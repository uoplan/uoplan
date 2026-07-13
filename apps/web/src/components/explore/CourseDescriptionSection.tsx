import { Alert, Box, Button, Skeleton, Text, Title } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useTr } from "../../i18n";
import { useCourseDescription } from "../../hooks/useCourseDescription";
import classes from "./CourseDescriptionSection.module.css";

/**
 * Fetches and renders the "About" course description section.
 *
 * Rendering rules:
 * - Loading: three Skeleton lines.
 * - Error: localized Alert + retry Button.
 * - Empty description after load (no error): renders nothing.
 * - Descriptions that exceed 2 rendered lines are clamped with an inline
 *   Read more / Read less disclosure.
 *
 * The section is rendered unconditionally in the parent so the hook runs
 * unconditionally; null courseCode short-circuits the fetch and renders nothing.
 */
export function CourseDescriptionSection({
  courseCode,
  facultyId,
}: {
  courseCode: string | null;
  facultyId: string | null;
}) {
  const tr = useTr();
  const { description, loading, error, retry } = useCourseDescription(courseCode, facultyId);

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const expandedRef = useRef(expanded);
  const descriptionRef = useRef<HTMLSpanElement>(null);
  expandedRef.current = expanded;

  // Collapse whenever the displayed course changes so every new course starts unexpanded.
  useEffect(() => {
    setExpanded(false);
    setOverflows(false);
  }, [courseCode]);

  useEffect(() => {
    const element = descriptionRef.current;
    if (!description || !element) {
      setOverflows(false);
      return;
    }

    const measure = () => {
      if (expandedRef.current) return;
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [description]);

  const showToggle = overflows;
  const isClamped = !expanded;

  // Omit the section entirely when there is nothing to show and no in-progress state.
  if (!loading && !error && !description) return null;

  return (
    <Box>
      <Title order={3} c="var(--app-text)" fw={600} fz="sm" mb="xs">
        {tr("explore.course.about")}
      </Title>

      {loading ? (
        <>
          <Skeleton height={13} width="90%" radius="sm" mb={7} />
          <Skeleton height={13} width="85%" radius="sm" mb={7} />
          <Skeleton height={13} width="70%" radius="sm" />
        </>
      ) : error ? (
        <>
          <Alert color="red" variant="light" mb="xs">
            {tr("explore.course.description.error")}
          </Alert>
          <Button type="button" size="xs" variant="subtle" onClick={retry}>
            {tr("explore.course.description.retry")}
          </Button>
        </>
      ) : (
        <Box className={classes.description}>
          <Text
            component="span"
            ref={descriptionRef}
            size="sm"
            c="var(--app-text)"
            lh={1.6}
            className={isClamped ? classes.clamped : classes.expanded}
          >
            {description}
          </Text>
          {showToggle ? (
            <button
              type="button"
              className={`${classes.toggle} ${
                expanded ? classes.expandedToggle : classes.collapsedToggle
              }`}
              aria-expanded={expanded}
              onClick={() => {
                setExpanded((e) => !e);
              }}
            >
              {expanded
                ? tr("explore.course.description.showLess")
                : tr("explore.course.description.showMore")}
            </button>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
