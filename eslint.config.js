import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.node_modules', '.agents', '.codex'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/client/**/*.{ts,tsx}'],
    languageOptions: { globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly', FormData: 'readonly', File: 'readonly', fetch: 'readonly', Headers: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Node: 'readonly', HTMLDivElement: 'readonly', HTMLInputElement: 'readonly', HTMLTextAreaElement: 'readonly', HTMLMetaElement: 'readonly', HTMLLinkElement: 'readonly', HTMLScriptElement: 'readonly', MouseEvent: 'readonly', KeyboardEvent: 'readonly', confirm: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { ...reactHooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off', 'react-refresh/only-export-components': 'off', '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }] },
  },
)
