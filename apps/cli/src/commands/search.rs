use anyhow::{anyhow, Result};
use cliclack::{intro, log, outro, outro_cancel, select, spinner};
use regex::Regex;

use crate::api::endpoints;
use crate::api::search::{
    confirm_enrollment, is_companion_page, is_waitlist_page, parse_companion_page,
    parse_confirm_messages, parse_course_code, search_courses, select_section,
    submit_companion_selection,
};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::{NoCookiesError, NoTermSelectedError};

/// Strip trailing PeopleSoft session indicator from a section string.
/// e.g. "A00-LEC FullSess." → "A00-LEC", "B00-TUT 2ndHalf." → "B00-TUT"
fn strip_session(section: &str) -> &str {
    let re = Regex::new(r"\s+\S+\.\s*$").unwrap();
    if let Some(m) = re.find(section) {
        &section[..m.start()]
    } else {
        section
    }
}

pub async fn run(course_code: &str) -> Result<()> {
    intro("uoplan search")?;
    let session = get_session().await.ok_or_else(|| anyhow!(NoCookiesError))?;
    if session.strm.is_none() {
        return Err(anyhow!(NoTermSelectedError));
    }
    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;
    let parsed = parse_course_code(course_code)?;

    let sp = spinner();
    sp.start(&format!(
        "Searching for {} {}…",
        parsed.subject, parsed.catalog_nbr
    ));
    let (results, xml) =
        search_courses(&client, &cart_url, &parsed.subject, &parsed.catalog_nbr).await?;
    sp.clear();

    if results.is_empty() {
        outro_cancel("No sections found.")?;
        return Ok(());
    }

    let mut prompt = select(&format!(
        "Select a section for {} {}",
        parsed.subject, parsed.catalog_nbr
    ));
    for r in &results {
        let section = strip_session(&r.section);
        let label = [section, r.days.as_str()]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" — ");
        let hint = [r.instructor.as_str(), r.status.as_str()]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" · ");
        prompt = prompt.item(r.row_index, label, hint);
    }
    let row_index = match prompt.interact() {
        Ok(v) => v,
        Err(_) => {
            outro_cancel("Cancelled.")?;
            return Ok(());
        }
    };

    let sp = spinner();
    sp.start("Loading section details");
    let mut xml = select_section(&client, &cart_url, &xml, row_index).await?;
    sp.clear();

    let mut page_num: i64 = 0;
    while is_companion_page(&xml) && !is_waitlist_page(&xml) {
        let page = parse_companion_page(&xml);
        let chosen_idx = if page.options.is_empty() {
            0
        } else if page.options.len() == 1 {
            page.options[0].index
        } else {
            let prompt_text = if page.label.is_empty() {
                "Select accompanying section".to_string()
            } else {
                page.label.clone()
            };
            let mut companion = select(&prompt_text);
            for o in &page.options {
                let label = [o.section.as_str(), o.schedule.as_str(), o.room.as_str()]
                    .into_iter()
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(" — ");
                let hint = [o.instructor.as_str(), o.status.as_str()]
                    .into_iter()
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join(" · ");
                companion = companion.item(o.index, label, hint);
            }
            match companion.interact() {
                Ok(v) => v,
                Err(_) => {
                    outro_cancel("Cancelled.")?;
                    return Ok(());
                }
            }
        };

        let sp = spinner();
        sp.start("Confirming selection");
        xml = submit_companion_selection(&client, &cart_url, &xml, chosen_idx, page_num).await?;
        sp.clear();
        page_num += 1;
    }

    let sp = spinner();
    sp.start("Adding to cart…");
    let final_xml = confirm_enrollment(&client, &cart_url, &xml).await?;
    let (errors, notices) = parse_confirm_messages(&final_xml);

    if errors.is_empty() {
        let fallback = format!("{} {} added to cart.", parsed.subject, parsed.catalog_nbr);
        let msg = notices.first().map(|s| s.as_str()).unwrap_or(&fallback);
        sp.stop(msg);
        outro("")?;
    } else {
        sp.cancel("Failed");
        for e in &errors {
            log::error(&format!("error: {e}"))?;
        }
        outro_cancel("Completed with errors.")?;
    }
    Ok(())
}
