import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "react"],
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
    "apps/web/public/data/**",
    "**/public/**",
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
