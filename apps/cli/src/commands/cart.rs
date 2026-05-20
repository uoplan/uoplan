use anyhow::{anyhow, Result};
use indicatif::{ProgressBar, ProgressStyle};
use inquire::{MultiSelect, Select};
use owo_colors::OwoColorize;
use std::time::Duration;

use crate::api::cart::{add_to_cart, list_cart, CartItem};
use crate::api::endpoints;
use crate::api::enrollment::{submit_cart_action, ACTION_DELETE, ACTION_ENROL};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::NoCookiesError;

fn make_spinner(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_chars("⠁⠂⠄⡀⢀⠠⠐⠈ "),
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

fn cart_url_from_session() -> Result<(PeopleSoftClient, String)> {
    let session = get_session().ok_or_else(|| anyhow!(NoCookiesError))?;
    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;
    Ok((client, cart_url))
}

fn label_for(item: &CartItem) -> String {
    format!(
        "{} {} (#{}) {} — {}",
        item.course_code,
        item.section,
        item.class_number,
        item.units,
        item.instructors.join(", ")
    )
}

pub async fn interactive() -> Result<()> {
    let (client, cart_url) = cart_url_from_session()?;
    loop {
        let pb = make_spinner("Loading cart…");
        let items = list_cart(&client, &cart_url).await?;
        pb.finish_and_clear();

        if items.is_empty() {
            println!("Your cart is empty.");
            return Ok(());
        }

        let labels: Vec<String> = items.iter().map(label_for).collect();
        let selected = MultiSelect::new("Select courses", labels.clone()).prompt()?;
        if selected.is_empty() {
            return Ok(());
        }

        let action = Select::new("Action", vec!["Enrol", "Delete", "Cancel"]).prompt()?;
        if action == "Cancel" {
            return Ok(());
        }

        let bufnums: Vec<i64> = selected
            .iter()
            .filter_map(|s| labels.iter().position(|l| l == s).map(|i| items[i].bufnum))
            .collect();

        let action_code = match action {
            "Enrol" => ACTION_ENROL,
            "Delete" => ACTION_DELETE,
            _ => continue,
        };

        let pb = make_spinner("Submitting…");
        let result = submit_cart_action(&client, &cart_url, &bufnums, action_code).await?;
        pb.finish_and_clear();

        if result.errors.is_empty() {
            println!("{} {}", "✓".green(), "Success".bold());
        } else {
            for e in &result.errors {
                println!("{} {}", "✗".red(), e);
            }
        }
    }
}

pub async fn add(class_number: &str) -> Result<()> {
    let (client, cart_url) = cart_url_from_session()?;
    let pb = make_spinner(&format!("Adding class {} to cart…", class_number));
    add_to_cart(&client, &cart_url, class_number).await?;
    pb.finish_and_clear();
    println!("{} Added.", "✓".green());
    Ok(())
}

pub async fn enrol() -> Result<()> {
    let (client, cart_url) = cart_url_from_session()?;
    let pb = make_spinner("Loading cart…");
    let items = list_cart(&client, &cart_url).await?;
    pb.finish_and_clear();
    if items.is_empty() {
        println!("Your cart is empty.");
        return Ok(());
    }
    let labels: Vec<String> = items.iter().map(label_for).collect();
    let selected = MultiSelect::new("Select courses to enrol", labels.clone()).prompt()?;
    if selected.is_empty() {
        return Ok(());
    }
    let bufnums: Vec<i64> = selected
        .iter()
        .filter_map(|s| labels.iter().position(|l| l == s).map(|i| items[i].bufnum))
        .collect();
    let pb = make_spinner("Enrolling…");
    let result = submit_cart_action(&client, &cart_url, &bufnums, ACTION_ENROL).await?;
    pb.finish_and_clear();
    if result.errors.is_empty() {
        println!("{} {}", "✓".green(), "Success".bold());
    } else {
        for e in &result.errors {
            println!("{} {}", "✗".red(), e);
        }
    }
    Ok(())
}
