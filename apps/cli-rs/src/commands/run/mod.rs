pub mod cart;
pub mod interactive;
pub mod sniper;

use anyhow::{anyhow, Result};
use indicatif::{ProgressBar, ProgressStyle};
use owo_colors::OwoColorize;
use std::time::Duration;

use crate::api::cart::list_cart;
use crate::api::endpoints;
use crate::api::enrollment::{submit_cart_action, ACTION_ENROL};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::{NoCookiesError, NoTermSelectedError};

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

pub async fn run(payload: &str) -> Result<()> {
    let decoded = cart::decode_payload(payload)?;

    let session = get_session().ok_or_else(|| anyhow!(NoCookiesError))?;
    if session.strm.is_none() {
        return Err(anyhow!(NoTermSelectedError));
    }
    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;

    let Some(selected_courses) = interactive::prompt_course_selection(&decoded.courses)? else {
        return Ok(());
    };

    cart::add_courses_to_cart(&client, &cart_url, &selected_courses).await?;

    let Some(mode) = interactive::prompt_enrol_mode()? else {
        return Ok(());
    };

    match mode {
        interactive::EnrolMode::Cart => {
            println!("{} Courses added to cart.", "✓".green());
        }
        interactive::EnrolMode::Now => {
            let pb = make_spinner("Loading cart…");
            let items = list_cart(&client, &cart_url).await?;
            pb.finish_and_clear();
            let bufnums: Vec<i64> = items.iter().map(|i| i.bufnum).collect();
            let pb = make_spinner("Enrolling…");
            let result = submit_cart_action(&client, &cart_url, &bufnums, ACTION_ENROL).await?;
            pb.finish_and_clear();
            if result.errors.is_empty() {
                println!("{} {}", "✓".green(), "Enrolled".bold());
            } else {
                for e in &result.errors {
                    println!("{} {}", "✗".red(), e);
                }
            }
        }
        interactive::EnrolMode::Snipe => {
            let Some(target) = interactive::prompt_snipe_time()? else {
                return Ok(());
            };
            let pb = make_spinner("Loading cart…");
            let items = list_cart(&client, &cart_url).await?;
            pb.finish_and_clear();
            let bufnums: Vec<i64> = items.iter().map(|i| i.bufnum).collect();
            let result = sniper::snipe(
                &client,
                &cart_url,
                &bufnums,
                target.timestamp_millis(),
                5_000,
                500,
                120_000,
            )
            .await?;
            if result.success {
                println!("{} {}", "✓".green(), "Sniped successfully!".bold());
            } else {
                for e in &result.errors {
                    println!("{} {}", "✗".red(), e);
                }
            }
        }
    }
    Ok(())
}
