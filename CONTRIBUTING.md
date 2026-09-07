# Contributing to Privacy Guard

Thank you for your interest in contributing to **Privacy Guard**! We welcome bug reports, feature suggestions, protocol documentation, and pull requests from the community.

---

## 🧭 Principles & Code of Conduct

Privacy Guard operates under strict engineering principles:
1. **Evidence-Based Engineering**: We never write speculative rules or pattern matches. Every suppression rule, signature regex, and WebSocket frame label must be backed by concrete evidence (live network traces, bundle analyses, or verifiable reproduction tests).
2. **Zero Functional Breakage**: Privacy enhancements must never crash the host web application or trigger Meta account suspicion. When dropping queries or mutations, always return synthetic responses matching Relay's GraphQL schema (e.g., `{ data: {}, extensions: { is_final: true } }`).
3. **No Duplicate Logic**: Common utilities and network evaluation helpers must be cleanly extracted into shared utility modules rather than duplicated across platform folders.
4. **Be Respectful & Constructive**: We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone.

---

## 🛠️ Development Setup

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v9.0.0` or higher

### 2. Getting Started
```bash
# Clone the repository
git clone https://github.com/Nam088/privacy-guard.git
cd privacy-guard

# Install dependencies
pnpm install

# Prepare WXT environment
pnpm postinstall
```

### 3. Local Development
```bash
# Launch Chrome / Brave / Chromium with extension hot-reloaded
pnpm dev

# Launch Firefox in isolated development mode
pnpm dev:firefox
```

---

## 🧪 Testing & Verification

Before submitting a Pull Request, you **must** ensure the entire verification pipeline passes cleanly:

```bash
# 1. Strict TypeScript type check
pnpm compile

# 2. ESLint static analysis
pnpm lint

# 3. Unit test suite (Vitest)
pnpm test

# 4. Multi-browser build verification
pnpm build:all
```

All Pull Requests run these checks automatically via GitHub Actions. PRs with failing tests or type errors cannot be merged.

---

## 📦 Project Structure

```
src/
├── core/             # Core settings store, suppression config, active site detector
├── engine/           # Decoupled suppression rule engine & intercept contexts
├── entrypoints/      # WXT entrypoints (popup UI, background script, messenger content script)
├── i18n/             # Localization dictionary (English & Vietnamese)
├── observe/          # Low-level hooks (WebSocket, Workers, Fetch, XHR, WebRTC, Dwell Time)
├── protocol/         # Network protocol decoders (DGW binary parser, GraphQL parser)
├── sites/            # Platform-specific rules and signatures (facebook/, instagram/)
├── trackers/         # Global tracker blocking rules (Meta Pixel, fbclid)
└── ui/               # Preact UI components, SVG icons, and Tailwind styles
```

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Commit your changes with meaningful Conventional Commits messages:
   - `feat(scope): add new feature`
   - `fix(scope): resolve bug or edge case`
   - `docs(scope): improve documentation`
   - `test(scope): add unit test coverage`
3. Push to your fork and submit a Pull Request targeting the `main` branch.
4. Describe your changes clearly in the PR description, including test steps and network evidence if modifying rules.
