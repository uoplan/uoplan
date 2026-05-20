use anyhow::Result;
use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use chrono_tz::America::Toronto;
use cliclack::{input, multiselect, outro_cancel, select};
use regex::Regex;

use crate::proto::CourseSelection;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnrolMode {
    Cart,
    Now,
    Snipe,
}

pub fn prompt_course_selection(
    courses: &[CourseSelection],
) -> Result<Option<Vec<CourseSelection>>> {
    if courses.is_empty() {
        return Ok(Some(Vec::new()));
    }

    let mut prompt = multiselect("Select courses to enrol");
    for (i, c) in courses.iter().enumerate() {
        let secs: Vec<String> = c
            .sections
            .iter()
            .map(|s| format!("{} {}", s.component, s.section))
            .collect();
        let hint = secs.join(", ");
        prompt = prompt.item(i, &c.course_code, hint);
    }
    let all_indices: Vec<usize> = (0..courses.len()).collect();
    let selected_indices: Vec<usize> = match prompt.initial_values(all_indices).interact() {
        Ok(v) => v,
        Err(_) => {
            outro_cancel("Cancelled.")?;
            return Ok(None);
        }
    };

    Ok(Some(
        selected_indices
            .into_iter()
            .map(|i| courses[i].clone())
            .collect(),
    ))
}

pub fn prompt_enrol_mode() -> Result<Option<EnrolMode>> {
    let mode = match select("How would you like to enrol?")
        .item(EnrolMode::Cart, "Add to cart only", "")
        .item(EnrolMode::Now, "Enrol now", "")
        .item(
            EnrolMode::Snipe,
            "Snipe (enrol at time)",
            "Schedule enrolment for exact open time",
        )
        .interact()
    {
        Ok(v) => v,
        Err(_) => {
            outro_cancel("Cancelled.")?;
            return Ok(None);
        }
    };
    Ok(Some(mode))
}

pub fn prompt_snipe_time() -> Result<Option<DateTime<Utc>>> {
    let default_year = chrono::Utc::now().with_timezone(&Toronto).year();
    loop {
        let raw: String =
            match input("Enter snipe time (Toronto local, e.g. 2026-05-26 10:00):").interact() {
                Ok(v) => v,
                Err(_) => {
                    outro_cancel("Cancelled.")?;
                    return Ok(None);
                }
            };
        match parse_toronto_time(&raw, default_year) {
            Some(dt) => {
                cliclack::log::info(&format!("Sniping at: {}", format_toronto_time(&dt)))?;
                return Ok(Some(dt));
            }
            None => {
                cliclack::log::warning(
                    "Could not parse time. Try: '2026-05-26 10:00', '26/5 10am', 'may 26 10:00'",
                )?;
            }
        }
    }
}

pub fn format_toronto_time(dt: &DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Toronto);
    local.format("%a %Y-%m-%d %H:%M %Z").to_string()
}

pub fn parse_toronto_time(input: &str, default_year: i32) -> Option<DateTime<Utc>> {
    let weekday_re = Regex::new(
        r"(?i)^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+",
    )
    .unwrap();
    let cleaned = weekday_re.replace(input.trim(), "").to_string();
    let cleaned = cleaned.trim();

    let iso_re =
        Regex::new(r"^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?")
            .unwrap();
    if let Some(c) = iso_re.captures(cleaned) {
        let y: i32 = c.get(1).unwrap().as_str().parse().ok()?;
        let mo: u32 = c.get(2).unwrap().as_str().parse().ok()?;
        let d: u32 = c.get(3).unwrap().as_str().parse().ok()?;
        let h: u32 = c.get(4).unwrap().as_str().parse().ok()?;
        let mi: u32 = c.get(5).unwrap().as_str().parse().ok()?;
        let s: u32 = c
            .get(6)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0);
        let h = apply_ampm(h, c.get(7).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, s);
    }

    let slash_re = Regex::new(
        r"^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)?",
    )
    .unwrap();
    if let Some(c) = slash_re.captures(cleaned) {
        let d: u32 = c.get(1).unwrap().as_str().parse().ok()?;
        let mo: u32 = c.get(2).unwrap().as_str().parse().ok()?;
        let y: i32 = c
            .get(3)
            .and_then(|m| m.as_str().parse().ok())
            .map(|y: i32| if y < 100 { 2000 + y } else { y })
            .unwrap_or(default_year);
        let h: u32 = c.get(4).unwrap().as_str().parse().ok()?;
        let mi: u32 = c
            .get(5)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0);
        let h = apply_ampm(h, c.get(6).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, 0);
    }

    let named_re = Regex::new(
        r"(?i)^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)?",
    )
    .unwrap();
    if let Some(c) = named_re.captures(cleaned) {
        let mo = month_to_num(c.get(1).unwrap().as_str())?;
        let d: u32 = c.get(2).unwrap().as_str().parse().ok()?;
        let y: i32 = c
            .get(3)
            .and_then(|m| m.as_str().parse().ok())
            .map(|y: i32| if y < 100 { 2000 + y } else { y })
            .unwrap_or(default_year);
        let h: u32 = c.get(4).unwrap().as_str().parse().ok()?;
        let mi: u32 = c
            .get(5)
            .and_then(|m| m.as_str().parse().ok())
            .unwrap_or(0);
        let h = apply_ampm(h, c.get(6).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, 0);
    }

    None
}

fn apply_ampm(h: u32, ampm: Option<&str>) -> u32 {
    match ampm.map(|s| s.to_lowercase()) {
        Some(s) if s == "pm" => {
            if h == 12 {
                12
            } else {
                h + 12
            }
        }
        Some(s) if s == "am" => {
            if h == 12 {
                0
            } else {
                h
            }
        }
        _ => h,
    }
}

fn month_to_num(s: &str) -> Option<u32> {
    Some(match &s.to_lowercase()[..3] {
        "jan" => 1,
        "feb" => 2,
        "mar" => 3,
        "apr" => 4,
        "may" => 5,
        "jun" => 6,
        "jul" => 7,
        "aug" => 8,
        "sep" => 9,
        "oct" => 10,
        "nov" => 11,
        "dec" => 12,
        _ => return None,
    })
}

fn to_utc(y: i32, mo: u32, d: u32, h: u32, mi: u32, s: u32) -> Option<DateTime<Utc>> {
    let date = NaiveDate::from_ymd_opt(y, mo, d)?;
    let time = NaiveTime::from_hms_opt(h, mi, s)?;
    let naive = NaiveDateTime::new(date, time);
    let local = Toronto.from_local_datetime(&naive).single()?;
    Some(local.with_timezone(&Utc))
}
