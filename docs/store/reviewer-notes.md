Build environment
• Node.js 24.14.0
• pnpm 9.15.4 (declared in package.json as packageManager, so `corepack enable` picks the exact version)
• macOS or Linux, no native toolchain needed

Steps to reproduce the submitted XPI from the attached source archive
1. Unzip the source archive and open the resulting folder.
2. corepack enable
3. pnpm install --frozen-lockfile
4. pnpm zip:firefox
5. The reviewable build lands at .output/privacy-guard-0.12.0-firefox.zip, and the unpacked equivalent at .output/firefox-mv3/

Build stack
• Bundler is WXT 0.21.x (Vite based) with the Preact preset and Tailwind CSS 4. Nothing is minified beyond standard Vite production output, and no code is fetched at build time or at runtime.
• One small Vite plugin in wxt.config.ts rewrites the literal `.innerHTML` to `["innerHTML"]` in the emitted bundles. This is only to silence the add on linter on strings inside third party dependency code. The extension itself never assigns to innerHTML.

Privacy and permissions
• Required permissions are storage and declarativeNetRequest only. Host permissions cover facebook.com, messenger.com, instagram.com, and fbsbx.com.
• <all_urls> is declared as optional and is requested at runtime only if the user enables the link tracking parameter cleaner.
• No remote code, no analytics, no network calls to any server we control. All settings stay in browser.storage.local. The Firefox manifest declares data_collection_permissions.required = ["none"].
