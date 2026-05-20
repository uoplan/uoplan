use anyhow::{anyhow, Result};
use indicatif::{ProgressBar, ProgressStyle};
use inquire::Select;
use owo_colors::OwoColorize;
use std::time::Duration;

use crate::api::terms::{list_terms, select_term};
use crate::api::PeopleSoftClient;
use crate::auth::{get_session, set_term};
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

async fn fetch_terms() -> Result<(PeopleSoftClient, Vec<crate::api::peoplesoft::Term>)> {
    let session = get_session().ok_or_else(|| anyhow!(NoCookiesError))?;
    let client = PeopleSoftClient::new(session)?;
    let pb = make_spinner("Fetching available terms…");
    let terms = list_terms(&client).await?;
    pb.finish_and_clear();
    Ok((client, terms))
}

pub async fn interactive() -> Result<()> {
    let (client, terms) = fetch_terms().await?;
    if terms.is_empty() {
        println!("No terms available.");
        return Ok(());
    }
    let labels: Vec<String> = terms
        .iter()
        .map(|t| format!("{} — {}", t.name, t.career))
        .collect();
    let choice = Select::new("Select a term", labels.clone()).prompt()?;
    let idx = labels.iter().position(|s| s == &choice).unwrap_or(0);
    let chosen = &terms[idx];
    let pb = make_spinner("Selecting term…");
    let strm = select_term(&client, chosen.index).await?;
    pb.finish_and_clear();
    set_term(&strm, chosen.index, None)?;
    println!("{} {}", "Selected".green(), chosen.name);
    Ok(())
}

pub async fn list() -> Result<()> {
    let (_client, terms) = fetch_terms().await?;
    if terms.is_empty() {
        println!("No terms available.");
        return Ok(());
    }
    for t in &terms {
        println!("{} — {}", t.name.bold(), t.career.dimmed());
    }
    Ok(())
}
