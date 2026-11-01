# Regression and audit scripts

The default verified suite is `npm test`. `npm run test:deployment` builds an
isolated frontend/server and checks SPA routes, assets and API requests.

The additional scripts in this directory were recovered from a local working
copy. They are retained for diagnosis and are **not all passing against the
current application**. They are not automatically included in `npm test`.
Do not interpret the presence of these scripts as a successful release check.

## Running additional checks

Most data checks import application modules with extensionless imports. Bundle
them with the existing esbuild dependency before running, for example:

```sh
npx esbuild tests/chinese-localization.test.mjs --bundle --platform=node --format=esm --packages=external --outfile=.test-build/chinese-localization.test.mjs
node .test-build/chinese-localization.test.mjs
```

Browser scripts use Playwright and Microsoft Edge (`channel: 'msedge'`). Supply
`UI_PLAYWRIGHT_MODULE` as the absolute path to Playwright's `index.mjs`, and set
`UI_AUDIT_URL` to the local demo server. Several scripts have their own URL or
output environment variables; inspect the start of the selected script. Tests
that import `/src/...` or `/tests/...` inside `page.evaluate` require a Vite
development server. Those imports resolve in the browser, not in Node.

`keyboard-modal-regression.mjs` requires a browser bundle of
`keyboard-modal-harness.jsx` at `.test-build/keyboard-modal-harness.js`.
The HTML/JSX harnesses are served through Vite. Export layout scripts require
their generated models and document files first. Python inspectors require
python-docx, python-pptx, pypdf and Pillow as applicable; the evidence renderer
also accepts a Poppler executable path.

`scripts/ui-audit-round5.mjs` connects to an existing local browser debugging
endpoint. `scripts/normalize-dga-typography-spacing.mjs` rewrites source files
unless `--check` is supplied. Neither script runs as part of the build or tests.

## Check recorded on 2026-11-01

Application baseline: `fa88561`. The previously run default suite passed 161
platform tests, 12 chat groups and 9 decision groups. Build, deployment smoke
and 12 English/Chinese/Arabic browser scenarios also passed.

Additional standalone checks that passed: Chinese localization, hardening data,
history entry data, modal focus, navigation data and organization scope data.

Additional checks that failed:

| Script | Observed failure |
| --- | --- |
| `access-data-regression.mjs` | Expected an unmatched reference; the current implementation returned matched. |
| `journey-data-regression.mjs` | Expected target data to survive the backup/restore flow; the result was undefined. |
| `production-mode.mjs` | Expected an unavailable production backend response (503); received 200. |
| `resilience-data-regression.mjs` | Expected independent request cancellation; observed one request instead of two. |

Several other scripts cannot currently bundle because the source modules they
exercise refer to unavailable exports. These include numeric target parsers,
store readers, asynchronous list helpers, worklist export helpers, `COLLECTIONS`
and the removed `risk` API. Affected entries include `export-data-regression`,
`input-data-regression`, `lifecycle-data-regression`, `query-stream-data`,
`strategicModel.test`, `ux-data-regression`, `workflow-data` and `workflow-ui`.
Restore the intended implementation or reconcile obsolete expectations before
adding these checks to the default suite. The remaining standalone browser,
performance and export inspections were not executed in this supplementary check.
