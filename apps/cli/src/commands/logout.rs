use anyhow::Result;
use cliclack::{intro, outro};

use crate::auth::delete_session;

pub async fn run() -> Result<()> {
    intro("uoplan logout")?;
    delete_session().await;
    outro("Logged out.")?;
    Ok(())
}
