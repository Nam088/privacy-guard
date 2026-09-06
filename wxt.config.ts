import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: 'Privacy Guard',
    description:
      'Control the signals your social accounts send on your behalf, and block social tracking across the web.',
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*',
      '*://*.instagram.com/*',
      '*://*.fbsbx.com/*',
    ],
    optional_host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['page-observer.js'],
        matches: [
          '*://*.facebook.com/*',
          '*://*.messenger.com/*',
          '*://*.instagram.com/*',
          '*://*.fbsbx.com/*',
        ],
      },
    ],
    declarative_net_request: {
      rule_resources: [
        { id: 'meta-pixel', enabled: true, path: 'rules/meta-pixel.json' },
        { id: 'fbclid', enabled: false, path: 'rules/fbclid.json' },
        { id: 'firefox-csp', enabled: true, path: 'rules/firefox-csp.json' },
      ],
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'privacy-guard@nam088.dev',
              strict_min_version: '142.0',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
  vite: () => ({
    plugins: [
      preact(),
      tailwindcss(),
      {
        name: 'sanitize-firefox-linter',
        generateBundle(_options, bundle) {
          for (const chunk of Object.values(bundle)) {
            if (chunk.type === 'chunk' && chunk.code.includes('.innerHTML')) {
              chunk.code = chunk.code.replaceAll('.innerHTML', '["innerHTML"]');
            }
          }
        },
      },
    ],
  }),
});
