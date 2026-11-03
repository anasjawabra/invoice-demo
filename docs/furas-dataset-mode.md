# Furas dataset mode (local only)

A second data mode beside the generated demo. It reads the six Databank exports of the Furas schema from **this computer** and shows only what they contain. It is never part of Git, a build or a deployment, and it must not be pushed or deployed.

## Turning it on
Put the export directory in the git-ignored file `furas-exports.local` (one line, an absolute path) or set `FURAS_EXPORT_DIR`. Without either — and always on Vercel — the mode is off: `/api/furas/*` answers 404 and the app shows no switch. When on, a «Generated demo / Furas exports» switch appears in the header; the choice is kept in the browser.

## What is protected
* The exports, the config file and every derived value stay out of Git (`*.local` is ignored; a test asserts no `.csv` or export file is tracked) and out of `dist/`, `dist-server/` and `api/` (a test asserts the built outputs hold no local path; they contain code only).
* Only a whitelist of non-personal columns is read (`FURAS_KEEP` in `server/furasData.js`); investor names, e-mail, mobile, national/unified ids and commercial-record numbers are skipped while parsing and never held. Investor ids are masked in answers.
* Nothing is written to disk. The only log line is `[furas] local exports loaded` (no counts, no values).

## What it shows (all from the files)
* Dataset identity, extract date (SOURCE_PT), ETL time, rows and coverage per file; the two capped files (exactly 10,000 rows) are labelled limited samples.
* **Contract records** and **distinct contract numbers** as separate figures; numbers that carry several records, with status / value / type / end-date conflicts compared as numbers. No current record is chosen and conflicting contract values are never summed (the value tile counts each number with one consistent value once).
* Payment rows of the capped extract, listed once under their contract number. A contract-number match never multiplies amounts: payment amounts are never joined to contract records, and rows matching several records are counted and flagged.
* Source status, service type and Amanah (code + source name, Makkah flagged for confirmation) exactly as stored; no meaning is inferred.
* Integrity checks: duplicate payment rows, unmatched payment numbers, case rows, investor ids, renewal links.
* Decision Room: only data items (repeated numbers, capped extract, dates to validate, unmatched rows, status meanings, missing start dates, renewal links).

## What it does not show
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

Records of a number are grouped by **opportunity number**: *single* (one record), *versions* (several records, one opportunity) and *multi* (two or more opportunities). The list shows «N opportunities · M records» with a Structure filter; the details page shows the tree contract number → opportunities → records, the records of each opportunity side by side with differences lit, differences reported separately within and between opportunities, and the Databank column name beside every field.

### Scope: approved contracts only

The contract pages are read together with invoices, so **only approved contracts are shown**: contract records whose stored status is exactly `Contract-Approved` (`APPROVED_STATUS` in `server/furasData.js`; `FURAS_STATUS_SCOPE` overrides it, `''` or `all` turns the scope off). Everything is computed on that scope: the list, the overview, the integrity checks and the Data requests.

* A number with an approved record is shown with its approved records only; the details page says how many other records of the number have another status and are not shown.
* Payment and case rows are dropped only when they belong to **other** contracts. A row that matches no contract at all stays, so the integrity checks still see it. The file row count is kept beside the in-scope count (`fileRows`).
* The exports hold **no invoices**. The only invoice evidence is the invoice date on payment rows; it is offered as a signal and a filter («With an invoice date») and is not an invoice link.
* «Approved» is a business rule applied to the stored value; the exports do not document status meanings. Statuses such as `ContractExtension-Approved` and `ContractAddendum-Approved` are different documents and are not included.
