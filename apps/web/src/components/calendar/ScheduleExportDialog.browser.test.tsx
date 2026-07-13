import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { ScheduleExportDialog } from "./ScheduleExportDialog";
import { renderWithProviders } from "../../test/renderWithProviders";

// ── helpers ────────────────────────────────────────────────────────────────

function baseProps(overrides: Partial<Parameters<typeof ScheduleExportDialog>[0]> = {}) {
  return {
    opened: true,
    onClose: vi.fn(),
    onExport: vi.fn<(options: { includeDeadlines: boolean }) => void | Promise<void>>(),
    ...overrides,
  };
}

/** Tiny helper that lets a queued microtask/macro-task queue drain. */
function flushAsync(ms = 30) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── tests ──────────────────────────────────────────────────────────────────

test("renders dialog title, description, and single unchecked checkbox when opened", async () => {
  await renderWithProviders(<ScheduleExportDialog {...baseProps()} />);

  // Title — scheduleExport.title = "Export calendar"
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  await expect.element(page.getByText(/export calendar/i)).toBeInTheDocument();

  // Explanation text — scheduleExport.description
  await expect.element(page.getByText(/official breaks/i)).toBeInTheDocument();

  // One unchecked checkbox — scheduleExport.includeDeadlines
  const checkbox = page.getByRole("checkbox", {
    name: /include other important dates/i,
  });
  await expect.element(checkbox).toBeInTheDocument();
  await expect.element(checkbox).not.toBeChecked();

  // Cancel button — scheduleExport.cancel
  await expect.element(page.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  // Download button — scheduleExport.download
  await expect.element(page.getByRole("button", { name: /download/i })).toBeInTheDocument();
});

test("does not render modal content when closed", async () => {
  await renderWithProviders(<ScheduleExportDialog {...baseProps({ opened: false })} />);

  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("renders optional scopeLabel when provided", async () => {
  await renderWithProviders(<ScheduleExportDialog {...baseProps({ scopeLabel: "Winter 2026" })} />);

  await expect.element(page.getByText("Winter 2026")).toBeInTheDocument();
});

test("does not render scope label when not provided", async () => {
  await renderWithProviders(<ScheduleExportDialog {...baseProps()} />);

  // scopeLabel element absent — verify no crash and dialog is present
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
});

test("calls onExport with includeDeadlines:false by default", async () => {
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>();
  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onExport })} />);

  await page.getByRole("button", { name: /download/i }).click();
  expect(onExport).toHaveBeenCalledOnce();
  expect(onExport).toHaveBeenCalledWith({ includeDeadlines: false });
});

test("calls onExport with includeDeadlines:true after toggling checkbox", async () => {
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>();
  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onExport })} />);

  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: /download/i }).click();
  expect(onExport).toHaveBeenCalledOnce();
  expect(onExport).toHaveBeenCalledWith({ includeDeadlines: true });
});

test("pending state: loading indicator shown and duplicate clicks do not invoke onExport again", async () => {
  let resolveExport!: () => void;
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        resolveExport = resolve;
      }),
  );

  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onExport })} />);

  // scheduleExport.download button triggers export
  await page.getByRole("button", { name: /download/i }).click();
  expect(onExport).toHaveBeenCalledOnce();

  // Cancel/close should be disabled during pending (scheduleExport.cancel)
  await expect.element(page.getByRole("button", { name: /cancel/i })).toBeDisabled();

  // Checkbox disabled during pending
  await expect.element(page.getByRole("checkbox")).toBeDisabled();

  // Download button is disabled/loading during pending — scheduleExport.downloading
  const downloadBtn = page.getByRole("button", { name: /download/i });
  await expect.element(downloadBtn).toBeDisabled();

  resolveExport();
});

test("synchronous throw: shows inline error and does not close", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>(() => {
    throw new Error("Network error");
  });

  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onClose, onExport })} />);

  await page.getByRole("button", { name: /download/i }).click();

  // Error message shown; role=alert has no redundant aria-live
  const alert = page.getByRole("alert");
  await expect.element(alert).toBeInTheDocument();
  await expect.element(alert).not.toHaveAttribute("aria-live");
  await expect.element(page.getByText(/network error/i)).toBeInTheDocument();

  // Dialog stays open (onClose not called)
  expect(onClose).not.toHaveBeenCalled();
});

test("async rejection: shows inline error and does not close", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(() =>
    Promise.reject(new Error("ICS generation failed")),
  );

  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onClose, onExport })} />);

  await page.getByRole("button", { name: /download/i }).click();

  await expect.element(page.getByRole("alert")).toBeInTheDocument();
  await expect.element(page.getByText(/ics generation failed/i)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test("unknown rejection is normalized to a generic error message", async () => {
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(
    // oxlint-disable-next-line prefer-promise-reject-errors
    () => Promise.reject("oops"),
  );

  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onExport })} />);

  await page.getByRole("button", { name: /download/i }).click();

  // Should display the normalized/generic error message (not "oops")
  const alert = page.getByRole("alert");
  await expect.element(alert).toBeInTheDocument();
  await expect.element(alert).not.toHaveTextContent("oops");
  // scheduleExport.error = "Calendar export failed. Please try again."
  await expect.element(page.getByText(/calendar export failed/i)).toBeInTheDocument();
});

test("success: calls onClose exactly once and clears error", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(() =>
    Promise.resolve(),
  );

  await renderWithProviders(<ScheduleExportDialog {...baseProps({ onClose, onExport })} />);

  await page.getByRole("button", { name: /download/i }).click();

  expect(onClose).toHaveBeenCalledOnce();
});

test("close/reopen resets checkbox state and clears error", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>(() => {
    throw new Error("fail");
  });

  const { rerender } = await renderWithProviders(
    <ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />,
  );

  // Toggle checkbox, trigger error
  await page.getByRole("checkbox").click();
  await expect.element(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: /download/i }).click();
  await expect.element(page.getByRole("alert")).toBeInTheDocument();

  // Close the dialog
  await rerender(<ScheduleExportDialog opened={false} onClose={onClose} onExport={onExport} />);

  // Reopen
  await rerender(<ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />);

  // Checkbox must be reset to unchecked
  await expect.element(page.getByRole("checkbox")).not.toBeChecked();

  // Error cleared (no alert visible)
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
});

test("rerender while open preserves checkbox state", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>();

  const { rerender } = await renderWithProviders(
    <ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />,
  );

  // Toggle checkbox
  await page.getByRole("checkbox").click();
  await expect.element(page.getByRole("checkbox")).toBeChecked();

  // Re-render with same opened=true (e.g. parent re-renders)
  await rerender(<ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />);

  // Checkbox must still be checked
  await expect.element(page.getByRole("checkbox")).toBeChecked();
});

test("cancel button clears transient error and invokes onClose", async () => {
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => void>(() => {
    throw new Error("nope");
  });

  await renderWithProviders(
    <ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />,
  );

  await page.getByRole("button", { name: /download/i }).click();
  await expect.element(page.getByRole("alert")).toBeInTheDocument();

  // scheduleExport.cancel button
  await page.getByRole("button", { name: /cancel/i }).click();
  expect(onClose).toHaveBeenCalledOnce();
});

test("stale promise resolution is ignored after external close → reopen (race regression)", async () => {
  let resolveFirst!: () => void;
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }),
  );

  const { rerender } = await renderWithProviders(
    <ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />,
  );

  // First session: start an export that hangs
  await page.getByRole("button", { name: /download/i }).click();
  expect(onExport).toHaveBeenCalledOnce();

  // Parent externally closes (opened→false) then reopens (opened→true)
  await rerender(<ScheduleExportDialog opened={false} onClose={onClose} onExport={onExport} />);
  await rerender(<ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />);

  // New session: pending must be reset — controls are interactive
  await expect.element(page.getByRole("button", { name: /download/i })).not.toBeDisabled();
  await expect.element(page.getByRole("checkbox")).not.toBeDisabled();
  await expect.element(page.getByRole("button", { name: /cancel/i })).not.toBeDisabled();

  // Resolve the first session's stale promise
  resolveFirst();
  await flushAsync();

  // Stale resolution must NOT call onClose
  expect(onClose).not.toHaveBeenCalled();
  // Stale resolution must NOT inject an error into the new session
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  // Controls must still be interactive
  await expect.element(page.getByRole("button", { name: /download/i })).not.toBeDisabled();
});

test("stale rejection is ignored after external close → reopen (race regression)", async () => {
  let rejectFirst!: (err: Error) => void;
  const onClose = vi.fn();
  const onExport = vi.fn<(opts: { includeDeadlines: boolean }) => Promise<void>>(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectFirst = reject;
      }),
  );

  const { rerender } = await renderWithProviders(
    <ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />,
  );

  await page.getByRole("button", { name: /download/i }).click();

  // External close → reopen
  await rerender(<ScheduleExportDialog opened={false} onClose={onClose} onExport={onExport} />);
  await rerender(<ScheduleExportDialog opened={true} onClose={onClose} onExport={onExport} />);

  // Reject the stale promise
  rejectFirst(new Error("stale error"));
  await flushAsync();

  // Stale error must NOT appear in the new session
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  // Controls still interactive
  await expect.element(page.getByRole("button", { name: /download/i })).not.toBeDisabled();
});
