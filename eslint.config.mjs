import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Root ESLint flat config for the Crochet PeakZ monorepo.
 *
 * Workspace specific configs (apps/web, apps/api) extend this
 * by spreading `rootConfig` and adding their own overrides.
 *
 * @see https://typescript-eslint.io/getting-started
 */
export const rootConfig = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      /* ── Type strictness (no `any`) ── */
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",

      /* ── Code quality ── */
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",

      /* ── Naming convention (camelCase vars/fns, PascalCase types/classes/interfaces) ── */
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE", "PascalCase"],
        },
        {
          selector: "import",
          format: null,
        },
        {
          selector: "objectLiteralProperty",
          format: null,
        },
      ],

      /* ── Explicit return types on exported functions ── */
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],

      /* ── No default exports (project rule) ── */
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Named exports only. No default exports (project convention).",
        },
      ],
    },
  },
  {
    /* Config files are not in tsconfig, disable type-checked rules and allow default exports */
    files: ["**/*.config.mjs", "**/*.config.ts", "**/*.config.js"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
    ],
  },
);

export default rootConfig;
