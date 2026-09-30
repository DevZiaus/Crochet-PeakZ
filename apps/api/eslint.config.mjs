import { rootConfig } from "../../eslint.config.mjs";
import tseslint from "typescript-eslint";

/**
 * ESLint config for apps/api.
 * Extends the monorepo root config with API specific overrides.
 */
export default tseslint.config(
  ...rootConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /* Allow numbers and booleans in template literals (common in log statements) */
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    /* Config files are not in tsconfig, disable type-checked rules and allow default exports */
    files: ["*.config.mjs", "*.config.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: ["dist/**"],
  },
);
