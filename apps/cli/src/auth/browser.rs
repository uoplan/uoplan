use anyhow::{anyhow, Result};
use chromiumoxide::{Browser, BrowserConfig};
use futures::StreamExt;
use std::time::Duration;

use super::keychain::{SessionCookie, StoredSession};

const PEOPLESOFT_URL: &str = "https://www.uocampus.uottawa.ca/psp/csprpr9www/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL?languageCd=ENG";

pub async fn launch_browser_auth() -> Result<StoredSession> {
    let session_dir = std::env::temp_dir().join("uoplan-session");
    let _ = std::fs::remove_dir_all(&session_dir);

    let config = BrowserConfig::builder()
        .user_data_dir(&session_dir)
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-sync")
        .arg("--disable-background-networking")
        .arg("--disable-background-timer-throttling")
        .arg("--disable-backgrounding-occluded-windows")
        .arg("--disable-breakpad")
        .arg("--disable-client-side-phishing-detection")
        .arg("--disable-component-extensions-with-background-pages")
        .arg("--disable-default-apps")
        .arg("--disable-dev-shm-usage")
        .arg("--disable-hang-monitor")
        .arg("--disable-ipc-flooding-protection")
        .arg("--disable-prompt-on-repost")
        .arg("--disable-renderer-backgrounding")
        .arg("--metrics-recording-only")
        .arg("--password-store=basic")
        .arg("--use-mock-keychain")
        .viewport(None)
        .launch_timeout(Duration::from_secs(30))
        .disable_default_args()
        .with_head()
        .build()
        .map_err(|e| anyhow!("Failed to build browser config: {e}. Make sure Chrome, Chromium, or Edge is installed."))?;

    let (mut browser, mut handler) = Browser::launch(config).await?;
    let handler_task = tokio::spawn(async move {
        loop {
            if handler.next().await.is_none() {
                break;
            }
        }
    });

    let page = loop {
        let pages = browser.pages().await?;
        if let Some(p) = pages.into_iter().next() {
            p.goto(PEOPLESOFT_URL).await?;
            break p;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    };
    cliclack::log::info("Chrome opened — log in with your uOttawa account.")?;

    let result = tokio::time::timeout(Duration::from_secs(300), async {
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if let Ok(Some(url)) = page.url().await {
                if url.starts_with("https://www.uocampus.uottawa.ca/psp/")
                    && !url.contains("login.microsoftonline.com")
                {
                    break;
                }
            }
        }
        Ok::<(), anyhow::Error>(())
    })
    .await;

    if result.is_err() {
        let _ = browser.close().await;
        handler_task.abort();
        return Err(anyhow!("Login timed out after 5 minutes."));
    }

    let cookies = page.get_cookies().await?;
    let session_cookies: Vec<SessionCookie> = cookies
        .into_iter()
        .map(|c| SessionCookie {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expires,
            http_only: c.http_only,
            secure: c.secure,
        })
        .collect();

    let _ = browser.close().await;
    handler_task.abort();

    let saved_at = chrono::Utc::now().timestamp_millis();

    Ok(StoredSession {
        cookies: session_cookies,
        saved_at,
        strm: None,
        term_index: None,
        cart_url: None,
    })
}
