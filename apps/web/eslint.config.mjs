import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * ESLint config for apps/web.
 * Layers Next.js presets with the monorepo's shared TypeScript rules
 * and Prettier compatibility.
 *
 * The no-default-exports rule is relaxed for Next.js convention files
 * (page.tsx, layout.tsx, etc.) which require default exports.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
  })),
  eslintConfigPrettier,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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

      /* ── No default exports, except where Next.js requires them ── */
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Named exports only. No default exports (project convention). Exception: Next.js page/layout/loading/error/not-found files.",
        },
      ],
    },
  },
  {
    /* Relax no-default-exports for Next.js convention files */
    files: [
      "**/page.tsx",
      "**/layout.tsx",
      "**/loading.tsx",
      "**/error.tsx",
      "**/not-found.tsx",
      "**/template.tsx",
      "**/default.tsx",
      "**/next.config.ts",
      "**/next.config.mjs",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    /* Shadcn UI primitives are generated code: relax explicit-return-type */
    files: ["**/src/components/ui/**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  {
    /* Test environment types */
    files: ["**/src/test-env.d.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Test files are handled by vitest, not eslint
  globalIgnores([
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/vitest.config.ts",
    "**/src/test/**/*.ts",
  ]),
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
