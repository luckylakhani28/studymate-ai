import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/coverage',
      'playwright-report',
      'test-results',
      'server/storage',
      'server/.model-cache',
      'server/.ocr-cache',
    ],
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'e2e/**/*.js', '*.config.js', 'client/*.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Controllers may only read input that passed a zod schema (req.validated.*).
    files: ['server/src/controllers/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='req'][property.name=/^(body|query|params)$/]",
          message: 'Use req.validated.* — raw request input must pass through a zod schema first.',
        },
      ],
    },
  },
  prettier,
];
