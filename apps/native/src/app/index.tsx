import { useState } from "react";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Pill,
  Progress,
  Radio,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@uoplan/ui";

import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * UI primitive gallery — renders every `@uoplan/ui` contract primitive via its
 * `.native.tsx` (React Native) implementation. This is the on-device proof that
 * the write-once component contract resolves and renders on the simulator; the
 * same primitives render their `.web.tsx` (Mantine) variants on apps/web.
 */
export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const [segment, setSegment] = useState("week");
  const [campus, setCampus] = useState("main");
  const [credits, setCredits] = useState<number | undefined>(3);
  const [modalOpen, setModalOpen] = useState(false);

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: { paddingTop: Spacing.six, paddingBottom: Spacing.four },
    default: { paddingTop: insets.top, paddingBottom: insets.bottom },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}
    >
      <ThemedView style={styles.container}>
        <Box px="md" py="md">
          <Stack gap="lg">
            <Stack gap="xs">
              <Title order={2}>Components</Title>
              <Text dimmed size="sm">
                Shared @uoplan/ui primitives, native variants
              </Text>
            </Stack>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Typography</Title>
                <Text size="xl" weight="bold">
                  Extra large bold
                </Text>
                <Text size="lg" weight="semibold">
                  Large semibold
                </Text>
                <Text size="md">Medium regular</Text>
                <Text size="sm" dimmed>
                  Small dimmed
                </Text>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Badges</Title>
                <Group gap="xs" wrap>
                  <Badge tone="accent">accent</Badge>
                  <Badge tone="neutral">neutral</Badge>
                  <Badge tone="success">success</Badge>
                  <Badge tone="warning">warning</Badge>
                  <Badge tone="danger">danger</Badge>
                </Group>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Buttons</Title>
                <Button variant="filled" fullWidth onPress={() => {}}>
                  filled
                </Button>
                <Group gap="sm">
                  <Button variant="light" onPress={() => {}}>
                    light
                  </Button>
                  <Button variant="outline" onPress={() => {}}>
                    outline
                  </Button>
                  <Button variant="subtle" onPress={() => {}}>
                    subtle
                  </Button>
                </Group>
                <Button disabled onPress={() => {}}>
                  disabled
                </Button>
              </Stack>
            </Card>

            <Paper p="md" withBorder shadow="sm">
              <Stack gap="sm">
                <Title order={4}>Surfaces &amp; layout</Title>
                <Text size="sm" dimmed>
                  Paper with border + shadow. Below: a divider and a centered loader.
                </Text>
                <Divider my="xs" />
                <Center>
                  <Loader />
                </Center>
              </Stack>
            </Paper>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Forms &amp; feedback</Title>
                <TextInput
                  label="Search"
                  placeholder="Type a course…"
                  value=""
                  onChangeText={() => {}}
                />
                <Checkbox label="Include full sections" defaultChecked onChange={() => {}} />
                <Switch label="Avoid 8:30am classes" defaultChecked onChange={() => {}} />
                <Progress value={64} />
                <Group gap="xs" wrap>
                  <Pill>MAT1320</Pill>
                  <Pill>ITI1120</Pill>
                  <Pill>ENG1112</Pill>
                </Group>
                <Alert tone="info" title="Heads up">
                  These are the shared form primitives, native variants.
                </Alert>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Inputs</Title>
                <SegmentedControl
                  value={segment}
                  onChange={setSegment}
                  fullWidth
                  data={[
                    { value: "week", label: "Week" },
                    { value: "list", label: "List" },
                  ]}
                />
                <Radio
                  label="Campus"
                  value={campus}
                  onChange={setCampus}
                  data={[
                    { value: "main", label: "Main campus" },
                    { value: "online", label: "Online" },
                  ]}
                />
                <NumberInput
                  label="Credits"
                  value={credits}
                  onChange={setCredits}
                  min={0}
                  max={6}
                />
                <Button variant="outline" onPress={() => setModalOpen(true)}>
                  Open modal
                </Button>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Grid &amp; flex</Title>
                <SimpleGrid cols={3} spacing="xs">
                  <Badge tone="accent">1</Badge>
                  <Badge tone="neutral">2</Badge>
                  <Badge tone="success">3</Badge>
                  <Badge tone="warning">4</Badge>
                  <Badge tone="danger">5</Badge>
                  <Badge tone="neutral">6</Badge>
                </SimpleGrid>
                <Flex direction="row" gap="sm" justify="between">
                  <Text size="sm">left</Text>
                  <Text size="sm" dimmed>
                    right
                  </Text>
                </Flex>
              </Stack>
            </Card>
          </Stack>
        </Box>
        <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Modal primitive">
          <Stack gap="sm">
            <Text size="sm" dimmed>
              This dialog renders via the native Modal variant.
            </Text>
            <Button variant="filled" onPress={() => setModalOpen(false)}>
              Close
            </Button>
          </Stack>
        </Modal>
        {Platform.OS === "web" && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
});
