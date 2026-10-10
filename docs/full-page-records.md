# Full-page record experience and enforcement corrections (branch `enforcement-order-matching`)

A clearly labelled **synthetic-data demonstration**; not production-ready; no accessibility-conformance claim. Builds on `docs/enforcement-order-matching.md`. `demo-baseline-final` is unchanged; nothing is pushed or merged.

## 1. Replaced drawers and every affected entry point

| Former experience | Where it opened | Now |
|---|---|---|
| **Invoice detail drawer** (`InvoiceDetailDrawer` + `InvoiceLedgerSections`, long right-hand panel) | Invoice library rows; `/invoices?id=…` links from dashboards, lists, analysis results, contract schedule, order pages | **`/invoices/:id`** (`InvoicePage`) |
| **AI run-trace drawer** (`AIProcessDrawer`, stacked on the invoice drawer) | «View full AI analysis» in the invoice drawer | **Removed.** It showed a fixed fixture trace (collection order, contract lookup) that had nothing to do with generated records. Real, rule-based findings are on the invoice page. Its orphaned components, data and CSS were deleted. |
| **Contract inline panel** (`ContractCard`, a long expansion under the list, `?no=`) | Contracts list rows; dashboard contract/execution lists | **`/contracts/:no`** (`ContractPage`) |
| **Analysis result drawer** (`ResultDrawer`) | «View results» of any analysis task (non-collection, exclusions, invoice, report…) | **`/analysis/:taskId`** (`AnalysisResultPage`; states clearly when the in-session result is gone after a refresh) |
| Sanad order page (already a page) | `/sanad-orders/:n` | **`/enforcement-orders/:n`**, rebuilt on the shared layout; list = **«إدارة أوامر التنفيذ»** in the operational modules |
| Investment-invoice pages (scripted walkthrough with fixed text) | `/investment-invoices(/:id)` (not linked from any menu) | **Removed** (a second, competing invoice view); the old addresses redirect |

Old addresses keep working by redirect: `/invoices?id=`, `/contracts?no=`, `/sanad-orders(/:n)`, `/investment-invoices(/:id)`.

**Entry points rewired** (all build addresses with `src/utils/paths.js` and use `RecordLink`, which remembers where the reader came from): Dashboard executive lists (overdue invoices, contracts, execution) and source-record links; Invoice library (row click and Enter/Space); Collection worklist; Risk / data-quality list (the «Analyze invoice» button is now «Analyze and review» → the invoice page); Noncollection (records, enforcement linkage list); Contracts list and contract schedule; Enforcement orders list; order page (linked invoices, references, debtor investigation, contracts); invoice page (orders, contract, findings); analysis-result invoice chips; decision-card drill-downs (`/enforcement-orders`, `/invoices/:id`). Compact filters, menus, the progress modal, the task dock and the assistant button remain (not record-detail drawers); every record page leaves room (`padding-block-end`) so the floating button never covers content.

**Return / list state.** A record page opened from a list or another record offers «Back to <where you came from>» and breadcrumbs. The Invoice, Contracts and Enforcement-orders lists keep their filters, sorting, page and scroll position and restore them only when re-entered by the return button or the browser's Back button; opening the list from the menu starts clean.

## 2. Pages

**Shared design** (`RecordPage.jsx`, `record.css`; existing MoMAH/DGA tokens, IBM Plex Sans Arabic, Arabic RTL): breadcrumb + return, kind + title + identifier, **three separately labelled status groups**, an essential-figures strip, a few sections, secondary detail folded in native `<details>`; loading (skeleton), error with retry, not-found; focus moves to the heading on arrival; the browser tab names the record.

* **Invoice** — header: number, revenue type + source, **payment status**, **enforcement status** (current / referred before, separate), **review** status, contextual return, CSV export. Essentials: gross · exclusions · net · collected · remaining; issue/due dates, payer, Amanah/municipality, identifiers. Sections: **Findings to review** (what · why flagged · evidence · action: approve/reject an exclusion, confirm/reject a proposed link, otherwise informational) · **Invoice information and payments** · **Analysis and review** (exclusion records with evidence, notes; states that source figures are corrected in the source system and that a review decision is neither payment nor legal approval) · **Enforcement orders and documents** (all orders with status, closure reason or «unknown», link state; **PDF page beside the extraction evidence**, side by side ≥ 900 px, stacked below) · **Related contract** (only the contract the invoice carries; invoices without a contract are stated as normal) · **History**.
* **Enforcement order** — Sanad information and status (closure reason or «unknown»), reconciliation figures, **three separate completeness states** (see §4), linked invoices (withdraw), references and matching review (matched / unmatched / ambiguous / duplicate / conflicting, with document · page · line), document panel (real PDF preview, per-page read status, supply text, restore), financial reconciliation (+ debtor's other open invoices, information only), related contracts, history.
* **Contract** — summary, **invoices** (payment schedule) each with its orders, **orders associated with the contract** (via its invoices, or contract-level requests that name the number — never spread over invoices), registration chain.

## 3. One relationship model, one status derivation (`src/data/relations.js`)

Order ⟷ link ⟷ invoice ⟷ (optional) contract. An order covers several invoices of any type; an invoice may carry several orders. Only **confirmed** links count. The contract exists only where the invoice record carries it or Sanad names the number — never inferred from an amount or a payer name.

Four facts, never merged: **historical referral** (any confirmed link — true again after an order closes), **current enforcement** (a confirmed order in execution, or suspended), **each order's own status** (in execution / suspended / closed + closure reason or «unknown»), **payment status**. Closing an order neither implies payment nor cancels the balance nor erases the link or the referral. Withdrawing or closing one order never removes the effect of another confirmed order (tested). The data service now returns **explicit unique-invoice counts**: *under an open order* (in execution / suspended) and *ever referred* (also all-closed); the category label reads «under an open enforcement order», and the Noncollection page and the orders list show both counts.

**Policy assumptions to confirm (not business decisions I may infer):** (1) a *suspended* order counts as «open» for the category and the open count; (2) a closed order no longer keeps the invoice in the non-collection category but remains in «ever referred»; (3) a withdrawn (wrongly made) link is not a referral, whereas history keeps it.

## 4. Matching corrections

* **Three completeness states, shown separately** (never one «Fully matched» label): *reference matching* (every reference found is confirmed/decided; no pending proposal — **does not require the amount to agree**), *document extraction* (every page read; pages whose text was supplied from outside or typed are counted and flagged as unverified), *financial reconciliation* (confirmed invoices vs the order amount — a difference is reported, never closed by inventing a link).
* **A written reason never resolves a conflict.** Hard conflicts (payer ≠ order debtor, different Amanah, invoice issued after the order, found only in a document that names another order, ambiguous reference) block confirmation until **evidence** resolves them: an ambiguous serial is settled only by another reference of the same order that names exactly one invoice; a debtor mismatch only if an order document names that payer's identity number; otherwise the link stays unresolved (the confirm button is disabled and says what would resolve it; the reducer also refuses). Warnings that do not block: also on another order, already collected / cancelled / excluded, weak reference.
* **Deduplication:** one reference merges every place it was found (Sanad, each document and page, each method); two forms of the same invoice (invoice number + SADAD number, or a serial) are shown as duplicates with their evidence; an invoice amount is counted once.

## 5. OCR / integration honesty

Distinguished everywhere: synthetic Sanad feed · live Sanad retrieval (**not connected**) · digital PDF text layer (**read by this system**) · OCR performed by this system (**none**) · imported external OCR text · manually entered references. Assessment, probe evidence and the dependencies of a real integration: `docs/ocr-integration-assessment.md`. The original requirement is **not** claimed fully delivered while live retrieval and real OCR are pending.

## 6. PDF backup and restore

Backups contain links, document records (name, hash, extracted references with page numbers and lines), supplements and history — **not the PDF files** (stated in the backup panel and wherever a document is missing). After a restore the order list reports how many documents have no file; each affected order says so beside the preview, keeps provenance, evidence and confirmed links, and offers **«add the file again»**: the replacement is associated **only if its SHA-256 equals the recorded identity** (a different file is refused with both hashes shown; it can be added as a new document). Re-association is written to the history.

## 7. Verification (isolated origin `http://127.0.0.1:3000`, reference date 2026-10-09)

**Start:** localStorage empty; no IndexedDB. **End:** localStorage empty, IndexedDB deleted, list/scroll memory cleared (my own test origin; `localhost:3000` untouched).

| Requirement | Result |
|---|---|
| Former drawer entry points open the right page | invoice row → `/invoices/:id`; contract row → `/contracts/:no`; analysis «View results» → `/analysis/:id`; old addresses redirect (checked all six) |
| Order → invoice → return to the same filtered order list | EN-5117 from list (status *closed*, search «EN-51») → linked invoice («Back to EN-5117») → order («Back to Enforcement orders») → list with the same filter and 3 rows |
| Invoice → order → return to the invoice | contract page → invoice («Back to CT-2023-0048») → order EN-5000 («Back to INV-2024-0000027») |
| Contract → invoice → related order | CT-2023-0048 → INV-2024-0000027 (schedule row shows EN-5091 *In execution*) → order |
| Invoice with no contract | white-lands / fines invoices: «This invoice type does not belong to a contract. That is normal.» |
| Several invoice types, one order | EN-5013: fines + investment + municipal fees |
| Several orders, one invoice | INV-2024-0000027: EN-5000 (closed, closure reason «Replaced by another order») + EN-5091 (in execution) → *An order is in execution · Referred before · 2 order(s)* |
| One closed + one active; withdraw one while another remains | withdrawing the closed order's link left «in execution» from EN-5091 (history logged); both counts explicit |
| Conflicting reference | EN-5195's link to INV-2024-0000027 shows «Different Amanah»; confirm is disabled («Unresolved — cannot be confirmed»); a written reason is refused by the reducer (unit-tested) |
| Ambiguous serial | EN-5065: both candidates unresolved; settled only when another reference names the invoice (EN-5143 demonstrated) |
| Amount discrepancy unresolved | EN-5078: references complete, document complete, **reconciliation: difference 35,410,020 SAR** — three states shown apart |
| Incomplete references completed through document review | EN-5026 (earlier round) and EN-5143 (typed references settle the ambiguous serial) |
| Arabic digital PDF | EN-5013: real Arabic page preview; 3 references over 2 pages; second copy of the English PDF: references merged (3 not 6), total counted once |
| Arabic scanned PDF | EN-5143: both pages «NOT read — this system performs no OCR»; external OCR text (macOS Vision output, labelled *imported*) produced a damaged serial → ambiguous across 3 years; typed references settled it; extraction shows «2 page(s) rely on supplied text — quality not verified» |
| Backup restore with missing PDFs | backup (4 keys, no `%PDF`) → IndexedDB deleted → restore: orders list «3 order document(s) have no original PDF», links/evidence intact; wrong file refused (hash mismatch), right file restored, history entry written, preview drawn again |
| Not-found / unknown URL | `/invoices/INV-9999-NOPE` → clear not-found with return link |
| Browser Back / refresh | Back from an invoice restored page, filters and scroll (3310 px); direct URL load works |
| Layout | desktop 1280: documents and evidence side by side; mobile 375 and 574: stacked, **no horizontal overflow** on 5 pages (measured); Arabic RTL screenshot |
| Keyboard | Enter on a focused row opens the page; focus lands on the page heading; breadcrumbs, return, sections (`<details>`) and tables are focusable |

Automated: `npm test` **102 passed** (84 baseline + 18 new across both rounds: relations, completeness, evidence-only conflict resolution, deduplication, Arabic PDFs, backup-with-missing-PDF, closure reasons, explicit counts); `npm run build` ok; `npm run verify:exports` 100 %.

Screenshots — before: `before-d1-invoice-drawer`, `before-d2-ai-run-trace-drawer`, `before-d3-contract-inline-panel`; after: `after-d3-order-arabic-pdf-preview`, `after-d4-invoice-document-evidence-desktop`, `after-d5-order-mobile-rtl` (all in `docs/screenshots/`).

## 8. Not verified / remaining

* **Live Sanad retrieval**, **Sanad PDF retrieval**, **real OCR** (and accuracy on real Arabic scans) — see §5; the original requirement is not fully delivered until these are connected and verified.
* Screen readers; real OS print/download dialogs; keyboard choice inside native select pop-ups; other browsers (checked in the in-app Chromium pane only).
* The Collection, Risk and Noncollection lists use the shared scope bar's remembered filters; only the Invoice, Contracts and Orders lists restore their own sorting/page/scroll.
* Data stays in one browser; server-side store/identity/audit (F-19) still blocked. Unchanged and unresolved: EQ2, EQ3, EQ4, EQ5, EQ6, EQ9, logo/Figma/icon licence; F-05, F-23, F-27, D-13, G-01.
