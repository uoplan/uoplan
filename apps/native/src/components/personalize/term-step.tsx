import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";
import { Fonts, Spacing, Surface } from "@/constants/theme";

interface TermStepProps {
  options: SearchableSelectOption[];
  value: string | null;
  onChange: (termId: string | null) => void;
  reminders?: ReactNode;
}

export function TermStep({ options, value, onChange, reminders }: TermStepProps) {
  const selected = options.find((option) => option.value === value) ?? null;
  const featured = options.slice(0, 4);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Planning term</Text>
        <Text style={styles.current}>{selected?.label ?? "Select a term"}</Text>
        <Text style={styles.copy}>
          Pick the semester you want to build. We use it to load real sections and schedule times.
        </Text>
      </View>

      {featured.length > 0 ? (
        <View style={styles.termGrid}>
          {featured.map((term) => {
            const active = term.value === value;
            return (
              <Pressable
                key={term.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChange(term.value)}
                style={({ pressed }) => [
                  styles.termCard,
                  active ? styles.termCardActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.termLabel, active ? styles.termLabelActive : null]}>
                  {term.label}
                </Text>
                <Text style={[styles.termMeta, active ? styles.termMetaActive : null]}>
                  {active ? "Selected" : "Tap to choose"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Find another term</Text>
        <SearchableSelect
          title="Term"
          options={options}
          value={value}
          onChange={onChange}
          placeholder="Select your term…"
          searchPlaceholder="Search terms"
          emptyMessage="No terms match your search."
          clearable={false}
        />
      </View>

      {reminders ? <View style={styles.reminders}>{reminders}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  hero: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 24,
    backgroundColor: Surface.accentSoft,
    padding: Spacing.three,
  },
  eyebrow: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: Surface.accent,
  },
  current: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
    color: Surface.label,
  },
  copy: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: Surface.dimmed,
  },
  termGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.two,
  },
  termCard: {
    width: "48%",
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 18,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  termCardActive: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accentSoft,
  },
  pressed: {
    opacity: 0.82,
  },
  termLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 15,
    fontWeight: "700",
    color: Surface.label,
  },
  termLabelActive: {
    color: Surface.accent,
  },
  termMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Surface.dimmed,
  },
  termMetaActive: {
    color: Surface.label,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: "700",
    color: Surface.label,
  },
  reminders: {
    marginTop: Spacing.one,
  },
});
