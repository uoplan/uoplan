use regex::Regex;
use scraper::{Html, Selector};

#[derive(Debug, Clone)]
pub struct Term {
    pub index: i64,
    pub name: String,
    pub career: String,
}

#[derive(Debug, Clone)]
pub struct PageState {
    pub icsid: String,
    pub ic_state_num: String,
}

pub fn extract_page_state(html: &str) -> PageState {
    let doc = Html::parse_document(html);
    let icsid_sel = Selector::parse("#ICSID").unwrap();
    let icstate_sel = Selector::parse("#ICStateNum").unwrap();
    let icsid = doc
        .select(&icsid_sel)
        .next()
        .and_then(|el| el.value().attr("value"))
        .unwrap_or("")
        .to_owned();
    let ic_state_num = doc
        .select(&icstate_sel)
        .next()
        .and_then(|el| el.value().attr("value"))
        .unwrap_or("")
        .to_owned();
    PageState {
        icsid,
        ic_state_num,
    }
}

fn base_pairs<'a>(state: &'a PageState, action: &'a str) -> Vec<(&'a str, &'a str)> {
    vec![
        ("ICAJAX", "0"),
        ("ICNAVTYPEDROPDOWN", "0"),
        ("ICType", "Panel"),
        ("ICElementNum", "0"),
        ("ICStateNum", &state.ic_state_num),
        ("ICAction", action),
        ("ICModelCancel", "0"),
        ("ICXPos", "0"),
        ("ICYPos", "0"),
        ("ResponsetoDiffFrame", "-1"),
        ("TargetFrameName", "None"),
        ("FacetPath", "None"),
        ("PrmtTbl", ""),
        ("PrmtTbl_fn", ""),
        ("PrmtTbl_fv", ""),
        ("TA_SkipFldNms", ""),
        ("ICFocus", ""),
        ("ICSaveWarningFilter", "0"),
        ("ICChanged", "-1"),
        ("ICSkipPending", "0"),
        ("ICAutoSave", "0"),
        ("ICResubmit", "0"),
        ("ICSID", &state.icsid),
        ("ICActionPrompt", "false"),
        ("ICTypeAheadID", ""),
        ("ICBcDomData", "UnknownValue"),
        ("ICPanelName", ""),
        ("ICFind", ""),
        ("ICAddCount", ""),
        ("ICAppClsData", ""),
    ]
}

pub fn encode_form(params: &[(&str, &str)]) -> String {
    let mut s = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in params {
        s.append_pair(k, v);
    }
    s.finish()
}

pub fn build_form_body(action: &str, state: &PageState, extra: &[(&str, &str)]) -> String {
    let mut params = base_pairs(state, action);
    for (k, v) in extra {
        params.push((*k, *v));
    }
    encode_form(&params)
}

pub fn build_term_select_body(state: &PageState, term_index: i64) -> String {
    let idx = term_index.to_string();
    let extra = vec![
        ("ICAJAX", "0"),
        ("#ICDataLang", "ENG"),
        ("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$", ""),
        ("SSR_DUMMY_RECV1$sels$0$$0", idx.as_str()),
        ("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$", ""),
    ];
    build_form_body("DERIVED_SSS_SCT_SSR_PB_GO", state, &extra)
}

pub fn is_term_selection_page(body: &str) -> bool {
    body.contains("SSR_DUMMY_RECV1$scroll$0")
}

pub fn parse_terms_from_html(html: &str) -> Vec<Term> {
    let doc = Html::parse_document(html);
    let row_sel = Selector::parse(r"tr[id^='trSSR_DUMMY_RECV1$0_row']").unwrap();
    let mut out = Vec::new();
    for row in doc.select(&row_sel) {
        let Some(bufnum_str) = row.value().attr("bufnum") else {
            continue;
        };
        let Ok(bufnum) = bufnum_str.parse::<i64>() else {
            continue;
        };
        let term_sel = Selector::parse(&format!("[id='TERM_CAR${bufnum}']")).unwrap();
        let career_sel = Selector::parse(&format!("[id='CAREER${bufnum}']")).unwrap();
        let name = row
            .select(&term_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_owned())
            .unwrap_or_default();
        let career = row
            .select(&career_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_owned())
            .unwrap_or_default();
        out.push(Term {
            index: bufnum,
            name,
            career,
        });
    }
    out
}

pub fn parse_strm_from_html(html: &str) -> Option<String> {
    let re = Regex::new(r"[?&]STRM=(\d{4})").unwrap();
    re.captures(html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_owned())
}
