import { Box, List, Stack, Text, Title } from "@mantine/core";
import type { LegalDoc } from "../../lib/legalContent";
import { BackButton } from "./BackButton";

/**
 * Shared renderer for the long-form legal pages (Privacy Policy, Terms of
 * Service). Content comes from `lib/legalContent.ts` for the active locale; this
 * component only handles presentation.
 *
 * Styling mirrors uoPlan's other content routes: an `--app-bg` <main> and a
 * centered column with a `BackButton`, an `order={2}` page title with a dimmed
 * subtitle, and the section body laid out as plain stacked typography (no card
 * surfaces).
 */
export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <Box
      component="main"
      style={{
        minHeight: "100dvh",
        padding: 24,
        backgroundColor: "var(--app-bg)",
        boxSizing: "border-box",
      }}
    >
      <Stack gap="lg" maw={760} mx="auto">
        <BackButton fallbackTo="/" />

        <Stack gap={4}>
          <Title order={2} c="var(--app-text)" fw={600}>
            {doc.title}
          </Title>
          <Text c="dimmed" size="sm">
            {doc.lastUpdated}
          </Text>
        </Stack>

        <Text c="dimmed" size="md" lh={1.6}>
          {doc.intro}
        </Text>

        <Stack gap="xl">
          {doc.sections.map((section) => (
            <Stack key={section.heading} gap="sm">
              <Title order={3} c="var(--app-text)" fw={600} fz={{ base: 17, sm: 19 }}>
                {section.heading}
              </Title>

              {section.paragraphs?.map((paragraph) => (
                <Text key={paragraph} size="sm" lh={1.65} c="var(--app-text)">
                  {paragraph}
                </Text>
              ))}

              {section.bullets && section.bullets.length > 0 ? (
                <List spacing="xs" size="sm" withPadding c="var(--app-text)">
                  {section.bullets.map((bullet) => (
                    <List.Item key={bullet} style={{ lineHeight: 1.6 }}>
                      {bullet}
                    </List.Item>
                  ))}
                </List>
              ) : null}
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
