use anyhow::Result;

use crate::auth::browser::launch_browser_auth;
use crate::auth::{get_session, set_session};

pub async fn run() -> Result<()> {
    let new_session = launch_browser_auth().await?;
    let merged = if let Some(existing) = get_session() {
        crate::auth::StoredSession {
            cookies: new_session.cookies,
            saved_at: new_session.saved_at,
            strm: existing.strm,
            term_index: existing.term_index,
            cart_url: existing.cart_url,
        }
    } else {
        new_session
    };
    set_session(&merged)?;
    println!("Logged in successfully.");
    Ok(())
}
