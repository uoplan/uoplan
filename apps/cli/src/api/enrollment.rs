use anyhow::Result;
use scraper::{Html, Selector};

use super::client::PeopleSoftClient;
use super::peoplesoft::{encode_form, extract_page_state, PageState};

pub const ACTION_ENROL: &str = "DERIVED_REGFRM1_LINK_ADD_ENRL$291$";
pub const ACTION_DELETE: &str = "DERIVED_REGFRM1_SSR_PB_DELETE$287$";

pub struct CartActionResult {
    pub errors: Vec<String>,
}

fn build_ajax_form(state: &PageState, action: &str) -> Vec<(String, String)> {
    vec![
        ("ICAJAX".to_owned(), "1".to_owned()),
        ("ICNAVTYPEDROPDOWN".to_owned(), "0".to_owned()),
        ("ICType".to_owned(), "Panel".to_owned()),
        ("ICElementNum".to_owned(), "0".to_owned()),
        ("ICStateNum".to_owned(), state.ic_state_num.clone()),
        ("ICAction".to_owned(), action.to_owned()),
        ("ICModelCancel".to_owned(), "0".to_owned()),
        ("ICXPos".to_owned(), "0".to_owned()),
        ("ICYPos".to_owned(), "0".to_owned()),
        ("ResponsetoDiffFrame".to_owned(), "-1".to_owned()),
        ("TargetFrameName".to_owned(), "None".to_owned()),
        ("FacetPath".to_owned(), "None".to_owned()),
        ("PrmtTbl".to_owned(), String::new()),
        ("PrmtTbl_fn".to_owned(), String::new()),
        ("PrmtTbl_fv".to_owned(), String::new()),
        ("TA_SkipFldNms".to_owned(), String::new()),
        ("ICFocus".to_owned(), String::new()),
        ("ICSaveWarningFilter".to_owned(), "0".to_owned()),
        ("ICChanged".to_owned(), "-1".to_owned()),
        ("ICSkipPending".to_owned(), "0".to_owned()),
        ("ICAutoSave".to_owned(), "0".to_owned()),
        ("ICResubmit".to_owned(), "0".to_owned()),
        ("ICSID".to_owned(), state.icsid.clone()),
        ("ICActionPrompt".to_owned(), "false".to_owned()),
        ("ICTypeAheadID".to_owned(), String::new()),
        ("ICBcDomData".to_owned(), "UnknownValue".to_owned()),
        ("ICPanelName".to_owned(), String::new()),
        ("ICFind".to_owned(), String::new()),
        ("ICAddCount".to_owned(), String::new()),
        ("ICAppClsData".to_owned(), String::new()),
        ("#ICDataLang".to_owned(), "ENG".to_owned()),
        ("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$".to_owned(), String::new()),
        (
            "DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$".to_owned(),
            "06".to_owned(),
        ),
    ]
}

pub fn parse_errors(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse(r"[id^='DERIVED_SASSMSG_ERROR_TEXT$']").unwrap();
    doc.select(&sel)
        .map(|e| e.text().collect::<String>().trim().to_owned())
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
        params.push((format!("P_SELECT$chk${bn}"), "Y".to_owned()));
        params.push((format!("P_SELECT${bn}"), "Y".to_owned()));
    }
    params.push(("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$".to_owned(), String::new()));
    let pairs: Vec<(&str, &str)> = params
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let post_body = encode_form(&pairs);
    let html = client.post(cart_url, post_body).await?;
    let errors = parse_errors(&html);
    Ok(CartActionResult { errors })
}
