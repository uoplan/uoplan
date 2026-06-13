/**
 * `@uoplan/theme` — the platform-agnostic theme model shared by the web app
 * (`apps/web`, rendered via Mantine + CSS variables) and the native app
 * (`apps/native`, rendered via a React Native theme object).
 *
 * This package deliberately contains **only** portable logic: the theme
 * registry and the selection→theme resolution. Platform I/O (reading the OS
 * colour-scheme, persisting the user's choice) and the concrete rendered token
 * values live in each platform's shell.
 */
export * from "./model";
export * from "./tokens";
