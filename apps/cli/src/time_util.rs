use std::sync::OnceLock;

use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use chrono_tz::America::Toronto;
use regex::{Captures, Regex};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum TorontoTimeParseError {
    #[error("time did not match supported formats")]
    UnsupportedFormat,
    #[error("time fields were out of range or ambiguous in Toronto local time")]
    InvalidLocalTime,
}

pub fn current_toronto_year() -> i32 {
    Utc::now().with_timezone(&Toronto).year()
}

pub fn format_toronto_time(dt: &DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Toronto);
    local.format("%a %Y-%m-%d %H:%M %Z").to_string()
}

pub fn parse_toronto_time(
    input: &str,
    default_year: i32,
) -> Result<DateTime<Utc>, TorontoTimeParseError> {
    let cleaned = weekday_re().replace(input.trim(), "").to_string();
    let cleaned = cleaned.trim();

    if let Some(c) = iso_re().captures(cleaned) {
        let y = parse_i32(&c, 1)?;
        let mo = parse_u32(&c, 2)?;
        let d = parse_u32(&c, 3)?;
        let h = parse_u32(&c, 4)?;
        let mi = parse_u32(&c, 5)?;
        let s = parse_optional_u32(&c, 6)?.unwrap_or(0);
        let h = apply_ampm(h, c.get(7).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, s);
    }

    if let Some(c) = slash_re().captures(cleaned) {
        let d = parse_u32(&c, 1)?;
        let mo = parse_u32(&c, 2)?;
        let y =
            parse_optional_i32(&c, 3)?.map_or(default_year, |y| if y < 100 { 2000 + y } else { y });
        let h = parse_u32(&c, 4)?;
        let mi = parse_optional_u32(&c, 5)?.unwrap_or(0);
        let h = apply_ampm(h, c.get(6).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, 0);
    }

    if let Some(c) = named_re().captures(cleaned) {
        let mo = month_to_num(capture_str(&c, 1)?)?;
        let d = parse_u32(&c, 2)?;
        let y =
            parse_optional_i32(&c, 3)?.map_or(default_year, |y| if y < 100 { 2000 + y } else { y });
        let h = parse_u32(&c, 4)?;
        let mi = parse_optional_u32(&c, 5)?.unwrap_or(0);
        let h = apply_ampm(h, c.get(6).map(|m| m.as_str()));
        return to_utc(y, mo, d, h, mi, 0);
    }

    Err(TorontoTimeParseError::UnsupportedFormat)
}

fn weekday_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r"(?i)^(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+",
        )
        .expect("weekday regex is valid")
    })
}

fn iso_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?")
            .expect("ISO-like Toronto time regex is valid")
    })
}

fn slash_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)?")
            .expect("slash Toronto time regex is valid")
    })
}

fn named_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?i)^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]m)?")
            .expect("named-month Toronto time regex is valid")
    })
}

fn capture_str<'a>(
    captures: &'a Captures<'a>,
    index: usize,
) -> Result<&'a str, TorontoTimeParseError> {
    captures
        .get(index)
        .map(|m| m.as_str())
        .ok_or(TorontoTimeParseError::UnsupportedFormat)
}

fn parse_i32(captures: &Captures<'_>, index: usize) -> Result<i32, TorontoTimeParseError> {
    capture_str(captures, index)?
        .parse()
        .map_err(|_| TorontoTimeParseError::InvalidLocalTime)
}

fn parse_u32(captures: &Captures<'_>, index: usize) -> Result<u32, TorontoTimeParseError> {
    capture_str(captures, index)?
        .parse()
        .map_err(|_| TorontoTimeParseError::InvalidLocalTime)
}

fn parse_optional_i32(
    captures: &Captures<'_>,
    index: usize,
) -> Result<Option<i32>, TorontoTimeParseError> {
    captures
        .get(index)
        .map(|m| {
            m.as_str()
                .parse()
                .map_err(|_| TorontoTimeParseError::InvalidLocalTime)
        })
        .transpose()
}

fn parse_optional_u32(
    captures: &Captures<'_>,
    index: usize,
) -> Result<Option<u32>, TorontoTimeParseError> {
    captures
        .get(index)
        .map(|m| {
            m.as_str()
                .parse()
                .map_err(|_| TorontoTimeParseError::InvalidLocalTime)
        })
        .transpose()
}

fn apply_ampm(h: u32, ampm: Option<&str>) -> u32 {
    match ampm {
        Some(s) if s.eq_ignore_ascii_case("pm") => {
            if h == 12 {
                12
            } else {
                h + 12
            }
        }
        Some(s) if s.eq_ignore_ascii_case("am") => {
            if h == 12 {
                0
            } else {
                h
            }
        }
        _ => h,
    }
}

fn month_to_num(s: &str) -> Result<u32, TorontoTimeParseError> {
    Ok(match &s.to_lowercase()[..3] {
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
        _ => return Err(TorontoTimeParseError::UnsupportedFormat),
    })
}

fn to_utc(
    y: i32,
    mo: u32,
    d: u32,
    h: u32,
    mi: u32,
    s: u32,
) -> Result<DateTime<Utc>, TorontoTimeParseError> {
    let date = NaiveDate::from_ymd_opt(y, mo, d).ok_or(TorontoTimeParseError::InvalidLocalTime)?;
    let time = NaiveTime::from_hms_opt(h, mi, s).ok_or(TorontoTimeParseError::InvalidLocalTime)?;
    let naive = NaiveDateTime::new(date, time);
    let local = Toronto
        .from_local_datetime(&naive)
        .single()
        .ok_or(TorontoTimeParseError::InvalidLocalTime)?;
    Ok(local.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::{format_toronto_time, parse_toronto_time, TorontoTimeParseError};

    #[test]
    fn parses_iso_like_toronto_time() {
        let parsed = parse_toronto_time("2026-05-26 10:00", 2026).unwrap();

        assert_eq!(format_toronto_time(&parsed), "Tue 2026-05-26 10:00 EDT");
    }

    #[test]
    fn parses_slash_time_with_default_year_and_ampm() {
        let parsed = parse_toronto_time("26/5 10am", 2026).unwrap();

        assert_eq!(format_toronto_time(&parsed), "Tue 2026-05-26 10:00 EDT");
    }

    #[test]
    fn parses_named_month_after_weekday_prefix() {
        let parsed = parse_toronto_time("Tuesday, may 26 10:00", 2026).unwrap();

        assert_eq!(format_toronto_time(&parsed), "Tue 2026-05-26 10:00 EDT");
    }

    #[test]
    fn reports_unsupported_formats() {
        let error = parse_toronto_time("next Tuesday", 2026).unwrap_err();

        assert_eq!(error, TorontoTimeParseError::UnsupportedFormat);
    }
}
