use anyhow::{anyhow, Result};
use std::time::Duration;
use thirtyfour::{
    common::capabilities::firefox::FirefoxPreferences, prelude::*,
};

use super::keychain::{SessionCookie, StoredSession};

const PEOPLESOFT_URL: &str = "https://www.uocampus.uottawa.ca/psp/csprpr9www/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL?languageCd=ENG";

pub async fn launch_browser_auth() -> Result<StoredSession> {
    let driver = match try_chrome().await {
        Ok(d) => d,
        Err(_) => try_firefox().await.map_err(|_| {
            anyhow!("No supported browser found. Install Chrome, Edge, or Firefox.")
        })?,
    };

    run_auth_flow(driver).await
}

async fn try_chrome() -> WebDriverResult<WebDriver> {
    let mut caps = DesiredCapabilities::chrome();
    caps.add_exclude_switch("enable-automation")?;
    caps.add_experimental_option("useAutomationExtension", false)?;
    caps.add_arg("--disable-blink-features=AutomationControlled")?;
    WebDriver::managed(caps).await
}

async fn try_firefox() -> WebDriverResult<WebDriver> {
    let mut caps = DesiredCapabilities::firefox();
    let mut prefs = FirefoxPreferences::new();
    prefs.set("dom.webdriver.enabled", false)?;
    caps.set_preferences(prefs)?;
    WebDriver::managed(caps).await
}

async fn run_auth_flow(driver: WebDriver) -> Result<StoredSession> {
    driver.goto(PEOPLESOFT_URL).await?;
    cliclack::log::info("Browser opened — log in with your uOttawa account.")?;

    let result = tokio::time::timeout(Duration::from_secs(300), async {
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if let Ok(url) = driver.current_url().await {
                let s = url.as_str();
                if s.starts_with("https://www.uocampus.uottawa.ca/psp/")
                    && !s.contains("login.microsoftonline.com")
                {
                    break;
                }
            }
        }
    })
    .await;

    if result.is_err() {
        let _ = driver.quit().await;
        return Err(anyhow!("Login timed out after 5 minutes."));
    }

    let cookies = driver.get_all_cookies().await?;
    let _ = driver.quit().await;

    let session_cookies = cookies
        .into_iter()
        .map(|c| SessionCookie {
            name: c.name.clone(),
            value: c.value.clone(),
            domain: c.domain.clone().unwrap_or_default(),
            path: c.path.clone().unwrap_or_default(),
            #[allow(clippy::cast_precision_loss)]
            expires: c.expiry.map_or(-1.0, |e| e as f64),
            http_only: false,
            secure: c.secure.unwrap_or(false),
        })
        .collect();

    Ok(StoredSession {
        cookies: session_cookies,
        saved_at: chrono::Utc::now().timestamp_millis(),
        strm: None,
        term_index: None,
        cart_url: None,
    })
}
