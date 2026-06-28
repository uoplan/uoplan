use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

const REPO_OWNER: &str = "uoplan";
const REPO_NAME: &str = "uoplan";
const CHECK_INTERVAL_SECS: u64 = 3600;
// Must match the CLI release tag scheme owned by release-please
// (`tag-name: "uoplan-v${version}"` for the `apps/cli` package in
// release-please-config.json; cli-release.yml also triggers on `uoplan-v*`).
const TAG_PREFIX: &str = "uoplan-v";

#[derive(Serialize, Deserialize)]
pub struct UpdateCache {
    pub last_checked: u64,
    pub latest_version: String,
}

fn cache_path() -> Option<std::path::PathBuf> {
    dirs::cache_dir().map(|d| d.join("uoplan").join("update_check.json"))
}

fn read_cache() -> Option<UpdateCache> {
    let path = cache_path()?;
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_cache(cache: &UpdateCache) {
    let Some(path) = cache_path() else { return };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, serde_json::to_string(cache).unwrap_or_default());
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn parse_version(v: &str) -> Option<(u32, u32, u32)> {
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((parts[0].parse().ok()?, parts[1].parse().ok()?, parts[2].parse().ok()?))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

fn version_from_tag(tag: &str) -> Option<&str> {
    let version = tag.strip_prefix(TAG_PREFIX)?;
    parse_version(version)?;
    Some(version)
}

pub fn is_cache_fresh(cache: &UpdateCache, now: u64) -> bool {
    now.saturating_sub(cache.last_checked) < CHECK_INTERVAL_SECS
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
}

pub async fn check_for_update() -> Option<String> {
    let now = now_secs();
    let current = env!("CARGO_PKG_VERSION");

    if let Some(cache) = read_cache() {
        if is_cache_fresh(&cache, now) {
            return if is_newer(&cache.latest_version, current) {
                Some(cache.latest_version)
            } else {
                None
            };
        }
    }

    let url = format!("https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases");
    let client = reqwest::Client::builder()
        .user_agent(concat!("uoplan-cli/", env!("CARGO_PKG_VERSION")))
        .build()
        .ok()?;
    let releases: Vec<GithubRelease> = client.get(&url).send().await.ok()?.json().await.ok()?;

    let latest_version = releases
        .iter()
        .find_map(|r| version_from_tag(&r.tag_name).map(str::to_owned))?;

    write_cache(&UpdateCache {
        last_checked: now,
        latest_version: latest_version.clone(),
    });

    if is_newer(&latest_version, current) {
        Some(latest_version)
    } else {
        None
    }
}

pub async fn do_update(version: &str) -> Result<()> {
    let tag = format!("{TAG_PREFIX}{version}");
    tokio::task::spawn_blocking(move || {
        self_update::backends::github::Update::configure()
            .repo_owner(REPO_OWNER)
            .repo_name(REPO_NAME)
            .target(self_update::get_target())
            .bin_name("uoplan")
            .show_output(false)
            .no_confirm(true)
            .current_version(env!("CARGO_PKG_VERSION"))
            .target_version_tag(&tag)
            .build()?
            .update()?;
        Ok::<_, anyhow::Error>(())
    })
    .await??;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_versions() {
        assert_eq!(parse_version("1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("0.1.0"), Some((0, 1, 0)));
        assert_eq!(parse_version("10.0.100"), Some((10, 0, 100)));
    }

    #[test]
    fn version_from_release_please_tag() {
        // release-please tags CLI releases as `uoplan-v${version}`.
        assert_eq!(version_from_tag("uoplan-v1.0.0"), Some("1.0.0"));
        assert_eq!(version_from_tag("uoplan-v0.4.2"), Some("0.4.2"));
        // The legacy `cli/v` scheme and the root app's tags must be ignored.
        assert_eq!(version_from_tag("cli/v0.2.0"), None);
        assert_eq!(version_from_tag("uoplan-monorepo-v1.0.0-beta.37"), None);
        assert_eq!(version_from_tag("uoplan-vabc"), None);
    }

    #[test]
    fn parse_invalid_versions() {
        assert_eq!(parse_version("1.2"), None);
        assert_eq!(parse_version("abc"), None);
        assert_eq!(parse_version(""), None);
        assert_eq!(parse_version("1.2.3.4"), None);
    }

    #[test]
    fn newer_version_detected() {
        assert!(is_newer("0.2.0", "0.1.0"));
        assert!(is_newer("1.0.0", "0.9.9"));
        assert!(is_newer("0.1.1", "0.1.0"));
    }

    #[test]
    fn same_or_older_not_newer() {
        assert!(!is_newer("0.1.0", "0.1.0"));
        assert!(!is_newer("0.1.0", "0.2.0"));
        assert!(!is_newer("0.9.9", "1.0.0"));
    }

    #[test]
    fn cache_fresh_within_hour() {
        let now = 7200u64;
        let cache = UpdateCache {
            last_checked: 7200 - 1800,
            latest_version: "0.2.0".to_owned(),
        };
        assert!(is_cache_fresh(&cache, now));
    }

    #[test]
    fn cache_stale_after_hour() {
        let now = 7200u64;
        let cache = UpdateCache {
            last_checked: 7200 - 3601,
            latest_version: "0.2.0".to_owned(),
        };
        assert!(!is_cache_fresh(&cache, now));
    }
}
