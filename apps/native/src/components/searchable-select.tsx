import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { Fonts, Spacing, Surface } from "@/constants/theme";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
}

interface BaseSearchablePickerProps {
  title: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
  /**
   * Only reveal options once the user starts typing. Used for very large lists
   * (programs, every course) so the sheet opens to a calm "search" prompt
   * instead of dumping hundreds of rows the moment it appears.
   */
  searchOnly?: boolean;
  testID?: string;
}

interface SearchableSelectProps extends BaseSearchablePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

interface SearchableMultiSelectProps extends BaseSearchablePickerProps {
  values: string[];
  onChange: (values: string[]) => void;
}

interface PickerFieldProps {
  label: string | null;
  placeholder?: string;
  selected: boolean;
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
}

interface SearchablePickerSheetProps extends BaseSearchablePickerProps {
  opened: boolean;
  mounted: boolean;
  selectedValues: string[];
  multiple: boolean;
  onClose: () => void;
  onExited: () => void;
  onSelect: (value: string) => void;
  onClear: () => void;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function optionHaystack(option: SearchableSelectOption): string {
  return normalize(
    [option.value, option.label, option.description, option.searchText].filter(Boolean).join(" "),
  );
}

function selectedSummary(
  count: number,
  selectedLabel: string | null,
  placeholder?: string,
): string {
  if (count === 0) return placeholder ?? "Select…";
  if (count === 1 && selectedLabel) return selectedLabel;
  return `${count} selected`;
}

function PickerField({
  label,
  placeholder,
  selected,
  disabled,
  testID,
  onPress,
}: PickerFieldProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text
        size="sm"
        weight={selected ? "semibold" : "regular"}
        color={selected ? Surface.label : Surface.faint}
        numberOfLines={1}
      >
        {label ?? placeholder ?? "Select…"}
      </Text>
      <AppIcon name="chevron.down" size={14} color={Surface.dimmed} weight="semibold" />
    </Pressable>
  );
}

function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.search}>
      <AppIcon name="magnifyingglass" size={17} color={Surface.dimmed} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search…"}
        placeholderTextColor={Surface.dimmed}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}

function OptionRow({
  option,
  selected,
  multiple,
  onPress,
}: {
  option: SearchableSelectOption;
  selected: boolean;
  multiple: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "button"}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed ? styles.optionPressed : null,
      ]}
    >
      <View style={styles.optionCopy}>
        <Text size="sm" weight={selected ? "semibold" : "regular"} color={Surface.label}>
          {option.label}
        </Text>
        {option.description ? (
          <Text size="xs" dimmed numberOfLines={1}>
            {option.description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.check, selected ? styles.checkSelected : null]}>
        {selected ? (
          <AppIcon name="checkmark" size={13} color={Surface.onAccent} weight="semibold" />
        ) : null}
      </View>
    </Pressable>
  );
}

function SearchablePickerSheet({
  opened,
  mounted,
  title,
  options,
  selectedValues,
  multiple,
  searchPlaceholder,
  emptyMessage,
  clearable = true,
  searchOnly = false,
  onClose,
  onExited,
  onSelect,
  onClear,
}: SearchablePickerSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedValues), [selectedValues]);

  useEffect(() => {
    if (opened) setQuery("");
  }, [opened]);

  useEffect(() => {
    if (!mounted) return;
    if (opened) {
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onExited();
      });
    }
  }, [opened, mounted, onExited, progress]);

  const needle = normalize(query);
  const filtered = useMemo(() => {
    if (!needle) return searchOnly ? [] : options;
    return options.filter((option) => optionHaystack(option).includes(needle));
  }, [options, needle, searchOnly]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [screenHeight, 0] });
  const canClear = selectedValues.length > 0;
  const awaitingQuery = searchOnly && !needle;
  const subtitle = multiple
    ? selectedValues.length === 0
      ? "No options selected"
      : `${selectedValues.length} selected`
    : awaitingQuery
      ? "Type to search"
      : `${options.length} options`;

  const renderItem: ListRenderItem<SearchableSelectOption> = ({ item }) => (
    <OptionRow
      option={item}
      selected={selected.has(item.value)}
      multiple={multiple}
      onPress={() => onSelect(item.value)}
    />
  );

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text size="xl" weight="bold" color={Surface.label}>
                {title}
              </Text>
              <Text size="xs" dimmed>
                {subtitle}
              </Text>
            </View>
            {clearable ? (
              <Pressable
                accessibilityRole="button"
                disabled={!canClear}
                onPress={onClear}
                style={[styles.clearButton, !canClear ? styles.clearButtonDisabled : null]}
              >
                <Text size="sm" color={canClear ? Surface.accent : Surface.faint} weight="semibold">
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>

          <SearchBox value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            renderItem={renderItem}
            extraData={selectedValues.join("\u0000")}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            initialNumToRender={18}
            maxToRenderPerBatch={24}
            windowSize={8}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text size="sm" dimmed align="center">
                  {awaitingQuery
                    ? "Start typing to search."
                    : (emptyMessage ?? "No matching options found.")}
                </Text>
              </View>
            }
          />

          {multiple ? (
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.doneButton}>
              <Text size="sm" weight="bold" color={Surface.onAccent}>
                Done
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  testID,
  ...sheetProps
}: SearchableSelectProps) {
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;
  const openSheet = () => {
    setMounted(true);
    setOpened(true);
  };
  const closeSheet = () => setOpened(false);

  return (
    <>
      <PickerField
        testID={testID}
        label={selected?.label ?? null}
        placeholder={placeholder}
        selected={selected != null}
        disabled={disabled}
        onPress={openSheet}
      />
      <SearchablePickerSheet
        {...sheetProps}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        opened={opened}
        mounted={mounted}
        selectedValues={value ? [value] : []}
        multiple={false}
        onClose={closeSheet}
        onExited={() => setMounted(false)}
        onClear={() => {
          onChange(null);
          closeSheet();
        }}
        onSelect={(next) => {
          onChange(next);
          closeSheet();
        }}
      />
    </>
  );
}

export function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  disabled,
  testID,
  ...sheetProps
}: SearchableMultiSelectProps) {
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selectedLabel =
    values.length === 1
      ? (options.find((option) => option.value === values[0])?.label ?? null)
      : null;
  const openSheet = () => {
    setMounted(true);
    setOpened(true);
  };
  const closeSheet = () => setOpened(false);

  return (
    <>
      <PickerField
        testID={testID}
        label={selectedSummary(values.length, selectedLabel, placeholder)}
        placeholder={placeholder}
        selected={values.length > 0}
        disabled={disabled}
        onPress={openSheet}
      />
      <SearchablePickerSheet
        {...sheetProps}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        opened={opened}
        mounted={mounted}
        selectedValues={values}
        multiple
        onClose={closeSheet}
        onExited={() => setMounted(false)}
        onClear={() => onChange([])}
        onSelect={(next) => {
          onChange(
            values.includes(next) ? values.filter((value) => value !== next) : [...values, next],
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.8,
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Surface.page,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "86%",
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Surface.border,
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  clearButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  clearButtonDisabled: {
    opacity: 0.55,
  },
  search: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 14,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 15,
    color: Surface.label,
    padding: 0,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  option: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  optionSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accentSoft,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accent,
  },
  empty: {
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  doneButton: {
    marginTop: Spacing.two,
    backgroundColor: Surface.accent,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
});
