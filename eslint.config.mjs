import js from "../anclora-nexus/node_modules/@eslint/js/src/index.js";
import tsParser from "../anclora-nexus/node_modules/@typescript-eslint/parser/dist/index.js";

export default [
  {
    ignores: ["node_modules/**", ".next/**", "scripts/**", "next.config.js"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
    },
  },
];
