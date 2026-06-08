use anyhow::Result;
use chrono::{DateTime, Utc};
use cliclack::{input, multiselect, outro_cancel, select};

use crate::proto::CourseSelection;
use crate::time_util::{current_toronto_year, format_toronto_time, parse_toronto_time};

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
    let selected_indices: Vec<usize> = if let Ok(v) = prompt.initial_values(all_indices).interact()
    {
        v
    } else {
        outro_cancel("Cancelled.")?;
        return Ok(None);
    };

    Ok(Some(
        selected_indices
            .into_iter()
            .map(|i| courses[i].clone())
            .collect(),
    ))
}

pub fn prompt_enrol_mode() -> Result<Option<EnrolMode>> {
    let Ok(mode) = select("How would you like to enrol?")
        .item(EnrolMode::Cart, "Add to cart only", "")
        .item(EnrolMode::Now, "Enrol now", "")
        .item(
            EnrolMode::Snipe,
            "Snipe (enrol at time)",
            "Schedule enrolment for exact open time",
        )
        .interact()
    else {
        outro_cancel("Cancelled.")?;
        return Ok(None);
    };
    Ok(Some(mode))
}

pub fn prompt_snipe_time() -> Result<Option<DateTime<Utc>>> {
    let default_year = current_toronto_year();
    loop {
        let raw: String = if let Ok(v) =
            input("Enter snipe time (Toronto local, e.g. 2026-05-26 10:00):").interact()
        {
            v
        } else {
            outro_cancel("Cancelled.")?;
            return Ok(None);
        };
        match parse_toronto_time(&raw, default_year) {
            Ok(dt) => {
                cliclack::log::info(format!("Sniping at: {}", format_toronto_time(&dt)))?;
                return Ok(Some(dt));
            }
            Err(_) => {
                cliclack::log::warning(
                    "Could not parse time. Try: '2026-05-26 10:00', '26/5 10am', 'may 26 10:00'",
                )?;
            }
        }
    }
}
