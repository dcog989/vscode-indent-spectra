import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    {
        ignores: ["dist/", "out/", "**/*.d.ts"],
    },
    js.configs.recommended,
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.mocha,
                ...globals.browser,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,

            "no-undef": "off",

            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],

            "@typescript-eslint/no-explicit-any": "warn",
            "no-console": ["warn", { "allow": ["warn", "error"] }],
        },
    },
    {
        files: ["src/test/**/*.ts"],
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
];
