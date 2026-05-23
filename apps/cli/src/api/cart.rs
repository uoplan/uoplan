use anyhow::Result;
use regex::Regex;
use scraper::{Html, Selector};

use super::client::PeopleSoftClient;
use super::peoplesoft::{build_form_body, extract_page_state};

#[derive(Debug, Clone)]
pub struct CartItem {
    pub course_code: String,
    pub instructors: Vec<String>,
    pub bufnum: i64,
}

struct RawRow {
    bufnum: i64,
    has_checkbox: bool,
    instructor: String,
    class_text: String,
}

pub fn parse_cart(html: &str) -> Vec<CartItem> {
    let doc = Html::parse_document(html);
    let row_sel = Selector::parse(r"tr[id^='trSSR_REGFORM_VW']").unwrap();
    let class_re = Regex::new(r"(?s)^([^\n(]+).*\((\d+)\)").unwrap();
    let course_re = Regex::new(r"(?i)^([A-Z]{2,4}\s*\d{3,4})").unwrap();

    let mut raws: Vec<RawRow> = Vec::new();
    for row in doc.select(&row_sel) {
        let Some(bufnum_str) = row.value().attr("bufnum") else {
            continue;
        };
        let Ok(bufnum) = bufnum_str.parse::<i64>() else {
            continue;
        };
        let chk_sel = Selector::parse(&format!("[id='P_SELECT$chk${bufnum}']")).unwrap();
        let has_checkbox = row.select(&chk_sel).next().is_some();
        let instr_sel =
            Selector::parse(&format!("[id='DERIVED_REGFRM1_SSR_INSTR_LONG${bufnum}']")).unwrap();
        let class_sel = Selector::parse(&format!("[id='P_CLASS_NAME${bufnum}']")).unwrap();
        let instructor = row
            .select(&instr_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_owned())
            .unwrap_or_default();
        let class_text = row
            .select(&class_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_owned())
            .unwrap_or_default();
        raws.push(RawRow {
            bufnum,
            has_checkbox,
            instructor,
            class_text,
        });
    }

    // Group consecutive non-checkbox rows into the preceding checkbox row
    let mut items: Vec<CartItem> = Vec::new();
    for r in raws {
        if r.has_checkbox {
            let mut section = String::new();
            if let Some(caps) = class_re.captures(&r.class_text) {
                section = caps
                    .get(1)
                    .map_or_else(String::new, |m| m.as_str().trim().to_owned());
            }
            let course_code = course_re
                .captures(&section)
                .and_then(|c| c.get(1).map(|m| m.as_str().trim().to_owned()))
                .unwrap_or_default();
            let mut instructors = Vec::new();
            if !r.instructor.is_empty() {
                instructors.push(r.instructor.clone());
            }
            items.push(CartItem {
                course_code,
                instructors,
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
