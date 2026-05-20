use anyhow::Result;
use regex::Regex;
use scraper::{Html, Selector};

use super::client::PeopleSoftClient;
use super::peoplesoft::{build_form_body, extract_page_state};

#[derive(Debug, Clone)]
pub struct CartItem {
    pub course_code: String,
    pub section: String,
    pub class_number: String,
    pub instructors: Vec<String>,
    pub units: String,
    pub bufnum: i64,
}

pub fn parse_cart(html: &str) -> Vec<CartItem> {
    let doc = Html::parse_document(html);
    let row_sel = Selector::parse(r#"tr[id^='trSSR_REGFORM_VW']"#).unwrap();
    let class_re = Regex::new(r"(?s)^([^\n(]+).*\((\d+)\)").unwrap();
    let course_re = Regex::new(r"(?i)^([A-Z]{2,4}\s*\d{3,4})").unwrap();

    // Step 1: iterate rows in order, collect data for each row keyed by bufnum
    struct RawRow {
        bufnum: i64,
        has_checkbox: bool,
        instructor: String,
        class_text: String,
        units: String,
    }
    let mut raws: Vec<RawRow> = Vec::new();
    for row in doc.select(&row_sel) {
        let bufnum_str = match row.value().attr("bufnum") {
            Some(v) => v,
            None => continue,
        };
        let bufnum: i64 = match bufnum_str.parse() {
            Ok(n) => n,
            Err(_) => continue,
        };
        let chk_sel = Selector::parse(&format!("[id='P_SELECT$chk${}']", bufnum)).unwrap();
        let has_checkbox = row.select(&chk_sel).next().is_some();
        let instr_sel =
            Selector::parse(&format!("[id='DERIVED_REGFRM1_SSR_INSTR_LONG${}']", bufnum))
                .unwrap();
        let class_sel = Selector::parse(&format!("[id='P_CLASS_NAME${}']", bufnum)).unwrap();
        let unit_sel =
            Selector::parse(&format!("[id='SSR_REGFORM_VW_UNT_TAKEN${}']", bufnum)).unwrap();
        let instructor = row
            .select(&instr_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let class_text = row
            .select(&class_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let units = row
            .select(&unit_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        raws.push(RawRow {
            bufnum,
            has_checkbox,
            instructor,
            class_text,
            units,
        });
    }

    // Step 2: group consecutive non-checkbox rows into previous checkbox row
    let mut items: Vec<CartItem> = Vec::new();
    for r in raws {
        if r.has_checkbox {
            // Parse section/classNumber/courseCode
            let mut section = String::new();
            let mut class_number = String::new();
            if let Some(caps) = class_re.captures(&r.class_text) {
                section = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                class_number = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
            }
            let course_code = course_re
                .captures(&section)
                .and_then(|c| c.get(1).map(|m| m.as_str().trim().to_string()))
                .unwrap_or_default();
            let mut instructors = Vec::new();
            if !r.instructor.is_empty() {
                instructors.push(r.instructor.clone());
            }
            items.push(CartItem {
                course_code,
                section,
                class_number,
                instructors,
                units: r.units,
                bufnum: r.bufnum,
            });
        } else if let Some(last) = items.last_mut() {
            if !r.instructor.is_empty() && !last.instructors.contains(&r.instructor) {
                last.instructors.push(r.instructor);
            }
        }
    }

    items
}

pub async fn list_cart(client: &PeopleSoftClient, cart_url: &str) -> Result<Vec<CartItem>> {
    let body = client.get(cart_url).await?;
    Ok(parse_cart(&body))
}

pub async fn add_to_cart(
    client: &PeopleSoftClient,
    cart_url: &str,
    class_number: &str,
) -> Result<()> {
    let body = client.get(cart_url).await?;
    let state = extract_page_state(&body);
    let extra = vec![("DERIVED_REGFRM1_CLASS_NBR", class_number)];
    let post_body = build_form_body("DERIVED_REGFRM1_SSR_PB_ADDTOLIST", &state, &extra);
    client.post(cart_url, post_body).await?;
    Ok(())
}
