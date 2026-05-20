use anyhow::Result;

use super::client::PeopleSoftClient;
use super::endpoints;
use super::peoplesoft::{
    build_term_select_body, extract_page_state, parse_strm_from_html, parse_terms_from_html, Term,
};

pub async fn list_terms(client: &PeopleSoftClient) -> Result<Vec<Term>> {
    let body = client.get(&endpoints::term_list()).await?;
    Ok(parse_terms_from_html(&body))
}

pub async fn select_term(client: &PeopleSoftClient, term_index: i64) -> Result<String> {
    let url = endpoints::term_list();
    let body = client.get(&url).await?;
    let state = extract_page_state(&body);
    let select_body = build_term_select_body(&state, term_index);
    let resp = client.post(&url, select_body).await?;
    let strm = parse_strm_from_html(&resp)
        .ok_or_else(|| anyhow::anyhow!("Could not parse STRM from response"))?;
    Ok(strm)
}
