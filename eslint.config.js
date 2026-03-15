import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow _-prefixed parameters to be unused (e.g. required positional args)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Async data-fetching inside useEffect is a valid pattern — suppress false positives
      'react-hooks/set-state-in-effect': 'off',
      // Prevent accidental console.log commits; allow warn/error for legitimate logging
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Playwright test files use a `use()` callback that ESLint mistakes for a
  // React hook, and empty destructuring `{}` for unused fixture parameters.
  // This override must come AFTER the main config so its rules win.
  {
    files: ['tests/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },
])
