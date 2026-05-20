use anyhow::Result;
use cliclack::{intro, outro, spinner};

use crate::update::{check_for_update, do_update};

pub async fn run() -> Result<()> {
    intro("uoplan update")?;

    let mut sp = spinner();
    sp.start("Checking for updates...");

    let Some(version) = check_for_update().await else {
        sp.stop("Already up to date.");
        outro("No update available.")?;
        return Ok(());
    };

    sp.stop(format!("Found v{version}"));

    let mut sp = spinner();
    sp.start(format!("Downloading v{version}..."));

    do_update(&version).await?;

    sp.stop("Done.");
    outro(format!("Updated to v{version}."))?;
    Ok(())
}
