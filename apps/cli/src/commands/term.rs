use anyhow::{anyhow, Result};
use cliclack::{intro, log, outro, outro_cancel, select, spinner};

use crate::api::terms::{list_terms, select_term};
use crate::api::PeopleSoftClient;
use crate::auth::{get_session, set_term};
use crate::error::NoCookiesError;

async fn fetch_terms() -> Result<(PeopleSoftClient, Vec<crate::api::peoplesoft::Term>)> {
    let session = get_session().await.ok_or_else(|| anyhow!(NoCookiesError))?;
    let client = PeopleSoftClient::new(session)?;
    let sp = spinner();
    sp.start("Fetching available terms…");
    let terms = list_terms(&client).await?;
    sp.stop("Terms loaded");
    Ok((client, terms))
}

pub async fn interactive() -> Result<()> {
    intro("uoplan term")?;
    let (client, terms) = fetch_terms().await?;
    if terms.is_empty() {
        outro_cancel("No terms available.")?;
        return Ok(());
    }

    let mut prompt = select("Select a term");
    for t in &terms {
        prompt = prompt.item(t.index, &t.name, &t.career);
    }
    let idx = match prompt.interact() {
        Ok(v) => v,
        Err(_) => {
            outro_cancel("Cancelled.")?;
            return Ok(());
        }
    };

    let chosen = terms.iter().find(|t| t.index == idx).unwrap();
    let sp = spinner();
    sp.start("Selecting term…");
    let strm = select_term(&client, idx).await?;
    sp.stop("Term selected");
    set_term(&strm, idx, None).await?;
    outro(&format!("Selected {}", chosen.name))?;
    Ok(())
}

pub async fn list() -> Result<()> {
    let (_client, terms) = fetch_terms().await?;
    if terms.is_empty() {
        log::info("No terms available.")?;
        return Ok(());
    }
    for t in &terms {
        log::info(&format!("{} — {}", t.name, t.career))?;
    }
    Ok(())
}
