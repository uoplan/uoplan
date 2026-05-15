/// <reference types="vite/client" />

declare const __COMMIT_HASH__: string | undefined;
declare const __BRANCH_NAME__: string | undefined;

declare module "virtual:changelog-html" {
  const html: string;
  export default html;
}
