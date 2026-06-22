/// <reference types="vite/client" />

declare const __COMMIT_HASH__: string | undefined;
declare const __BRANCH_NAME__: string | undefined;

interface ImportMetaEnv {
  readonly VITE_POSTHOG_DEBUG?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_UI_HOST?: string;
}

declare module "virtual:changelog-html" {
  const html: string;
  export default html;
}
