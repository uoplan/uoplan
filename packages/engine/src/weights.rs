//! Soft selection weights shared by basic- and advanced-mode generation.
//!
//! Both modes bias random course selection by two optional preferences:
//!  - "prefer easier" over the A+ difficulty map (higher A+% → higher weight),
//!  - "prefer higher sentiment" over the 1-5 course-feedback scale.
//!
//! The pivots/bases below are the single source of truth for both modes so the
//! two paths stay in lock-step.

use std::collections::HashMap;

const EASIER_APLUS_PIVOT: f64 = 20.0;
const EASIER_APLUS_BASE: f64 = 5.25;
const EASIER_APLUS_SCALE: f64 = 10.0;

// "Prefer higher sentiment" soft weighting over the 1-5 course-feedback scale.
// Pivot 3.5 is neutral; a course one point above gets ~2x weight, one below ~0.5x.
const SENTIMENT_PIVOT: f64 = 3.5;
const SENTIMENT_BASE: f64 = 2.0;
const SENTIMENT_SCALE: f64 = 1.0;

// "Prefer higher professor rating" soft weighting over the 0-5 RateMyProfessors
// scale, biasing *section* selection by the section's professor rating. Same
// exponential shape as sentiment (pivot 3.5 neutral; +1 ≈ 2x, -1 ≈ 0.5x).
// Unrated professors are treated as `PROFESSOR_RATING_UNRATED` (slightly above
// neutral) so rated-but-mediocre profs don't outrank the great unknown.
const PROFESSOR_RATING_PIVOT: f64 = 3.5;
const PROFESSOR_RATING_BASE: f64 = 2.0;
const PROFESSOR_RATING_SCALE: f64 = 1.0;
pub(crate) const PROFESSOR_RATING_UNRATED: f64 = 4.0;

/// Prefer-easier soft multiplier for `code` (1.0 when disabled or unknown).
pub(crate) fn easier_weight(code: &str, prefer_easier: bool, aplus: &HashMap<String, f64>) -> f64 {
    if !prefer_easier {
        return 1.0;
    }
    match aplus.get(code) {
        None => 1.0,
        Some(&a) => EASIER_APLUS_BASE.powf((a - EASIER_APLUS_PIVOT) / EASIER_APLUS_SCALE),
    }
}

/// Prefer-higher-sentiment soft multiplier for `code` (1.0 when disabled or unknown).
pub(crate) fn sentiment_weight(
    code: &str,
    prefer_higher_sentiment: bool,
    sentiment: &HashMap<String, f64>,
) -> f64 {
    if !prefer_higher_sentiment {
        return 1.0;
    }
    match sentiment.get(code) {
        None => 1.0,
        Some(&s) => SENTIMENT_BASE.powf((s - SENTIMENT_PIVOT) / SENTIMENT_SCALE),
    }
}

/// Prefer-higher-professor-rating soft multiplier for a section's representative
/// rating (1.0 when disabled). `rating` is `None` for an unrated/instructor-less
/// section, which is treated as [`PROFESSOR_RATING_UNRATED`].
pub(crate) fn professor_rating_weight(rating: Option<f64>, prefer: bool) -> f64 {
    if !prefer {
        return 1.0;
    }
    let r = match rating {
        Some(r) if r.is_finite() => r,
        _ => PROFESSOR_RATING_UNRATED,
    };
    PROFESSOR_RATING_BASE.powf((r - PROFESSOR_RATING_PIVOT) / PROFESSOR_RATING_SCALE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn easier_preference_orders_courses_by_aplus_rate() {
        let aplus = HashMap::from([
            ("HARD 1000".to_string(), 10.0),
            ("NEUT 1000".to_string(), 20.0),
            ("EASY 1000".to_string(), 30.0),
        ]);

        let hard = easier_weight("HARD 1000", true, &aplus);
        let neutral = easier_weight("NEUT 1000", true, &aplus);
        let easy = easier_weight("EASY 1000", true, &aplus);

        assert!(easy > neutral);
        assert!(neutral > hard);
        assert_eq!(easier_weight("UNKNOWN 1000", true, &aplus), 1.0);
        assert_eq!(easier_weight("EASY 1000", false, &aplus), 1.0);
    }

    #[test]
    fn sentiment_preference_orders_courses_by_feedback_rating() {
        let sentiment = HashMap::from([
            ("LOW 1000".to_string(), 2.5),
            ("NEUT 1000".to_string(), 3.5),
            ("HIGH 1000".to_string(), 4.5),
        ]);

        let low = sentiment_weight("LOW 1000", true, &sentiment);
        let neutral = sentiment_weight("NEUT 1000", true, &sentiment);
        let high = sentiment_weight("HIGH 1000", true, &sentiment);

        assert!(high > neutral);
        assert!(neutral > low);
        assert_eq!(sentiment_weight("UNKNOWN 1000", true, &sentiment), 1.0);
        assert_eq!(sentiment_weight("HIGH 1000", false, &sentiment), 1.0);
    }

    #[test]
    fn easier_and_sentiment_multipliers_compose_for_combined_ranking() {
        let aplus = HashMap::from([
            ("BEST 1000".to_string(), 30.0),
            ("MIXED 1000".to_string(), 30.0),
            ("WORST 1000".to_string(), 10.0),
        ]);
        let sentiment = HashMap::from([
            ("BEST 1000".to_string(), 4.5),
            ("MIXED 1000".to_string(), 2.5),
            ("WORST 1000".to_string(), 2.5),
        ]);

        let combined = |code: &str| {
            easier_weight(code, true, &aplus) * sentiment_weight(code, true, &sentiment)
        };

        assert!(combined("BEST 1000") > combined("MIXED 1000"));
        assert!(combined("MIXED 1000") > combined("WORST 1000"));
    }

    #[test]
    fn professor_rating_preference_orders_sections_and_defaults_unrated() {
        // Disabled => neutral.
        assert_eq!(professor_rating_weight(Some(4.5), false), 1.0);

        let high = professor_rating_weight(Some(4.5), true);
        let neutral = professor_rating_weight(Some(PROFESSOR_RATING_PIVOT), true);
        let low = professor_rating_weight(Some(2.5), true);
        let unrated = professor_rating_weight(None, true);

        assert!(high > neutral);
        assert!(neutral > low);
        // Unrated is treated as ~4.0 — above neutral but below a top-rated prof.
        assert_eq!(
            unrated,
            professor_rating_weight(Some(PROFESSOR_RATING_UNRATED), true)
        );
        assert!(unrated > neutral);
        assert!(high > unrated);
    }
}
