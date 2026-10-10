# Enforcement orders and invoice matching — business correction (branch `enforcement-order-matching`)

A clearly labelled **synthetic-data demonstration**. Not production-ready; no accessibility-conformance or "reliable AI understanding" claim. > **Superseded in part by `docs/full-page-records.md`:** the single «Fully matched» label was replaced by three separate completeness states; a written reason no longer makes a conflicting link acceptable (only evidence does); the order list/page/invoice view are now full pages (the drawer and the `/sanad-orders` page are gone — old addresses redirect); closed orders keep the invoice as «ever referred» (the category is «under an open order»). The verification table below describes the first round.

Branch created from the tag `demo-baseline-final` (the tag itself is unchanged). Nothing is pushed or merged.

## 1. The correction

Enforcement orders are **not limited to contracts**. An order from **Sanad** can cover **one or several invoices of any revenue type**. The earlier build modelled Sanad requests only at contract level, found "candidates" by amount + Amanah, and accepted simulated document text. All three are replaced.

## 2. Workflow and integration status

| Step | Status in this build |
|---|---|
| 1. Retrieve the order and its invoice references from Sanad | **Not live.** Orders and references come from a **synthetic Sanad demo feed** (`server/world.js`, section E), labelled as such on every order screen. *Dependency: a live Sanad integration.* |
| 2. Match the referenced invoice numbers against the system's invoices | **Implemented** (`server/orderMatch.js`, `POST /api/order-match`): exact invoice number, bare serial (ambiguous across years), SADAD number, violation number. |
| 3. If structured references are missing / incomplete / wrong → get the order PDF | **Manual upload implemented.** Retrieval of the PDF from Sanad is **not connected** (button shown disabled with the reason; `orderDocument.retrievable=false`). *Dependency: Sanad document API.* |
| 4. Extract all references from the document, incl. tables and later pages | **Text layer of digital PDFs — really read** (pdf.js, every page, rows kept on one line). **No OCR engine is connected**: a page with no text layer is reported **«NOT read»** and the order cannot be shown as fully matched until text is supplied from an **external OCR tool** (import) or typed by a person; both are recorded as such. *Dependency: an OCR service.* Nothing is simulated. |
| 5. Match the extracted references and present them for review | **Implemented** (order page, §3–§4). |

## 3. Matching rules and where they are enforced

* **One order, one or many invoices; one number is never "the list".** `collectReferences` merges Sanad's references with every document extraction; every reference gets its own row. (`src/data/orderMatching.js`)
* **Invoice numbers ≠ other numbers.** `extractFromText` classifies invoice number / serial / SADAD / violation separately from order (`EN-…`), contract (`CT-…`, `CO-…`), IBAN, account, commercial-registration and identity numbers and from amounts; the latter are listed under «Other numbers found — never matched». Tested on a mixed text and on the sample PDFs.
* **Amount alone never matches.** The order amount is only compared with the total of invoices matched **by reference**. The "other open invoices of this debtor" list is *information only* (explicit on-screen text); no button links from it. The old amount/Amanah candidate finder (`matchCandidates`, the `enforcement` analysis task, `proposeMatches`) was **removed**.
* **Discrepancy ≠ forced match.** `reconcile` reports `short` / `over` with the difference; the order stays **partial**. A wrong reference matches **nothing** (never replaced by a "similar" invoice).
* **Ambiguous / duplicate / conflicting are shown, not resolved by the system:** ambiguous (a bare serial that exists in several years), duplicate (two references to the same invoice, or an invoice already linked to another order), conflicts (invoice payer ≠ order debtor, different Amanah, cancelled / excluded / already collected, issued after the order, found only in a document that names another order).
* **Retained evidence:** document name + SHA-256, page numbers, the exact line each reference was read from, extraction method (text layer / imported OCR text / typed), and the link's origin and method.
* **Confirmation before any status changes.** A link is *proposed* (no effect anywhere) until a person confirms it. Structured exact invoice numbers from Sanad are confirmed by the feed itself; every document-derived, weak or ambiguous link needs an explicit confirmation, and any conflict or ambiguity needs a **written reason**. A confirmed link is withdrawn (reason required), never silently overwritten.
* **Status reflection.** A confirmed link gives the invoice the order's status (in execution / suspended / closed). **The invoice's payment status is a separate field** (`payStatus`, never changed by a link).
* **Partial stays partial.** An order is «Fully matched» only when every reference is accounted for (link or recorded decision), no proposal is pending, no document page is unread, and the amounts reconcile. Otherwise «Partially matched» with the reasons listed.
* **History is kept:** document added / re-read / text supplied, proposed, confirmed (with the status applied), rejected, withdrawn, reference set aside, and a change of the order's own status since the last record.

## 4. Data model

* **Server (synthetic world):** orders over all invoice sources with 8 controlled archetypes (single, several-of-different-types, partial references, no references, wrong reference, ambiguous serial, amount discrepancy, duplicate across orders); the hidden truth is used only to write the sample PDFs and the tests. `GET /api/sanad-cases` now also returns `refs`, debtor, `orderDocument`, `feed`.
* **Client:** `ib_enforcement_v1` (localStorage; written **only** on a user action) holds links, document records (name, hash, extracted references), supplements and history; PDF bytes live in IndexedDB (`ib_enforcement_docs`, keyed by SHA-256). The legacy review state (`ib_rev_cases`, sessionStorage) is only **read**. Backup: the optional key is included and validated; an older backup never removes it; **PDF files are not in the backup** (a restored order asks for the file again).
* **Effective orders** = Sanad/anchor base + the person's overlay (`buildEffectiveCases`); `invoiceStatusMap` is what the data service receives (confirmed → open / suspended / closed; proposed → `candidate`).

## 5. Impact review

**Screens:** Enforcement orders (rewritten: match-state tiles and filters, integration notice); Order page (rewritten: order + reconciliation, document panel with per-page read status, references table, order-beside-invoice table, history); Invoice drawer (payment status row; enforcement orders row with confirmed and proposed links); Noncollection ("Enforcement linkage" wording and states); Contracts (note that orders are not limited to contracts); Settings → local data/backup (text + summary); decision card «Enforcement orders not fully matched to invoices»; Smart-report risk line.

**Data relationships:** order ↔ invoices is now many-to-many in practice (an invoice may be named by two orders: shown as a conflict, status precedence open > suspended > closed); order → debtor; order → documents → extracted references → links; link → evidence.

**Calculations:**
* `derive` (server/engine.js): link codes 1 proposed (no effect) · 2 confirmed/open · 3 confirmed/suspended · 4 confirmed/closed. Category `enforcement` only for 2/3 (before: any confirmed link, and a *proposed* link moved the invoice to «linkage unresolved»). The existing rule that a confirmed link keeps an invoice live (not cancelled) now applies to open **and** suspended orders alike. New `payStatus` (collected / partial / overdue / not due / cancelled / excluded).
* Effect on the demo figures at 2026-10-09: invoices in the «Referred to enforcement» category **4 → 3** (one linked only to a **closed** order), gross/outstanding 632.28 M → 612.37 M SAR; **net uncollected unchanged** (13.39 bn) and the identities hold (enforcement is a non-collection category, not a deduction).
* `list` filter «execution»: only confirmed links count; a proposal does not.
* `dataVersion` now hashes the links map (a proposed→confirmed change no longer leaves running analyses looking current).

**Assumption (not an EQ, flagged for confirmation):** a **closed** order does not keep an invoice in «Referred to enforcement»; it shows the status «Closed» on the invoice. If the business wants closed orders to keep the category, it is one line in `derive`.

**Tests added (9; suite 84 → 93):** archetypes cover all invoice types; reference classification; real PDF text-layer reading (multi-page, scanned page unread, wrong-order document, caller's bytes preserved); reference resolution (exact / serial ambiguous / typo unmatched / SADAD / non-invoice kinds / exact ids never padded); amount alone never matches; match states; link lifecycle (no effect until confirmed, note requirements, withdrawal, history, status-change log); engine (category and payment status); backup.

## 6. Verification evidence (browser, isolated origin `http://127.0.0.1:3000`, `?demoToday=2026-10-09`)

**Start state:** localStorage empty; sessionStorage = app defaults + `ib_demo_today`. **End state:** localStorage empty, IndexedDB `ib_enforcement_docs` deleted (my own test origin; `localhost:3000` was not used for any action).

| Required case | Order | Result |
|---|---|---|
| One order → one invoice | EN-5000 | Sanad reference matches exactly → «Fully matched» (1 invoice, difference 0). |
| One order → several invoices of **different types** | EN-5013 | Fines + Investment + Municipal fees, same debtor → «Fully matched» (3 invoices, 85,438,130 SAR = order amount). |
| Incomplete structured match **completed from a PDF** | EN-5026 | Sanad gave 1 of 3 references → «Partially matched» (24.7 M short). PDF added: both pages read, 2 more references found (page 2). Confirming them one by one: still partial after the 2nd, **«Fully matched» only after the 3rd** (difference 0). History shows document + each confirmation with the status applied («Closed»). |
| **Ambiguous** reference | EN-5065 | Bare serial `0000111` → «Ambiguous — 2 invoices», one flagged «payer is not the order debtor / issued after the order». Confirm without a reason → refused; with a reason → linked; the other candidate is untouched. Withdrawal (reason required) removed the effect and logged it. |
| **Amount discrepancy** | EN-5078 | References match 2 invoices (235.6 M); order 271.0 M; PDF lists the same 2 → difference **35,410,020 SAR stays**, state «Partially matched», text «look for further references — do not force a match». The debtor's other open invoices are listed as *information only* (one of them equals the difference; an amount coincidence is not a match). |
| Status reflected **only on confirmed invoices** | EN-5065 / EN-5026 | Invoice drawer: confirmed → «EN-5065 In execution» / «EN-5026 Closed» with **payment status «Overdue» shown separately**; the unchosen candidate (INV-2026-0000111) shows no order and an unchanged category. A proposal sent as `candidate` changes nothing (engine test). |
| Wrong reference | EN-5052 | `INV-2024-4000030` → «Not found in the system» (not replaced by a similar invoice); order stays partial. |
| Duplicate across orders | EN-5091 | Invoice already confirmed on EN-5000 → «Also linked to another order» (reason required). |
| Document of another order | EN-5000 (wrong PDF) | «This document names a different order (EN-5013)»; its link needs a reason; order drops to partial until rejected; after «Reject» it returns to fully matched and the rejection is in the history. |
| Scanned PDF | EN-5039 | Pages 2–3 «NOT read — no text layer; OCR is not connected»; pasted OCR text recorded as «OCR text imported from an external tool» (references found there are labelled so); links still need confirmation. |

Screenshots: `docs/screenshots/after-o1-order-amount-discrepancy.jpg`, `after-o2-order-confirmed-links-history.jpg`. Arabic (RTL) rendering of the list and an order page was checked.

`npm test` 93 passed · `npm run build` ok · `npm run verify:exports` 100 % (docx/pptx 4744/4744, xlsx 2202/2202, 1408/1408 items per format) · `npm start` smoke: `/api/order-match` and `/api/sanad-cases` respond with the new fields.

## 7. Remaining dependencies and limits

1. **Live Sanad retrieval** (orders, invoice references, status changes) — not connected; the feed is synthetic. Status changes of an order after confirmation are logged only when this record is next touched.
2. **Sanad PDF retrieval** — not connected (manual upload).
3. **OCR engine** — not connected. Only the text layer of digital PDFs is read; scanned pages need external OCR text or typed references. OCR confidence is therefore not available.
4. Arabic text inside PDFs: the sample PDFs use Latin text; Arabic PDFs depend on the PDF's own text layer/encoding — **not verified**.
5. **Data is kept in one browser**; a server-side store with identity, roles and audit (F-19) remains blocked. The "by" in the history is the demo account name.
6. In the `full` (≈1.6 M invoice) mode the links map sent with each request grows with the number of confirmed orders (≈2,000 links ≈ 100 KB); the compact demo (default) is unaffected.
7. Unchanged and still open: EQ2, EQ3, EQ4, EQ5, EQ6, EQ9, logo / Figma / icon licence; F-05, F-19, F-23, F-27, D-13, G-01 statuses; screen-reader verification.
