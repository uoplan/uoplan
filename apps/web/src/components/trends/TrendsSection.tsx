import { Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function TrendsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Stack gap="md" component="section">
      <Stack gap={2}>
        <Title
          order={2}
          style={{
            fontFamily: "var(--app-font-heading)",
            color: "var(--app-text)",
            fontWeight: 400,
            fontSize: "clamp(1.1rem, 2.6vw, 1.35rem)",
          }}
        >
          {title}
        </Title>
        {description ? (
          <Text size="sm" c="dimmed" maw={640}>
            {description}
          </Text>
        ) : null}
      </Stack>
      {children}
    </Stack>
  );
}
