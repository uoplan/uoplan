use anyhow::Result;
use chrono::Utc;
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;

use crate::api::enrollment::{submit_cart_action, ACTION_ENROL};
use crate::api::PeopleSoftClient;

pub struct SnipeResult {
    pub success: bool,
    pub errors: Vec<String>,
}

pub async fn snipe(
    client: &PeopleSoftClient,
    cart_url: &str,
    bufnums: &[i64],
    target_ms: i64,
    lead_ms: i64,
    retry_interval_ms: u64,
    timeout_after_ms: i64,
) -> Result<SnipeResult> {
    let now = Utc::now().timestamp_millis();
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_chars("⠁⠂⠄⡀⢀⠠⠐⠈ "),
    );
    pb.enable_steady_tick(Duration::from_millis(100));

    let wait_until = target_ms - lead_ms;
    if wait_until > now {
        let dur = (wait_until - now) as u64;
        pb.set_message(format!("Waiting {} ms until snipe window…", dur));
        tokio::time::sleep(Duration::from_millis(dur)).await;
    }

    let deadline = target_ms + timeout_after_ms;
    let mut last_errors: Vec<String> = Vec::new();
    loop {
        pb.set_message("Firing enrol…");
        let result = submit_cart_action(client, cart_url, bufnums, ACTION_ENROL).await?;
        if result.errors.is_empty() {
            pb.finish_and_clear();
            return Ok(SnipeResult {
                success: true,
                errors: Vec::new(),
            });
        }
        last_errors = result.errors;
        let now = Utc::now().timestamp_millis();
        if now >= deadline {
            break;
        }
        tokio::time::sleep(Duration::from_millis(retry_interval_ms)).await;
    }
    pb.finish_and_clear();
    Ok(SnipeResult {
        success: false,
        errors: last_errors,
    })
}
