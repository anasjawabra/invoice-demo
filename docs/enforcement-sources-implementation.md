# إدارة التنفيذ — Sanad + Eefaa (+ Mumtathil enrichment): implementation record

Branch `feat/enforcement-sources` (from `main` at `f94e378`; local only — nothing pushed or deployed). Plan and findings: [enforcement-sources-plan.md](enforcement-sources-plan.md).

**Confidential-data basis.** The supplied exports were used only for their **schema** (sheet and column names) and **at most 15 sample rows per sheet, inspected as masked shapes**. No value from them is in code, fixtures, tests, docs, logs or commits; every record the demo and the tests use is **synthetic** (identifiers in invented ranges: violation numbers `99…`, Sadad numbers `99…`, request numbers `91…`). The supplied files are not imported into the demo and stay outside the repository. Nothing here establishes full-dataset accuracy, completeness, uniqueness or relationship validity.

## 1. What was built
| Area | Implementation |
|---|---|
| Sources | Sanad, Eefaa, Mumtathil are business sources (`src/data/ingestion/reports.js`). **Ingestion method** is separate: `excel` (available), `data_bank` and `direct` (planned, shown disabled, refused by the importer). `Sanad / Excel` and `Sanad / Data Bank` therefore share `source:'sanad'`, and the record identity contains no method. |
| Pipeline | `importer.js` (pure): header detection by **name** → per-cell normalisation (`ids.js`) → key choice → classification new / revised / unchanged / rejected → batch summary. `excel.js` reads the data block only (the search-criteria panel beside Eefaa reports is ignored). The same `{headers, rows}` input is what a Data Bank reader or direct integration would hand over. |
| Identifiers | Kept as **strings**; never padded, repaired or parsed as numbers. Flags: scientific notation with lost digits (damaged, unusable), exact scientific notation (recovered, flagged), > 15 digits (Excel precision risk), non-numeric, placeholder `---`, shorter than expected (leading zeros may be lost — flagged, not added back). A damaged identifier is kept for provenance and never used as a key or for matching. |
| Dates / amounts | Excel serial numbers converted; an ambiguous day/month text date is **not** interpreted (flag). Amounts must be numeric. |
| Validation / rejected rows | Header mismatch (missing required columns named), unusable key, duplicate key inside a file. Rejected rows are listed with row numbers in the import panel. |
| Repeat imports | Identity = `(report, key field, key)`. Same content hash → unchanged (not rewritten); changed content → **revision** that keeps the previous values; the same file imported twice creates nothing. |
| Provenance | Per record: original cell values, source label of every column, source status verbatim, import time, batch, file name + hash, mapping id and version, revision history. Per Eefaa field: which report supplied it. |
| Storage | IndexedDB `ib_enforcement_sources` (records, batches, reviews) with an in-memory backend for tests. It holds **synthetic** demo records and reviewer history; browser storage is not permission to keep confidential source data (the import panel says so). |
| Eefaa | `eefaa.js`: report rows are grouped **only** by an equal candidate violation number (`رقم المخالفة` / `Finenumber` / `رقم الغرامة`), the basis is shown, conflicts between reports are flagged with **both** values kept. An Eefaa violation is a violation record, not an enforcement order. **Execution basis** = `evidence` only when a source field states execution (execution no., request status, referral/execution date); otherwise `unknown`. A listing in the "referable" report is shown as a listing, never as eligibility. |
| Mumtathil | `relations.js`: Mumtathil records are separate records with their own provenance. One candidate rule — exact equality of Eefaa violation number and Mumtathil fine number — gives **«ربط مقترح — يحتاج تأكيد»**; several Mumtathil records with the number → ambiguous; none → unmatched. A reviewer confirms / rejects / reopens; decisions are an **append-only** history (reviewer, time, note). Conflicting values (Sadad number, amount, Amanah) are shown side by side. Amount/date/text similarity never links. Mumtathil rows are never counted as violations. |
| Page | `/enforcement`: tabs **الكل · سند · إيفاء** + eligible invoices · referred invoices · related contracts · **استيراد البيانات**. KPI strip with the unit stated on every card; Sanad and Eefaa counts never added; a standing disclosure that Sanad↔Eefaa overlap is not established. Eefaa list with filters supported by the data (Amanah/entity, source status as written, execution basis, Mumtathil link state incl. conflicting, supplying report, data quality, amount range) and search by violation no. / serial / business ref. / Sadad no. Sanad list gained source/ingestion and document-state columns. Eefaa details: `/enforcement/violations/:key`. |
| Linking | Importing ≠ linking. Eefaa → invoice candidates come from an **exact Sadad-number** match (only the v2 view carries one); a link exists only after a reviewer confirms it; history kept. |

## 2. Field mappings (from the supplied schemas; value patterns are assumptions to confirm)
Evidence level: **header seen in a supplied workbook/CSV** for every column below; shapes were seen on ≤ 15 sample rows only.

#### `sanad.qadaya_view key=requestNo`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| رقم طلب المطالبة بألاداء | claimNo | id(numeric) |  |
| رقم طلب التنفيذ | requestNo | id(numeric) | required |
| تاريخ المطالبة | claimDate | date |  |
| الأمانة | amanah | text | required |
| البلدية | municipality | text |  |
| رقم حالة الرفع للتنفيذ | statusId | text |  |
| حالة الرفع للتنفيذ | statusText | text | required, status |
| رقم نوع المنفذ ضدة | debtorTypeId | text |  |
| نوع المنفذ ضدة | debtorType | text |  |
| تاريخ الرفع للتنفيذ | raisedAt | date |  |
| تاريخ انشاء الطلب | createdAt | date |  |
| رقم اسم الموظف منشئ الطلب | employeeId | id(numeric) | personal |
| اسم الموظف منشئ الطلب | employeeName | text | personal |
| المبلغ | amount | amount | required |
| المبلغ كتابة | amountWords | text |  |
| رقم الانفاذ | enforcementNo | id(numeric) |  |
| رقم الفاتورة | invoiceNo | id(numeric) |  |
| رقم نوع التنفيذ | executionTypeId | text |  |
| نوع التنفيذ | executionType | text |  |
| الوصف | description | text |  |
#### `eefaa.executed_against key=violationNo`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| الجهة | entity | text | required |
| رقم الهوية | identityNo | id | personal |
| رقم المخالفة | violationNo | id(numeric) | required, candidate id |
| الرقم التسلسلي | serialNo | text |  |
| قيمة المخالفة | amount | amount |  |
| حالة طلب التنفيذ | executionRequestStatus | text | required, status |
| رقم التنفيذ لدى ديوان المظالم | executionNo | id(numeric) |  |
| تاريخ الرفع للتنفيذ | referralDate | date |  |
| تاريخ التنفيذ | executionDate | date |  |
#### `eefaa.referable key=violationNo`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| الجهة | entity | text | required |
| رقم الهوية | identityNo | id | personal |
| رقم المخالفة | violationNo | id(numeric) | required, candidate id |
| الرقم التسلسلي | serialNo | text |  |
| تاريخ المخالفة | violationDate | date |  |
| مدينة المخالفة | city | text | required |
| تصنيف المخالفة | category | text |  |
| قيمة المخالفة | amount | amount |  |
| تاريخ استلام رسالة المطالبة بالأداء | claimNoticeDate | date |  |
#### `eefaa.incomplete_notices key=violationNo`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| الجهة | entity | text | required |
| رقم المخالفة | violationNo | id(numeric) | required, candidate id |
| الرقم التسلسلي | serialNo | text |  |
| رقم الهوية | identityNo | id | personal |
| حالة الإكتمال | completionStatus | text | required, status |
| تاريخ المخالفة | violationDate | date |  |
| تاريخ استلام رسالة المطالبة بالأداء | claimNoticeDate | date |  |
#### `eefaa.general key=violationNo alt=businessRef`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| Finenumber | violationNo | id(numeric) | required, candidate id |
| Main Source Info | entity | text |  |
| Violatorid | violatorId | id | personal |
| Efaa Amount | amount | amount | required |
| Sadad Amount | sadadAmount | amount |  |
| Efaa Status | efaaStatus | text | status |
| Sadad Status | sadadStatus | text | status |
| Datehappened | violationDate | date |  |
| Timehappened | timeHappened | text |  |
| Cityname | city | text |  |
| Finebusinessref | businessRef | id(text) | required |
| Finebookingtypename | bookingType | text |  |
| Amananame | amanah | text |  |
| Insertdate | insertDate | date |  |
| Mainfinecategoryname | category | text |  |
| Reference ID | referenceId | text |  |
| Full Name | fullName | text | personal |
| Owner Id | ownerId | id | personal |
| Resolutionref | resolutionRef | id(text) |  |
| Violatorname | violatorName | text | personal |
| Inspectiontype | inspectionType | text |  |
| حالة التنفيذ | executionRequestStatus | text | status |
| رقم التنفيذ | executionNo | id(numeric) |  |
#### `eefaa.v2_tahseel key=violationNo alt=sadadNo`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| معرف نوع المخالفة | violationTypeId | text |  |
| رقم الهوية | identityNo | id | personal |
| اسم المدينة | city | text |  |
| رقم السداد | sadadNo | id(numeric) | required |
| اسم الأمانة | amanah | text | required |
| رقم الغرامة | violationNo | id(numeric) | required, candidate id |
| اسم المخالف | violatorName | text | personal |
| وصف الغرامة | fineDescription | text |  |
| مبلغ الغرامة | amount | amount | required |
| عدد او فترة | periodCount | text |  |
| تاريح الانشاء | createdDate | date |  |
| تاريخ الدفع | paymentDate | date |  |
| تاريخ الالغاء | cancellationDate | date |  |
| حالة الفاتورة | invoiceStatus | text | required, status |
#### `mumtathil.report key=caseId`

| Source column (as written) | Canonical field | Type | Notes |
|---|---|---|---|
| معرف الحالة | caseId | id(text) | required |
| رقم سداد | sadadNo | id(numeric) | required |
| حالة الفاتورة | invoiceStatus | text | status |
| اسم أمانة | amanah | text | required |
| اسم البلدية | municipality | text |  |
| مبلغ سداد | amount | amount |  |
| رقم غرامة | fineNo | id(numeric) | candidate id |
| هوية المخالف | violatorId | id | personal |
| بند اللائحة | clauseNo | text | clause (text) |
| اسم اللائحة | regulationName | text |  |
| معرف الاستئناف | appealId | id(text) |  |
| حالة الاستئناف | appealStatus | text | status |
| حالة الاستئناف AR | appealStatusAr | text | status |
| تاريخ رفع الاستئناف | appealRaisedAt | date |  |
| تاريخ حل الاستئناف | appealResolvedAt | date |  |
| تاريخ التحميل | loadedAt | date |  |
| اللائحة الرئيسية | mainClauseNo | text | clause (text) |
| اسم اللائحة الرئيسية | mainRegulationName | text |  |

## 3. Relationships — what the evidence supports
| Relationship | Evidence | Status in the demo |
|---|---|---|
| Sanad request ↔ its document | Business statement (every Sanad record is expected to have a document) | Modelled; a record without a document is flagged «مستند سند غير متوفر» |
| Eefaa violation ↔ Eefaa reports | Same 14-digit number appears under three different column names (Excel: `رقم المخالفة`; CSV: `Finenumber`, `رقم الغرامة`) | **Candidate** — grouping by equal value; equivalence and uniqueness not assumed |
| Eefaa violation ↔ Mumtathil record | Mumtathil `رقم غرامة` has the same shape (14 digits) as the Eefaa violation number in Excel exports; scientific-notation damage in CSV exports | **Candidate rule, unverified** → «ربط مقترح — يحتاج تأكيد»; reviewer decides |
| Eefaa violation ↔ invoice | Sadad number exists only in the v2 view and in Mumtathil | Exact Sadad-number candidates; reviewer confirms |
| Sanad request ↔ Eefaa violation | Both are said to use the same BOG execution number, but Sanad `رقم الانفاذ` meaning and Eefaa `رقم التنفيذ` population are unconfirmed | **Not linked, not de-duplicated**; counts and amounts kept separate; overlap disclosed as unknown |

## 4. Still needed from the data owners (does not block the synthetic demo)
1. Confirm `رقم المخالفة` = `Finenumber` = `رقم الغرامة` is one violation number and unique; which Eefaa views are delivered regularly; which Eefaa records belong on this page.
2. Approve the Mumtathil matching rule (or give another); is Mumtathil a pass-through of Eefaa or an independent record (MOM §11.4)?
3. Meaning of Sanad `رقم الانفاذ` and of Eefaa `رقم التنفيذ`; whether they identify the same case across systems.
4. Exports that keep identifiers exact (the CSV "fine number" columns arrive in scientific notation); whether Mumtathil `بند اللائحة` / `اللائحة الرئيسية` are clause codes that Excel turned into dates.
5. Official status classes for Sanad, Eefaa and Mumtathil statuses (today only «مغلق…» is a stated closure; vocabularies differ between systems).
6. Sanad documents: how documents will be delivered (file per request? bulk?) and which fields of the document are authoritative.
7. A real OCR / document-analysis provider (none approved). The demo workflow is a labelled simulation behind a provider interface.
8. Data Bank / direct-integration details (endpoints, record keys, delivery frequency) before those methods can be enabled.

## 5. Sanad documents and the OCR simulation (synthetic, behind a provider interface)
* **Documents.** Four synthetic Sanad PDFs (`public/samples/synthetic-sanad/`, Arabic text layer, every page headed «مستند تجريبي — غير رسمي», built by `scripts/make-sanad-docs.mjs` with `index.json` holding transcripts and SHA-256) for the demo scenarios, previewable and downloadable. The fifth scenario has no document by design.
* **Attach flow.** A document is attached to a Sanad record by picking a scenario document or uploading a file. An arbitrary upload can be previewed where the format is supported, but **simulated extraction needs a provided scenario document**: a file is "simulated" only when its SHA-256 equals a scenario document's; any other file gets an explanation and **no extracted values**. The system never claims to have read an uploaded file.
* **Extraction interface.** `src/data/sanadDocs/extraction.js`: `registerProvider({ id, label, simulated, extract })`; the UI and `runExtraction` only call the registry (default provider `simulation`, deterministic, with a persisted attempt counter). A real OCR provider replaces the simulation by registering another provider.
* **Extracted fields** are the ones the existing Sanad schema supports (request no., claim no., claim date, Amanah, municipality, amount, amount in words, «رقم الانفاذ», invoice no., debtor type, execution type), each with simulated confidence, source page and highlighted synthetic text, and status `extracted | uncertain | missing | conflict | confirmed | corrected | rejected`.
* **Review.** Side-by-side document + transcript with highlights and the structured Sanad value beside each extracted value, origin labelled. Confirm / correct / reject per field; the **original extracted value is immutable**; the correction, reviewer and ISO time are stored; conflicts (identifier, amount beyond the 1 SAR tolerance) need a decision with a reason; review history is persisted in IndexedDB (`ib_sanad_docs`) and survives a refresh.
* **Label.** «محاكاة OCR — بيانات تجريبية» is visible throughout, with the explanation that results are predefined synthetic outputs.
* **Scenarios** (fixed synthetic records `SND-9100001…9100005`): 1 document matches · 2 uncertain enforcement no. + municipality absent from the document · 3 conflicting invoice no. and amount · 4 no document («مستند سند غير متوفر» with attach actions) · 5 extraction fails on attempt 1, retry succeeds.
* **List integration.** The Sanad list and «الكل» show the document state (missing / attached / extracted / under review / reviewed / failed) via `documentState` + `loadDocsIndex`.
* **Remains simulated.** All extraction output. No OCR engine is connected; review decisions never write back to the Sanad source record.

## 6. Verification (this branch)
* `npm test`: platform suite **161** passed (unchanged), chat 12, decision room 9, **ingestion 14, Eefaa/Mumtathil 10, Sanad documents 18** test groups passed.
* Covered by the new suites: Excel header detection and rejection, identifier / date normalisation (incl. 14-digit exactness and scientific-notation damage), duplicate-key rejection, repeat import (no duplicates), changed-row revisions, Excel round trip with a criteria panel, store + append-only reviews, Sanad adapter; Eefaa grouping on a candidate identifier, per-report provenance, conflicts kept, execution basis (never "eligible"), Mumtathil proposed / ambiguous / unmatched / conflicting / confirmed / rejected / reopened with history, no similarity linking, Mumtathil never counted as violations; the document scenarios, failure + retry, arbitrary-file refusal, confirm / correct history persistence, missing-document flag.
* Browser (dev server, Arabic RTL): import of the synthetic reports (7 batches), tab counts (الكل 88 = سند 77 + إيفاء 11), KPI cards with units, Eefaa list and details, Mumtathil proposed → confirmed with history surviving a reload, invoice candidate by exact Sadad number confirmed (the «فواتير مربوطة (متمايزة)» card was later removed at the user's request), Sanad list columns, document panel on an imported Sanad record (extraction run, side-by-side review, label visible). `vite build` compiles. No console errors after the fixes below.
* Fixed during verification: StrictMode double-mount left the records provider permanently "not alive" (records never loaded); an Eefaa details page crashed when an invoice candidate's payer name (`{ar,en}`) was rendered raw.
* Not verified: mobile layout of the new tabs; the page-level horizontal overflow of the existing top navigation at ~1000 px (pre-existing, not caused by this work); real Excel files (deliberately not imported).


## 7. Enforcement exclusion workflow (invoice references → confirmed links → exclusion)
Requirement and design: [plan §8](enforcement-sources-plan.md). Applies to **confirmed Sanad enforcement links only**; an Eefaa → invoice link a reviewer confirms is stored apart (`invoice_link` reviews) and never reaches the exclusion engine (asserted by a test that the revenue context reads no Eefaa review).

### 7.1 Amount basis — an implementation assumption, NOT a confirmed business decision
**Excluded value = the uncollected remainder = billed (gross + approved adjustments) − received to the cut-off**, counted once per invoice. It is the basis the existing exclusion formulas already use (`exclAmt = max(0, billed − received)`, decision D10), so it was **kept, not invented**; it is documented here, on the invoice page («أساس القيمة المستبعدة … افتراض تنفيذي بانتظار تأكيد الأعمال»), in the exclusion record (`amountBasis: uncollected_remainder`) and in the dictionary. Consistency checked (test «AMOUNT BASIS consistency», over **every** invoice of the compact ledger with links applied):
* partly paid invoice: the collected part stays collected, only the remainder is excluded (the full invoice value is never excluded); a fully collected invoice is never excluded (D10);
* Σ per-invoice `exclTotal` = dashboard `exclusions`; Σ rule exclusions + cancelled = `exclusions`; excluded count, gross (after approved adjustments), net, outstanding all equal the snapshot; **Net invoiced = Gross invoiced − Exclusions**; net = collected + uncollected;
* the CSV export, the excluded-values table and the invoice detail carry the same excluded value; `verify:exports` (docx / xlsx / pptx parity) still passes.
**Inconsistencies / open points flagged (not silently resolved):**
1. *Time-dependence:* the remainder is measured at the cut-off, so a later payment on an excluded invoice shrinks the excluded value and raises collected. Whether the business wants the remainder frozen at the confirmation date is **unconfirmed**.
2. *Naming:* `totals.gross` is already after approved adjustments (`grossBeforeAdjustments` is the raw sum) — the identity holds on that definition.
3. *Reason name:* the approved 18-Oct name «منفذ ضده – قضايا (سند)» became «مرتبطة بأمر تنفيذ مؤكد» on instruction; the old name is kept in the rule text. Needs the rule owner's acknowledgement.
4. *Cancelled invoices:* the demo ledger has no cancellation-reason code, so **every** source-cancelled invoice with a confirmed order is flagged «تعارض بين المصدر والتنفيذ — يحتاج مراجعة» (also feed orders). In reality a «Transfer to BOG» cancellation is the normal referral marker (MOM §5): the flag may need a reason code to avoid noise. The S9 treatment (stays billed, excluded) is kept; only the flag was added.
5. *Pages outside the default period:* the exclusions page and dashboards use the page's period; an invoice issued before it does not move those tiles (verified with an all-time scope).

### 7.2 What was implemented
Engine: conflict flag; SND-1 exclusion record kept next to every other reason (no longer hidden behind a higher-priority one) with order, status, reviewer, time, supporting document and amount basis (`linkInfo` sent with each request, display only). Pages: invoice detail (reason, excluded value, orders as links, reviewer·time, document, all reasons), invoice list (badge + order links + conflict tag), excluded-values table (excluded value column, all reasons, order link). Review UX (extraction → matching → confirm, partial confirmation, exact button text) in the order journey. Circularity fixed: a confirmed link's own exclusion is shown as «مستبعدة: مرتبطة بأمر تنفيذ مؤكد», not as a conflict or "already excluded". Simulation label unified to «محاكاة OCR — بيانات تجريبية».

### 7.3 «إجمالي المحصل من أوامر التنفيذ» (Enforcement Management page only)
Card + drill-down (orders, invoices, payment dates, amounts). Payments counted = records whose **channel is «enforcement»** on invoices with a **confirmed** link; period = **payment date** (inclusive); Amanah/organisation scope filters the invoice; each payment counted **once** (by record id) however many orders link the invoice; partial payments are separate records; payments of another channel are listed apart, never counted; if the linked invoices carry payments but none shows attribution evidence the card reads «غير متوفر من المصدر» (no assumed amount, no zero). Nothing is inferred from order closure, exclusion or the order amount. Payment records are the demo ledger's plus a **labelled synthetic** set (`SYN-TAH-…`) that is **not part of the ledger**: no dashboard, invoice page or exclusion amount reads it (stated on the card). Whether the real Tahseel feed carries an enforcement channel is **To Be Confirmed**. Code: `server/enforcementCollections.js`, `POST /api/enforcement-collections`, tests `tests/enforcement-collections.test.mjs` (8 groups).

### 7.4 Eefaa details
`/enforcement/violations/:key` now opens with «تفاصيل المخالفة»: which of the five Eefaa reports supplied the violation, then every business field grouped (identity/classification, entity/location, violator — masked, amounts and payment status, dates, execution as stated by the source) with the report and column behind each value, conflicts kept, and an explicit «غير متوفر في التقارير المستوردة» for absent fields; the list has an «فتح» button; invoice candidates show payment status and outstanding. Execution basis remains «source evidence» or «unknown», never «eligible».

### 7.5 Browser verification (synthetic data) — journey on SND-9100001/2/5/6
Document preview → labelled simulated OCR → 3 invoice numbers with page + snippet → review table (entity, amount, status, evidence, discrepancy; incomplete / unmatched / ambiguous / conflicting flags) → typed full number resolves the ambiguous short serial → partial confirmation (1 reference stays pending) → exclusion: all-time totals move by exactly the confirmed amounts (+64,155,210 for three invoices; partly paid F: +131,309,453 = its remainder, collected unchanged; E +51,243,700; excluded count +n; gross and collected unchanged; equation ok); unconfirmed extraction leaves the exclusions page unchanged; one invoice linked to two orders is counted once; withdrawing one order's link keeps the invoice excluded (the other link), withdrawing the last removes it; a source-cancelled invoice shows the conflict flag and its source status is untouched; after a refresh the document, extraction state, confirmed links, reviewer·time·document, field confirmations and a correction (original value kept) are all still there. Screenshots (synthetic only): `docs/screenshots/enforcement-sources/`.

### 7.6 Status of the two-source requirement (Sanad alone is not the whole requirement)
| Area | Status |
|---|---|
| Sanad: import, list, details, documents, simulated OCR, invoice-reference review, confirmation, exclusion | **Implemented**, browser-verified on synthetic data; OCR **simulated** |
| Eefaa: import (5 report layouts), list, filters, details (all fields + provenance), candidate violation-number grouping, execution evidence vs unknown | **Implemented** (synthetic data); key equivalence / uniqueness **unconfirmed** |
| Mumtathil: separate source, enrichment inside Eefaa details, proposed/confirmed/ambiguous/rejected/conflicting with reviewer history | **Implemented** (synthetic); matching rule **unverified** («ربط مقترح — يحتاج تأكيد») |
| Eefaa → exclusion | **Deliberately not extended** (applies to confirmed Sanad links only) |
| Sanad ↔ Eefaa overlap | **Not established**; counts kept separate and disclosed |
| Excel ingestion | Excel **available**; Data Bank / direct integration **planned, not connected**; real confidential files **not imported** |
| Real OCR | **Not available**; labelled simulation behind a provider interface |
Pre-existing dev-only issue found (not introduced here, left unfixed): on a hard navigation the page can hang on «جارٍ تجهيز البيانات التجريبية…» or show a data-service error «reading 'cutoff'» — `src/api/client.js` shares an in-flight request between the two React StrictMode effect runs and the first run's abort poisons the shared promise (`compareSnapshots` then reads `.cutoff` of undefined). A reload recovers; a fix is a one-line change (do not pass the caller's abort signal to a shared cached request).


## Direction change (2026-11-05, supersedes the Excel / reviewer-decision parts above)
1. **Data comes from the Data Bank, read directly.** Excel was only the way the report layouts were analysed (schema + ≤ 15 masked sample rows). **Uploading Excel is removed from the product** (no import page, button, file chooser, template download or "clear imported"). The ingestion pipeline (header mappings, normalisation, validation, repeat-read idempotency, revisions, provenance) is unchanged and is the contract a Data Bank reader maps onto; the Data Bank's own field names are **To Be Confirmed**. Ingestion methods are now `data_bank` (available) and `excel` (retired, refused); the earlier "direct integration" method was folded into `data_bank`.
2. **Demo:** synthetic records stand in for the Data Bank read and are seeded automatically through the same pipeline on every load (idempotent), labelled «بيانات تجريبية اصطناعية»; the landing shows «بنك البيانات — قراءة مباشرة · آخر قراءة …» with an explanatory disclosure. Records previously stored under the Excel method are replaced once (reviewer history kept).
3. **Eefaa has no confirm / reject / reopen.** Where Mumtathil is found for an Eefaa violation (exact fine-number = violation-number match) its information is simply shown inside the Eefaa details, attributed to Mumtathil; several Mumtathil records with the same number are shown with an «عدة سجلات» warning; conflicting values are shown side by side; no Mumtathil record → nothing is added. The wording «ربط مقترح — يحتاج تأكيد» is retired (status: «مرتبط بممتثل (مطابقة تامة للرقم)»). Eefaa → invoice candidates by Sadad number are shown for information only. The matching rule is still **unverified by the data owner** and the page says so. (The reviewer-decision functions remain in the data layer, unused by the UI.)
4. **Page renamed** «إدارة أوامر التنفيذ» (EN «Enforcement orders management»).

5. **Eefaa details show only the violation's own data and its linked invoices** (user instruction): the execution-evidence section, the Mumtathil section and the source/ingestion section were removed from the page; the linked invoices appear in the same detailed table as on the Sanad order page (issuing entity, Amanah/municipality, invoice type, revenue source/item/product, dates, amounts, status). The Mumtathil match logic and the list column remain in the data layer/list; they are simply not shown in the details.


## Structured-first Sanad workflow (2026-11-05, supersedes "OCR first")
**Principle:** OCR is a *fallback* when the structured Sanad invoice reference is missing or inconsistent; **no proposal becomes a confirmed link without the explicit click «تأكيد ربط الفواتير المحددة بأمر التنفيذ»**, even when the structured number and amount match.
* **Validation first** (on opening the order, no document needed): the structured «رقم الفاتورة» is compared with the ledger (Tahseel + the sources it unifies; one invoice counted once however many representations/references). Exact match with safe normalisation only (identifiers stay strings; a bare 12-digit value is read as a Sadad number); several matches → candidates shown, never chosen.
* **Amount basis (documented in `src/data/sanadWorkflow.js`):** order amount = Sanad «المبلغ» (`source.amount`); invoice amount = the invoice's billed value (gross + approved adjustments, `grossAmount`) — **never the outstanding balance** (shown for information only); difference = order − Σ invoices (each once); tolerance 1 SAR. This is an implementation choice pending business confirmation.
* **Scenario banners (exact texts):** «رقم الفاتورة والقيمة متطابقان» → straight to confirmation, OCR optional · «رقم الفاتورة غير موجود في المصادر المتاحة — يحتاج مراجعة» (never "wrong": coverage may be incomplete) → extraction or manual entry/search · «اختلاف بين قيمة الفواتير وقيمة أمر التنفيذ» + the difference → extraction / manual review · no numbers → extraction · no document / extraction failed → manual ledger search with a **required recorded explanation**.
* **One review path:** structured, document-extracted (simulated OCR) and manually entered/searched references all go through the same existence / ambiguity / duplicate / amount checks. Originals are never overwritten; corrections are recorded separately (`reference_corrected` with origin, reason, reviewer, time).
* **Discrepancy:** a remaining difference stays visible and confirming across it needs an explicit acknowledgment + reason (enforced in the reducer, stored on the link and history). Unresolved references never become links; partial confirmation is marked.
* **Confirmation panel:** proposed invoices (source, values), total, order amount, difference, warnings. After confirmation the engine re-evaluates the existing exclusion rules and the page shows **each invoice's outcome** («مستبعدة» with the excluded value, or «لم تُستبعد» with the reason, e.g. fully collected, cancelled → flagged). Unconfirmed proposals change nothing (links map, exclusions, totals — tested).
* **Demo records:** SND-9100007 exact match (no OCR) · 9100008 unmatched number corrected via extraction · 9100009 amount difference + missing invoice found in the document · 9100001 no numbers, three invoices from the document · 9100004/9100005 (no document / failed extraction) completed by manual search. Deviations: the structured value is given as the 12-digit Sadad number (the importer rejects dashed ids); 9100009's second invoice belongs to the same Amanah as the first (an invoice of another Amanah is a hard conflict that cannot be confirmed). Tests: `tests/sanad-workflow.test.mjs` (16 groups).
* **Not covered:** a cancelled-invoice outcome was verified by tests, not in the browser; "all referral-linking paths" = structured, document, manual (Eefaa violations are deliberately not linked to exclusion).
