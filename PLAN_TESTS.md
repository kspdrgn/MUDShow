# Frontend Test Plan

The first regression slice is intentionally small and deterministic. It runs without Tauri, a browser, a live MUD, or user storage.

Current coverage:

- transcript history append and line-limit trimming;
- incremental transcript-height indexing and virtual range calculation;
- canonical range extraction across chunks that may not be mounted;
- connection sequence acceptance, including duplicate and stale-event rejection.

Command: `npm test` (or `npm run test:regression`). The suite compiles the narrow production modules into `dist/regression-tests` and runs them with Node's built-in test runner.

Next coverage:

- mocked Tauri connection lifecycle and attach/snapshot ordering;
- session send/output/disconnect transitions;
- isolated history persistence;
- a Playwright test for selection while scrolling and split-view recovery.
