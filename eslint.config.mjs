import js from '@eslint/js';
import globals from 'globals';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: [
            'node_modules/',
            'playwright-report/',
            'test-results/',
            'assets/stems/'
        ]
    },
    js.configs.recommended,
    {
        files: ['assets/js/**/*.js'],
        languageOptions: {
            globals: globals.browser
        },
        rules: {
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-self-assign': 'warn',
            'no-undef': 'warn',
            'no-unused-vars': 'warn',
            'no-useless-assignment': 'warn',
            'no-useless-escape': 'warn'
        }
    },
    {
        files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
        languageOptions: {
            globals: globals.node
        },
        rules: {
            'no-useless-escape': 'warn'
        }
    },
    {
        files: ['tests/**/*.ts', 'playwright.config.ts'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            },
            parser: tseslint.parser
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            playwright
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-undef': 'off',
            'no-unused-vars': 'off',
            ...playwright.configs['flat/recommended'].rules
        }
    }
];
