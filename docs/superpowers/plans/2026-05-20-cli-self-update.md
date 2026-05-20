# CLI Self-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passive update-available notices on every command run and an `uoplan update` subcommand that downloads and atomically swaps the binary from GitHub Releases.

**Architecture:** A new `update.rs` module handles version checking against the GitHub Releases API (filtering for `cli/v*` tags), caches results for 1 hour in a platform cache dir, and delegates the actual binary swap to the `self_update` crate. The passive check runs as a `tokio::spawn` task so it never blocks the active command; the update notice is printed after the command completes.

**Tech Stack:** Rust, `self_update` 0.42 (binary swap), `dirs` 5 (platform cache path), `reqwest` (already present, used for the version check API call), `serde_json` (already present, used for the cache file), `cliclack` (already present, used for spinner/output in the update command).

---

## File Map

| Action | Path                              | Responsibility                                                     |
| ------ | --------------------------------- | ------------------------------------------------------------------ |
| Modify | `apps/cli/Cargo.toml`             | Add `self_update` and `dirs` dependencies                          |
| Create | `apps/cli/src/update.rs`          | Cache I/O, version comparison, `check_for_update()`, `do_update()` |
| Create | `apps/cli/src/commands/update.rs` | `uoplan update` subcommand handler                                 |
| Modify | `apps/cli/src/commands/mod.rs`    | Expose `pub mod update`                                            |
| Modify | `apps/cli/src/main.rs`            | Add `Update` variant to `Cmd`, wire passive check                  |

---

## Task 1: Add dependencies

**Files:**

- Modify: `apps/cli/Cargo.toml`

- [ ] **Step 1: Add `self_update` and `dirs` to `[dependencies]`**

In `apps/cli/Cargo.toml`, after the `uv-keyring` line:

```toml
self_update = { version = "0.42", default-features = false, features = [
  "rustls",
  "archive-tar",
  "archive-zip",
  "compression-flate2",
  "compression-zip-deflate",
] }
dirs = "5"
```

- [ ] **Step 2: Verify the project still compiles**

```bash
cargo check --manifest-path apps/cli/Cargo.toml
```

Expected: no errors (warnings about unused deps are fine at this stage).

- [ ] **Step 3: Commit**

```bash
git add apps/cli/Cargo.toml apps/cli/Cargo.lock
git commit -m "chore(cli): add self_update and dirs dependencies"
```

---

## Task 2: Implement `update.rs` — cache and version check

**Files:**

- Create: `apps/cli/src/update.rs`

- [ ] **Step 1: Write tests for version parsing and cache freshness**

Create `apps/cli/src/update.rs` with the following test module at the bottom (the functions under test will be added next):

```rust
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
            last_checked: 7200 - 1800, // 30 min ago
            latest_version: "0.2.0".to_owned(),
        };
        assert!(is_cache_fresh(&cache, now));
    }

    #[test]
    fn cache_stale_after_hour() {
        let now = 7200u64;
        let cache = UpdateCache {
            last_checked: 7200 - 3601, // just over 1 hour ago
            latest_version: "0.2.0".to_owned(),
        };
        assert!(!is_cache_fresh(&cache, now));
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cargo test --manifest-path apps/cli/Cargo.toml
```

Expected: compilation error — `parse_version`, `is_newer`, `UpdateCache`, `is_cache_fresh` are not defined yet.

- [ ] **Step 3: Implement the module**

Replace the contents of `apps/cli/src/update.rs` with:

```rust
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

const REPO_OWNER: &str = "uoplan";
const REPO_NAME: &str = "uoplan";
const CHECK_INTERVAL_SECS: u64 = 3600;

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

    let url = format!(
        "https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases"
    );
    let client = reqwest::Client::builder()
        .user_agent(concat!("uoplan-cli/", env!("CARGO_PKG_VERSION")))
        .build()
        .ok()?;
    let releases: Vec<GithubRelease> = client.get(&url).send().await.ok()?.json().await.ok()?;

    let latest_version = releases
        .iter()
        .filter_map(|r| r.tag_name.strip_prefix("cli/v"))
        .find(|v| parse_version(v).is_some())
        .map(str::to_owned)?;

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
    let tag = format!("cli/v{version}");
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
```

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path apps/cli/Cargo.toml
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/update.rs
git commit -m "feat(cli): add update cache and version check logic"
```

---

## Task 3: Implement `commands/update.rs`

**Files:**

- Create: `apps/cli/src/commands/update.rs`
- Modify: `apps/cli/src/commands/mod.rs`

- [ ] **Step 1: Create the command handler**

Create `apps/cli/src/commands/update.rs`:

```rust
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
```

- [ ] **Step 2: Expose the module**

In `apps/cli/src/commands/mod.rs`, add:

```rust
pub mod update;
```

- [ ] **Step 3: Verify compile**

```bash
cargo check --manifest-path apps/cli/Cargo.toml
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/commands/update.rs apps/cli/src/commands/mod.rs
git commit -m "feat(cli): add update subcommand"
```

---

## Task 4: Wire up `main.rs`

**Files:**

- Modify: `apps/cli/src/main.rs`

- [ ] **Step 1: Add `mod update` and the `Update` variant**

In `apps/cli/src/main.rs`, add `mod update;` alongside the other module declarations at the top:

```rust
mod api;
mod auth;
mod commands;
mod error;
mod update;
```

Add `Update` to the `Cmd` enum:

```rust
/// Check for and install the latest version
Update,
```

- [ ] **Step 2: Rewrite `run()` with passive check and Update dispatch**

Replace the `run()` function body:

```rust
async fn run() -> Result<()> {
    let cli = Cli::parse();

    let update_handle = if !matches!(cli.command, Cmd::Update) {
        Some(tokio::spawn(update::check_for_update()))
    } else {
        None
    };

    let result = match cli.command {
        Cmd::Login => commands::login::run().await,
        Cmd::Logout => commands::logout::run().await,
        Cmd::Term { sub } => match sub {
            Some(TermCmd::Ls) => commands::term::list().await,
            None => commands::term::interactive().await,
        },
        Cmd::Search { course } => commands::search::run(&course).await,
        Cmd::Cart { sub } => match sub {
            Some(CartCmd::Add { class_number }) => commands::cart::add(&class_number).await,
            Some(CartCmd::Enrol) => commands::cart::enrol().await,
            None => commands::cart::interactive().await,
        },
        Cmd::Enrol => commands::cart::enrol().await,
        Cmd::Fetch { url } => commands::fetch::run(&url).await,
        Cmd::Run { payload } => commands::run::run(&payload).await,
        Cmd::Update => commands::update::run().await,
    };

    if let Some(handle) = update_handle {
        if let Ok(Some(version)) = handle.await {
            eprintln!(
                "\n  a new version is available: v{version} — run 'uoplan update' to install it"
            );
        }
    }

    result
}
```

- [ ] **Step 3: Verify compile and run tests**

```bash
cargo check --manifest-path apps/cli/Cargo.toml
cargo test --manifest-path apps/cli/Cargo.toml
```

Expected: clean compile, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/main.rs
git commit -m "feat(cli): wire passive update check and update subcommand"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Build a debug binary**

```bash
cargo build --manifest-path apps/cli/Cargo.toml
```

- [ ] **Step 2: Run a command and verify no crash**

```bash
./apps/cli/target/debug/uoplan --help
```

Expected: help text printed, no panic.

- [ ] **Step 3: Verify update check runs silently**

```bash
./apps/cli/target/debug/uoplan term ls 2>&1 | head -20
```

Expected: normal command output. If the GitHub API is reachable and `0.1.0` is the latest, no update notice. The cache file should now exist:

```bash
cat ~/.cache/uoplan/update_check.json   # macOS/Linux
```

Expected: `{"last_checked":<timestamp>,"latest_version":"0.1.0"}` (or whatever the latest tagged release is).

- [ ] **Step 4: Verify `uoplan update` reports up to date**

```bash
./apps/cli/target/debug/uoplan update
```

Expected: "No update available." (since `0.1.0` is the current version and likely the only/latest `cli/v*` release).

- [ ] **Step 5: Commit if any fixups were needed, otherwise done**

```bash
git add -p
git commit -m "fix(cli): update smoke test fixups"
```
