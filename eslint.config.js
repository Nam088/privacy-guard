import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const ENTRYPOINT_IMPORTS = {
  group: ['**/entrypoints/**', '@/entrypoints/*', '~/entrypoints/*'],
  message:
    'Dependency direction is one way: entrypoints use core, never the reverse.',
};

const EXTENSION_API_IMPORTS = [
  {
    name: '#imports',
    message:
      'Code running in the MAIN world has no extension APIs. Receive configuration as function arguments instead.',
  },
  {
    name: 'wxt/browser',
    message:
      'Code running in the MAIN world has no extension APIs. Receive configuration as function arguments instead.',
  },
];

export default tseslint.config(
  { ignores: ['.wxt/**', '.output/**', 'node_modules/**', 'scratch/**', 'tools/**', 'fbchat-v2/**', '.dev-profile/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // A console probe is pasted into a page verbatim, so it stays plain browser javascript with
    // no imports to tell eslint what these are.
    files: ['tools/**/*.js'],
    languageOptions: {
      globals: {
        ArrayBuffer: 'readonly',
        Blob: 'readonly',
        MessagePort: 'readonly',
        document: 'readonly',
        Date: 'readonly',
        FormData: 'readonly',
        RegExp: 'readonly',
        SharedWorker: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        Worker: 'readonly',
        XMLHttpRequest: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ENTRYPOINT_IMPORTS] }],
    },
  },
  {
    files: ['src/observe/**/*.ts', 'src/protocol/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: EXTENSION_API_IMPORTS, patterns: [ENTRYPOINT_IMPORTS] },
      ],
    },
  },
  {
    files: ['src/sites/**/*.ts', 'src/trackers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/core/**', '@/core/*', '~/core/*'],
              message:
                'A site module stays pure data plus site logic. Depending on the settings layer makes adding a platform stop being additive.',
            },
            ENTRYPOINT_IMPORTS,
          ],
        },
      ],
    },
  },
);
