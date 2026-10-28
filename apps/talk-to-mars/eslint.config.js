import { nextJsConfig } from "@repo/eslint-config/next-js";

export default [
  ...nextJsConfig,
  { ignores: ["public/**"] },
  {
    files: ["scripts/*.mjs"],
    languageOptions: { globals: { process: "readonly", Buffer: "readonly" } },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
