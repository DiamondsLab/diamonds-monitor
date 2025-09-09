import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      "**/node_modules",
      "**/artifacts",
      "**/cache",
      "**/coverage",
      "**/dist/**",
      "**/docs/**",
      // Project-specific directories to skip
      "**/typechain-types/**",
      "**/diamond-typechain-types/**",
    ],
  },
  ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.entries(globals.browser).map(([key]) => [key, "off"]),
        ),
        ...globals.mocha,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: "module",

      parserOptions: {
        // Intentionally not setting `project` here so JS config files
        // (like this one) are not required to be included in tsconfig.json.
      },
    },

    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      // Configure unused vars to allow underscore prefix
      "@typescript-eslint/no-unused-vars": "off",
      //  ["error", { 
      //   argsIgnorePattern: "^_",
      //   varsIgnorePattern: "^_",
      //   ignoreRestSiblings: true
      // }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Disable Prettier integration in ESLint to avoid formatting errors
      "prettier/prettier": "off",
    },
  },
  // Enable type-aware linting only for TypeScript sources that should be
  // checked against the project's tsconfig.json.
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  // Disable no-explicit-any in scripts folder where heavier typing is not required
  {
    files: ["scripts/**/*.ts", "scripts/**/*.mts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // Disable Prettier errors for scripts where formatting may intentionally differ
      "prettier/prettier": "off",
  // Allow unused variables/assignments in scripts (often used for CLI side-effects)
  "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Disable no-unused-vars in test files to allow test helpers and fixtures that may be unused
  {
    files: ["test/**/*.ts", "test/**/*.mts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./test/tsconfig.json",
      },
    },
    rules: {
  "@typescript-eslint/no-unused-vars": "off",
  // Allow use of `any` in tests
  "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable no-unused-vars for repository root configuration files (hardhat, other .config.ts)
  {
    files: ["hardhat.config.ts", "*.config.ts", "setup/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
