# CLI Self-Update Design

## Summary

Add passive update notifications and an `uoplan update` command that detects newer `cli/v*` GitHub releases and atomically replaces the running binary using the `self_update` crate.

## Components

### `src/update.rs`

Core module with two public functions:

- `check_for_update() -> Option<String>` — queries the GitHub Releases API, filters for tags starting with `cli/v`, compares the latest tag version against `env!("CARGO_PKG_VERSION")`. Returns the new version string if one is available, otherwise `None`. Respects a 1-hour cache (see below) so the network is hit at most once per hour.
- `do_update(version: &str) -> Result<()>` — invokes `self_update` to download the correct platform asset and atomically replace the running binary.

### Update cache (`~/.cache/uoplan/update_check.json`)

A small JSON file stored at the platform cache dir (via the `dirs` crate):

```json
{ "last_checked": 1716230400, "latest_version": "0.2.0" }
```

- On read: if `last_checked` is less than 3600 seconds ago, return `latest_version` from cache without hitting the network.
- On write: after a successful API call, update both fields.
- Errors reading/writing the cache are silently ignored.

Platform paths:

- Linux/macOS: `~/.cache/uoplan/update_check.json`
- Windows: `%LOCALAPPDATA%\uoplan\update_check.json`

### `src/commands/update.rs`

The `uoplan update` command. Shows a `cliclack` spinner, calls `do_update()`, prints success or "already up to date." Errors surface via `anyhow` and the standard `outro_cancel` handler.

## Passive Check

In `main.rs`, after `Cli::parse()` but before dispatching the subcommand:

1. Spawn `check_for_update()` as a `tokio::spawn` task (non-blocking).
2. Dispatch and await the actual subcommand.
3. After the command completes, `await` the update check result.
4. If a newer version was found, print: `  a new version is available: vX.Y.Z — run 'uoplan update' to install it`

Errors from the background check are silently swallowed — a network failure must never interrupt the user's command.

## Asset Matching

`cli-release.yml` produces assets named `uoplan-<target-triple>.tar.gz` (Unix) and `uoplan-<target-triple>.zip` (Windows). The `self_update` crate is configured to match on the current `target_triple` (e.g. `aarch64-apple-darwin`), and uses the GitHub repo `uoplan/uoplan` filtered by tags prefixed `cli/v`.

On Unix, the atomic swap uses `rename(2)`. On Windows, `self_update` uses a temp-file move strategy to work around file-locking constraints.

## New Dependencies (`apps/cli/Cargo.toml`)

```toml
self_update = { version = "0.42", default-features = false, features = [
  "archive-tar",
  "archive-zip",
  "compression-flate2",
  "compression-zip-deflate",
] }
dirs = "5"
```

`serde_json` is already present and used for the cache file.

## File Layout

```
apps/cli/src/
  update.rs          # check_for_update(), do_update(), cache logic
  commands/
    update.rs        # uoplan update subcommand
    mod.rs           # add pub mod update
  main.rs            # add Update variant to Cmd enum, passive check
```
