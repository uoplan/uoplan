mod api;
mod auth;
mod commands;
mod error;
mod update;

pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/cli.rs"));
}

use anyhow::Result;
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "uoplan", version, about = "uOttawa course enrollment CLI")]
struct Cli {
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Authenticate via Chrome
    Login,
    /// Remove saved session
    Logout,
    /// Select a term interactively, or list terms
    Term {
        #[command(subcommand)]
        sub: Option<TermCmd>,
    },
    /// Search for a course and enrol
    Search {
        /// Course code, e.g. CSI3140
        course: String,
    },
    /// Manage the enrollment cart
    Cart {
        #[command(subcommand)]
        sub: Option<CartCmd>,
    },
    /// Enrol selected courses from cart
    Enrol,
    /// Fetch a URL using the authenticated session
    Fetch {
        url: String,
    },
    /// Run a schedule payload
    Run {
        payload: String,
    },
    /// Check for and install the latest version
    Update,
}

#[derive(Subcommand)]
enum TermCmd {
    /// List available terms
    #[command(alias = "list")]
    Ls,
}

#[derive(Subcommand)]
enum CartCmd {
    /// Add a class number to the cart
    Add { class_number: String },
    /// Enrol selected courses
    Enrol,
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        let _ = cliclack::outro_cancel(&format!("{e}"));
        std::process::exit(1);
    }
}

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
