//! Prerequisite evaluation, ported from `prerequisites/{context,evaluator}.ts`.

use std::collections::HashMap;

use crate::model::{
    course_level, language_variant, normalize_course_code, subject_prefix, DataView,
};
use crate::proto::data::{CoursePrereqKind, CoursePrereqNode, CoursePrereqNodeType};

pub struct TakenCourse {
    pub code: String,
    pub credits: f64,
    pub discipline: String,
    pub level: Option<i64>,
}

pub struct PrereqContext {
    pub taken: Vec<TakenCourse>,
    pub total_credits: f64,
    pub discipline_credits: HashMap<String, f64>,
    pub student_programs: Vec<String>,
}

pub fn build_prereq_context(
    completed: &[String],
    data: &DataView,
    student_programs: &[String],
) -> PrereqContext {
    let mut taken: Vec<TakenCourse> = Vec::new();
    let mut total_credits = 0.0;
    let mut discipline_credits: HashMap<String, f64> = HashMap::new();
    let mut seen: Vec<String> = Vec::new();

    for raw in completed {
        let canonical = data.resolve_to_canonical(raw);
        let course = match data.get_course(&canonical) {
            Some(c) => c,
            None => continue,
        };
        if seen.contains(&canonical) {
            continue;
        }
        seen.push(canonical.clone());

        let credits = course.credits;
        let canon_str = data.canonical_code_str(&canonical);
        let discipline = subject_prefix(&canon_str);
        taken.push(TakenCourse {
            code: canonical.clone(),
            credits,
            discipline: discipline.clone(),
            level: course_level(&canon_str),
        });
        total_credits += credits;
        if !discipline.is_empty() {
            *discipline_credits.entry(discipline).or_insert(0.0) += credits;
        }
    }

    PrereqContext {
        taken,
        total_credits,
        discipline_credits,
        student_programs: student_programs.to_vec(),
    }
}

fn is_soft_kind(kind: i32) -> bool {
    matches!(
        CoursePrereqKind::try_from(kind),
        Ok(CoursePrereqKind::Permission)
            | Ok(CoursePrereqKind::Audition)
            | Ok(CoursePrereqKind::Language)
            | Ok(CoursePrereqKind::Highschool)
            | Ok(CoursePrereqKind::Recommended)
            | Ok(CoursePrereqKind::Topic)
    )
}

fn is_soft_non_course(node: &CoursePrereqNode) -> bool {
    node.r#type == CoursePrereqNodeType::NonCourse as i32
        && node.credits.is_none()
        && node.kind.map(is_soft_kind).unwrap_or(false)
}

pub fn can_take_course(code: &str, data: &DataView, ctx: &PrereqContext) -> bool {
    let course = match data.get_course(code) {
        Some(c) => c,
        None => return false,
    };
    match &course.prerequisites {
        None => true,
        Some(prereq) => meets_prereq(prereq, ctx, false),
    }
}

fn meets_prereq(node: &CoursePrereqNode, ctx: &PrereqContext, in_or_group: bool) -> bool {
    if !node.programs.is_empty() {
        let in_program = node
            .programs
            .iter()
            .any(|p| ctx.student_programs.contains(p));
        if !in_program {
            return false;
        }
    }

    let node_type = node.r#type;
    if node_type == CoursePrereqNodeType::Course as i32 {
        evaluate_course_requirement(node, ctx)
    } else if node_type == CoursePrereqNodeType::AndGroup as i32 {
        node.children.iter().all(|c| meets_prereq(c, ctx, false))
    } else if node_type == CoursePrereqNodeType::OrGroup as i32 {
        node.children.iter().any(|c| meets_prereq(c, ctx, true))
    } else if node_type == CoursePrereqNodeType::NonCourse as i32 {
        evaluate_non_course(node, ctx, in_or_group)
    } else {
        true
    }
}

fn evaluate_course_requirement(node: &CoursePrereqNode, ctx: &PrereqContext) -> bool {
    let code = match &node.code {
        Some(c) if !c.is_empty() => c,
        _ => return true,
    };
    let target = normalize_course_code(code);
    let variant = language_variant(&target);
    ctx.taken
        .iter()
        .any(|c| c.code == target || variant.as_deref() == Some(c.code.as_str()))
}

fn collect_course_codes(node: &CoursePrereqNode, out: &mut Vec<String>) {
    if node.r#type == CoursePrereqNodeType::Course as i32 {
        if let Some(code) = &node.code {
            let target = normalize_course_code(code);
            if let Some(v) = language_variant(&target) {
                if !out.contains(&v) {
                    out.push(v);
                }
            }
            if !out.contains(&target) {
                out.push(target);
            }
        }
    }
    for child in &node.children {
        collect_course_codes(child, out);
    }
}

fn evaluate_non_course(node: &CoursePrereqNode, ctx: &PrereqContext, in_or_group: bool) -> bool {
    let credits = match node.credits {
        None => {
            if is_soft_non_course(node) {
                return !in_or_group;
            }
            return false;
        }
        Some(c) => c,
    };

    if !node.children.is_empty() {
        let mut codes: Vec<String> = Vec::new();
        for child in &node.children {
            collect_course_codes(child, &mut codes);
        }
        if codes.is_empty() {
            return false;
        }
        let sum: f64 = ctx
            .taken
            .iter()
            .filter(|c| codes.contains(&c.code))
            .map(|c| c.credits)
            .sum();
        return sum >= credits;
    }

    credits_matching_non_course(node, ctx) >= credits
}

fn credits_matching_non_course(node: &CoursePrereqNode, ctx: &PrereqContext) -> f64 {
    // 1. discipline + level constraints
    if !node.discipline_levels.is_empty() {
        let mut sum = 0.0;
        for t in &ctx.taken {
            for dl in &node.discipline_levels {
                if dl.discipline.to_ascii_uppercase() != t.discipline.to_ascii_uppercase() {
                    continue;
                }
                if dl.levels.is_empty() {
                    sum += t.credits;
                    break;
                }
                if let Some(lv) = t.level {
                    if dl.levels.contains(&(lv as u32)) {
                        sum += t.credits;
                        break;
                    }
                }
            }
        }
        return sum;
    }

    // 2. both disciplines and levels
    if !node.disciplines.is_empty() && !node.levels.is_empty() {
        let dset: Vec<String> = node
            .disciplines
            .iter()
            .map(|d| d.to_ascii_uppercase())
            .collect();
        let mut sum = 0.0;
        for t in &ctx.taken {
            if !dset.contains(&t.discipline.to_ascii_uppercase()) {
                continue;
            }
            if let Some(lv) = t.level {
                if node.levels.contains(&(lv as u32)) {
                    sum += t.credits;
                }
            }
        }
        return sum;
    }

    // 3. only levels
    if !node.levels.is_empty() && node.disciplines.is_empty() {
        let mut sum = 0.0;
        for t in &ctx.taken {
            if let Some(lv) = t.level {
                if node.levels.contains(&(lv as u32)) {
                    sum += t.credits;
                }
            }
        }
        return sum;
    }

    // 4. only disciplines
    if !node.disciplines.is_empty() {
        return node
            .disciplines
            .iter()
            .map(|d| {
                *ctx.discipline_credits
                    .get(&d.to_ascii_uppercase())
                    .unwrap_or(&0.0)
            })
            .sum();
    }

    // 5. fallback: total credits
    ctx.total_credits
}

/// True if the prereq tree contains any non-soft `non_course` node.
pub fn prerequisites_contain_non_course(node: Option<&CoursePrereqNode>) -> bool {
    let node = match node {
        Some(n) => n,
        None => return false,
    };
    if node.r#type == CoursePrereqNodeType::NonCourse as i32 && !is_soft_non_course(node) {
        return true;
    }
    node.children
        .iter()
        .any(|c| prerequisites_contain_non_course(Some(c)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::data::{
        Catalogue, Course, CoursePrereqDisciplineLevel, CoursePrereqKind, SchedulesData,
    };

    fn course_node(code: &str) -> CoursePrereqNode {
        CoursePrereqNode {
            r#type: CoursePrereqNodeType::Course as i32,
            code: Some(code.to_string()),
            ..Default::default()
        }
    }

    fn and_node(children: Vec<CoursePrereqNode>) -> CoursePrereqNode {
        CoursePrereqNode {
            r#type: CoursePrereqNodeType::AndGroup as i32,
            children,
            ..Default::default()
        }
    }

    fn or_node(children: Vec<CoursePrereqNode>) -> CoursePrereqNode {
        CoursePrereqNode {
            r#type: CoursePrereqNodeType::OrGroup as i32,
            children,
            ..Default::default()
        }
    }

    fn non_course_node(credits: Option<f64>) -> CoursePrereqNode {
        CoursePrereqNode {
            r#type: CoursePrereqNodeType::NonCourse as i32,
            credits,
            ..Default::default()
        }
    }

    fn soft_non_course(kind: CoursePrereqKind) -> CoursePrereqNode {
        CoursePrereqNode {
            r#type: CoursePrereqNodeType::NonCourse as i32,
            kind: Some(kind as i32),
            ..Default::default()
        }
    }

    fn data_with_prereqs(courses: Vec<(&str, f64, Option<CoursePrereqNode>)>) -> DataView {
        let course_codes = courses
            .iter()
            .map(|(code, _, _)| (*code).to_string())
            .collect::<Vec<_>>();
        let courses = courses
            .into_iter()
            .enumerate()
            .map(|(index, (_, credits, prerequisites))| Course {
                code: index as u32,
                credits,
                prerequisites,
                ..Default::default()
            })
            .collect();
        DataView::new(
            Catalogue {
                course_codes,
                courses,
                ..Default::default()
            },
            SchedulesData::default(),
        )
    }

    fn ctx(data: &DataView, completed: &[&str]) -> PrereqContext {
        build_prereq_context(
            &completed
                .iter()
                .map(|c| (*c).to_string())
                .collect::<Vec<_>>(),
            data,
            &[],
        )
    }

    #[test]
    fn nested_course_prerequisites_accept_language_variants() {
        let target_prereq = and_node(vec![
            course_node("MAT 1500"),
            or_node(vec![course_node("CSI 1100"), course_node("ITI 1120")]),
        ]);
        let data = data_with_prereqs(vec![
            ("MAT 1100", 3.0, None),
            ("MAT 1500", 3.0, None),
            ("CSI 1100", 3.0, None),
            ("ITI 1120", 3.0, None),
            ("ADV 2500", 3.0, Some(target_prereq)),
        ]);

        assert!(can_take_course(
            "ADV 2500",
            &data,
            &ctx(&data, &["MAT 1100", "CSI 1100"]),
        ));
        assert!(!can_take_course(
            "ADV 2500",
            &data,
            &ctx(&data, &["MAT 1100"]),
        ));
    }

    #[test]
    fn scoped_credit_prerequisites_count_only_their_child_course_set() {
        let mut six_credits_from_two_courses = non_course_node(Some(6.0));
        six_credits_from_two_courses.children =
            vec![course_node("MAT 1500"), course_node("CSI 1100")];

        let data = data_with_prereqs(vec![
            ("MAT 1100", 3.0, None),
            ("MAT 1500", 3.0, None),
            ("CSI 1100", 3.0, None),
            ("ECO 1100", 3.0, None),
            ("ADV 2500", 3.0, Some(six_credits_from_two_courses)),
        ]);

        assert!(can_take_course(
            "ADV 2500",
            &data,
            &ctx(&data, &["MAT 1100", "CSI 1100", "ECO 1100"]),
        ));
        assert!(!can_take_course(
            "ADV 2500",
            &data,
            &ctx(&data, &["MAT 1100", "ECO 1100"]),
        ));
    }

    #[test]
    fn non_course_credit_requirements_honour_discipline_level_and_program_gates() {
        let mut csi_2000_credit_gate = non_course_node(Some(6.0));
        csi_2000_credit_gate.discipline_levels = vec![CoursePrereqDisciplineLevel {
            discipline: "csi".to_string(),
            levels: vec![2000],
        }];
        csi_2000_credit_gate.programs = vec!["SEG".to_string()];

        let data = data_with_prereqs(vec![
            ("CSI 2100", 3.0, None),
            ("CSI 2500", 3.0, None),
            ("CSI 1100", 3.0, None),
            ("ADV 3500", 3.0, Some(csi_2000_credit_gate.clone())),
        ]);
        let eligible = build_prereq_context(
            &["CSI 2100".to_string(), "CSI 2500".to_string()],
            &data,
            &["SEG".to_string()],
        );
        let wrong_program = build_prereq_context(
            &["CSI 2100".to_string(), "CSI 2500".to_string()],
            &data,
            &["CSI".to_string()],
        );
        let too_few_matching_credits = build_prereq_context(
            &["CSI 2100".to_string(), "CSI 1100".to_string()],
            &data,
            &["SEG".to_string()],
        );

        assert!(can_take_course("ADV 3500", &data, &eligible));
        assert!(!can_take_course("ADV 3500", &data, &wrong_program));
        assert!(!can_take_course(
            "ADV 3500",
            &data,
            &too_few_matching_credits
        ));
    }

    #[test]
    fn soft_non_course_gates_pass_alone_but_do_not_satisfy_an_or_group() {
        let data = data_with_prereqs(vec![
            ("CSI 1100", 3.0, None),
            (
                "ADM 2000",
                3.0,
                Some(soft_non_course(CoursePrereqKind::Permission)),
            ),
            (
                "ADM 2001",
                3.0,
                Some(or_node(vec![
                    soft_non_course(CoursePrereqKind::Permission),
                    course_node("CSI 1100"),
                ])),
            ),
        ]);

        assert!(can_take_course("ADM 2000", &data, &ctx(&data, &[])));
        assert!(!can_take_course("ADM 2001", &data, &ctx(&data, &[])));
        assert!(can_take_course(
            "ADM 2001",
            &data,
            &ctx(&data, &["CSI 1100"])
        ));
    }

    #[test]
    fn conservative_non_course_gates_block_and_are_reported_for_weighting() {
        let hard_gate = soft_non_course(CoursePrereqKind::Standing);
        let soft_gate = soft_non_course(CoursePrereqKind::Recommended);
        let data = data_with_prereqs(vec![
            ("ADV 3000", 3.0, Some(hard_gate.clone())),
            ("ADV 3001", 3.0, Some(soft_gate.clone())),
        ]);

        assert!(!can_take_course("ADV 3000", &data, &ctx(&data, &[])));
        assert!(can_take_course("ADV 3001", &data, &ctx(&data, &[])));
        assert!(prerequisites_contain_non_course(Some(&hard_gate)));
        assert!(!prerequisites_contain_non_course(Some(&soft_gate)));
    }
}
