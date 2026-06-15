import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Stack } from "@uoplan/ui";

import { ListRow } from "@/components/list-row";
import { RedesignScreen, ScreenHeader } from "@/components/redesign";
import { Spacing, Surface } from "@/constants/theme";
import { type AppLocale, useTr } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";

interface LanguageOption {
  /** The override value to persist; `null` follows the system locale. */
  value: AppLocale | null;
  title: string;
  description?: string;
}

function Separator() {
  return <View style={styles.separator} />;
}

/**
 * Language switcher: pick between following the device language ("System
 * default") or pinning English / French (Canada). Selecting a row persists the
 * override via `setOverrideLocale`, which re-activates the locale immediately.
 */
export default function LanguageScreen() {
  const router = useRouter();
  const tr = useTr();
  const { overrideLocale, setOverrideLocale } = useLocale();

  const options: LanguageOption[] = [
    {
      value: null,
      title: tr("native.language.system"),
      description: tr("native.language.systemDescription"),
    },
    { value: "en", title: tr("native.language.english") },
    { value: "fr-CA", title: tr("native.language.frenchCanada") },
  ];

  return (
    <RedesignScreen
      gap={Spacing.three}
      backLabel={tr("native.language.title")}
      onBack={() => router.back()}
    >
      <ScreenHeader title={tr("native.language.title")} subtitle={tr("native.language.subtitle")} />

      <Stack gap="xs">
        <View style={styles.group}>
          {options.map((option, index) => (
            <View key={option.value ?? "system"}>
              {index > 0 ? <Separator /> : null}
              <ListRow
                title={option.title}
                description={option.description}
                selected={overrideLocale === option.value}
                onPress={() => setOverrideLocale(option.value)}
              />
            </View>
          ))}
        </View>
      </Stack>
    </RedesignScreen>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
    marginLeft: Spacing.three,
  },
});
