use anyhow::{anyhow, Result};
use regex::Regex;
use reqwest::cookie::Jar;
use reqwest::header;
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;

use crate::auth::{set_term, StoredSession};
use crate::error::AuthExpiredError;

use super::endpoints;
use super::peoplesoft::{
    build_term_select_body, extract_page_state, is_term_selection_page, parse_strm_from_html,
};

pub struct ClientInner {
    pub client: reqwest::Client,
    pub session: Mutex<StoredSession>,
}

#[derive(Clone)]
pub struct PeopleSoftClient {
    inner: Arc<ClientInner>,
}

fn is_login_page(body: &str, url: &str) -> bool {
    let lower = body.to_lowercase();
    if lower.contains("sign in to peoplesoft") {
        return true;
    }
    if lower.contains("you must have cookies enabled") {
        return true;
    }
    let re = Regex::new(r#"(?i)<meta[^>]+http-equiv=['"]refresh['"]"#).unwrap();
    if re.is_match(body) && body.contains("CAMPUS_URL=") {
        return true;
    }
    if url.contains("login.microsoftonline.com") {
        return true;
    }
    false
}

impl PeopleSoftClient {
    pub fn new(session: StoredSession) -> Result<Self> {
        let jar = Arc::new(Jar::default());
        for c in &session.cookies {
            let domain = c.domain.trim_start_matches('.');
            let cookie_url = Url::parse(&format!("https://{}/", domain))?;
            let cookie_str = format!(
                "{}={}; Domain={}; Path={}{}{}",
                c.name,
                c.value,
                c.domain,
                c.path,
                if c.secure { "; Secure" } else { "" },
                if c.http_only { "; HttpOnly" } else { "" }
            );
            jar.add_cookie_str(&cookie_str, &cookie_url);
        }

        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::USER_AGENT,
            header::HeaderValue::from_static(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ),
        );
        headers.insert(
            header::ACCEPT,
            header::HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        );

        let client = reqwest::Client::builder()
            .cookie_provider(jar.clone())
            .default_headers(headers)
            .gzip(true)
            .build()?;

        Ok(Self {
            inner: Arc::new(ClientInner {
                client,
                session: Mutex::new(session),
            }),
        })
    }

    pub async fn get(&self, url: &str) -> Result<String> {
        let resp = self.inner.client.get(url).send().await?;
        let final_url = resp.url().to_string();
        let body = resp.text().await?;
        self.check_response(&final_url, body, Some(url), None).await
    }

    pub async fn post(&self, url: &str, body: String) -> Result<String> {
        let resp = self
            .inner
            .client
            .post(url)
            .header(
                header::CONTENT_TYPE,
                "application/x-www-form-urlencoded; charset=UTF-8",
            )
            .body(body.clone())
            .send()
            .await?;
        let final_url = resp.url().to_string();
        let resp_body = resp.text().await?;
        self.check_response(&final_url, resp_body, None, Some((url, body)))
            .await
    }

    async fn check_response(
        &self,
        final_url: &str,
        body: String,
        retry_get: Option<&str>,
        retry_post: Option<(&str, String)>,
    ) -> Result<String> {
        if is_login_page(&body, final_url) {
            return Err(anyhow!(AuthExpiredError));
        }
        if is_term_selection_page(&body) {
            // Need term_index from session.
            let term_index = {
                let sess = self.inner.session.lock().await;
                sess.term_index
            };
            let Some(term_index) = term_index else {
                return Err(anyhow!(crate::error::NoTermSelectedError));
            };
            // Re-select term: GET term list, POST select
            let term_list_url = endpoints::term_list();
            let list_resp = self.inner.client.get(&term_list_url).send().await?;
            let list_body = list_resp.text().await?;
            let state = extract_page_state(&list_body);
            let select_body = build_term_select_body(&state, term_index);
            let select_resp = self
                .inner
                .client
                .post(&term_list_url)
                .header(
                    header::CONTENT_TYPE,
                    "application/x-www-form-urlencoded; charset=UTF-8",
                )
                .body(select_body)
                .send()
                .await?;
            let select_resp_url = select_resp.url().to_string();
            let select_resp_body = select_resp.text().await?;
            if let Some(strm) = parse_strm_from_html(&select_resp_body)
                .or_else(|| parse_strm_from_html(&select_resp_url))
            {
                let _ = set_term(&strm, term_index, None).await;
                let mut sess = self.inner.session.lock().await;
                sess.strm = Some(strm);
            }

            // Replay original request
            if let Some(url) = retry_get {
                let resp = self.inner.client.get(url).send().await?;
                return Ok(resp.text().await?);
            }
            if let Some((url, b)) = retry_post {
                let resp = self
                    .inner
                    .client
                    .post(url)
                    .header(
                        header::CONTENT_TYPE,
                        "application/x-www-form-urlencoded; charset=UTF-8",
                    )
                    .body(b)
                    .send()
                    .await?;
                return Ok(resp.text().await?);
            }
        }
        Ok(body)
    }

    pub async fn session_strm(&self) -> Option<String> {
        self.inner.session.lock().await.strm.clone()
    }

    pub async fn session_cart_url(&self) -> Option<String> {
        self.inner.session.lock().await.cart_url.clone()
    }
}
