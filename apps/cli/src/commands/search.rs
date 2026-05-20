use anyhow::{anyhow, Result};
use cliclack::{intro, log, outro, outro_cancel, select, spinner};

use crate::api::endpoints;
use crate::api::search::{
    confirm_enrollment, is_companion_page, is_waitlist_page, parse_companion_page,
    parse_confirm_messages, parse_course_code, search_courses, select_section,
    submit_companion_selection,
};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::{NoCookiesError, NoTermSelectedError};

pub async fn run(course_code: &str) -> Result<()> {
    intro("uoplan search")?;
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

    let sp = spinner();
    sp.start(&format!(
        "Searching for {} {}…",
        parsed.subject, parsed.catalog_nbr
    ));
    let (results, xml) =
        search_courses(&client, &cart_url, &parsed.subject, &parsed.catalog_nbr).await?;
    sp.stop("Search complete");

    if results.is_empty() {
        outro_cancel("No sections found.")?;
        return Ok(());
    }

    let mut prompt = select("Select a section");
    for r in &results {
        let label = format!("{} ({})", r.section, r.class_nbr);
        let hint = format!("{} — {} — {} [{}]", r.days, r.room, r.instructor, r.status);
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
    sp.start("Selecting section…");
    let mut xml = select_section(&client, &cart_url, &xml, row_index).await?;
    sp.stop("Section selected");

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
                let hint = format!(
                    "{} — {} — {} [{}]",
                    o.schedule, o.room, o.instructor, o.status
                );
                companion = companion.item(o.index, o.section.clone(), hint);
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
        sp.start("Submitting selection…");
        xml = submit_companion_selection(&client, &cart_url, &xml, chosen_idx, page_num).await?;
        sp.stop("Done");
        page_num += 1;
    }

    let sp = spinner();
    sp.start("Confirming enrolment…");
    let final_xml = confirm_enrollment(&client, &cart_url, &xml).await?;
    sp.stop("Done");

    let (errors, notices) = parse_confirm_messages(&final_xml);
    for n in &notices {
        log::success(n)?;
    }
    for e in &errors {
        log::error(e)?;
    }
    if errors.is_empty() {
        outro("Enrolled successfully.")?;
    } else {
        outro_cancel("Enrolment completed with errors.")?;
    }
    Ok(())
}
