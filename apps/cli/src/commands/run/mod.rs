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
use crate::proto::{CourseSelection, SchedulePayload};

struct RunContext {
    client: PeopleSoftClient,
    cart_url: String,
}

pub async fn run(payload: &str) -> Result<()> {
    intro("uoplan run")?;
    let (decoded, ctx) = prepare_run(payload).await?;

    let Some(selected_courses) = prompt_courses(&decoded.courses)? else {
        return Ok(());
    };
    cart::add_courses_to_cart(&ctx.client, &ctx.cart_url, &selected_courses).await?;

    let Some(mode) = interactive::prompt_enrol_mode()? else {
        return Ok(());
    };

    handle_enrol_mode(&ctx, mode).await
}

async fn prepare_run(payload: &str) -> Result<(SchedulePayload, RunContext)> {
    let decoded = cart::decode_payload(payload)?;
    let session = get_session().await.ok_or_else(|| anyhow!(NoCookiesError))?;
    if session.strm.is_none() {
        return Err(anyhow!(NoTermSelectedError));
    }

    log::info(format!("Term: {}", session.term_label()))?;

    let cart_url = session
        .cart_url
        .clone()
        .unwrap_or_else(endpoints::enroll_cart);
    let client = PeopleSoftClient::new(session)?;
    Ok((decoded, RunContext { client, cart_url }))
}

fn prompt_courses(courses: &[CourseSelection]) -> Result<Option<Vec<CourseSelection>>> {
    interactive::prompt_course_selection(courses)
}

async fn handle_enrol_mode(ctx: &RunContext, mode: interactive::EnrolMode) -> Result<()> {
    match mode {
        interactive::EnrolMode::Cart => {
            outro("Courses added to cart.")?;
        }
        interactive::EnrolMode::Now => {
            submit_now(ctx).await?;
        }
        interactive::EnrolMode::Snipe => {
            let Some(target) = interactive::prompt_snipe_time()? else {
                return Ok(());
            };
            submit_snipe(ctx, target.timestamp_millis()).await?;
        }
    }
    Ok(())
}

async fn cart_bufnums(ctx: &RunContext) -> Result<Vec<i64>> {
    let sp = spinner();
    sp.start("Loading cart…");
    let items = list_cart(&ctx.client, &ctx.cart_url).await?;
    sp.clear();
    Ok(items.iter().map(|i| i.bufnum).collect())
}

async fn submit_now(ctx: &RunContext) -> Result<()> {
    let bufnums = cart_bufnums(ctx).await?;
    let sp = spinner();
    sp.start("Enrolling…");
    let result = submit_cart_action(&ctx.client, &ctx.cart_url, &bufnums, ACTION_ENROL).await?;
    sp.clear();
    if result.errors.is_empty() {
        outro("Enrolled successfully.")?;
    } else {
        report_errors(&result.errors)?;
        outro_cancel("Enrolment completed with errors.")?;
    }
    Ok(())
}

async fn submit_snipe(ctx: &RunContext, target_ms: i64) -> Result<()> {
    let bufnums = cart_bufnums(ctx).await?;
    let result = sniper::snipe(
        &ctx.client,
        &ctx.cart_url,
        &bufnums,
        target_ms,
        5_000,
        500,
        120_000,
    )
    .await?;
    if result.success {
        outro("Sniped successfully!")?;
    } else {
        report_errors(&result.errors)?;
        outro_cancel("Snipe failed.")?;
    }
    Ok(())
}

fn report_errors(errors: &[String]) -> Result<()> {
    for e in errors {
        log::error(e)?;
    }
    Ok(())
}
