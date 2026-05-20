use thiserror::Error;

#[derive(Debug, Error)]
#[error("Authentication expired. Please run `uoplan login` again.")]
pub struct AuthExpiredError;

#[derive(Debug, Error)]
#[error("No session cookies found. Please run `uoplan login`.")]
pub struct NoCookiesError;

#[derive(Debug, Error)]
#[error("No term selected. Please run `uoplan term` to select a term.")]
pub struct NoTermSelectedError;
