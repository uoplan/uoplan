use anyhow::Result;

use crate::auth::delete_session;

pub async fn run() -> Result<()> {
    delete_session();
    println!("Logged out.");
    Ok(())
}
