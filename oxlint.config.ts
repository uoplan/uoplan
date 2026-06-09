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
        "react/only-export-components": ["error", { allowConstantExport: true }],
        "i18n-tr/tr-key-exists": "error",
        "jsx-a11y/prefer-tag-over-role": "error",
        "jsx-a11y/interactive-supports-focus": "error",
        "jsx-a11y/no-static-element-interactions": "error",
        "jsx-a11y/click-events-have-key-events": "error",
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
        "react/only-export-components": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/consistent-type-imports": "off",
      },
    },
    {
      // TanStack route files export `Route` next to an inline route component
      // (idiomatic), and test utilities export render helpers alongside
      // wrapper components — neither is worth splitting for Fast Refresh.
      files: ["apps/web/src/routes/**/*.{ts,tsx}", "apps/web/src/test/**/*.{ts,tsx}"],
      rules: {
        "react/only-export-components": "off",
      },
    },
  ],
});
