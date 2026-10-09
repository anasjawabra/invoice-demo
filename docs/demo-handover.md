# Demo handover — INTELLIBILL revenue intelligence (branch `phase0-fixes`)

**Release-candidate code commit:** `9a964fc6a97b8874dc9c6699a9217deeac636c90` (branch `phase0-fixes`; nothing pushed or merged). This handover and the register's Round 6 section are committed on top of it.
**What it is:** a clearly labelled **synthetic-data demonstration** of the Ministry's revenue-intelligence prototype. It is **not production-ready** and makes **no accessibility-conformance claim**.

## 1. Run it locally
Requirements: Node ≥ 18 (tested on 26.7), npm. Python 3 with `python-docx`, `openpyxl`, `python-pptx` only for the optional export-parity check.

```bash
npm install
npm run dev            # development: http://localhost:3000 (the data service runs inside Vite)
```
or the built form:
```bash
npm run build && PORT=3000 npm start      # serves the SPA and the data service from one process
```
Sign in with the seeded demo account **demo / demo123** (reviewer rights: can approve, save versions, create actions). `auditor / demo123` is read-only. The sign-in form is pre-filled.

Useful switches: `?demoToday=YYYY-MM-DD` pins the demo's "today" (Asia/Riyadh) for the session; `?demoToday=reset` returns to the real date. Data lives in the browser: plans, scenarios, actions and Smart-report conversations in `localStorage` (use «أين تُحفظ بياناتي؟ النسخ الاحتياطي والاستعادة» to export/restore); filters and settings in `sessionStorage`. To test without touching existing data, open the app on a different origin, e.g. `http://127.0.0.1:3000` instead of `http://localhost:3000`.

Checks: `npm test` (84 tests), `npm run build`, `npm run verify:exports`.

## 2. Five-minute demonstration script (Arabic interface, reference date 2026-10-09 → open `…/login?demoToday=2026-10-09`)
1. **Dashboard** — headline «386 فاتورة … المحصّل حتى 9 أكتوبر 2026». Point at the three identities (gross = exclusions + net; net = collected + uncollected). Click a «؟» to show a definition. Open «المرشحات»; choose «الشهر الماضي» and an Amanah; the status line and figures update.
2. **Drill-down** — «التفاصيل: الفواتير والأدلة» → the same invoices; open one (drawer: focus stays inside, Esc returns). Browser back → filters preserved.
3. **Fixed reports** — «التقارير الثابتة» → «الملخص التنفيذي الشهري» → same figures as the dashboard → «تصدير Excel» (status line confirms the file).
4. **Smart reports** — type «تقرير الرياض وجدة ومكة هذا الشهر». The system **asks for confirmation** (several Amanahs; a short name): show the editable summary, confirm. Then the chip «قارن بالشهر الماضي», then «تعديل» → change the status → the report regenerates; export. Type «تقرير الإيرادات بالدولار» to show the system asks instead of ignoring the currency («تابع بدونه»).
5. **Planning** — baseline, then **«ما الذي يقيسه كل رقم؟»**: collected 7.83 bn + 50 thousand + 580.82 million = receipts 8.41 bn, and why. Scenarios: change the collection-rate lever, save «تحسن أربع نقاط» (marked «غير معتمد»), save a version, open «الإصدارات» → «إعادة الاحتساب».
6. **Close** — state the limits below out loud (synthetic data, rule-based interpreter, no production claims).

## 3. Known limitations (demo)
* Synthetic data only; no real Ministry figures anywhere in code or UI.
* Data is kept in one browser; backups are manual.
* The Smart-report interpreter is **rule-based**, not a language model. It asks (clarification or confirmation) more than a person would and **can still misread requests outside the confirmed categories**; fresh-set results are 76.4 %, 92.2 %, 70.3 %, 95.2 % and 76.2 % first-run (see the register) — no claim of reliable understanding. F-05 stays partial.
* The funding side-by-side in Planning (scenario beside projected receipts) is an openly **approximate** combination of two bases; it is labelled.
* Chinese is incomplete (shown as English with an on-screen notice); Arabic and English are the authored languages.
* Not verified: screen readers; real OS download and file chooser for backup/restore; keyboard selection inside native select pop-ups and typing into native date segments; real cross-browser behaviour. Automated axe checks are clean on the pages tested — that is not conformance.
* One unexplained redirect (`/invoices` → `/insights`) was seen once and not reproduced (7 attempts).

## 4. Production dependencies
Server-side store with identity, roles and audit for plans, scenarios, actions, conversations (F-19); real approval workflow and authenticated actor identity; real data connections and the data-quality gaps in the evidence notes; formal accessibility audit with assistive technologies; a language model or an owned, tested rule set for free-form understanding; a browser/device support matrix.

## 5. Unresolved business decisions (nothing is assumed)
EQ2 grace periods (collection reporting vs enforcement referral — two parameters, both unset) · EQ3 exclusions under unapproved rules · EQ4 who approves plans/objectives/actions · EQ5 the official coverage definition (not invented in the reconciliation) · EQ6 fiscal year and target approval (D-13) · EQ9 new July report types · official logo, Figma specification and icon licence.

## 6. Final verification results (details in `docs/findings-register.md`, Round 6)
`npm test` 84 passed · `npm run build` ok · `verify:exports` 100 % (docx/pptx tables 4735/4735, xlsx amounts 2196/2196) · `npm start` smoke ok · four main journeys verified at 2026-10-09 in an isolated browser origin · presets, coverage and figures consistent at 2026-09-30, 2026-10-01, 2026-12-31, 2027-01-01 and across a simulated Riyadh midnight · defects found and fixed during this pass: status-filtered reports failing reconciliation, multi-Amanah edit resetting to «all», raw Amanah keys and a stale period label in report subtitles, an uncancelled post-login navigation timer.
