# إدارة التنفيذ — two primary sources (Sanad, Eefaa) + Mumtathil enrichment: findings and plan

Status: **plan only, nothing implemented.** Base: `main` at `f94e378`. Written 2026-11-05.

**Confidential-data basis.** The uploaded exports were inspected for **schema** (sheet and column names) and **at most 15 sample rows per sheet, shown only as masked shapes** (digits → 9, letters → a, Arabic words → ع). No sample value appears in this document, in code, fixtures or logs. Nothing here establishes full-dataset accuracy, completeness, uniqueness or relationship validity. Everything marked **TBC** needs the data owner. *Disclosure:* before the sample-only rule was given, a full-file profile of the CSV exports was run in a scratch session; none of its figures are used or recorded here.

## 1. What exists today (code, `main`)

| Area | Finding |
|---|---|
| Page | `/enforcement` (`EnforcementHome.jsx`, tabs orders / eligible / referred invoices / related contracts); `EnforcementOrders.jsx` = one row per **Sanad** request; `/enforcement-orders/:enforceNum` (`EnforcementOrderPage.jsx`). All Sanad-specific wording. |
| Data | Sanad-shaped cases: 20-column dictionary in `src/data/sanadSource.js` (33 statuses kept verbatim, only «مغلق…» classed closed), deterministic **synthetic** adaptation (`adaptSourceCase`), generator in `server/world.js`. Served by `GET /api/sanad-cases`. |
| Eefaa | Only an **invoice-level** field `statusRawEfaa` (5 synthetic values, `catalog.js`). **No Eefaa violation/case object, no page.** Referral eligibility does not read Eefaa. |
| Mumtathil | Only a source-registry entry and invoice objection flag/status (`OBJ-1`, `iim.js`). No violation record, no relation to Eefaa. |
| Matching | `orderMatching.js` + `server/orderMatch.js`: references from structured field, description, notes, document; amount alone never matches; 1 SAR reconciliation tolerance; link lifecycle with history. Scientific-notation identifiers handled (exact recoverable, rounded = unreliable, never matched). |
| Persistence | Everything the reviewer does is **browser-only**: `localStorage ib_enforcement_v1` (links, docs metadata, history), IndexedDB `ib_enforcement_docs` (file bytes keyed by SHA-256). No server write. |
| Documents | Upload PDF/docx/images; PDF text layer + Word text really extracted; scans are **not** OCR'd (reported unread); 8 prepared synthetic scans replayed as **«محاكاة OCR — للعرض التجريبي»**; no engine integrated. **No download button.** No per-field extraction, no field-level confirm/correct, no stored confidence; only link-level confirm/reject and "supply text for unread pages". |
| Import | **None** for enforcement. Only the exclusion-upload template (`xlsx` 0.18.5, per-row rejection reasons, `duplicate_in_file`). No adapter/ingestion abstraction. |
| KPIs | 4 cards, each with its own unit: requests · requests needing action · referred invoices (distinct) · invoices eligible. Requests and invoices are never added. |
| Tests | Strong coverage of matching, OCR simulation, link lifecycle, Sanad structure; **none** for import, Eefaa, Mumtathil, UI components. |

## 2. Source schemas (headers only) and structural sample observations

### Sanad — `Sanad - New Qadaya View_Tab.xlsx`, sheet `Sheet1`, 20 columns (same 20 as the CSV extract already mapped in `docs/sanad-csv-mapping.md`)
`رقم طلب المطالبة بألاداء · رقم طلب التنفيذ · تاريخ المطالبة · الأمانة · البلدية · رقم حالة الرفع للتنفيذ · حالة الرفع للتنفيذ · رقم نوع المنفذ ضدة · نوع المنفذ ضدة · تاريخ الرفع للتنفيذ · تاريخ انشاء الطلب · رقم اسم الموظف منشئ الطلب · اسم الموظف منشئ الطلب · المبلغ · المبلغ كتابة · رقم الانفاذ · رقم الفاتورة · رقم نوع التنفيذ · نوع التنفيذ · الوصف`

Structural notes (15-row sample, Excel file): identifiers arrive as **numeric cells** (7–12 digits); the two date columns arrive as **Excel serial numbers** (integer for the claim date, fractional for date-time) — the importer must convert serials, not parse text; municipality and invoice number can be empty; amount is numeric (integer or decimal); amount-in-words is free text; description is free text. The CSV export of the same view carried identifiers as text and some in scientific notation — both forms must be accepted. **No debtor name/identity column.** Employee name is a personal-data column.

### Eefaa — five report views (different schemas; they are *views*, not one table)
Common to the three Excel reports: the first row is the header, the data block is followed on the same sheet by a small **«معايير البحث» (search-criteria) panel in columns to the right** (two unnamed spacer columns first) — the importer must read only the data block and treat the criteria panel as report metadata. Dates are **Excel serial numbers**; the identity number and the **violation number are numeric cells (10 and 14 digits)**, so they arrive exact in Excel (unlike the CSV exports below).
1. **Executed-against report** — `efaa المنفذ ضده…xlsx`, sheet `efaa المنفذ ضده`, 9 data cols: `الجهة · رقم الهوية · رقم المخالفة · الرقم التسلسلي · قيمة المخالفة · حالة طلب التنفيذ · رقم التنفيذ لدى ديوان المظالم · تاريخ الرفع للتنفيذ · تاريخ التنفيذ`. Shapes (sample): violation no. 14 digits; serial = letter + digits (several lengths/suffix variants); amount integer; **BOG execution no. 9 digits**; referral date fractional serial; execution date = integer serial **or the text placeholder `---`** (not an empty cell).
2. **Referable-to-execution report** — `efaa تقرير المخالفات القابلة للتنفيذ…xlsx`, sheet `المخالغات القابلة للتنفيذ` (spelled so in the file), 9 data cols: `الجهة · رقم الهوية · رقم المخالفة · الرقم التسلسلي · تاريخ المخالفة · مدينة المخالفة · تصنيف المخالفة · قيمة المخالفة · تاريخ استلام رسالة المطالبة بالأداء`.
3. **Incomplete-notices report** — `EFAA غير المكتمل - اشعار المطالبة بالاداء من 01-11-2022م الى 31-12-2022…xlsx`, sheet `إشعارات المطالبة بالأداء`, 7 data cols: `الجهة · رقم المخالفة · الرقم التسلسلي · رقم الهوية · حالة الإكتمال · تاريخ المخالفة · تاريخ استلام رسالة المطالبة بالأداء` (the receipt-date column is empty in the sample; the report is for a stated date range, here Nov–Dec 2022). Same schema family as the `2020 غير مكتمل` workbook.
4. **General violations report** (CSV, 23 cols): `Finenumber · Main Source Info · Violatorid · Efaa Amount · Sadad Amount · Efaa Status · Sadad Status · Datehappened · Timehappened · Cityname · Finebusinessref · Finebookingtypename · Amananame · Insertdate · Mainfinecategoryname · Reference ID · Full Name · Owner Id · Resolutionref · Violatorname · Inspectiontype · حالة التنفيذ · رقم التنفيذ`. Sample: `Finenumber` is in **scientific notation** (damaged); `Finebusinessref`/`Resolutionref` are `digits_digits`; Sadad amount/status, reference/owner/inspection and the two execution columns are empty in the sample.
5. **v2 report, status as in Tahseel** (CSV, 14 cols): `معرف نوع المخالفة · رقم الهوية · اسم المدينة · رقم السداد · اسم الأمانة · رقم الغرامة · اسم المخالف · وصف الغرامة · مبلغ الغرامة · عدد او فترة · تاريح الانشاء · تاريخ الدفع · تاريخ الالغاء · حالة الفاتورة`. Sample: `رقم الغرامة` in scientific notation; `رقم السداد` 9–10 digits; the only Eefaa view with a **Sadad number** and a payment status.

Reading across the five views (sample-based, **TBC**): `رقم المخالفة` (Excel, 14 digits) , `Finenumber` and `رقم الغرامة` (CSV, damaged to scientific notation) look like the **same 14-digit violation number**; it is the only candidate that appears in four of the five views. Only the *executed-against* view carries the BOG execution number; only the *v2* view carries the Sadad number; the *referable* and *incomplete* views carry neither. Personal data (identity number, violator name/id) → masked by default, role-restricted.

### Mumtathil — two files with the same 18 columns (`تقرير ممتثل` CSV and `تقرير منصة ممتثل .xlsx`, sheet `Sheet2`)
`معرف الحالة · رقم سداد · حالة الفاتورة · اسم أمانة · اسم البلدية · مبلغ سداد · رقم غرامة · هوية المخالف · بند اللائحة · اسم اللائحة · معرف الاستئناف · حالة الاستئناف · حالة الاستئناف AR · تاريخ رفع الاستئناف · تاريخ حل الاستئناف · تاريخ التحميل · اللائحة الرئيسية · اسم اللائحة الرئيسية`
Sample observations (15 rows each, **not** a validation):
* `معرف الحالة` = letters-dash-digits string (the Mumtathil case id). `رقم سداد` 11 digits. `حالة الفاتورة` = English phrase vocabulary (differs from Eefaa's Arabic one).
* **`رقم غرامة` (fine number): in the Excel file it is a numeric 14-digit cell (or empty); in the CSV it arrived in scientific notation.** So in an Excel export it has the same shape as Eefaa's 14-digit `رقم المخالفة` — the best *candidate* join (Mumtathil fine number = Eefaa violation number) — but the relationship is **not verified** (samples of different files cannot show overlap, and the field is empty for some rows).
* `بند اللائحة` and `اللائحة الرئيسية` arrive as 5-digit integers in some Excel rows and as `9/9/9/9`-style text elsewhere → Excel may have **coerced regulation-clause numbers into dates**; treat both as text, never interpret as dates (**TBC**).
* Appeal columns (`معرف الاستئناف`, status EN/AR, raised/resolved dates) are empty when there is no appeal. `تاريخ التحميل` = load date (Excel serial in the Excel file).
* `هوية المخالف` = identity number (personal data → masked, role-restricted).

### Business context (MOM, not data)
Sanad = non-violation invoices (Furas, tobacco, white-land…); violations go Mumtathil → Eefaa → Administrative Execution; Sanad and Eefaa share the **BOG execution request number**. Whether Mumtathil is a pass-through or holds an independent record is **open** (MOM §11.4).

## 3. Findings that shape the design
1. **The Eefaa↔Mumtathil relationship cannot be verified from these samples.** In the CSV exports the "fine number" columns are in scientific notation (damaged); in the Excel exports they are intact 14-digit numbers on **both** sides (Eefaa `رقم المخالفة`, Mumtathil `رقم غرامة`), which makes *violation number = fine number* the leading **candidate** rule. Other candidates: the Sadad number (Eefaa v2 and Mumtathil `رقم سداد`). Whether the two numbers denote the same thing, are unique per record, and are populated for every Mumtathil row is **not established** (the Mumtathil sample has rows with an empty fine number) — **no rule is verified**. → The matching rule is a **configurable rule set with `verified:false` by default**; real imports will show «مطابقة مقترحة — القاعدة غير معتمدة» rather than "confirmed" until the data owner approves a rule.
2. **Eefaa is five different report views with no single canonical one.** The 14-digit violation number (`رقم المخالفة`) is the strongest *candidate* key (present, exact, in the three Excel views; damaged in the two CSV views), but uniqueness and equivalence across views are **TBC**. The importer takes the key from a declared per-view mapping; a record built from several views is merged only on that key. Each view fills different fields (execution no. only in *executed-against*, Sadad no. only in *v2*).
3. **Sanad↔Eefaa overlap** can only come via the execution request number (Sanad `رقم الانفاذ` meaning is unconfirmed; Eefaa `رقم التنفيذ` is empty in the sample). Overlap is therefore **undeterminable** → every combined view says so and never merges totals.
4. Sanad's structured invoice number is sparse (per the earlier mapping doc) and Eefaa has **no** invoice-number column; Eefaa's link to an invoice is through the **Sadad number**, which exists only in the v2 report.
5. No data exists in the repo/server for Eefaa or Mumtathil; persistence is browser-only; there is no import code.

## 4. Design

### 4.1 Source vs ingestion (the model)
```
RecordSource   : 'sanad' | 'eefaa' | 'mumtathil'                      // business source
Ingestion      : { method: 'excel' | 'data_bank' | 'direct', status: 'available' | 'planned',
                   batchId, fileName, fileSha256, importedAt, mappingId, mappingVersion }
SourceRecord   : { source, sourceKey, kind, raw:{…original cells…}, normalised:{…}, sourceStatus (verbatim),
                   ingestion, firstImportedAt, lastSeenBatchId, revisions[], flags[] }
```
`Sanad / Excel` and `Sanad / Data Bank` share `source:'sanad'`; only `ingestion.method` differs. Only **Excel** is `available`; Data Bank and direct are shown as **planned** (labelled, disabled).

### 4.2 Pipeline (one pure module, no UI dependency, reusable by a future server/Data Bank reader)
`read workbook → pick sheet → detect schema by header names (never position) → mapping (versioned, per source/report) → normalise (Excel serial dates, numeric ids → exact digit strings, scientific-notation analysis via existing `analyzeNotation`) → validate → classify rows (accepted / unchanged / revised / rejected) → commit batch`.
* **Validation / rejected rows**: missing key, duplicate key in file, unreadable date serial, non-numeric amount, unreliable (rounded) identifier flagged but row kept, unknown status kept verbatim + flagged, header mismatch (missing/extra columns reported, never guessed). Downloadable rejected-rows report.
* **Idempotency / duplicates**: identity = `(source, sourceKey)`; same content hash → *unchanged*; changed content → new revision with the previous raw kept; a later Data Bank record with the same key updates the same record, never adds a second. Re-importing the same file is a no-op report.
* **Provenance** kept per record: original identifiers, raw values, source status verbatim, import timestamp, batch, mapping id/version.
* **Keys (provisional)**: Sanad `رقم طلب التنفيذ`; Eefaa = the 14-digit violation number declared in each view's mapping (`رقم المخالفة` / `Finenumber` / `رقم الغرامة`; rows whose number arrives in scientific notation are flagged unreliable and **not** keyed — **TBC** uniqueness); Mumtathil `معرف الحالة` (case id).
* **Storage**: IndexedDB in the browser (same model as the existing document store) so confidential files and records never touch the repo, server or deployment; localStorage cannot hold the volume. Records are partitioned per source; the existing `ib_enforcement_v1` reviewer store is kept and linked by key, so confirmed links and history survive re-imports.

### 4.3 Sanad documents and extraction
* Every Sanad record: document slot. **No document → flag «مستند سند غير متوفر»** (record stays visible; filter + KPI).
* Attach (existing hash-keyed store), **view** (existing preview), **download** (new).
* Extraction stays honest: text layer / Word text = real; scans = unread; OCR = **simulation, labelled** (existing label), or imported text. No claim of real OCR.
* New **extracted-field model**: `{field, value, origin (document|sanad_structured|reviewer), method, page/location, confidence?, status: extracted|uncertain|confirmed|corrected|rejected, original (immutable), reviewHistory[]}`. Fields extractable today from the existing reference extractor: invoice/Sadad/violation/order/contract numbers and the stated amount; debtor name/ID/dates are **not** extractable today (no engine) and are not shown as extracted.
* Flags: missing document · failed/unread extraction · uncertain value · **conflict** document vs structured data (reference set, amount beyond the 1 SAR tolerance, execution/order number of another request) — reusing the existing conflict machinery, extended to amount. Reviewer confirms/corrects; original extraction and every review step retained.

### 4.4 Mumtathil enrichment of Eefaa
Relation record `{eefaaKey, mumtathilKey, rule, ruleVerified, status}`; `status ∈ confirmed | candidate (rule unverified) | ambiguous | unmatched | conflicting`.
* A rule is an **exact identifier equality** (normalised, never scientific-notation/rounded, never empty) between named fields, applied only when each side resolves to exactly one record. **Never** amount, date or text similarity.
* *confirmed* = verified rule + 1:1; *ambiguous* = several candidates on either side; *conflicting* = matched but compared fields differ (Sadad no., amount, Amanah, invoice status — each shown side by side with attribution); *unmatched* / missing Mumtathil = Eefaa record stays fully usable.
* Both systems' identifiers shown; Mumtathil data labelled «من ممتثل» inside the Eefaa details (regulation, appeal id/status/dates, invoice status). **Mumtathil rows are never counted as violations** — totals count Eefaa violations only.

### 4.5 Page, filters, columns
* Title/description generalised: «إدارة التنفيذ — سند وإيفاء». Tabs **الكل | سند | إيفاء** (+ existing eligible / referred-invoices / contracts tabs kept).
* **Common columns**: source chip + source id · source status (verbatim, own vocabulary) · Amanah / municipality (where present) · amount **with its definition** (Sanad: claim amount of the request; Eefaa: fine amount) · linked invoices (+evidence/ confidence) · ingestion method + last import time.
* **Sanad-only**: claim no., document availability + extraction review status, financial gap. **Eefaa-only**: Mumtathil match status, Sadad number, execution no. (when present).
* **Filters offered only where the data supports them**: source, Amanah/municipality (all three sources have Amanah), source status (per source), amount range, date range, linked-invoice state, Sanad document state, extraction review state, Mumtathil match state, ingestion method, import batch. Search: Sanad request/claim/enforcement no., Eefaa violation key / Sadad no., linked invoice number.
* **«الكل» shows two separate groups of counts**, never a merged receivable; a standing disclosure: «تداخل سند وإيفاء غير محدد — يعتمد على رقم التنفيذ ولم يُعتمد».

### 4.6 KPIs (unit and formula stated on each card)
* Sanad requests = count of Sanad records in scope. Eefaa violations = count of Eefaa records in scope (Mumtathil excluded). Distinct linked invoices = `|union of confirmed linked invoice ids|` across both sources (dedup by invoice id). Needing action = records with an open review item (unit: records of that source).
* Amounts: shown **per source, with their definition**; no total across Sanad amount + Eefaa amount + invoice balance. Closure ≠ payment. Active enforcement vs historical referral stay separate (existing rule). A contract is never inferred as referred because one of its invoices was.

### 4.7 Invoice linking
Unchanged principle: importing ≠ linking. Existing resolver/lifecycle reused; Eefaa records link via **Sadad number** (exact, `biller-sadad` as for invoices) with evidence; confirmed links and history keyed by `(source, sourceKey)` survive re-import.

## 5. Phases
| # | Deliverable | Notes |
|---|---|---|
| P0 | Branch `feat/enforcement-sources` from `main`; baseline `npm test` | |
| P1 | `src/data/ingestion/` : model, mapping registry (Sanad-Excel, Sanad-CSV, Eefaa executed-against / referable / incomplete-notices / general / v2, Mumtathil), including the search-criteria panel skip and the `---` placeholder, normaliser (serials, numeric ids, sci-notation), validator, batch classifier, IndexedDB record store | pure functions + unit tests; **synthetic fixtures only** |
| P2 | Synthetic data: generator for Sanad/Eefaa/Mumtathil records in the real schemas **and downloadable synthetic Excel templates** for each source (so imports can be tried without confidential files) | all values fictional |
| P3 | Import UI (reuse upload patterns): choose source + method, preview, validation summary, rejected-rows report, repeat-import result; planned methods shown disabled | |
| P4 | Eefaa + Mumtathil: relation engine, rule config, details sections, attribution | |
| P5 | Sanad documents: missing flag, download, extracted-field model, review/correct flow with history, conflict flags, simulation labelling | |
| P6 | Page: tabs, columns, filters, search, KPIs, disclosures, details for each source | shared components, RTL |
| P7 | Verification (see §6), docs, handover | |

## 6. Verification to run
Excel validation (bad header, missing key, duplicate in file, bad serial, sci-notation id, unknown status) · repeat import of the same synthetic file (no duplicates) · changed row → revision · same key via a second ingestion method (single record) · Sanad record without document → flag + still listed · failed/unread extraction · document-vs-structured conflict · reviewer confirm/correct keeps original + history · Mumtathil: confirmed, candidate (unverified rule), ambiguous, unmatched, conflicting, Eefaa record intact when absent, Mumtathil never adds to totals · invoice links by Sadad number · source filters/search · KPI sums vs visible rows (units never mixed) · existing 124+ enforcement tests unchanged · `npm run build` · browser pass in RTL, no console errors.

## 7. Decisions / information needed
1. **Eefaa views and key**: confirm that `رقم المخالفة` = `Finenumber` = `رقم الغرامة` is one violation number and unique; which of the five views are delivered regularly; and which Eefaa records belong on this page (all violations, or only those referable / referred to execution).
2. **Mumtathil matching rule**: which identifier pair the data owner confirms (and whether Mumtathil is a pass-through or holds its own record, MOM §11.4). Until then relations stay *candidate*.
3. **Meaning of Sanad `رقم الانفاذ`** and Eefaa `رقم التنفيذ` — needed to disclose/compute Sanad↔Eefaa overlap.
4. **Exports that keep identifiers exact**: prefer the Excel exports (or text-typed CSV) — the CSV "fine number" columns arrive in scientific notation; and clarify whether Mumtathil `بند اللائحة` / `اللائحة الرئيسية` are clause codes (Excel appears to convert some to dates).
5. **Storage choice**: browser IndexedDB (recommended: keeps confidential data off the repo/server/deployment) vs a server store.
6. Official status classes for Sanad/Eefaa statuses (today only «مغلق…» is treated as closed; Eefaa statuses differ in vocabulary from Sanad's and Mumtathil's).
7. Real OCR engine decision (none approved); the demo keeps the labelled simulation.


## 8. Addendum (2026-11-05) — core purpose: invoice references → confirmed links → enforcement exclusion
**Business requirement.** The main purpose of Sanad document extraction is to find the invoice number(s) an enforcement order refers to, match them to system invoices and let a reviewer confirm the links. Once **confirmed**, those invoices are excluded from the collectible base. This applies to **confirmed Sanad enforcement links only** — it is not extended to Eefaa violations (an Eefaa → invoice link, which a reviewer may also confirm, never reaches the exclusion engine).

**What already existed (verified in the code, not rebuilt).** One matching pipeline (`orderMatching.js` + `server/orderMatch.js`: reference extraction, exact / serial / Sadad / violation / contract resolution, discrepancy rules, amount never matches alone), one link lifecycle (proposed → confirmed / rejected → withdrawn, history), and one exclusion engine (`server/engine.js derive`): rule **SND-1** excludes an uncollected invoice whose order link is confirmed / open / suspended / closed; a proposed link is code `1` and changes nothing; a withdrawn link (`5`) removes the reason. The invoice stays in gross invoiced; the exclusion is the **uncollected remainder** (`billed − received`, decision D10), counted once per invoice whatever the number of reasons or orders (`exclTotal = billed − net`). Source cancellation, payment records and source statuses are never modified.

**Amount basis (explicit).** *Uncollected remainder = billed (gross + approved adjustments) − received to the cut-off.* A fully collected invoice is never excluded (counted as an ignored exclusion); a partly paid invoice keeps what was collected and only the remainder is excluded. It is neither the full invoice value nor "outstanding" re-derived separately. The exclusion record now states `amountBasis: uncollected_remainder`.

**Workflow**
1. *Extract* — a synthetic Sanad document (labelled «محاكاة OCR — بيانات تجريبية») is read through the provider interface; its transcript goes through the existing reference extractor, giving every invoice number with its page and snippet; several invoices per order are supported.
2. *Match & review* — each reference is matched against the demo ledger; the review table shows invoice number, entity, amount, status, evidence and discrepancy, and flags incomplete numbers, unmatched, ambiguous and conflicting references. Nothing is excluded at this stage.
3. *Confirm* — the reviewer selects the correct invoices and presses «تأكيد ربط الفواتير المحددة بأمر التنفيذ»; reviewer, time and the supporting document are saved with each link; unresolved references remain pending (partial confirmation).
4. *Exclude* — the data service receives the confirmed link status and applies SND-1 with reason **«مرتبطة بأمر تنفيذ مؤكد»** (the rule's former wording «منفذ ضده – قضايا (سند)» is kept in its description). The invoice stays visible in invoice lists and enforcement details with an exclusion badge and a link to the order; the exclusion record keeps order, order status, reviewer, time, supporting document and the amount basis. Every other reason the invoice meets is kept side by side (SND-1 no longer disappears behind a higher-priority reason) and the excluded value is counted once.
5. *Totals* — dashboards, reports, invoice details and exports read the same engine: Net invoiced = Gross invoiced − Exclusions; enforcement is neither payment nor cancellation.
6. *Corrections* — withdrawing a link reassesses the reason (the invoice stays excluded if another valid reason remains); closing an order does not remove the exclusion (the closure reason is shown); a source-cancelled invoice with a confirmed order is flagged **«تعارض بين المصدر والتنفيذ — يحتاج مراجعة»** — a flag only: no amount, payment record or source status changes (S9 treatment kept).

**Changes made for this addendum** (engine/labels; the document/matching UX is in the Sanad document workflow): the conflict flag now fires for any source-cancelled invoice with a confirmed order (previously dead behind the S9 constant); the SND-1 reason label and rule text; the exclusion record carries the reviewer's evidence (`linkInfo` sent with each data-service request); the invoice list and the excluded-values table show the badge, the excluded value, all reasons and the order link; tests in `tests/enforcement-exclusion.test.mjs`.
**Open** — the data owner has not confirmed (a) whether a "Transfer to BOG" cancellation reason exists in the real source (the demo ledger has no cancellation reason code, so every cancelled + referred invoice is flagged); (b) whether the exclusion should keep the S9 "stays billed" treatment for cancelled invoices (kept as is).


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
