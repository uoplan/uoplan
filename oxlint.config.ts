import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "react", "jsx-a11y"],
  jsPlugins: ["./scripts/i18n/oxlint-plugin.mjs"],
  categories: {
    correctness: "error",
  },
  options: {
    typeAware: true,
  },
  env: {
    builtin: true,
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/*.config.ts",
    "**/*.mjs",
    "apps/web/src/assets/data/**",
    "**/public/**",
    "**/src/generated/**",
    "apps/notifications/**",
    "worker-configuration.d.ts",
  ],
  rules: {
    "no-unused-vars": "off",
    "typescript/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "typescript/consistent-type-imports": "error",
    "typescript/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
  },
  overrides: [
    {
      files: ["apps/web/src/**/*.{ts,tsx}"],
      rules: {
        "react/rules-of-hooks": "error",
        "react/exhaustive-deps": "warn",
        "i18n-tr/tr-key-exists": "error",
        // jsx-a11y: the plugin is enabled globally, so all accessibility rules
        // are enforced at `error` (via the `correctness` category). The four
        // rules below have pre-existing violations in the current UI; they are
        // kept at `warn` to surface for incremental cleanup without failing CI.
        // New violations of any other a11y rule still fail the build.
        "jsx-a11y/prefer-tag-over-role": "warn",
        "jsx-a11y/interactive-supports-focus": "warn",
        "jsx-a11y/no-static-element-interactions": "warn",
        "jsx-a11y/click-events-have-key-events": "warn",
        "typescript/no-floating-promises": "off",
        "typescript/require-await": "off",
        "typescript/no-misused-promises": [
          "error",
          {
            checksVoidReturn: {
              attributes: false,
              arguments: false,
            },
          },
        ],
      },
    },
    {
      files: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/tests/**/*.{ts,tsx}",
        "**/__tests__/**/*.{ts,tsx}",
      ],
      rules: {
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/consistent-type-imports": "off",
      },
    },
  ],
});
