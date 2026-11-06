# Furas dataset mode (local only)

A second data mode beside the generated demo. It reads the six Databank exports of the Furas schema from **this computer** and shows only what they contain. It is never part of Git, a build or a deployment, and it must not be pushed or deployed.

## Turning it on
Put the export directory in the git-ignored file `furas-exports.local` (one line, an absolute path) or set `FURAS_EXPORT_DIR`. Without either — and always on Vercel — the mode is off: `/api/furas/*` answers 404 and the app shows no switch. When on, a «Generated demo / Furas exports» switch appears in the header; the choice is kept in the browser.

## What is protected
* The exports, the config file and every derived value stay out of Git (`*.local` is ignored; a test asserts no `.csv` or export file is tracked) and out of `dist/`, `dist-server/` and `api/` (a test asserts the built outputs hold no local path; they contain code only).
* Only a whitelist of non-personal columns is read (`FURAS_KEEP` in `server/furasData.js`); investor names, e-mail, mobile, national/unified ids and commercial-record numbers are skipped while parsing and never held. Investor ids are masked in answers.
* Nothing is written to disk. The only log line is `[furas] local exports loaded` (no counts, no values).

## What the Furas PRODUCT page shows (all from the files; the contract list and details pages were reduced — see «Contract pages rework» below)
* Dataset identity, extract date (SOURCE_PT), ETL time, rows and coverage per file; the two capped files (exactly 10,000 rows) are labelled limited samples.
* **Contract records** and **distinct contract numbers** as separate figures; numbers that carry several records, with status / value / type / end-date conflicts compared as numbers. No current record is chosen and conflicting contract values are never summed (the value tile counts each number with one consistent value once).
* Payment rows, listed once under their contract number (the contract details page shows them as installments). A contract-number match never multiplies amounts: payment amounts are never joined to contract records, and rows matching several records are counted and flagged.
* Source status, service type and Amanah (code + source name, Makkah flagged for confirmation) exactly as stored; no meaning is inferred.
* Integrity checks: duplicate payment rows, unmatched payment numbers, case rows, investor ids, renewal links.
* Decision Room: only data items (repeated numbers, capped extract, dates to validate, unmatched rows, status meanings, missing start dates, renewal links).

## What it does not show (anywhere)
«Not available in the current data»: collected amounts, unpaid balances, collection rate, «n of N», complete schedules, upcoming installments, «due — no invoice linked», any installment-to-invoice link, and every page built on generated invoices, targets or enforcement orders.

## Verification
`python3 scripts/verify-furas.py` recomputes every displayed count and total from the CSV files with pandas and compares it with the running service (aggregates only). The unit tests use synthetic fixtures; no real record is used by a test.

## The local scenario subset (`furas-subset.local/`)

`scripts/make-furas-subset.py` builds a **100-contract-number scenario subset** of the six exports, for working without keeping the full files in the project. It is local and git-ignored; the originals are never changed.

* **What it is.** 100 contract *numbers*, not 100 unique current contracts: a number can carry several records, so the subset holds more contract records than numbers, plus the payment, case and investor rows related to them.
* **What "covers" means.** A seeded greedy cover over the scenarios defined by the profiling rules in the script (service types, statuses, Amanah codes, payment statuses, repeated numbers and their conflicts, date anomalies, schedule shapes, renewal links, case rows). It covers **all 125 scenarios defined by those rules**. That does not establish complete business-scenario coverage.
* **Not a sample.** Rare cases are over-represented on purpose, so no count, total or distribution computed from the subset is a Furas-wide or representative figure. The UI says so in the dataset strip, the overview, the limits panel and on every Decision Room item; no percentage or share of a population is shown anywhere.
* **Renewal links.** A link to a record that is not in the subset keeps the fixed marker `OUTSIDE-SUBSET` (no identifier of the outside record). It is shown as «related record outside this subset», and is counted apart from «no link» and from «target record not found». The marker is honoured only when the directory has a `subset.json`.
* **Identifiers.** Columns outside the non-personal whitelist are blank. Investor ids (and the ids embedded in record keys) are replaced by consistent fake ids from a seeded shuffle, so matching, repeats and gaps are preserved but no real id remains; bill numbers keep only a «filled» placeholder. Contract, opportunity and payment numbers are real business identifiers and stay: the subset must remain local.
* **Reproducible.** The selection and the fake ids are deterministic (verified with different hash seeds).

## Update: the contract pages always read the Databank-schema data

The data-mode switch was removed. `/contracts`, `/contracts/:no` and `/products/foras` always read the local exports (the 100-contract-number scenario subset, or the full folder if `furas-exports.local` points to it); the generated contract pages (`Contracts.jsx`, `ContractPage.jsx`) and the `DataModeContext` were deleted. Where the exports are not configured (always on a deployment) the pages show an unavailable state and no contract. The Furas data-quality items now live in the contracts page, tab «Data requests».

The generated contract engine (`server/contracts.js`, the ledger's contract field) is kept because invoice features still use it (order matching, invoice contract status) and its tests guard the Phase 1 financial identities; no page shows it any more.

### Structure of a contract number

> *UI superseded (5 Nov 2026): the Structure filter, the «N opportunities · M records» chip, the tree and the within/between-opportunity callouts were removed from the pages. The grouping itself remains in the data service: installments are grouped by opportunity and records with several opportunities are shown side by side.*

Records of a number are grouped by **opportunity number**: *single* (one record), *versions* (several records, one opportunity) and *multi* (two or more opportunities). The list shows «N opportunities · M records» with a Structure filter; the details page shows the tree contract number → opportunities → records, the records of each opportunity side by side with differences lit, differences reported separately within and between opportunities, and the Databank column name beside every field.

### Scope: approved contracts only

The contract pages are read together with invoices, so **only approved contracts are shown**: contract records whose stored status is exactly `Contract-Approved` (`APPROVED_STATUS` in `server/furasData.js`; `FURAS_STATUS_SCOPE` overrides it, `''` or `all` turns the scope off). Everything is computed on that scope: the list, the overview, the integrity checks and the Data requests.

* A number with an approved record is shown with its approved records only; the details page says how many other records of the number have another status and are not shown.
* Payment and case rows are dropped only when they belong to **other** contracts. A row that matches no contract at all stays, so the integrity checks still see it. The file row count is kept beside the in-scope count (`fileRows`).
* The exports hold **no invoices**. The only invoice evidence is the invoice date on payment rows; it is offered as a signal and a filter («With an invoice date») and is not an invoice link.
* «Approved» is a business rule applied to the stored value; the exports do not document status meanings. Statuses such as `ContractExtension-Approved` and `ContractAddendum-Approved` are different documents and are not included.


## Contract pages rework (5 Nov 2026) — authoritative description of `/contracts` and `/contracts/:no`

Branch `feat/furas-contracts-rework`. The two pages were reduced to the task: browse contracts → open one → see its information, investor, actual installments and contract-level invoice references. The overview, limits and checks, data-requests, structure-tree, case-rows and dataset-banner views were removed from these two pages (technical explanations live here, not on screen). The Furas product page keeps its overview. Everything below is computed in `server/furasData.js`; the pages only render it.

### Purpose and boundaries
Read-only view of the six Furas views for **approved** contracts (`Contract-Approved`). It shows contract facts, the actual Payment rows and bill references found on the workflow views. It does not show collected totals, a collection rate, a generated schedule, an installment→invoice link, or any AI / data-source / quality section. Furas «paid» is not the authoritative collected total (Tahseel is); contract value ≠ invoiced; installment payable ≠ invoiced; a future installment ≠ a receivable.

### The six views (191 columns, per `Furas_Schema.xlsx`: Investor 8 · EntityManagement 32 · ContractManagement 28 · Payment 31 · Contract 38 · IMSFW_Work 54)
Only a whitelist is read (`FURAS_KEEP`). Added in this rework: `OPPORTUNITYNAME` and `PRIMARYCONTRACTID` (Contract). Investor names, e-mail, mobile, national/unified ids and CR numbers are never read, so the investor **name is «Not available in the current data»**; the investor appears as a masked reference only.

### Verified vs schema-documented vs unresolved
(«Verified» = observed on the local 100-contract-number scenario subset, structural counts only. The subset over-represents rare cases and is not a sample: nothing below is a Furas-wide figure. Re-run on the full export before relying on it.)

| Topic | Schema says | Observed | Status |
|---|---|---|---|
| Contract record key | `PZINSKEY` is the primary key | unique across all records | Verified |
| `CONTRACTNUMBER` | external business id | **not unique**: records outnumber numbers; many numbers carry several opportunities | Verified (not a key) |
| `Payment.CONTRACTID` | «points to the contract-master row key» (= `PZINSKEY`) | matches `CONTRACTNUMBER` for every row, matches `PZINSKEY` for none | **Schema contradicted**: it holds the contract **number**. Joined by number; a row naming a record key attaches to nothing (tested) |
| Payment row = one installment | `PYGUID` is the logical id | `PYGUID` unique, filled; no repeated (number, batch year, batch number) | Verified |
| Payment → opportunity | `OPPORTUNITYNUMBER` on each row | every row's opportunity is one of its contract number's opportunities | Verified: installments are grouped by opportunity; a row is listed once |
| `PAYMENTAMOUNT` | amount payable for the batch or bill | filled on all rows; some zero | Verified as **payable**, never collected |
| `BATCHAMOUNTPAID` | amount actually received | **empty on every row** of the subset | Not available → «Not available», never 0 |
| `BATCHAMOUNTBALANCE` | outstanding amount of the batch | filled on very few rows | Shown only where filled |
| `BALANCEAMOUNT` | remaining payable after what has been paid | **does not behave so**: most `Paid` rows have a non-zero balance; no relation to status | Unconfirmed → **not displayed**; never added to `BATCHAMOUNTBALANCE` |
| `VATAMOUNT` | VAT portion | filled on a minority of rows; where filled it is ≈15% of `PAYMENTAMOUNT` in about half the rows | VAT basis of `PAYMENTAMOUNT` unconfirmed: VAT is shown beside the payable amount, never added |
| `BATCHSTATUS` | unpaid / partly / paid / overdue | 11 stored values (New, Paid, Default, Suspend, Unpaid, In Progress, Cancelled, Cancel-Regenerated, Cancel-PaymentFromTanfeeth, two «Invoice canceled…») | Meaning unapproved: shown as stored (Arabic = literal translation), not interpreted |
| `INVOICEDATE` / `PAYMENTDATE` | issue / settlement date | filled on part of the rows; a `Paid` row can lack a payment date and a `New` row can carry one | Shown as stored; an empty date is not evidence of anything |
| Investor join | `INVESTORID` joins all investor data | `Investor.INVESTORID` unique; contracts and payments find their investor, one contract id does not | Verified; reported on the page as «investor record not found» |
| Opportunity status vs execution status | `OPPORTUNITYSTATUS` = lifecycle, `RENTALSTATUS` = execution | independent columns; `RENTALSTATUS` mostly empty | Kept as two fields (approval scope vs execution status) |
| Renewal chain | `RENEWEDCONTRACTID` forward, `PRIMARYCONTRACTID` back | `PRIMARYCONTRACTID` empty on the subset; the few forward links resolve to the same number or to the record itself | **Direction and targets unverified**: shown as stored; nothing derived |
| Bill numbers | `SADADBILLNUMBER` in ContractManagement, EntityManagement, IMSFW_Work | present on a few workflow rows; **Payment has no bill key**; the subset keeps only a «filled» placeholder, so uniqueness cannot be tested here | Installment→invoice link **unavailable**; contract-level references only; bill uniqueness unresolved |
| Bill status / paid flag | `BILLSTATUS`, `BILLPAID` on the workflow views | not read | Out of the whitelist; a workflow row is a case snapshot, not a separate invoice |

### Contract list (`/contracts`)
One row per contract **number**: number · opportunity name (`OPPORTUNITYNAME`; «+n more» when records differ) · investor (masked) · execution status (`RENTALSTATUS`, literal Arabic) · start → end (`STARTDATE`/`ENDDATE`; «records differ» when the records of a number disagree, an implausible year is marked «to validate» and not converted) · contract value.
**Value meaning:** the main figure is `CONTRACTVALUE` — the stored **total**, VAT basis not stated. Beneath it, as separate stored fields: `ANNUALCONTRACTVALUE` («Annual») and `TOTALCONTRACTVALUEWITHVAT` («Incl. VAT»). None is derived from another and none is summed. When the records of a number disagree on a value, no value is chosen.
Filters: search (number, opportunity number, opportunity name), Amanah, service type, execution status. Export: CSV of the filtered list (`src/data/furasExport.js`, built from the same payload as the table, so it cannot disagree with it). The scenario-subset marker is one chip beside the title.

### Contract details (`/contracts/:no`)
1. **Contract information** — grouped fields; approval status, execution status and renewal status are separate fields; a number with several records shows them side by side with differences marked and **no record chosen as current**. Empty fields are listed once as «Not available».
2. **Investor** — masked id and «Investor name: Not available in the current data» (names are not read).
3. **Installments** — the actual Payment rows, grouped by opportunity when the number has several: batch no. (+ year, months, period end) · type · due date · invoice date · **payable** (`PAYMENTAMOUNT`, VAT beneath) · **paid** (`BATCHAMOUNTPAID`) · **outstanding** (`BATCHAMOUNTBALANCE`) · status as stored (+ payment date). A due date after today is marked «Upcoming» (a future installment is not due or overdue). No totals row: a sum over a partial or versioned schedule would mislead. CSV export of the rows.
4. **Invoices** — bill references found on the workflow views, matched by the **contract number** (or by opportunity number when the row names no contract number; a row naming another contract is never attached), listed once per distinct bill across the three views. Wording: «Installment link unavailable» (the Payment rows carry no bill key) and, when none is found, «No linked invoice found in the available data». The page never says «Invoice not issued»: that needs evidence the exports do not hold. Expandable installment rows are **not built**: they will be added only when an installment→invoice key is verified. The existing invoice details page is not linked because no Furas bill is matched to an invoice of the application's ledger.

### Statuses kept separate
Contract approval (`OPPORTUNITYSTATUS`) · execution (`RENTALSTATUS`) · renewal · installment (`BATCHSTATUS`) · payment evidence (payment date, paid amount). Missing payment information is never read as unpaid; closure or cancellation is never read as payment; a batch-paid amount is never allocated to an invoice.

### Open questions for the Furas data team
1. Is `Payment.CONTRACTID` meant to hold the contract number (observed) or the record key (schema)?
2. Meaning and approval of each `BATCHSTATUS` value; meaning of `BALANCEAMOUNT`; why `BATCHAMOUNTPAID` is empty.
3. VAT basis of `PAYMENTAMOUNT`, `CONTRACTVALUE` and `ANNUALCONTRACTVALUE`.
4. Which record of a repeated contract number is current; how `RENEWEDCONTRACTID` / `PRIMARYCONTRACTID` chain (direction, targets).
5. Is `SADADBILLNUMBER` unique per bill; is there an installment→bill key; what do the workflow rows of the three views represent (case snapshots or bills).
6. Permission to read investor names (masked reference only today).

### Code and validation
`server/furasData.js` (loader, scope, per-number rows, installments, bills) · `src/data/furasExport.js` · `src/pages/furas/FurasContracts.jsx`, `FurasContract.jsx` · `src/styles/furas.css` · `scripts/make-furas-subset.py` (whitelist now carries the two added columns; rebuilt locally, originals untouched). Tests: `npm run test:furas` (13, synthetic exports: number vs key, CONTRACTID mapping, repeated numbers, partial/full/missing payments, ambiguous links, bills deduplicated across views, no double counting, filters, subset markers, export consistency, no diagnostic sections) and the Furas tests of `tests/platform.test.mjs`. Browser: list and details checked in Arabic and English at 1280 px and 375 px (no horizontal overflow; installments become labelled cards on mobile).

### UI/UX rules applied
No MOMAH UI/UX guideline file, Figma link or Hugeicons package is available in this repository or the connected folders, so the pages follow the application's own system: the DGA-based tokens in `src/styles/variables.css` (Saudi green, AA-contrast text and focus ring), IBM Plex Sans Arabic, the shared `fu-*` components and inline SVG icons. Rules applied: logical CSS properties only (RTL/LTR safe) · one table, no tabs or summary cards · status chips in restrained colours and never colour alone (every chip has text) · dash + legend for «Not available» (full wording for screen readers) · visible focus on search, selects, toggles, rows and tables · live result count (`aria-live`) · labelled tables with `scope` headers · installments collapse into labelled cards under 760 px · `prefers-reduced-motion` honoured · loading, empty, error and unavailable states reused from `RecordState` / `FurasUnavailable`. **Gap:** compliance with the official MOMAH guideline could not be checked; please supply it for a review.
