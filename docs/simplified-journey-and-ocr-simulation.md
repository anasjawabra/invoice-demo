# Simplified demo journey, OCR simulation and corrected matching rules (branch `enforcement-order-matching`)

Synthetic-data demonstration; not production-ready. Builds on `docs/all-sources-and-cancelled-invoices.md` (parts of which this document **supersedes**: the «source conflict» hard conflict and the automatic ENF-1 retention are gone, see §1 and §3). Tag `demo-baseline-final` is unchanged; nothing is pushed or merged. **The OCR here is a labelled SIMULATION for prepared samples. Actual OCR and live Sanad retrieval are NOT connected.**

## 1. Matching corrections

* **Same serial, different year is not a conflict.** `INV-2025-0000087` and `INV-2026-0000087` are two legitimate invoices; the order may cover both. Complete identifiers are matched **independently**, values and leading zeros preserved. (The earlier cross-source «source conflict» rule and its auto-resolution by debtor were removed.)
* **An incomplete serial** that matches several invoices is **ambiguous** and cannot be selected. The order's debtor owning one candidate is shown as *supporting only* («الدافع = مدين الأمر (قرينة داعمة فقط)») and never selects it. It is settled only by another reference of the same order that identifies exactly one candidate (a full number on another page, or typed in the row: «إضافة كدليل»).
* **A genuine conflict** is a reference to an invoice of **another payer** (also another Amanah, issued after the order, a document naming another order). It stays unselectable until evidence (e.g. a document naming that payer's identity number) resolves it; a typed reason is refused.
* **All sources** are always combined: structured field, description, notes, PDF, Word (paragraphs and tables), typed references. Repeats merge into one row keeping every origin; each invoice is linked and counted **once**.
* **Nothing found:** «لم يتم تحديد أرقام الفواتير — تحتاج مراجعة» (never «no related invoices»).

## 2. Contract referral evidence

Three facts: **mentioned** · **directly referred** · **contract with some invoices referred**. A document that merely names an existing contract is **not** enough. A reviewer can confirm a direct referral only by pointing at a **document location** (paragraph/table or page), ticking that the document **explicitly states the contract itself is referred**, and recording the statement; the evidence (document, location, statement, who, when) is stored. A description-only mention cannot be confirmed; a non-existent contract cannot be confirmed. A direct referral never makes the contract's invoices referred; invoices of any type, with or without contracts, are unaffected.

## 3. Cancelled invoices vs enforcement — what «ENF-1 treatment» means

* **Rule (documented).** `ENF-1` is in the rule registry (`ruleRegistry.js`, `revenueMetrics.js`; also the Arabic handover document): *locked, approved, effective 2026-07-01, owner «Revenue data steward»*; recorded wording «meeting correction»: invoices referred to enforcement — often shown «cancelled» in the source — are counted **uncollected**, not excluded.
* **Calculation effect.** Where applied to a source-cancelled invoice, the cancellation is **not deducted**: the invoice stays in net billed and its remaining balance (billed − received) is in net uncollected; it is not a rule exclusion. Where not applied, the cancelled amount (billed − received) leaves net billed once.
* **Documented vs assumed.** Documented: the rule's wording above (the meeting minutes themselves are not in the repository, so the exact conditions cannot be verified). **Assumptions in the earlier implementation:** which links count as «enforcement» (including links found in documents), whether any order status qualifies (open/suspended/closed/withdrawn), and automatic application.
* **What the demo does now (no new financial policy).** Enforcement — active, historical, closed or withdrawn — **never by itself** overrides the source cancellation, reinstates collectibility or changes a total: the invoice stays **cancelled** and is flagged **«source/enforcement conflict — review required»**. The documented rule is applied **only to an invoice for which a reviewer records that decision** (apply ENF-1 / keep the source cancellation / clear), kept in a history and in backups. Business confirmation is pending; **EQ3 stays unresolved**. Engine: `D.enfConflict` (flag) vs `D.enf1Applied` (reviewer decision); request field `enf1`.
* Five separate facts on the invoice page: source cancellation · effective treatment (exclusion/review) · remaining collectible balance · payment status · active enforcement and historical referral.
* **Visible change from the previous round:** an invoice with a confirmed referral and a source cancellation is no longer automatically counted uncollected; the landing count «source/enforcement conflicts» now lists invoices awaiting that decision.

## 4. The three-step journey (order page)

Top of the page: order number · status · **order amount · debtor** · linked invoices (with «عرض الفاتورة») · the three steps. Everything else — sources and extraction evidence, the three completeness states, contract references, Sanad information, history — is under expandable sections.

1. **إضافة المستند** — upload a PDF/Word file, **or** choose a prepared sample for this order (labelled «محاكاة OCR — للعرض التجريبي»), **or** type invoice numbers by hand.
2. **تحليل المستند** — one primary action **«تحليل وربط الفواتير»**: reads every added document by what it really is, combines the references from fields, description, notes and documents, matches each one. Page-by-page progress is shown for a simulation. Concise summary lines: «تم العثور على 3 فواتير — مرجع واحد يحتاج مراجعة» · «صفحة واحدة لم تُقرأ» · «يوجد فرق في المبلغ».
3. **مراجعة وتأكيد الربط** — **one consolidated table** (extracted reference · matched invoice · invoice amount · match result · selection). Exact matches are preselected; ambiguous, conflicting, weak and unmatched ones are not. Selected total, already-linked total, order amount and difference with the **amount basis** (invoice gross, before exclusions and payments, each invoice once). One action **«تأكيد ربط الفواتير المحددة»**; the success box lists the linked invoices with «عرض الفاتورة» and says that confirming **creates links only** (no legal approval, no payment, no change of confirmed financial treatment).

The banner was replaced by the marker **«بيانات تجريبية · محاكاة OCR»** with the limits under **«تفاصيل التكامل»**; warnings stay beside the affected result (unreadable file, unread page, conflict, difference).

## 5. OCR simulation (prepared samples) — and what stays real

* **Prepared samples** (`public/samples/prepared/`, `npm run make:samples:prepared`): eight **scanned-style, image-only PDFs** (no text layer) each tied to one demo order, with `index.json` holding the **transcript of what was rendered on each page** (the generator's own source text) and the file's SHA-256. The simulation replays that transcript through the same reference extraction as real text — **deterministic, tied to the sample's content, never random, never from a file name** (a test renames the file and gets the same result). A file is treated as a prepared sample only if the reviewer picked it from the list or its SHA-256 equals the catalogue's.
* **Arbitrary uploaded files:** digital PDF → real text extraction; Word `.docx` → real extraction of paragraphs and tables (evidence names the **table/row or paragraph**, never an approximate page); scans, images, legacy `.doc`, unknown → **kept, flagged «not read»** with the reason, **nothing attributed to them**; options offered: a prepared sample (recorded as a **separate** document), typed numbers, or external OCR text. Legacy `.doc` parsing is **not available**.
* **Methods stay distinct in the stored records, the history, the evidence lists, the invoice review CSV and the backup:** `text_layer` (digital extraction) · `docx_text` · `ocr_simulated` (+ sample id, label) · `ocr_system` (reserved, not connected) · `ocr_import` · `manual_entry`.

| Scenario | Order | What it shows |
|---|---|---|
| One invoice | EN-6000 | single reference only in the scanned attachment → exact match |
| Several invoices across pages | EN-5039 | 3 pages: invoices on pages 1–2, page 3 a stamp with no text → «صفحة واحدة لم تُقرأ» |
| Field + description + attachment | EN-6028 | one structured, one in the description, the attachment repeats the first → merged, no duplicates |
| Same serial, two years | EN-6014 | two legitimate invoices matched independently |
| Incomplete / ambiguous | EN-5065 | serial `0000111` matches two invoices; payer match is supporting only; typed full number settles it |
| Genuine conflict | EN-6021 | an invoice of another payer: unselectable, needs evidence |
| Amount discrepancy | EN-5078 | linked invoices ≠ order amount: difference shown, linking not blocked |
| Arabic scanned document | EN-5143 | Latin invoice numbers in Arabic text; contract/account numbers set apart |

Real-extraction samples (digital PDF/Word, unreadable scan and `.doc`): `public/samples/enforcement-orders/` (`npm run make:samples`, `make:samples:docx`, `make:samples:ar`). Order numbers are those of the compact demo world at 2026-10-09.

## 6. Documents and backup

Source documents and extraction evidence are preserved. **Backups do not contain the document files** (stated on the order, the landing and in the backup panel); they keep the extracted evidence, provenance, typed references, reviewer decisions and link history. After a restore the file is shown **unavailable — only the extracted evidence remains**; re-upload checks the SHA-256, and a prepared sample can be restored from the catalogue (same check).

## 7. Verification

`npm test` **121 passed** (automated); `npm run build` ok; `npm run verify:exports` 100 % (docx/pptx/xlsx tables and amounts reconcile). Browser checks on the isolated origin `http://127.0.0.1:3000/?demoToday=2026-10-09`; start state noted: the origin held leftovers of the previous round's tests (cleared first); end state restored: localStorage empty, `ib_enforcement_docs` deleted, `ib_listmem_*`/`ib_scroll_*` cleared. The user's `localhost:3000` profile was not used (the dev-server tool opens one tab there; it was navigated away at once).

| Requirement | Automated test | Browser check |
|---|---|---|
| Two valid invoices, same serial, different years | ✓ | ✓ EN-6014: both matched, both selectable; confirmed → «المبلغ متطابق» |
| Incomplete serial, several candidates; debtor not sufficient | ✓ | ✓ EN-5065: ambiguous, nothing selectable; typed full number settles it |
| Genuine conflict needs evidence; typed reason refused | ✓ | ✓ EN-6021: unselectable with the hint |
| References across fields, description, attachments | ✓ | ✓ EN-6028 (3 sources merged) |
| Several invoices on one order; repeats not duplicated | ✓ | ✓ EN-6028, EN-6014 |
| Matching with an unresolved amount discrepancy | ✓ | — (EN-5078 in the tests; the discrepancy display was checked on EN-6014 before the second link) |
| Contract mention without evidence; explicit-evidence confirmation | ✓ | ✓ EN-6063 (mention only, confirm disabled until explicit statement + quote); EN-6119 (confirmed, evidence stored) |
| Cancelled invoices with active and closed orders | ✓ (all statuses + withdrawal + identities) | ✓ EN-6126: flagged, amounts unchanged; reviewer decision applies ENF-1 |
| Three-step simulated OCR happy path | ✓ | ✓ EN-6000 (add sample → analyse → confirm → success + «عرض الفاتورة») |
| Ambiguous and unreadable paths | ✓ | ✓ EN-5065; EN-6035 (scan + legacy `.doc` flagged, nothing attributed) |
| Real Word extraction with locations | ✓ | ✓ EN-6063 (جدول 1 · صف 2) |
| Status reflection on confirmed links only | ✓ | ✓ landing counts and order/invoice pages |
| Totals and exports reconcile | ✓ (identities with/without referrals and after ENF-1 decisions) | ✓ `verify:exports` |
| Backup / missing file | ✓ (backup content) | ✓ file deleted → unavailable + identity-checked restore |
| Desktop, mobile, keyboard | — | ✓ 760 px and 375 px (no horizontal page overflow); Space toggles a selection, Tab/Enter reach and run «تأكيد…» with a visible focus outline |

Screenshots (`docs/screenshots/`): `r12-1-order-page-summary-and-steps.jpg`, `r12-2-review-table-mixed-sources.jpg`, `r12-3-mobile-steps-1-2.jpg`, `r12-4-mobile-review-confirm.jpg`, `r12-5-genuine-conflict-needs-evidence.jpg`, `r12-6-invoice-conflict-enf1-explained.jpg`.

## 8. Short demo script (Arabic UI, `?demoToday=2026-10-09`)

1. **إدارة التنفيذ** → read the counts; open «عينات العرض المعدّة».
2. **EN-6000** — happy path: choose the sample → «تحليل وربط الفواتير» (page-by-page «محاكاة OCR — للعرض التجريبي») → review → «تأكيد ربط الفواتير المحددة» → «عرض الفاتورة».
3. **EN-6028** — three sources merged; **EN-6014** — same serial in two years; **EN-5065** — ambiguous, add the full number; **EN-6021** — conflict needs evidence; **EN-5039** — one page not read.
4. **EN-6063**: upload `EN-6063-attachment.docx` (real Word extraction, table locations); contract: mention ≠ referral. **EN-6119**: confirm with the explicit statement.
5. **EN-6035**: upload the scan and the `.doc` — flagged, nothing attributed.
6. **Full-page invoice** (from EN-6126): the conflict, the five separate facts, «ما هي معالجة ENF-1؟», the reviewer decision.

## 9. Remaining dependencies (not delivered)

Live Sanad retrieval and Sanad attachment retrieval · **actual OCR** (engine selection, Arabic scans with Latin numbers, accuracy on real documents) · legacy `.doc` support · Word embedded images · business decisions: **EQ3** (treatment of cancelled-in-source invoices referred to enforcement), Sanad's official statuses and closure reasons, who may confirm a contract referral. Unchanged: F-05, F-19, F-23, F-27, D-13, G-01 statuses; screen-reader verification open; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved. No production-readiness or accessibility-conformance claim.
