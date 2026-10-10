# Demo handover — INTELLIBILL revenue intelligence (branch `phase0-fixes`)

A clearly labelled **synthetic-data demonstration**. It is **not production-ready**, and no accessibility-conformance or "reliable AI understanding" claim is made. Scope is frozen; the branch is ready for review. Nothing is pushed or merged.

## 1. Final commit
The final commit — code **and** documentation together — is the commit tagged **`demo-baseline-final`** on branch `phase0-fixes`:
```bash
git rev-parse demo-baseline-final     # the exact commit hash
git show --stat demo-baseline-final   # code + docs in one commit
```
(A commit cannot contain its own hash, so the tag is the stable reference; the hash is also reported in the hand-off message.) Evidence and statuses: `docs/findings-register.md` (Rounds 1–7); interpreter first runs: `docs/interpreter-heldout*-first-run.txt`.

## 2. Run instructions and demo date
Requirements: Node ≥ 18 and npm. (Python 3 with `python-docx`, `openpyxl`, `python-pptx` only for the optional export-parity check.)
```bash
npm install
npm run dev                                  # http://localhost:3000 (data service runs inside Vite)
# or the built form:
npm run build && PORT=3000 npm start
```
Sign in with the seeded demo account **demo / demo123** (reviewer rights); `auditor / demo123` is read-only. The form is pre-filled.

**Demo date.** The app uses today's real date in Asia/Riyadh. For a repeatable demonstration, open
`http://localhost:3000/login?demoToday=2026-10-09`. **`demoToday` is demo/review-only:** it pins the displayed date for the browser session, a banner on every page says so («وضع العرض … للعرض والمراجعة فقط») with an *unpin* link, and `?demoToday=reset` returns to the real date. It is not a production feature.

**Your data is stored in the browser** (plans, scenarios, actions, Smart-report conversations in `localStorage`; filters in `sessionStorage`) and is never overwritten by starting the app. To try the demo without touching existing data, use another origin, e.g. `http://127.0.0.1:3000` instead of `http://localhost:3000`. Backup/restore: «أين تُحفظ بياناتي؟ النسخ الاحتياطي والاستعادة».

Checks: `npm test` (84 tests), `npm run build`, `npm run verify:exports`.

## 3. Demonstration script (≈ 6 minutes, Arabic interface, date pinned to 2026-10-09)
1. **Dashboard** — «386 فاتورة … المحصّل حتى 9 أكتوبر 2026»; the identities (gross = exclusions + net; net = collected + uncollected); a «؟» definition; «المرشحات» → «الشهر الماضي» + an Amanah.
2. **Drill-down** — «التفاصيل: الفواتير والأدلة» → the same invoices; open one (focus stays in the drawer; Esc returns); browser back → filters kept.
3. **Fixed reports** — «الملخص التنفيذي الشهري» → same figures → «تصدير Excel».
4. **Smart reports** — read the bold line: *fixed rules, not a language model; check «How I read your request»*. Type «تقرير الرياض وجدة ومكة هذا الشهر» → the system **asks for confirmation** (several Amanahs; a short name) with the editable interpretation → confirm → report → chip «قارن بالشهر الماضي» → «تعديل» → period «السنة حتى اليوم» → apply → export. Then «تقرير الإيرادات بالدولار» → it **asks** («تابع بدونه») instead of ignoring the currency.
5. **Planning** — «ما الذي يقيسه كل رقم؟»: *collected 7.83 bn* (capped at each invoice's net) **+ 50 thousand** (one overpayment: cash received above the invoice net) **+ 580.82 million** (paid on older invoices) **= received 8.41 bn** (total cash by payment date). Set the collection-rate lever: the funding table's baseline **does not move**; the scenario's effect is shown **separately** («سيناريو — غير معتمد», no scenario balance). Save a named scenario, save a version, «الإصدارات» → «إعادة الاحتساب».
6. **Close** — say the limitations below aloud.

### Supported Smart Report prompts (what the rules understand)
* **Period:** «هذا الشهر حتى اليوم», «الشهر الماضي», «آخر 3 أشهر», «الربع الحالي حتى اليوم», «السنة حتى اليوم», a month name, «الربع الأول…», «من 1 مارس إلى 15 مارس», «منذ أول يناير» (the last two ask for confirmation).
* **Scope:** an Amanah («اعرض أمانة الرياض فقط»; several Amanahs and short/variant names ask for confirmation), a municipality direction, a revenue source (Furas investment, fines, municipal fees, licences, accommodation, tobacco, white lands), invoice status («المتأخرة فقط», «المحصّلة», «الملغاة»).
* **Comparison:** «قارن بالشهر الماضي», «قارن بالعام الماضي»; **sections:** sources, Amanahs, aging, exclusions, monthly trend, gaps, payment status, data quality; «ملخص» / «تفصيلي»; follow-ups («أضف تحليل الاستبعادات»).
* **Not supported (the system asks or declines, never ignores):** top-N rankings, grouping/sorting by other fields, amount thresholds, currencies other than SAR, named payers/districts, «excluding …», forecasts, partial periods («نهاية العام الماضي»), weeks/days/«n years ago», weekdays, and actions such as send/translate/schedule (use the export buttons).

## 4. Known limitations
* Synthetic data only; no real Ministry figures in code or UI. Data lives in one browser; backups are manual.
* **The Smart-report interpreter is rule-based, not a language model.** It asks more than a person would and can still misread requests outside the confirmed categories. Fresh-set first runs: 76.4 %, 92.2 %, 70.3 %, 95.2 %, 76.2 % (see the register); regression sets passing is not accuracy evidence. Always check the interpreted scope shown with each report. **F-05 stays partial.**
* **F-23 stays partial.** Planning explains and reconciles the two actual measures (the bridge above). The funding view shows the baseline only and the scenario separately; a compatible funding calculation that includes the scenario would need a defined conversion from invoice-basis collections to payment-date receipts and the unresolved coverage definition — neither is assumed.
* «Collected» is **capped at each invoice's net**; «received» is **total cash**, including overpayments and payments on invoices outside the period — they are different figures by design.
* Chinese is incomplete (shown as English with an on-screen notice); Arabic and English are the authored languages.
* Not verified: screen readers; the real OS download and file chooser for backup/restore; keyboard choice inside native select pop-ups and typing into native date segments; real cross-browser behaviour. Clean automated axe results are not conformance.
* One unexplained redirect (`/invoices` → `/insights`) was seen once and not reproduced in 7 attempts.
* Production dependencies: a server-side store with identity, roles and audit (F-19); a real approval workflow; real data connections; a formal accessibility audit; a language model or an owned, tested rule set for free-form understanding.

## 5. Outstanding business decisions (nothing is assumed)
EQ2 grace periods (collection reporting vs enforcement referral — two parameters, both unset) · EQ3 exclusions under unapproved rules · EQ4 who approves plans/objectives/actions · EQ5 the official operating-spending coverage definition · EQ6 fiscal year and target approval (D-13) · EQ9 new July report types · official logo, Figma specification and icon licence.

## Final verification (summary)
`npm test` 84 passed · `npm run build` ok · `npm run verify:exports` 100 % (docx/pptx tables 4744/4744, xlsx amounts 2202/2202, 1408/1408 items per format, now including a funding table with an active scenario) · four main journeys, date-rollover checks (2026-09-30, 2026-10-01, 2026-12-31, 2027-01-01, simulated Riyadh midnight) and the final Planning checks run in an isolated browser origin; the `localhost:3000` profile was not touched. Details: register Rounds 6–7.

## Addendum — enforcement orders and invoice matching (branch `enforcement-order-matching`)
Orders from Sanad cover **one or several invoices of any type**; open **Operations → Noncollection & exclusions → «Open enforcement orders»** (or an invoice's «Enforcement orders» row). Demo (date pinned to 2026-10-09): open **EN-5078** (amount discrepancy stays visible), **EN-5026** (add `public/samples/enforcement-orders/EN-5026-multi_partial_refs.pdf`, confirm the two new references → fully matched only after the last), **EN-5065** (ambiguous serial: a reason is required), **EN-5039** (add the scanned sample: pages are «NOT read», OCR is not connected). Say aloud: **the Sanad feed is synthetic, live Sanad retrieval and Sanad PDF retrieval are not connected, and there is no OCR engine — only the text layer of digital PDFs is read.** Details, verification and dependencies: `docs/enforcement-order-matching.md`. Sample PDFs are regenerated with `npm run make:samples`.

### Update — full-page records (same branch)
Invoices, contracts, enforcement orders and analysis results now open as **full pages** (no side drawers): `/invoices/:id`, `/contracts/:id`, `/enforcement-orders/:n`, `/analysis/:id`; the list **«إدارة أوامر التنفيذ»** is under Operations. Demo: Invoices → filter + page 2 → open an invoice → «Back» (same filter/page/scroll); open **INV-2024-0000027** (an order closed and one in execution: *current enforcement* and *referred before* are shown apart from *payment status*); **EN-5143** with `ar-EN-5143-scanned.pdf` (Arabic scan: «NOT read — no OCR») then type the two invoice numbers; **EN-5013** with `ar-EN-5013-digital.pdf`. Say aloud: **the Sanad feed is synthetic; live Sanad and Sanad-PDF retrieval and real OCR are not connected.** Backups do not contain PDF files. Details: `docs/full-page-records.md`, `docs/ocr-integration-assessment.md`. Arabic samples: `npm run make:samples:ar` (needs LibreOffice + pdftoppm).

### Update — enforcement management as a primary area
**«إدارة التنفيذ»** is now a third primary navigation entry with a landing page of defined counts and four views (orders · referred invoices · related contracts · review exceptions). Enforcement no longer changes any collection category: an unpaid invoice stays in the uncollected view whether its order is in execution, suspended or closed; suspended orders are shown separately («open, not proceeding»). Sanad's official status mapping is **not** known. Details: `docs/enforcement-management.md`, `docs/old-ocr-review.md`.

### Update — every source of references, cancelled invoices, contract mentions
Orders now read **all** sources (structured field, description, notes, PDF, Word tables); unreadable files are kept and flagged; cancelled-in-source invoices with a confirmed order are flagged «source/enforcement conflict — review required» (ENF-1 retained, pending EQ3); contracts show *mentioned* / *directly referred* / *invoices referred* separately. Demo: **EN-6007** (description only) → **EN-6014** (add the PDF) → **EN-6021** (add the `.docx`, confirm the contract mention) → **EN-6042** (scan + legacy `.doc` flagged) → **EN-6028** (conflicting years) → invoice **INV-2025-0000012** (conflict finding). Full script, evidence and dependencies: `docs/all-sources-and-cancelled-invoices.md`. Live Sanad retrieval and actual OCR remain pending.

### Update — simplified journey and OCR simulation
The order page is now three steps (**إضافة المستند · تحليل المستند · مراجعة وتأكيد الربط**) with one primary action «تحليل وربط الفواتير» and one confirm action «تأكيد ربط الفواتير المحددة». Eight prepared scanned samples run a labelled **«محاكاة OCR — للعرض التجريبي»** (not real OCR); other files use real extraction or are flagged unread. Enforcement no longer changes any amount by itself (ENF-1 only on a reviewer decision; EQ3 open). Demo: EN-6000 → EN-6028 → EN-6014 → EN-5065 → EN-6021 → EN-5039 → EN-6063/EN-6119 → EN-6035 → invoice from EN-6126. Details: `docs/simplified-journey-and-ocr-simulation.md`. Live Sanad and actual OCR remain pending.

### Update — Sanad CSV structure
The orders list now follows the Sanad extract (request number, Amanah · municipality, debtor type, referral status as written, referral date, amount, invoice-number field, matching-review status); all 20 columns are in the order page («حقول المصدر»). Scientific-notation identifiers are listed, never matched. The «apply ENF-1» reviewer action was removed: nothing changes any amount; the cancellation/enforcement conflict stays visible (EQ3 open). Demo: list → **EN-6049** (numbers only in the description) → **EN-6056** (corrupted structured number) → invoice **INV-2025-0000217** (conflict, balance 0, no action). Current sample orders: prepared samples EN-6014, EN-5039, EN-6042, EN-6028, EN-5065, EN-6035, EN-5078, EN-5143; Word EN-6007 (mention only) and EN-6098 (explicit statement); scan + `.doc` EN-6063; PDF EN-6000. Details: `docs/sanad-csv-mapping.md`.

