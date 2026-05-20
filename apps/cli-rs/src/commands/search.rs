use anyhow::{anyhow, Result};
use indicatif::{ProgressBar, ProgressStyle};
use inquire::Select;
use owo_colors::OwoColorize;
use std::time::Duration;

use crate::api::endpoints;
use crate::api::search::{
    confirm_enrollment, is_companion_page, is_waitlist_page, parse_companion_page,
    parse_confirm_messages, parse_course_code, search_courses, select_section,
    submit_companion_selection,
};
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

pub async fn run(course_code: &str) -> Result<()> {
    let session = get_session().ok_or_else(|| anyhow!(NoCookiesError))?;
    if session.strm.is_none() {
        return Err(anyhow!(NoTermSelectedError));
    }
    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;

    let parsed = parse_course_code(course_code)?;

    let pb = make_spinner(&format!(
        "Searching for {} {}…",
        parsed.subject, parsed.catalog_nbr
    ));
    let (results, xml) =
        search_courses(&client, &cart_url, &parsed.subject, &parsed.catalog_nbr).await?;
    pb.finish_and_clear();

    if results.is_empty() {
        println!("No sections found.");
        return Ok(());
    }

    let labels: Vec<String> = results
        .iter()
        .map(|r| {
            format!(
                "{} ({}) — {} — {} — {} — [{}]",
                r.section, r.class_nbr, r.days, r.room, r.instructor, r.status
            )
        })
        .collect();
    let choice = Select::new("Select a section", labels.clone()).prompt()?;
    let idx = labels.iter().position(|s| s == &choice).unwrap_or(0);
    let chosen = &results[idx];

    let pb = make_spinner("Selecting section…");
    let mut xml = select_section(&client, &cart_url, &xml, chosen.row_index).await?;
    pb.finish_and_clear();

    let mut page_num: i64 = 0;
    while is_companion_page(&xml) && !is_waitlist_page(&xml) {
        let page = parse_companion_page(&xml);
        let chosen_idx = if page.options.is_empty() {
            0
        } else if page.options.len() == 1 {
            page.options[0].index
        } else {
            let opt_labels: Vec<String> = page
                .options
                .iter()
                .map(|o| {
                    format!(
                        "{} — {} — {} — {} — [{}]",
                        o.section, o.schedule, o.room, o.instructor, o.status
                    )
                })
                .collect();
            let prompt = if page.label.is_empty() {
                "Select accompanying section".to_string()
            } else {
                page.label.clone()
            };
            let choice = Select::new(&prompt, opt_labels.clone()).prompt()?;
            let i = opt_labels.iter().position(|s| s == &choice).unwrap_or(0);
            page.options[i].index
        };
        let pb = make_spinner("Submitting selection…");
        xml = submit_companion_selection(&client, &cart_url, &xml, chosen_idx, page_num).await?;
        pb.finish_and_clear();
        page_num += 1;
    }

    let pb = make_spinner("Confirming…");
    let final_xml = confirm_enrollment(&client, &cart_url, &xml).await?;
    pb.finish_and_clear();
    let (errors, notices) = parse_confirm_messages(&final_xml);
    for n in &notices {
        println!("{} {}", "✓".green(), n);
    }
    for e in &errors {
        println!("{} {}", "✗".red(), e);
    }
    Ok(())
}
