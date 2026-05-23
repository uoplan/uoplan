use anyhow::Result;
use cliclack::{intro, outro};

use crate::auth::browser::launch_browser_auth;
use crate::auth::{get_session, set_session};

pub async fn run() -> Result<()> {
    intro("uoplan login")?;
    let new_session = launch_browser_auth().await?;
    let merged = if let Some(existing) = get_session().await {
        crate::auth::StoredSession {
            cookies: new_session.cookies,
            saved_at: new_session.saved_at,
            strm: existing.strm,
            term_index: existing.term_index,
            term_name: existing.term_name,
            cart_url: existing.cart_url,
        }
    } else {
        new_session
    };
    set_session(&merged).await?;
    outro("Logged in successfully.")?;
    Ok(())
}
