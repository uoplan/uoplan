use anyhow::{anyhow, Result};
use regex::Regex;
use scraper::{Html, Selector};
use std::collections::HashMap;

use super::client::PeopleSoftClient;
use super::peoplesoft::{encode_form, extract_page_state, PageState};

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub row_index: i64,
    pub class_nbr: String,
    pub section: String,
    pub days: String,
    pub room: String,
    pub instructor: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct CompanionOption {
    pub index: i64,
    pub section: String,
    pub schedule: String,
    pub room: String,
    pub instructor: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct CompanionPage {
    pub label: String,
    pub options: Vec<CompanionOption>,
}

#[derive(Debug, Clone)]
pub struct ParsedCourseCode {
    pub subject: String,
    pub catalog_nbr: String,
}

#[derive(Debug, Clone)]
pub struct ClassMapping {
    pub component: String,
    pub section: String,
}

pub fn parse_course_code(raw: &str) -> Result<ParsedCourseCode> {
    let normalized: String = raw
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_uppercase();
    let re = Regex::new(r"^([A-Z]{2,4})(\d{3,4})$").unwrap();
    let caps = re
        .captures(&normalized)
        .ok_or_else(|| anyhow!("Invalid course code: {}", raw))?;
    Ok(ParsedCourseCode {
        subject: caps.get(1).unwrap().as_str().to_string(),
        catalog_nbr: caps.get(2).unwrap().as_str().to_string(),
    })
}

pub fn extract_ajax_state(xml: &str) -> PageState {
    let state_re = Regex::new(r"ICStateNum\.value=(\d+)").unwrap();
    let ic_state_num = state_re
        .captures(xml)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        .unwrap_or_default();
    let icsid_re1 = Regex::new(r#"name=['"]ICSID['"][^>]*value=['"]([^'"]+)['"]"#).unwrap();
    let icsid_re2 = Regex::new(r#"value=['"]([^'"]+)['"][^>]*name=['"]ICSID['"]"#).unwrap();
    let icsid = icsid_re1
        .captures(xml)
        .or_else(|| icsid_re2.captures(xml))
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        .unwrap_or_default();
    PageState {
        icsid,
        ic_state_num,
    }
}

pub fn extract_page_html(xml: &str) -> String {
    let re =
        Regex::new(r"(?s)<FIELD id='win0divPAGECONTAINER'><!\[CDATA\[(.*?)\]\]></FIELD>").unwrap();
    re.captures(xml)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        .unwrap_or_else(|| xml.to_string())
}

pub fn parse_search_results(xml: &str) -> Vec<SearchResult> {
    let html = extract_page_html(xml);
    let doc = Html::parse_document(&html);
    let link_sel = Selector::parse(r#"a.PSHYPERLINK[id^='MTG_CLASS_NBR$']"#).unwrap();
    let mut out = Vec::new();
    let row_re = Regex::new(r"MTG_CLASS_NBR\$(\d+)").unwrap();
    for el in doc.select(&link_sel) {
        let id = match el.value().attr("id") {
            Some(v) => v,
            None => continue,
        };
        let row_index: i64 = match row_re
            .captures(id)
            .and_then(|c| c.get(1).and_then(|m| m.as_str().parse().ok()))
        {
            Some(v) => v,
            None => continue,
        };
        let class_nbr = el.text().collect::<String>().trim().to_string();
        let sec_sel =
            Selector::parse(&format!("[id='MTG_CLASSNAME${}']", row_index)).unwrap();
        let day_sel =
            Selector::parse(&format!("[id='MTG_DAYTIME${}']", row_index)).unwrap();
        let room_sel = Selector::parse(&format!("[id='MTG_ROOM${}']", row_index)).unwrap();
        let instr_sel = Selector::parse(&format!("[id='MTG_INSTR${}']", row_index)).unwrap();
        let status_sel = Selector::parse(&format!(
            "[id='win0divDERIVED_CLSRCH_SSR_STATUS_LONG${}'] img",
            row_index
        ))
        .unwrap();
        let section = doc
            .select(&sec_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let days = doc
            .select(&day_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let room_text = doc
            .select(&room_sel)
            .next()
            .map(|e| e.text().collect::<String>().to_string())
            .unwrap_or_default();
        let room = room_text.lines().next().unwrap_or("").trim().to_string();
        let instr_text = doc
            .select(&instr_sel)
            .next()
            .map(|e| e.text().collect::<String>().to_string())
            .unwrap_or_default();
        let mut seen: Vec<String> = Vec::new();
        for line in instr_text.lines() {
            let l = line.trim().to_string();
            if !l.is_empty() && !seen.contains(&l) {
                seen.push(l);
            }
        }
        let instructor = seen.join(", ");
        let status = doc
            .select(&status_sel)
            .next()
            .and_then(|e| e.value().attr("alt"))
            .unwrap_or("")
            .to_string();
        out.push(SearchResult {
            row_index,
            class_nbr,
            section,
            days,
            room,
            instructor,
            status,
        });
    }
    out
}

pub fn is_companion_page(xml: &str) -> bool {
    xml.contains("SSR_CLS_TBL_R1$scroll")
}

pub fn is_waitlist_page(xml: &str) -> bool {
    xml.contains("DERIVED_CLS_DTL_WAIT_LIST_OKAY")
}

pub fn parse_companion_page(xml: &str) -> CompanionPage {
    let html = extract_page_html(xml);
    let doc = Html::parse_document(&html);
    let label_sel = Selector::parse(r#"[id^='win0divSSR_CLS_TBL_R1GP']"#).unwrap();
    let label = doc
        .select(&label_sel)
        .next()
        .map(|e| e.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| "Select accompanying section".to_string());

    let row_sel = Selector::parse(r#"tr[id^='trSSR_CLS_TBL_R1']"#).unwrap();
    let mut options = Vec::new();
    for row in doc.select(&row_sel) {
        let bufnum_str = match row.value().attr("bufnum") {
            Some(v) => v,
            None => continue,
        };
        let index: i64 = match bufnum_str.parse() {
            Ok(n) => n,
            Err(_) => continue,
        };
        let cell_sel = Selector::parse("td").unwrap();
        let cells: Vec<_> = row.select(&cell_sel).collect();
        if cells.len() < 7 {
            continue;
        }
        let txt = |i: usize| {
            cells
                .get(i)
                .map(|c| c.text().collect::<String>().trim().to_string())
                .unwrap_or_default()
        };
        let class_nbr = txt(1);
        let section = txt(2);
        let schedule = txt(3);
        let room = txt(4);
        let instructor = txt(5);
        // status from img alt
        let img_sel = Selector::parse("img").unwrap();
        let status = cells
            .get(6)
            .and_then(|c| c.select(&img_sel).next())
            .and_then(|e| e.value().attr("alt"))
            .unwrap_or("")
            .to_string();
        let _ = class_nbr; // unused but parsed
        options.push(CompanionOption {
            index,
            section,
            schedule,
            room,
            instructor,
            status,
        });
    }
    CompanionPage { label, options }
}

pub fn parse_waitlist_id(xml: &str) -> Option<String> {
    let re = Regex::new(r"DERIVED_CLS_DTL_WAIT_LIST_OKAY\$(\d+)").unwrap();
    re.captures(xml)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

pub fn parse_confirm_action_id(xml: &str) -> String {
    let re = Regex::new(r#"name=["']DERIVED_CLS_DTL_NEXT_PB\$(\d+)\$"#).unwrap();
    if let Some(c) = re.captures(xml) {
        if let Some(m) = c.get(1) {
            return format!("DERIVED_CLS_DTL_NEXT_PB${}$", m.as_str());
        }
    }
    "DERIVED_CLS_DTL_NEXT_PB$280$".to_string()
}

pub fn parse_all_class_numbers(xml: &str) -> HashMap<String, ClassMapping> {
    let html = extract_page_html(xml);
    let doc = Html::parse_document(&html);
    let sel = Selector::parse(r#"a[id^='MTG_CLASS_NBR$']"#).unwrap();
    let row_re = Regex::new(r"MTG_CLASS_NBR\$(\d+)").unwrap();
    let sec_re = Regex::new(r"^([A-Za-z0-9]+)-([A-Z]+)").unwrap();
    let mut out = HashMap::new();
    for el in doc.select(&sel) {
        let id = match el.value().attr("id") {
            Some(v) => v,
            None => continue,
        };
        let row_index: i64 = match row_re
            .captures(id)
            .and_then(|c| c.get(1).and_then(|m| m.as_str().parse().ok()))
        {
            Some(v) => v,
            None => continue,
        };
        let class_nbr = el.text().collect::<String>().trim().to_string();
        let sec_sel =
            Selector::parse(&format!("[id='MTG_CLASSNAME${}']", row_index)).unwrap();
        let section_text = doc
            .select(&sec_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        if let Some(caps) = sec_re.captures(&section_text) {
            let section = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
            let component = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
            out.insert(class_nbr, ClassMapping { component, section });
        }
    }
    out
}

pub fn parse_confirm_messages(xml: &str) -> (Vec<String>, Vec<String>) {
    let html = extract_page_html(xml);
    let is_success = html.contains("PS_CS_MESSAGE_CONFIRM_ICN");
    let doc = Html::parse_document(&html);
    let sel = Selector::parse(r#"[id^='DERIVED_SASSMSG_ERROR_TEXT$']"#).unwrap();
    let messages: Vec<String> = doc
        .select(&sel)
        .map(|e| e.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if is_success {
        (Vec::new(), messages)
    } else {
        (messages, Vec::new())
    }
}

// ---- AJAX form body builder ----
fn ajax_base(state: &PageState, action: &str) -> Vec<(String, String)> {
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
    ]
}

fn ajax_finish(params: &mut Vec<(String, String)>) {
    params.push((
        "DERIVED_SSTSNAV_SSTS_MAIN_GOTO$7$".to_string(),
        "".to_string(),
    ));
}

fn override_pair(params: &mut Vec<(String, String)>, key: &str, value: &str) {
    if let Some(idx) = params.iter().position(|(k, _)| k == key) {
        params[idx].1 = value.to_string();
    } else {
        params.push((key.to_string(), value.to_string()));
    }
}

fn pairs_to_form(params: &[(String, String)]) -> String {
    let p: Vec<(&str, &str)> = params.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    encode_form(&p)
}

pub async fn search_courses(
    client: &PeopleSoftClient,
    cart_url: &str,
    subject: &str,
    catalog_nbr: &str,
) -> Result<(Vec<SearchResult>, String)> {
    // Step 1
    let body = client.get(cart_url).await?;
    let state1 = extract_page_state(&body);

    // Step 2 — click search button
    let mut params = ajax_base(&state1, "DERIVED_REGFRM1_SSR_PB_SRCH");
    params.push((
        "DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$".to_string(),
        "06".to_string(),
    ));
    ajax_finish(&mut params);
    let resp1 = client.post(cart_url, pairs_to_form(&params)).await?;

    let state2 = extract_ajax_state(&resp1);
    // If state2 missing, fall back to state1
    let state2 = if state2.icsid.is_empty() {
        PageState {
            icsid: state1.icsid.clone(),
            ic_state_num: if state2.ic_state_num.is_empty() {
                state1.ic_state_num.clone()
            } else {
                state2.ic_state_num
            },
        }
    } else {
        state2
    };

    // Step 3 — execute search
    let mut params2 = ajax_base(&state2, "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
    params2.push(("SSR_CLSRCH_WRK_ACAD_CAREER$0".to_string(), "".to_string()));
    params2.push((
        "SSR_CLSRCH_WRK_SUBJECT$1".to_string(),
        subject.to_string(),
    ));
    params2.push((
        "SSR_CLSRCH_WRK_SSR_EXACT_MATCH1$2".to_string(),
        "E".to_string(),
    ));
    params2.push((
        "SSR_CLSRCH_WRK_CATALOG_NBR$2".to_string(),
        catalog_nbr.to_string(),
    ));
    params2.push(("SSR_CLSRCH_WRK_SSR_COMPONENT$3".to_string(), "".to_string()));
    params2.push(("SSR_CLSRCH_WRK_CAMPUS$4".to_string(), "".to_string()));
    params2.push(("SSR_CLSRCH_WRK_LOCATION$5".to_string(), "".to_string()));
    params2.push(("SSR_CLSRCH_WRK_CRSE_ATTR$6".to_string(), "".to_string()));
    params2.push((
        "DERIVED_REGFRM1_SSR_CLS_SRCH_TYPE$249$".to_string(),
        "06".to_string(),
    ));
    ajax_finish(&mut params2);
    let xml = client.post(cart_url, pairs_to_form(&params2)).await?;
    let results = parse_search_results(&xml);
    Ok((results, xml))
}

pub async fn select_section(
    client: &PeopleSoftClient,
    cart_url: &str,
    xml: &str,
    row_index: i64,
) -> Result<String> {
    let state = extract_ajax_state(xml);
    let action = format!("SSR_PB_SELECT${}", row_index);
    let mut params = ajax_base(&state, &action);
    override_pair(&mut params, "ICXPos", "350");
    override_pair(&mut params, "ICYPos", "397.5");
    ajax_finish(&mut params);
    let mut result = client.post(cart_url, pairs_to_form(&params)).await?;
    // inject ICSID back if lost
    if extract_ajax_state(&result).icsid.is_empty() && !state.icsid.is_empty() {
        result = inject_icsid(&result, &state.icsid);
    }
    Ok(result)
}

pub async fn submit_companion_selection(
    client: &PeopleSoftClient,
    cart_url: &str,
    xml: &str,
    companion_index: i64,
    page_num: i64,
) -> Result<String> {
    let state = extract_ajax_state(xml);
    let mut params = ajax_base(&state, "DERIVED_CLS_DTL_NEXT_PB");
    let key = format!("SSR_CLS_TBL_R1$sels${}$$0", page_num);
    params.push((key, companion_index.to_string()));
    ajax_finish(&mut params);
    let mut result = client.post(cart_url, pairs_to_form(&params)).await?;
    if extract_ajax_state(&result).icsid.is_empty() && !state.icsid.is_empty() {
        result = inject_icsid(&result, &state.icsid);
    }
    Ok(result)
}

pub async fn confirm_enrollment(
    client: &PeopleSoftClient,
    cart_url: &str,
    xml: &str,
) -> Result<String> {
    let state = extract_ajax_state(xml);
    let waitlist_id = parse_waitlist_id(xml);
    let action = parse_confirm_action_id(xml);
    let mut params = ajax_base(&state, &action);
    override_pair(&mut params, "ICYPos", "38");
    if let Some(wid) = &waitlist_id {
        params.push((
            format!("DERIVED_CLS_DTL_WAIT_LIST_OKAY${}$$chk", wid),
            "Y".to_string(),
        ));
        params.push((
            format!("DERIVED_CLS_DTL_WAIT_LIST_OKAY${}$", wid),
            "Y".to_string(),
        ));
    }
    ajax_finish(&mut params);
    client.post(cart_url, pairs_to_form(&params)).await
}

fn inject_icsid(xml: &str, icsid: &str) -> String {
    // Provide a synthetic ICSID hidden input embedded near the end of CDATA
    if xml.contains("name='ICSID'") || xml.contains("name=\"ICSID\"") {
        return xml.to_string();
    }
    format!(
        "{}\n<input name='ICSID' value='{}' type='hidden' />",
        xml, icsid
    )
}
