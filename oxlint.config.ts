import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "react", "jsx-a11y", "unicorn", "oxc", "import", "promise", "node"],
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
    "apps/web/src/routeTree.gen.ts",
    "packages/i18n/src/locales/**/messages.ts",
    "apps/notifications/**",
    "apps/native/**",
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
    "typescript/no-explicit-any": "error",

    // Import hygiene
    "import/no-duplicates": "error",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    "import/first": "error",
    "import/no-self-import": "error",
    "import/no-cycle": "error",
    // Sort named members within an import statement (autofixable). Declaration
    // ordering between statements is intentionally left off — oxlint cannot
    // autofix it and it conflicts with grouped/side-effect imports.
    "sort-imports": [
      "error",
      { ignoreDeclarationSort: true, ignoreCase: true, allowSeparatedGroups: true },
    ],

    // Promise safety
    "promise/prefer-await-to-then": "error",
    "promise/param-names": "error",

    // Modern JS idioms (unicorn)
    "unicorn/prefer-node-protocol": "error",
    "unicorn/no-useless-undefined": "error",
    "unicorn/no-array-for-each": "error",
    "unicorn/prefer-string-replace-all": "error",
    "unicorn/explicit-length-check": "error",
    "unicorn/no-lonely-if": "error",
    "unicorn/prefer-string-slice": "error",
    "unicorn/prefer-array-some": "error",
    "unicorn/prefer-array-flat-map": "error",
    "unicorn/throw-new-error": "error",
    "unicorn/prefer-date-now": "error",

    // General
    "no-console": "error",
    "prefer-template": "error",
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
        // Referencing mock methods (e.g. `expect(mock.put).toHaveBeenCalled()`)
        // is the standard test pattern and a known unbound-method false positive.
        "typescript/unbound-method": "off",
        "no-console": "off",
      },
    },
    {
      // The scraper is a Node CLI/tooling suite where stdout/stderr is the
      // intended output channel, so `console` usage is expected here.
      files: ["apps/scraper/**/*.{ts,tsx}"],
      rules: {
        "no-console": "off",
      },
    },
    {
      // Package codegen/build scripts are Node CLI tooling where stdout/stderr
      // is the intended output channel (same rationale as the scraper).
      files: ["packages/*/scripts/**/*.{ts,tsx,mjs}"],
      rules: {
        "no-console": "off",
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
