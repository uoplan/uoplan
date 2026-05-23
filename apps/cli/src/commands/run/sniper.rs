use anyhow::Result;
use chrono::Utc;
use cliclack::{progress_bar, spinner};
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
    let wait_until = target_ms - lead_ms;

    if wait_until > now {
        #[allow(clippy::cast_sign_loss)]
        let total_ms = (wait_until - now) as u64;
        let pb = progress_bar(total_ms)
            .with_template("{msg} [{bar:30.magenta}] {eta}");
        pb.start("Waiting for snipe window…");
        let tick = 250u64;
        let mut elapsed = 0u64;
        while elapsed < total_ms {
            tokio::time::sleep(Duration::from_millis(tick)).await;
            elapsed += tick;
            pb.set_position(elapsed.min(total_ms));
        }
        pb.stop("Snipe window open");
    }

    let sp = spinner();
    sp.start("Firing enrol…");
    let deadline = target_ms + timeout_after_ms;
    let last_errors = loop {
        let result = submit_cart_action(client, cart_url, bufnums, ACTION_ENROL).await?;
        if result.errors.is_empty() {
            sp.clear();
            return Ok(SnipeResult {
                success: true,
                errors: Vec::new(),
            });
        }
        if Utc::now().timestamp_millis() >= deadline {
            break result.errors;
        }
        tokio::time::sleep(Duration::from_millis(retry_interval_ms)).await;
    };
    sp.cancel("Snipe window closed");
    Ok(SnipeResult {
        success: false,
        errors: last_errors,
    })
}
