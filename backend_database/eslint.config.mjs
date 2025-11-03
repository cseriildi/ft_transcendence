import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.js",
      "*.mjs",
      "vitest.config.ts",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Errors (block commits)
      "no-console": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn", // Changed to warn for gradual adoption
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn", // Changed to warn for gradual adoption
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "no-return-await": "error",
      "@typescript-eslint/no-floating-promises": "warn", // Changed to warn for gradual adoption
      "@typescript-eslint/no-misused-promises": "off", // Fastify handlers return promises correctly

      // Warnings (show in editor, don't block)
      "no-warning-comments": [
        "warn",
        { terms: ["TODO", "FIXME", "HACK"], location: "start" },
      ],
      "prefer-const": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",

      // Prettier integration
      "prettier/prettier": "error",

      // Disabled (handled by Prettier or too strict)
      indent: "off",
      "@typescript-eslint/indent": "off",
      quotes: "off",
      semi: "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  {
    files: ["vitest.config.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        // Don't use project for config files
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-explicit-any": "off", // Allow any in tests
      "@typescript-eslint/no-unused-vars": "warn", // Warn instead of error in tests
    },
  },
];
