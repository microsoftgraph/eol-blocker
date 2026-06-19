# Copilot Instructions

## Architecture

This is a **GitHub Action** (Node.js, TypeScript) that detects CRLF line endings in pull request files and blocks merges. It runs on `pull_request_target` events.

**Flow:** `src/index.ts` (entry point) uses `@actions/github` to fetch PR files via the GitHub API, passes them to `src/validation.ts` which downloads each file's base64 content and checks for `\r\n`. If CRLF is found, the action posts a PR comment with fix instructions, adds a `crlf detected` label, and calls `core.setFailed()`.

**Key modules:**

- `src/index.ts` — Action entry point, orchestrates GitHub API calls
- `src/validation.ts` — Core logic: file content checking, exclusion matching (minimatch), PR comment generation
- `src/types.ts` — TypeScript types derived from `@octokit/openapi-types`
- `src/strings.ts` — User-facing string constants for PR comments

The `dist/` directory contains the bundled action output (committed to the repo) produced by Rollup.

## Build, Test, and Lint

```bash
# Build (TypeScript compilation)
npm run build

# Run all tests
npm run test

# Run a single test by name
npx cross-env NODE_OPTIONS='--experimental-vm-modules' jest -t "File with CRLF is detected properly"

# Lint
npm run lint

# Bundle for distribution (must be committed)
npm run package

# Full pipeline (format + build + test + package)
npm run all
```

After making changes, run `npm run package` and commit the updated `dist/` directory.

## Conventions

- **ESM modules** — The project uses `"type": "module"` with `.js` extensions in import paths (e.g., `'./types.js'`).
- **Copyright header** — Every `.ts` and `.js` file must start with:
  ```
  // Copyright (c) Microsoft Corporation.
  // Licensed under the MIT license.
  ```
  This is enforced by ESLint (`@tony.ganchev/eslint-plugin-header`).
- **Prettier** — Single quotes, auto line endings. Integrated via ESLint.
- **Tests** — Jest with `ts-jest` in ESM mode. Tests live in `test/` and mock Octokit HTTP calls by injecting a `jest.fn()` via Octokit's `request: { fetch }` option with native `Response` objects. Test files match `**/*.test.ts`.
- **Unused variables** — Prefix with `_` (enforced by `@typescript-eslint/no-unused-vars`).
