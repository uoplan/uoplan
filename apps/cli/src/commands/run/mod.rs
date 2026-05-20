pub mod cart;
pub mod interactive;
pub mod sniper;

use anyhow::{anyhow, Result};
use cliclack::{intro, log, outro, outro_cancel, spinner};

use crate::api::cart::list_cart;
use crate::api::endpoints;
use crate::api::enrollment::{submit_cart_action, ACTION_ENROL};
use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::{NoCookiesError, NoTermSelectedError};

pub async fn run(payload: &str) -> Result<()> {
    intro("uoplan run")?;
    let decoded = cart::decode_payload(payload)?;

    let session = get_session().await.ok_or_else(|| anyhow!(NoCookiesError))?;
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
            outro("Courses added to cart.")?;
        }
        interactive::EnrolMode::Now => {
            let sp = spinner();
            sp.start("Loading cart…");
            let items = list_cart(&client, &cart_url).await?;
            sp.stop("Cart loaded");
            let bufnums: Vec<i64> = items.iter().map(|i| i.bufnum).collect();
            let sp = spinner();
            sp.start("Enrolling…");
            let result = submit_cart_action(&client, &cart_url, &bufnums, ACTION_ENROL).await?;
            sp.stop("Done");
            if result.errors.is_empty() {
                outro("Enrolled successfully.")?;
            } else {
                for e in &result.errors {
                    log::error(e)?;
                }
                outro_cancel("Enrolment completed with errors.")?;
            }
        }
        interactive::EnrolMode::Snipe => {
            let Some(target) = interactive::prompt_snipe_time()? else {
                return Ok(());
            };
            let sp = spinner();
            sp.start("Loading cart…");
            let items = list_cart(&client, &cart_url).await?;
            sp.stop("Cart loaded");
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
                outro("Sniped successfully!")?;
            } else {
                for e in &result.errors {
                    log::error(e)?;
                }
                outro_cancel("Snipe failed.")?;
            }
        }
    }
    Ok(())
}
