import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Flat config.
 *
 * The Next plugin is wired directly rather than through `eslint-config-next`, whose
 * legacy shareable config loads `@rushstack/eslint-patch` and fails outright on
 * ESLint 9. Same rule sets, one fewer moving part.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'artifacts/**',
      '.migration-reference/**',
      'migration-orchestration/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // React 19 + the new JSX transform: neither is needed.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // The charter forbids `any` outright.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Raw HTML injection is confined to the three primitives that escape their input.
      'react/no-danger': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    /**
     * The only places allowed to serialise a string into the DOM:
     *  - RichText renders structured nodes, never a string (kept here for the rule below);
     *  - JsonLd escapes `<`, `>` and `&` before writing the graph;
     *  - the root layout inlines the pre-paint theme script, which is a constant.
     */
    files: ['packages/ui/src/primitives/RichText.tsx', 'packages/seo/src/JsonLd.tsx', 'app/layout.tsx'],
    rules: { 'react/no-danger': 'off' },
  },
  {
    files: ['scripts/**/*.{ts,mjs}', 'tests/**/*.ts', '*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
);
