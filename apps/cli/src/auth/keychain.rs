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
    pub cart_url: Option<String>,
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

pub async fn set_term(strm: &str, term_index: i64, cart_url: Option<&str>) -> Result<()> {
    let Some(mut s) = get_session().await else {
        return Ok(());
    };
    s.strm = Some(strm.to_string());
    s.term_index = Some(term_index);
    if let Some(c) = cart_url {
        s.cart_url = Some(c.to_string());
    }
    set_session(&s).await
}

pub async fn delete_session() {
    if let Ok(entry) = Entry::new(SERVICE, ACCOUNT) {
        let _ = entry.delete_credential().await;
    }
}
