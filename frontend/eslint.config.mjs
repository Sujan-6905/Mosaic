import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
    { ignores: [".next*/**", "public/**", "test-results/**"] },
    ...compat.extends("next/core-web-vitals"),
    {
        files: ["**/*.{js,jsx,mjs,ts,tsx}"],
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: { "no-undef": "error" },
    },
    // Playwright fixtures receive a callback named `use`, which the hooks rule mistakes for React's.
    { files: ["e2e/**/*.js"], rules: { "react-hooks/rules-of-hooks": "off" } },
    // TypeScript checks names itself, and no-undef can't see type-only ones.
    { files: ["**/*.{ts,tsx}"], rules: { "no-undef": "off" } },
];
