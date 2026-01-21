import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
    {
        ignores: ["dist/", "out/", "**/*.d.ts", "node_modules/", ".vscode-test/"],
    },
    js.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2024,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,

            // TypeScript handles this
            "no-undef": "off",

            // Warn on unused vars but allow underscore-prefixed names
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }],

            // Warn on explicit any
            "@typescript-eslint/no-explicit-any": "warn",

            // Restrict console usage (allow warn/error)
            "no-console": ["warn", { "allow": ["warn", "error"] }],

            // Enforce consistent type imports
            "@typescript-eslint/consistent-type-imports": ["error", {
                "prefer": "type-imports",
                "fixStyle": "separate-type-imports"
            }],

            // Require explicit return types on functions
            "@typescript-eslint/explicit-function-return-type": ["warn", {
                "allowExpressions": true,
                "allowTypedFunctionExpressions": true,
                "allowHigherOrderFunctions": true
            }],

            // Prefer nullish coalescing
            "@typescript-eslint/prefer-nullish-coalescing": "warn",

            // Prefer optional chaining
            "@typescript-eslint/prefer-optional-chain": "warn",
        },
    },
    {
        files: ["src/test/**/*.ts", "**/*.test.ts"],
        languageOptions: {
            globals: {
                ...globals.mocha,
            },
        },
        rules: {
            "no-console": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-function-return-type": "off"
        }
    },
    {
        files: ["*.js", "*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    }
];
