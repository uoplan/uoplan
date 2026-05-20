use anyhow::Result;
use scraper::{Html, Selector};

use super::client::PeopleSoftClient;
use super::peoplesoft::{encode_form, extract_page_state, PageState};

pub const ACTION_ENROL: &str = "DERIVED_REGFRM1_LINK_ADD_ENRL$291$";
pub const ACTION_DELETE: &str = "DERIVED_REGFRM1_SSR_PB_DELETE$287$";

pub struct CartActionResult {
    pub html: String,
    pub errors: Vec<String>,
}

fn build_ajax_form(state: &PageState, action: &str) -> Vec<(String, String)> {
    vec![
        ("ICAJAX".to_string(), "1".to_string()),
        ("ICNAVTYPEDROPDOWN".to_string(), "0".to_string()),
        ("ICType".to_string(), "Panel".to_string()),
        ("ICElementNum".to_string(), "0".to_string()),
        ("ICStateNum".to_string(), state.ic_state_num.clone()),
        ("ICAction".to_string(), action.to_string()),
        ("ICModelCancel".to_string(), "0".to_string()),
        ("ICXPos".to_string(), "0".to_string()),
        ("ICYPos".to_string(), "0".to_string()),
        ("ResponsetoDiffFrame".to_string(), "-1".to_string()),
        ("TargetFrameName".to_string(), "None".to_string()),
        ("FacetPath".to_string(), "None".to_string()),
        ("PrmtTbl".to_string(), "".to_string()),
        ("PrmtTbl_fn".to_string(), "".to_string()),
        ("PrmtTbl_fv".to_string(), "".to_string()),
        ("TA_SkipFldNms".to_string(), "".to_string()),
        ("ICFocus".to_string(), "".to_string()),
        ("ICSaveWarningFilter".to_string(), "0".to_string()),
        ("ICChanged".to_string(), "-1".to_string()),
        ("ICSkipPending".to_string(), "0".to_string()),
        ("ICAutoSave".to_string(), "0".to_string()),
        ("ICResubmit".to_string(), "0".to_string()),
        ("ICSID".to_string(), state.icsid.clone()),
        ("ICActionPrompt".to_string(), "false".to_string()),
        ("ICTypeAheadID".to_string(), "".to_string()),
        ("ICBcDomData".to_string(), "UnknownValue".to_string()),
        ("ICPanelName".to_string(), "".to_string()),
        ("ICFind".to_string(), "".to_string()),
        ("ICAddCount".to_string(), "".to_string()),
        ("ICAppClsData".to_string(), "".to_string()),
        ("#ICDataLang".to_string(), "ENG".to_string()),
        ("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$".to_string(), "".to_string()),
        (
            "DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$".to_string(),
            "06".to_string(),
        ),
    ]
}

pub fn parse_errors(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse(r#"[id^='DERIVED_SASSMSG_ERROR_TEXT$']"#).unwrap();
    doc.select(&sel)
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

pub async fn submit_cart_action(
    client: &PeopleSoftClient,
    cart_url: &str,
    bufnums: &[i64],
    action: &str,
) -> Result<CartActionResult> {
    let body = client.get(cart_url).await?;
    let state = extract_page_state(&body);
    let mut params = build_ajax_form(&state, action);
    for bn in bufnums {
        params.push((format!("P_SELECT$chk${}", bn), "Y".to_string()));
        params.push((format!("P_SELECT${}", bn), "Y".to_string()));
    }
    params.push((
        "DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$".to_string(),
        "".to_string(),
    ));
    let pairs: Vec<(&str, &str)> = params
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let post_body = encode_form(&pairs);
    let html = client.post(cart_url, post_body).await?;
    let errors = parse_errors(&html);
    Ok(CartActionResult { html, errors })
}
