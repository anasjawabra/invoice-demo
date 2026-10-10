# Every source of invoice references, cancelled invoices vs enforcement, contract mentions (branch `enforcement-order-matching`)

> **Superseded in part by `docs/simplified-journey-and-ocr-simulation.md`:** the cross-source «source conflict» hard conflict (§1) and the automatic retention of the ENF-1 treatment (§2) were removed — same serial in different years is not a conflict, and enforcement alone no longer changes any amount (a reviewer's recorded decision applies ENF-1). The sample order numbers below changed with the demo world; the new document lists the current ones.

Synthetic-data demonstration; not production-ready. Builds on `docs/enforcement-management.md` and `docs/full-page-records.md`. Tag `demo-baseline-final` is unchanged; nothing is pushed or merged. Live Sanad retrieval and actual OCR are **still not connected** — nothing below is a simulated retrieval or a simulated extraction.

## 1. Collecting ALL invoice references of an order

People enter references in different places: one in the structured field and the rest in the description; only in the description or notes; only in an attachment. The order page now reads **every** source and never stops at the first match.

| Source | How it is read | Where it shows |
|---|---|---|
| Sanad structured invoice-reference field | as supplied | origin «Sanad structured field» |
| Sanad description / notes (free text) | lenient extraction: `inv-2024-0000022`, `INV 2024 0000087`, `INV – 2025 / 0000072`, short serials → canonical `INV-YYYY-NNNNNNN`; **the text as typed is kept** («as written») | origin «Sanad description / notes (free text)» |
| Digital PDF attachment | text layer (pdf.js), every page, table rows | origin «Order PDF (text layer)» + page + snippet |
| **Word `.docx` attachment (new)** | paragraphs **and table rows** (`[table N, row R] a | b | c`), headers/footers; pages = explicit page breaks, else Word's saved ones (approximate, labelled) | origin «Word document (text and tables, read by this system)» |
| Scanned PDF page / image (JPEG, PNG, TIFF) | **not read** — an image needs OCR, which this system does not perform | page flagged *NOT read — no text layer / needs OCR* |
| Legacy `.doc` (binary) / unknown format | **not read** — «convert to .docx or PDF»; the file is kept | flagged *NOT read — unsupported format* |

Format is detected from the file's bytes (not its extension). A flagged file is stored with the order, listed in the sources table and counted as an unread page; **it is never treated as read**. External-OCR text or typed references can be supplied for unread pages and are recorded with that origin.

**One reference, every occurrence.** The same invoice typed in the structured field, the description, the notes and two documents is one reference with all occurrences kept (field, document, page, snippet, raw text) and one link: its amount is counted once. **Each reference is matched independently**; matching never uses the amount.

**Sources examined (order page).** A table lists the structured field, description, notes, the attachments Sanad lists (retrieval not connected) and each added document (format, pages read/unread, tables, references found). If nothing was found anywhere the order shows **«Invoice references not identified — review required»** — never «no related invoices» — and the landing exception carries the same wording.

**Three completeness states stay separate** (reference matching · document extraction · financial reconciliation). «Complete» in the first means every reference *found* is decided; it does **not** prove every invoice the order covers was found. Amount equality alone is not completeness. One confirmed invoice never proves the others are identified.

**Conflicting references across sources** (the same serial with different years, e.g. `INV-2025-0000303` in the structured field and `INV-2026-0000303` in the description): a **hard conflict** on every member. It is resolved **only by data evidence** — exactly one candidate belongs to the order's debtor — otherwise it stays unresolved; a written reason never overrides it (`confirmLink` refuses). Shown on the order page with the other reference named.

## 2. Cancelled invoices vs enforcement — five separate facts

On the invoice page («Cancellation, exclusion, balance and enforcement — kept separate») and in the data: **source cancellation** · **effective exclusion/review decision** · **remaining collectible balance** · **payment status** · **active enforcement and historical referral**.

* A cancelled-in-source invoice **with a confirmed order** (open, suspended or closed) or a confirmed link **later withdrawn** (overlay code 5) keeps the **documented treatment ENF-1** (stays uncollected). It is flagged **«source/enforcement conflict — review required»**, with the wording that the treatment is **pending the open decision EQ3** and is not a finding that the invoice is collectible.
* An order **never** adds or removes an amount by itself: open → suspended → closed → withdrawn leaves gross, net and remaining identical (unit-tested). A **proposal** has no effect (the invoice stays cancelled). Closing/withdrawing never implies payment and never erases the historical referral.
* Visible in: invoice finding + «kept separate» table; Invoices list tag and filter *Enforcement → Source/enforcement conflict*; landing count **«Source/enforcement conflicts»**; order page («linked invoices» tag). Engine: `stock.enforcement.sourceConflict`, list filter `exec:'conflict'`, `D.sourceCancelled` / `D.enfConflict`.
* **Not decided here (business):** whether such an invoice should finally count as collectible, excluded or cancelled (EQ3). The approved identities (gross = exclusions + net; net = collected + uncollected) hold with and without these referrals (tested).

## 3. Contracts — three facts, never merged

| Fact | Established by | Shown |
|---|---|---|
| **Mentioned in an order** | a contract number in the description or a document | order page «Contract references» (status *mentioned only*); contract page block 1; landing «Mentioned in an order (unreviewed)»; exception «Contract mentioned, not reviewed» |
| **Directly referred** | Sanad's structured contract field, **or** a mention a reviewer confirmed **from a document** (a description alone cannot be confirmed; the contract must exist in the data) | order page; contract page block 2; landing «Directly referred» |
| **Contract with some invoices referred** | the contract's own invoices carrying a confirmed order | contract page block 3 («x of y»); landing «With referred invoices» |

A mention is never a direct referral on its own; a directly referred contract never implies all its invoices are referred (tested: `invoices` stays empty). Invoices without a contract stay supported on their own. Reviews are recorded with who/when/evidence/note in the order history (and in backups).

## 4. Verification

`npm test` **114 passed** (104 + 10 new, listed below) · `npm run build` ok · `npm run verify:exports` 100 %. Browser checks on the isolated origin `http://127.0.0.1:3000/?demoToday=2026-10-09`; **start state:** localStorage empty, IndexedDB empty, no list/scroll memory; **end state restored:** localStorage empty, `ib_enforcement_docs` deleted, `ib_listmem_*`/`ib_scroll_*` cleared. The user's `localhost:3000` profile was not used (the dev-server tool opened one tab at `localhost:3000`; it was navigated away immediately and no storage was written there).

| Brief item | Result |
|---|---|
| structured field one invoice + description several | **EN-6000**: 1 structured + 2 in the description (lowercase / spaces / dash variants) → 3 references, raw text kept, each matched on its own (test + unit) |
| description only | **EN-6007**: 3 references from description + notes (none structured), listed with «as written», *references incomplete* — not «none» (browser + test) |
| multi-page PDF only | **EN-6014** (`EN-6014-attachment.pdf`): 2 pages, 3 invoices (the repeat on page 2 = one reference with 2 pages), confirmed all → 3 confirmed, difference 0 (browser + test) |
| DOC/DOCX tables only | **EN-6021** (`.docx`): 2 tables over a page break, 3 invoices only in the tables; contract named in the text = *mentioned only* (browser + test) |
| repeated across fields/documents | structured + description + notes + PDF → one row, 4 origins, one link, amount once (test) |
| conflicting across sources | **EN-6028**: 2025 vs 2026 serial → both flagged, resolved only for the order debtor's invoice (browser + test); **EN-6035**: nothing tells them apart → stays unresolved; a typed reason is refused (test) |
| empty fields + unreadable attachment | **EN-6042**: scanned PDF (1 of 2 pages unread) + legacy `.doc` → «Invoice references not identified — review required», extraction incomplete, never read (browser + test) |
| several confirmed invoices on one order | EN-6014 (3), EN-6056 (2) reconcile the order amount, each invoice once |
| cancelled invoices, active order | **EN-6049** (2 invoices): flagged conflict, remaining unchanged; after **withdrawing** a link the flag and the balance remain (browser) |
| cancelled invoices, closed order | **EN-6112**: same flag; amounts identical across open/suspended/closed/withdrawn (test) |
| contract mentioned, no direct-referral evidence | **EN-6056**: *mentioned only* — «Confirm» disabled for a description-only mention; nonexistent `CT-2099-0001` (EN-6119) cannot be confirmed (test) |
| confirmed direct contract referral | **EN-6021**: mention confirmed from the Word file → contract page shows *directly referred by EN-3111 (structured) and EN-6021 (reviewer-confirmed)* and «1 of 19 invoices referred» (browser) |
| status only from confirmed links | description/proposed references change nothing; a confirmation does (test) |
| dashboard / report totals | identities hold with and without the referrals (`snapshot().equation.ok`); dashboard loads without console errors (test + browser) |

New tests: structured+description · description-only · multi-page PDF · Word tables/page break/contract mention (incl. an XML unit) · unreadable formats · duplicates/one amount/several confirmed · conflicting sources · cancelled vs enforcement (all order statuses, proposal, withdrawal, identities, filter) · status from confirmed links only · contract mention → review → direct referral.

Sample files are regenerated with `npm run make:samples` (PDFs, the scan and the legacy `.doc` stub) and `npm run make:samples:docx` (Word); they carry the invoice numbers of the compact demo world at 2026-10-09 and say **SYNTHETIC DEMO DOCUMENT**.

## 5. Short demo script (Arabic UI, `?demoToday=2026-10-09`, sign in with the demo account)

**Enforcement management** (primary nav «إدارة التنفيذ»)
1. Landing: read the *Source/enforcement conflicts* (3), the three contract facts and the *Review exceptions* (new exception types, «Invoice references not identified — review required»).
2. Open **EN-6007** → *Sources examined*: structured empty, description 3, notes 1 → the references table shows each place and «as written». Save/confirm → three confirmed → reconciled.
3. Open **EN-6014** → add `public/samples/enforcement-orders/EN-6014-attachment.pdf` (2 pages, 3 invoices, one repeated). Then **EN-6021** → add `EN-6021-attachment.docx` (tables) → *Contract references*: «mentioned only» → «Confirm direct referral» (needs the document).
4. **EN-6042** → add the scanned PDF and the `.doc`: both kept, flagged *NOT read*; «not identified — review required».
5. **EN-6028** → conflicting years; only the debtor's invoice can be confirmed.

**Full-page invoice review**
6. Open **INV-2025-0000012** (from EN-6049): *Findings* → «Source/enforcement conflict — review required», and the table «Cancellation, exclusion, balance and enforcement — kept separate». Back on EN-6049 withdraw a link (with a reason): the balance does not move.
7. Contract **CT-2023-0020**: three facts (mentioned by EN-6056, directly referred by EN-3111 and EN-6021, 1 of 19 invoices referred).

## 6. Confirmed capabilities (synthetic demonstration)

All-source reference collection with provenance (structured · description · notes · digital PDF · Word text and tables) · lenient normalisation without losing the typed text · independent matching · de-duplication across sources · explicit unreadable-format handling (scan, image, legacy `.doc`, unknown) · source-conflict detection with evidence-only resolution · review table and existing confirm/propose/reject/withdraw workflow · three separate completeness states with the new «not identified» wording · cancelled-vs-enforcement conflict flagging with ENF-1 retained and EQ3 pending · three contract facts with evidence-based review.

## 7. Remaining dependencies (not delivered)

* **Live Sanad retrieval** and **retrieval of Sanad attachments** — not connected; the feed is synthetic and attachments are added by hand.
* **Actual OCR** (scanned PDFs and images, Arabic with embedded Latin numbers) — no engine approved or integrated; the earlier macOS Vision probe remains exploratory evidence only (`docs/ocr-integration-assessment.md`).
* **Legacy `.doc`** — not parsed (convert to `.docx` or PDF); **`.docx`** page numbers are approximate (Word paginates when it displays); embedded images/scans inside a Word file are not read.
* Business decisions: **EQ3** (final treatment of a cancelled-in-source invoice that is referred to enforcement and of exclusions under unapproved rules); Sanad's official statuses and closure reasons; who may confirm a contract mention; real attachment/description conventions (the demo's phrasing is synthetic).
* Unchanged: F-05, F-19, F-23, F-27, D-13, G-01 statuses; screen-reader verification open; EQ2, EQ3, EQ4, EQ5, EQ6, EQ9 and logo/Figma/icon licence unresolved and not inferred. No production-readiness or accessibility-conformance claim.
