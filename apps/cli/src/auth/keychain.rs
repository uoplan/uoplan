use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use uv_keyring::Entry;

const SERVICE: &str = "uoplan";
const ACCOUNT: &str = "session";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCookie {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub expires: f64,
    pub http_only: bool,
    pub secure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSession {
    pub cookies: Vec<SessionCookie>,
    pub saved_at: i64,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub strm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub term_index: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub term_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cart_url: Option<String>,
}

impl StoredSession {
    pub fn term_label(&self) -> String {
        self.term_name
            .as_deref()
            .map(|n| {
                self.strm
                    .as_deref()
                    .map_or_else(|| n.to_owned(), |s| format!("{n} (STRM {s})"))
            })
            .or_else(|| self.strm.as_deref().map(|s| format!("STRM {s}")))
            .unwrap_or_else(|| "unknown".to_owned())
    }
}

pub async fn get_session() -> Option<StoredSession> {
    let entry = Entry::new(SERVICE, ACCOUNT).ok()?;
    let raw = entry.get_password().await.ok()?;
    serde_json::from_str(&raw).ok()
}

pub async fn set_session(session: &StoredSession) -> Result<()> {
    let json = serde_json::to_string(session)?;
    let entry =
        Entry::new(SERVICE, ACCOUNT).map_err(|e| anyhow!("Failed to access keychain: {e}"))?;
    entry
        .set_password(&json)
        .await
        .map_err(|e| anyhow!("Failed to store session in keychain: {e}"))
}

pub async fn set_term(
    strm: &str,
    term_index: i64,
    term_name: Option<&str>,
    cart_url: Option<&str>,
) -> Result<()> {
    let Some(mut s) = get_session().await else {
        return Ok(());
    };
    s.strm = Some(strm.to_string());
    s.term_index = Some(term_index);
    if let Some(n) = term_name {
        s.term_name = Some(n.to_string());
    }
    // Clear stale cart_url whenever the term changes so the next request
    // picks up a fresh one rather than one belonging to the previous term.
    s.cart_url = cart_url.map(str::to_string);
    set_session(&s).await
}

pub async fn delete_session() {
    if let Ok(entry) = Entry::new(SERVICE, ACCOUNT) {
        let _ = entry.delete_credential().await;
    }
}
