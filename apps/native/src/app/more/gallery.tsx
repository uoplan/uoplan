import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, StyleSheet } from "react-native";

import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Collapse,
  Divider,
  Drawer,
  Flex,
  Group,
  Icon,
  Indicator,
  Loader,
  Menu,
  Modal,
  Motion,
  MultiSelect,
  Notification,
  NumberInput,
  Paper,
  Pill,
  Popover,
  Progress,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@uoplan/ui";
import { WelcomeScreen } from "@uoplan/app";

import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { ThemedView } from "@/components/themed-view";
import { NativeNavigationProvider } from "@/navigation/NativeNavigationProvider";
import { WebBadge } from "@/components/web-badge";
import { MaxContentWidth, Spacing } from "@/constants/theme";

/**
 * UI primitive gallery — renders every `@uoplan/ui` contract primitive via its
 * `.native.tsx` (React Native) implementation. This is the on-device proof that
 * the write-once component contract resolves and renders on the simulator; the
 * same primitives render their `.web.tsx` (Mantine) variants on apps/web. Lives
 * under the More tab as a developer reference.
 */
export default function GalleryScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState("week");
  const [campus, setCampus] = useState("main");
  const [credits, setCredits] = useState<number | undefined>(3);
  const [modalOpen, setModalOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState("overview");
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [selectVal, setSelectVal] = useState<string | null>(null);
  const [multiVals, setMultiVals] = useState<string[]>(["mat"]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifVisible, setNotifVisible] = useState(true);

  return (
    <RedesignScreen gap={Spacing.three} backLabel="Settings" onBack={() => router.back()}>
      <ScreenHeader title="Components" subtitle="Shared @uoplan/ui primitives, native variants" />

      <ThemedView style={styles.container}>
        <NativeNavigationProvider>
          <WelcomeScreen />
        </NativeNavigationProvider>
        <Box px="md" py="md">
          <Stack gap="lg">
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

            <Card>
              <Stack gap="sm">
                <Title order={4}>Icons &amp; indicators</Title>
                <Group gap="sm">
                  <ActionIcon variant="filled" label="star">
                    <Icon name="star" size={16} color="#fffdfa" />
                  </ActionIcon>
                  <ActionIcon variant="light" label="search">
                    <Icon name="search" size={16} />
                  </ActionIcon>
                  <ActionIcon variant="default" label="settings">
                    <Icon name="settings" size={16} />
                  </ActionIcon>
                  <ThemeIcon tone="accent">
                    <Icon name="calendar" size={16} color="#fffdfa" />
                  </ThemeIcon>
                  <ThemeIcon tone="success">
                    <Icon name="check" size={16} color="#fffdfa" />
                  </ThemeIcon>
                  <Indicator label={5} tone="danger">
                    <ThemeIcon tone="neutral">
                      <Icon name="heart" size={16} />
                    </ThemeIcon>
                  </Indicator>
                </Group>
                <Group gap="md" wrap>
                  {(
                    [
                      "home",
                      "search",
                      "calendar",
                      "chart",
                      "graph",
                      "school",
                      "book",
                      "user",
                    ] as const
                  ).map((iconName) => (
                    <Icon key={iconName} name={iconName} size={22} />
                  ))}
                </Group>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Motion</Title>
                <Text size="sm" dimmed>
                  Fade + slide on mount (framer-motion on web, RN Animated on native)
                </Text>
                <Motion from={{ opacity: 0, translateY: 12 }} to={{ opacity: 1 }} duration={400}>
                  <Paper p="md" radius="md" withBorder>
                    <Group gap="sm">
                      <Icon name="info" size={18} />
                      <Text size="sm">Animated surface</Text>
                    </Group>
                  </Paper>
                </Motion>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Tabs</Title>
                <Tabs
                  value={galleryTab}
                  onChange={setGalleryTab}
                  items={[
                    {
                      value: "overview",
                      label: "Overview",
                      content: <Text size="sm">Overview panel</Text>,
                    },
                    {
                      value: "details",
                      label: "Details",
                      content: <Text size="sm">Details panel</Text>,
                    },
                  ]}
                />
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Accordion &amp; collapse</Title>
                <Accordion
                  defaultOpen={["a"]}
                  items={[
                    {
                      value: "a",
                      label: "First section",
                      content: <Text size="sm">First body</Text>,
                    },
                    {
                      value: "b",
                      label: "Second section",
                      content: <Text size="sm">Second body</Text>,
                    },
                  ]}
                />
                <Button variant="subtle" onPress={() => setCollapseOpen((open) => !open)}>
                  {collapseOpen ? "Hide details" : "Show details"}
                </Button>
                <Collapse open={collapseOpen}>
                  <Text size="sm" dimmed>
                    Collapsible content revealed via the Collapse primitive.
                  </Text>
                </Collapse>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Selects &amp; overlays</Title>
                <Select
                  label="Term"
                  placeholder="Pick a term…"
                  value={selectVal}
                  onChange={setSelectVal}
                  data={[
                    { value: "fall", label: "Fall 2025" },
                    { value: "winter", label: "Winter 2026" },
                    { value: "summer", label: "Summer 2026" },
                  ]}
                />
                <MultiSelect
                  label="Subjects"
                  placeholder="Pick subjects…"
                  value={multiVals}
                  onChange={setMultiVals}
                  data={[
                    { value: "mat", label: "MAT" },
                    { value: "iti", label: "ITI" },
                    { value: "csi", label: "CSI" },
                  ]}
                />
                <Group gap="sm" wrap>
                  <Tooltip label="Web-only hover hint">
                    <Button variant="default" onPress={() => {}}>
                      Tooltip
                    </Button>
                  </Tooltip>
                  <Menu
                    target={
                      <Button variant="light" onPress={() => {}}>
                        Menu
                      </Button>
                    }
                    items={[
                      { value: "share", label: "Share", onSelect: () => {} },
                      { value: "export", label: "Export ICS", onSelect: () => {} },
                    ]}
                  />
                  <Popover
                    opened={popoverOpen}
                    onChange={setPopoverOpen}
                    target={
                      <Button variant="outline" onPress={() => setPopoverOpen((o) => !o)}>
                        Popover
                      </Button>
                    }
                  >
                    <Text size="sm">Floating popover content.</Text>
                  </Popover>
                  <Button variant="subtle" onPress={() => setDrawerOpen(true)}>
                    Open drawer
                  </Button>
                </Group>
              </Stack>
            </Card>

            <Card>
              <Stack gap="sm">
                <Title order={4}>Table &amp; notification</Title>
                <Table
                  columns={[
                    { key: "code", header: "Course" },
                    { key: "section", header: "Section" },
                    { key: "seats", header: "Seats" },
                  ]}
                  rows={[
                    { code: "ITI 1120", section: "A00", seats: "12" },
                    { code: "MAT 1320", section: "B00", seats: "3" },
                    { code: "CSI 2110", section: "C00", seats: "0" },
                  ]}
                />
                {notifVisible ? (
                  <Notification
                    title="Schedule generated"
                    tone="success"
                    onClose={() => setNotifVisible(false)}
                  >
                    3 conflict-free timetables found.
                  </Notification>
                ) : (
                  <Button variant="subtle" onPress={() => setNotifVisible(true)}>
                    Restore notification
                  </Button>
                )}
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
        <Drawer
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Drawer primitive"
          position="right"
        >
          <Stack gap="sm">
            <Text size="sm" dimmed>
              This side panel renders via the native Drawer variant.
            </Text>
            <Button variant="filled" onPress={() => setDrawerOpen(false)}>
              Close
            </Button>
          </Stack>
        </Drawer>
        {Platform.OS === "web" && <WebBadge />}
      </ThemedView>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    flexGrow: 1,
  },
});
