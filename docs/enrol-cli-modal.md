# Enrol via CLI Modal

## What it is

A button on both calendar pages (basic and advanced) that opens a modal displaying a pre-built `npx @uoplan/cli run <payload>` command the user can copy and run to automatically enrol in the current schedule.

## How it works

1. `encodeSchedulePayload` (`apps/web/src/lib/encodeSchedulePayload.ts`) converts the current `GeneratedSchedule` and `selectedTermId` into a protobuf `SchedulePayload`, encodes it as raw protobuf bytes, then base64url-encodes the result (no gzip, no padding, URL-safe characters).
2. The resulting string is passed into `npx @uoplan/cli run <payload>`.
3. The `EnrolCliModal` component renders this command in a `<Code block>` with a copy button.
4. The button appears in the sidebar whenever a schedule is loaded (`cliCommand !== null`), in both basic and advanced variants.

## How to change it

- **Payload format**: Edit `encodeSchedulePayload.ts`. The CLI's `decodePayload` in `apps/cli/src/commands/run.ts` tries gzip first then falls back to raw — so you can add gzip compression here without a CLI change.
- **Modal UI**: Edit `EnrolCliModal.tsx`.
- **Button placement/style**: Edit `CalendarPage.tsx` — search for `enrolCli.button`.
- **Strings**: Add/update entries in `apps/web/src/locales/en/messages.po` and `fr-CA/messages.po`.

## Configuration

No env vars or flags. The button is always shown when a schedule is available.

## Dependencies

- `packages/schedule/src/proto/cli.ts` — generated protobuf types (`SchedulePayload`, `CourseSelection`, `SectionSelection`)
- `packages/schedule/src/generation/types.ts` — `GeneratedSchedule`, `CourseEnrollment`, `SectionCombo`
- Mantine `Modal`, `Code`, `CopyButton`, `ActionIcon`, `Tooltip`
- Lingui i18n via `tr()` / `useLingui()`
