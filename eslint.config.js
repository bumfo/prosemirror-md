import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        navigator: 'readonly',
        prompt: 'readonly',
        CustomEvent: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        args: 'none',
        argsIgnorePattern: '^_', // function foo(_unused) {}
        varsIgnorePattern: '^_', // const _unused = 1
        caughtErrors: 'none' // ignore catch (e) { /* unused */ }
      }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { allowTemplateLiterals: true }]
    }
  }
];
