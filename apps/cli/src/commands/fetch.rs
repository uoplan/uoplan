use anyhow::{anyhow, Result};

use crate::api::PeopleSoftClient;
use crate::auth::get_session;
use crate::error::NoCookiesError;

pub async fn run(url: &str) -> Result<()> {
    let session = get_session().ok_or_else(|| anyhow!(NoCookiesError))?;
    let client = PeopleSoftClient::new(session)?;
    let body = client.get(url).await?;
    println!("{}", body);
    Ok(())
}
