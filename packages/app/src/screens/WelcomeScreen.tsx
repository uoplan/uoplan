import { useNavigate } from "@uoplan/navigation";
import type { AppRoute } from "@uoplan/navigation";
import { Badge, Button, Card, Container, SimpleGrid, Stack, Text, Title } from "@uoplan/ui";

interface Destination {
  route: AppRoute;
  title: string;
  description: string;
}

const DESTINATIONS: Destination[] = [
  {
    route: { name: "personalize" },
    title: "Plan my schedule",
    description: "Answer a few questions and generate conflict-free timetables.",
  },
  {
    route: { name: "explore" },
    title: "Explore courses",
    description: "Browse programs, courses, disciplines and professors.",
  },
  {
    route: { name: "trends" },
    title: "Grade trends",
    description: "See historical grade distributions across the university.",
  },
  {
    route: { name: "schedule" },
    title: "My schedule",
    description: "View and tweak your generated weekly calendar.",
  },
];

/**
 * The first screen authored once against the shared contracts (`@uoplan/ui` +
 * `@uoplan/navigation`). It imports no Mantine, React Native, or router code —
 * each shell resolves the platform UI variants and supplies a NavigationAdapter,
 * so this exact component renders on both web (Vite/Mantine) and native
 * (Metro/React Native). It is the end-to-end proof of the write-once stack.
 */
export function WelcomeScreen() {
  const navigate = useNavigate();
  return (
    <Container maxWidth={720} px="md" testID="welcome-screen">
      <Stack gap="lg">
        <Stack gap="xs">
          <Badge tone="accent">uoPlan</Badge>
          <Title order={1}>Plan your degree, one term at a time</Title>
          <Text dimmed>
            Requirement-first course planning for uOttawa students. This screen is written once and
            runs on both web and native.
          </Text>
        </Stack>
        <SimpleGrid cols={2} spacing="md">
          {DESTINATIONS.map((destination) => (
            <Card key={destination.title}>
              <Stack gap="xs">
                <Title order={4}>{destination.title}</Title>
                <Text size="sm" dimmed>
                  {destination.description}
                </Text>
                <Button
                  variant="light"
                  testID={`welcome-open-${destination.route.name}`}
                  onPress={() => navigate(destination.route)}
                >
                  Open
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
