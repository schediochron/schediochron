import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

const reactFiles = [
  'apps/react-app/src/**/*.{ts,tsx,js,jsx}',
  'libs/react-components/src/**/*.{ts,tsx,js,jsx}',
];

export default [
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: reactFiles,
    ...react.configs.flat.recommended,
    settings: { react: { version: '19' } },
  },
  {
    files: reactFiles,
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      // Includes the React Compiler's static analysis rules (purity, immutability,
      // set-state-in-render, …) — the Rules of React the compiler relies on.
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // The React 19 JSX transform makes the React import unnecessary.
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: ['**/*.e2e.{ts,js}'],
    ...playwright.configs['flat/recommended'],
  },
  {
    rules: {
      'no-console': ['error', { allow: ['log', 'info', 'debug'] }],
    },
  },
  prettier,
];
