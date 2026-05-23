use anyhow::{anyhow, Result};
use base64::Engine;
use cliclack::{log, spinner};
use flate2::read::GzDecoder;
use prost::Message;
use std::io::Read;

const BOLD: &str = "\x1b[1m";
const GRAY: &str = "\x1b[2m";
const RESET: &str = "\x1b[0m";

use crate::api::search::{
    confirm_enrollment, is_companion_page, is_waitlist_page, parse_all_class_numbers,
    parse_companion_tables, parse_confirm_messages, parse_course_code, search_courses,
    select_section, submit_companion_selection,
};
use crate::api::PeopleSoftClient;
use crate::proto::{CourseSelection, SchedulePayload};

pub fn decode_payload(raw: &str) -> Result<SchedulePayload> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(raw.trim_end_matches('='))
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(raw))
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(raw))
        .map_err(|e| anyhow!("Failed to base64-decode payload: {e}"))?;

    let decoded = if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        let mut decoder = GzDecoder::new(&bytes[..]);
        let mut out = Vec::new();
        decoder
            .read_to_end(&mut out)
            .map_err(|e| anyhow!("Failed to gunzip payload: {e}"))?;
        out
    } else {
        bytes
    };

    let payload = SchedulePayload::decode(&decoded[..])
        .map_err(|e| anyhow!("Failed to decode protobuf payload: {e}"))?;
    Ok(payload)
}

pub async fn add_courses_to_cart(
    client: &PeopleSoftClient,
    cart_url: &str,
    courses: &[CourseSelection],
) -> Result<()> {
    for course in courses {
        let parsed = match parse_course_code(&course.course_code) {
            Ok(p) => p,
            Err(e) => {
                log::error(format!("{}: {e}", course.course_code))?;
                continue;
            }
        };

        let sp = spinner();
        sp.start(format!(
            "Searching {} {}…",
            parsed.subject, parsed.catalog_nbr
        ));
        let (results, xml) =
            search_courses(client, cart_url, &parsed.subject, &parsed.catalog_nbr).await?;
        sp.clear();

        let class_map = parse_all_class_numbers(&xml);

        let mut primary_row_index: Option<i64> = None;
        'outer: for sel in &course.sections {
            for r in &results {
                if let Some(mapping) = class_map.get(&r.class_nbr) {
                    if mapping.component.eq_ignore_ascii_case(&sel.component)
                        && mapping.section.eq_ignore_ascii_case(&sel.section)
                    {
                        primary_row_index = Some(r.row_index);
                        break 'outer;
                    }
                }
            }
        }

        let Some(row_index) = primary_row_index else {
            log::error(format!(
                "No matching primary section for {}",
                course.course_code
            ))?;
            continue;
        };

        let sp = spinner();
        sp.start("Selecting section…");
        let mut xml = select_section(client, cart_url, &xml, row_index).await?;
        sp.clear();

        while is_companion_page(&xml) && !is_waitlist_page(&xml) {
            let tables = parse_companion_tables(&xml);
            let selections: Vec<(u32, i64)> = tables
                .iter()
                .map(|table| {
                    let pick = table
                        .options
                        .iter()
                        .find(|opt| {
                            course.sections.iter().any(|sel| {
                                opt.section
                                    .to_uppercase()
                                    .contains(&sel.section.to_uppercase())
                            })
                        })
                        .or_else(|| table.options.first())
                        .map_or(0, |o| o.index);
                    (table.table_num, pick)
                })
                .collect();

            let sp = spinner();
            sp.start("Selecting companion sections…");
            xml = submit_companion_selection(client, cart_url, &xml, &selections).await?;
            sp.clear();
        }

        let sp = spinner();
        sp.start("Confirming…");
        let final_xml = confirm_enrollment(client, cart_url, &xml).await?;
        sp.clear();

        let mut sections_text = String::new();
        for sel in &course.sections {
            use std::fmt::Write as _;
            let _ = write!(sections_text, "\n{GRAY}• {} {}{RESET}", sel.component, sel.section);
        }

        let (errors, notices) = parse_confirm_messages(&final_xml);
        if errors.is_empty() {
            log::success(format!("{BOLD}{} ✓{RESET}{sections_text}", course.course_code))?;
            for n in &notices {
                log::info(format!("{GRAY}{n}{RESET}"))?;
            }
        } else {
            log::info(format!("{BOLD}{}{RESET}{sections_text}", course.course_code))?;
            for e in &errors {
                log::error(e.clone())?;
            }
        }
    }
    Ok(())
}
