// packages/express-backend/eslint.config.js
import js from "@eslint/js";

export default [
  { ignores: ["dist"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { process: "readonly", console: "readonly" },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];