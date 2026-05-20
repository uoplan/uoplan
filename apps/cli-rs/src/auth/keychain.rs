use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

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

pub fn get_session() -> Option<StoredSession> {
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-a",
            ACCOUNT,
            "-s",
            SERVICE,
            "-w",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8(output.stdout).ok()?;
    let raw = raw.trim();
    serde_json::from_str(raw).ok()
}

pub fn set_session(session: &StoredSession) -> Result<()> {
    let json = serde_json::to_string(session)?;
    // delete existing (ignore error)
    let _ = Command::new("security")
        .args([
            "delete-generic-password",
            "-a",
            ACCOUNT,
            "-s",
            SERVICE,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    let status = Command::new("security")
        .args([
            "add-generic-password",
            "-a",
            ACCOUNT,
            "-s",
            SERVICE,
            "-w",
            &json,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()?;
    if !status.success() {
        return Err(anyhow!("Failed to store session in keychain"));
    }
    Ok(())
}

pub fn set_term(strm: &str, term_index: i64, cart_url: Option<&str>) -> Result<()> {
    let Some(mut s) = get_session() else {
        return Ok(());
    };
    s.strm = Some(strm.to_string());
    s.term_index = Some(term_index);
    if let Some(c) = cart_url {
        s.cart_url = Some(c.to_string());
    }
    set_session(&s)
}

pub fn delete_session() {
    let _ = Command::new("security")
        .args([
            "delete-generic-password",
            "-a",
            ACCOUNT,
            "-s",
            SERVICE,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}
