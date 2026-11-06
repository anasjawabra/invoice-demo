# Exclusions management (`/exclusions`) — the exclusion register (final, 5 Nov 2026)

## Page order
1. Title and one-line description.
2. **Upload exclusions file** — «رفع الملف (.xlsx / .csv)» is the primary action, «تنزيل النموذج» secondary; instructions, the column list and the sample file are inside one collapsed «تعليمات الرفع» (the sample file is no longer a primary action). Validation, accepted / rejected counts and amounts, rejected-row explanations, the rejected-rows download and the applied-files history are unchanged.
3. The shared scope bar (`ScopeBar`): period, Amanah, source, … and the cutoff line — shown **once**.
4. **Compact summary** (one strip, no cards): total excluded · number of excluded invoices · share of total uncollected with its denominator named («من إجمالي غير المحصّل (يشمل المستبعد)» and the denominator amount).
5. **Compact reasons table** — one header row «سبب الاستبعاد | عدد الفواتير | المبلغ المستبعد | عرض»; ≈ 44–52 px rows (measured 44 px); top five reasons **with invoices**, by excluded amount, labelled «أعلى 5 من n …»; «عرض جميع الأسباب» / «عرض أقل» (zero-count reasons appear only when expanded; a selected reason is never hidden); the footer row is the total of **all** reasons in scope; amounts are shown in one short unit with the exact SAR in the cell tooltip and in the «i» detail (rule, source, exact amount); precedence is a secondary «القواعد وترتيب الأولوية» fold.
6. **Excluded invoices** in the shared register table (`InvoiceListTable`, `mode="excluded"`, the same component as `/invoices`): search, sorting, 25 per page, CSV export, plus a **payment-status filter**. «عرض» selects a reason: the row is highlighted («محدّد»), an active-filter indicator with «عرض كل الأسباب» appears, the list heading is scrolled into view and focused. Reason, search, payment status, sort, page and scroll are restored when coming back from an invoice.

## Payment status ≠ exclusion (services, not only the UI)
* `D.payStatus` (engine) is now **only** the payment status the source's own amounts give: collected · partly paid · overdue · not yet due · cancelled. It no longer becomes «excluded». Exclusion is the separate flag `D.excluded` (+ `D.mask`, `D.primaryBit`) and a **collection class** (`cls`, which is a calculated category, not a payment status). Documented in `server/engine.js`; `payStatusSource` (round 1) was removed — one field, one meaning.
* Consumers updated: list rows, invoice page (header, payment table), enforcement candidate summaries, `paymentFacts` (an excluded invoice's payment story is told against the amount billed), `PAY_STATUS_LABEL` (no «excluded» label), filters (`filters.payStatus`), **CSV** (`collection_class` replaces the ambiguous `state`; new `payment_status`; `exclusion_reason_ar/en`, `excluded_sar`).
* The invoice page shows «المتبقي غير المسدد» as the unpaid part even when it is excluded («مستبعد من القابل للتحصيل»); the exclusion banner states that the payment status is unchanged. Enforcement referral / order closure still never imply payment; source/enforcement conflict flags are untouched.

## Calculations (unchanged) and what was verified
Rules, precedence and formulas are untouched. `tests/exclusions-register.test.mjs` (isolated data) and the platform test «Exclusions register…»:
* each invoice once (composite identity), primary-reason groups = the excluded total, no amount twice, multi-reason invoices deduct once;
* **partly paid + excluded** (a synthetic partly paid invoice excluded through an uploaded-file overlay): paid part stays collected, excluded = billed − received, original = collected + excluded, status stays «partly paid», identities hold, total excluded grows by exactly the remainder;
* payment-status filter partitions the excluded invoices; «excluded» matches nothing;
* repeated uploads are idempotent; upload rows: missing / invalid fields, amount / date / account mismatch, other Amanah, duplicate row, composite key on a match; `pickUploadInvoice` (new, pure): several invoices with one number in one Amanah → told apart by GFS code, otherwise **ambiguous with every candidate's key, never the first**;
* export reconciles with the list (rows and Σ excluded), no row has «excluded» as payment status.
* **Real bug found and fixed:** the data service cached list pages without the uploaded-file overlay in the cache key, so a page cached before an upload could be served after it. The key now includes it.

Browser (isolated upload file of 5 rows): 2 accepted (690,000 = a fully unpaid invoice 268,000 + the unpaid remainder 422,000 of a partly paid one), 3 rejected with their reasons (missing invoice number, amount mismatch, duplicate row); after confirming: total 54 → 56 invoices, the reason row shows 2 / 690 thousand, the partly paid invoice appears once as «مدفوعة جزئياً» with invoice amount 572,000, collected 150,000, excluded 422,000; its invoice page shows the compact banner and the return path restores the filters; uploading the same file again changed nothing (56). Arabic RTL, English LTR, 1440 px and 375 px (no page overflow; the reasons table stays a table with 44–52 px rows). The test upload was removed from session storage afterwards.

Screenshots: `docs/screenshots/exclusions-before-1…4.webp` (the page before the redesign, as supplied), `exclusions-after-1-top.jpg` (title → upload → filters → summary → reasons), `exclusions-after-2-reasons-list.jpg` (reasons table and register).

## Limitations
* The demo data has **no same-number-in-one-Amanah** case, so that ambiguity branch is proven by the pure-function test and not by a browser upload; excluded invoices in the demo data are all unpaid (none partly paid) — partial payments are verified on isolated test data only.
* The uncollected worklist (`/collection`) keeps its own ranked columns; it was not moved onto `InvoiceListTable`.
* Keyboard: every action is a native button / link / `<details>`; focus order was reviewed in code and the list heading receives focus on selection; a full assistive-technology pass was not run.
* Hugeicons and the MOMAH/DGA kit are not available locally (`docs/design-dependencies.md`): the «i» control and other icons are the project's existing inline icons.
* The CSV column `state` was renamed `collection_class` (and `payment_status` added): any external consumer of the old header must be updated.
