import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Paper, Stack, Text, Title } from "@uoplan/ui";

import { ProfessorGraph } from "@/components/professor-graph";
import { BottomTabInset, MaxContentWidth, Spacing, Surface } from "@/constants/theme";
import {
  GRAPH_GROUP_COLORS,
  SAMPLE_GRAPH_EDGES,
  SAMPLE_GRAPH_NODES,
  graphGroupColor,
} from "@/data/sample-graph";

/**
 * Professor network screen — the native analogue of the web `/graph` page. Shows
 * a force-directed co-occurrence graph of professors (coloured by discipline) and
 * a details panel for the selected node: its discipline, the number of
 * connections, and the colleagues it links to. Sample data stands in until the
 * live `.pb` professors/schedules graph is wired.
 */
export default function ProfessorGraphScreen() {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const selected = useMemo(() => SAMPLE_GRAPH_NODES.find((n) => n.id === selectedId), [selectedId]);

  const neighbours = useMemo(() => {
    if (!selectedId) return [];
    const ids = new Set<string>();
    for (const edge of SAMPLE_GRAPH_EDGES) {
      if (edge.source === selectedId) ids.add(edge.target);
      else if (edge.target === selectedId) ids.add(edge.source);
    }
    return SAMPLE_GRAPH_NODES.filter((n) => ids.has(n.id));
  }, [selectedId]);

  const groups = useMemo(() => Object.keys(GRAPH_GROUP_COLORS), []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.column}>
        <Stack gap="md">
          <View>
            <Title order={3}>Professor network</Title>
            <Text size="sm" dimmed>
              Professors who co-teach are linked — tap a node to explore.
            </Text>
          </View>

          <Paper p="sm" radius="lg" withBorder>
            <ProfessorGraph
              nodes={SAMPLE_GRAPH_NODES}
              edges={SAMPLE_GRAPH_EDGES}
              colorFor={graphGroupColor}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? undefined : id))}
            />
          </Paper>

          <View style={styles.legend}>
            {groups.map((group) => (
              <View key={group} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: GRAPH_GROUP_COLORS[group] }]} />
                <Text size="xs" dimmed>
                  {group}
                </Text>
              </View>
            ))}
          </View>

          {selected ? (
            <Paper p="md" radius="lg" withBorder>
              <Stack gap="sm">
                <View style={styles.detailHeader}>
                  <View
                    style={[styles.detailDot, { backgroundColor: graphGroupColor(selected.group) }]}
                  />
                  <View style={styles.detailHeaderText}>
                    <Title order={4}>{selected.label}</Title>
                    <Text size="sm" dimmed>
                      {selected.group}
                    </Text>
                  </View>
                </View>
                <Text size="sm" weight="semibold">
                  {neighbours.length} connection{neighbours.length === 1 ? "" : "s"}
                </Text>
                <View style={styles.neighbourRow}>
                  {neighbours.map((n) => (
                    <Pressable
                      key={n.id}
                      onPress={() => setSelectedId(n.id)}
                      style={styles.neighbourChip}
                    >
                      <View
                        style={[styles.neighbourDot, { backgroundColor: graphGroupColor(n.group) }]}
                      />
                      <Text size="xs">{n.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Stack>
            </Paper>
          ) : (
            <Paper p="md" radius="lg" withBorder>
              <Text size="sm" dimmed align="center">
                Select a professor to see their connections.
              </Text>
            </Paper>
          )}

          <Text size="xs" dimmed align="center">
            Sample data — the live professor graph loads once the data layer is wired.
          </Text>
        </Stack>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.page,
  },
  content: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  column: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    rowGap: Spacing.two,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  detailDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  detailHeaderText: {
    flex: 1,
  },
  neighbourRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  neighbourChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.subtle,
  },
  neighbourDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
