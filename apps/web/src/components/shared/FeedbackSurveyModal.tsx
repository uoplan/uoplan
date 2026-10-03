import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { tr, useTr } from "../../i18n";
import classes from "./FeedbackSurveyModal.module.css";
import { FEEDBACK_SURVEY_URL } from "../../lib/feedbackSurvey";

const STORAGE_KEY = "uoplan:feedback-survey:v1";

export function FeedbackSurveyModal() {
  useTr();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    try {
      setOpened(localStorage.getItem(STORAGE_KEY) === null);
    } catch {
      setOpened(true);
    }
  }, []);

  const dismiss = () => {
    setOpened(false);
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // Keep the prompt dismissed for this visit when storage is unavailable.
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={dismiss}
      title={tr("feedbackSurvey.title")}
      closeButtonProps={{ "aria-label": tr("feedbackSurvey.dismiss") }}
      centered
      size={480}
      radius="lg"
      classNames={{ header: classes.header, title: classes.title, body: classes.body }}
    >
      <Stack gap="lg">
        <div className={classes.hero}>
          <Stack gap="sm" className={classes.copy}>
            <Text component="span" className={classes.badge}>
              {tr("feedbackSurvey.invitation")}
            </Text>
            <Text size="sm" c="dimmed" lh={1.65}>
              {tr("feedbackSurvey.description")}
            </Text>
          </Stack>
          <svg
            className={classes.illustration}
            viewBox="0 0 160 156"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="86" cy="86" r="62" fill="currentColor" opacity=".08" />
            <g transform="rotate(-9 72 85)">
              <rect x="26" y="30" width="91" height="112" rx="15" className={classes.paper} />
              <rect
                x="26"
                y="30"
                width="91"
                height="112"
                rx="15"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M27 59H116M48 23V38M94 23V38"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect x="43" y="75" width="15" height="15" rx="4" fill="currentColor" opacity=".16" />
              <path
                d="m46 82 3 3 6-7M69 82H99M43 108H96M43 121H78"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <path
              d="M95 46C95 37 102 30 111 30H134C143 30 150 37 150 46V61C150 70 143 77 134 77H123L111 87V77C102 77 95 70 95 61Z"
              fill="currentColor"
            />
            <path
              d="M109 53H135M109 62H125"
              className={classes.bubbleLines}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="m140 102 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM26 9l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"
              fill="currentColor"
            />
            <circle cx="9" cy="81" r="3" fill="currentColor" opacity=".45" />
          </svg>
        </div>
        <Text size="xs" c="dimmed" className={classes.details}>
          {tr("feedbackSurvey.details")}
        </Text>
        <Group gap="sm" className={classes.actions}>
          <Button
            component="a"
            href={FEEDBACK_SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            color="accentBlue"
            size="md"
            className={classes.primary}
            rightSection={<span aria-hidden="true">↗</span>}
          >
            {tr("feedbackSurvey.open")}
          </Button>
          <Button variant="subtle" color="gray" onClick={dismiss}>
            {tr("feedbackSurvey.dismiss")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
