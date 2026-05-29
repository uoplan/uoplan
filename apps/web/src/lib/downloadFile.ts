/**
 * Trigger a browser download of an in-memory text file. Browser-only (uses the
 * DOM + URL.createObjectURL), so it lives in the web app rather than in the
 * platform-agnostic @uoplan/core package.
 */
export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
