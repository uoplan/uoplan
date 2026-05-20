use anyhow::{anyhow, Result};
use base64::Engine;
use flate2::read::GzDecoder;
use indicatif::{ProgressBar, ProgressStyle};
use owo_colors::OwoColorize;
use prost::Message;
use std::io::Read;
use std::time::Duration;

use crate::api::search::{
    confirm_enrollment, is_companion_page, is_waitlist_page, parse_all_class_numbers,
    parse_companion_page, parse_confirm_messages, parse_course_code, search_courses,
    select_section, submit_companion_selection,
};
use crate::api::PeopleSoftClient;
use crate::proto::{CourseSelection, SchedulePayload};

fn make_spinner(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_chars("⠁⠂⠄⡀⢀⠠⠐⠈ "),
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

pub fn decode_payload(raw: &str) -> Result<SchedulePayload> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(raw.trim_end_matches('='))
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(raw))
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(raw))
        .map_err(|e| anyhow!("Failed to base64-decode payload: {e}"))?;

    // try gzip first
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
                println!("{} {}: {}", "✗".red(), course.course_code, e);
                continue;
            }
        };
        let pb = make_spinner(&format!(
            "Searching {} {}…",
            parsed.subject, parsed.catalog_nbr
        ));
        let (results, xml) =
            search_courses(client, cart_url, &parsed.subject, &parsed.catalog_nbr).await?;
        pb.finish_and_clear();

        // find primary selection: section in selected sections matching one of results
        let class_map = parse_all_class_numbers(&xml);

        // Determine primary section (the first selection that matches a search result)
        let mut primary_row_index: Option<i64> = None;
        for sel in &course.sections {
            for r in &results {
                // Check if this result's section/component matches via class map
                if let Some(mapping) = class_map.get(&r.class_nbr) {
                    if mapping.component.eq_ignore_ascii_case(&sel.component)
                        && mapping.section.eq_ignore_ascii_case(&sel.section)
                    {
                        primary_row_index = Some(r.row_index);
                        break;
                    }
                }
            }
            if primary_row_index.is_some() {
                break;
            }
        }

        let row_index = match primary_row_index {
            Some(i) => i,
            None => {
                println!(
                    "{} No matching primary section for {}",
                    "✗".red(),
                    course.course_code
                );
                continue;
            }
        };

        let pb = make_spinner("Selecting section…");
        let mut xml = select_section(client, cart_url, &xml, row_index).await?;
        pb.finish_and_clear();

        let mut page_num: i64 = 0;
        while is_companion_page(&xml) && !is_waitlist_page(&xml) {
            let page = parse_companion_page(&xml);
            // try to match a selection by section name in this page
            let mut chosen_idx: Option<i64> = None;
            for sel in &course.sections {
                for opt in &page.options {
                    // opt.section like "A00-LEC" or similar — try contains
                    if opt
                        .section
                        .to_uppercase()
                        .contains(&sel.section.to_uppercase())
                        && opt
                            .section
                            .to_uppercase()
                            .contains(&sel.component.to_uppercase())
                    {
                        chosen_idx = Some(opt.index);
                        break;
                    }
                }
                if chosen_idx.is_some() {
                    break;
                }
            }
            let pick = chosen_idx
                .or_else(|| page.options.first().map(|o| o.index))
                .unwrap_or(0);

            let pb = make_spinner("Submitting companion selection…");
            xml = submit_companion_selection(client, cart_url, &xml, pick, page_num).await?;
            pb.finish_and_clear();
            page_num += 1;
        }

        let pb = make_spinner("Confirming…");
        let final_xml = confirm_enrollment(client, cart_url, &xml).await?;
        pb.finish_and_clear();

        let (errors, notices) = parse_confirm_messages(&final_xml);
        for n in &notices {
            println!("{} {} — {}", "✓".green(), course.course_code, n);
        }
        for e in &errors {
            println!("{} {} — {}", "✗".red(), course.course_code, e);
        }
    }
    Ok(())
}
