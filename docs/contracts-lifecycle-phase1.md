# Investment contracts — lifecycle page (Phase 1)

Branch `feat/contracts-lifecycle-phase1` (from `main` at dd2d107). Approved plan: `IIM-Requirements-Handover/02_Investment_Contracts/Investment_Contracts_Review_and_Implementation_Plan` (D1–D21, gaps G1–G20, phases).
Everything here runs on the **synthetic** demo data; no Furas, Tahseel or SADAD meaning is asserted that the evidence does not support.

## What changed

**Contract page (`/contracts/:no`)** — the main section is now «الدفعات والفواتير — من الإنشاء إلى الانتهاء»: one row per scheduled installment for the WHOLE contract (first installment → contract end), cut by segments (all · paid · invoiced and due · upcoming · excluded/cancelled · before the data range). Each row shows installment no. «n of N» and year, due date, invoice id + SADAD number, invoice issue date, amount, collected, remaining, paid-in-full / last-payment date and state; invoiced rows expand to their payment events (date, amount, channel, running total, days against the due date). A legend explains every state. Orders show opened date and «closed: not recorded». The figures strip is now gross invoiced · exclusions · net invoiced · collected · uncollected · collection rate on net invoiced, with coverage («n of N installments have data»).

**Contracts list (`/contracts`)** — new tile, filter and column for «due — no invoice linked» (a CANDIDATE rule, pending confirmation), the rate column is the governed collection rate on net invoiced (collected ÷ net; «not available» when net is zero), loading/error states, the illustrative-data badge and a scope line (the period selector does not apply to contract schedules).

**Decision Room** — new item `contracts:unlinked`; `contracts:no_contract` now states the period basis it really uses.

**Invoice page** — beneficiary mobile removed (also from the API), beneficiary id masked.

**Search / numbers** — contracts are found by exact (trimmed, case-folded) match with a known number (`contractByNumber`); the generator emits `CT-yyyy-nnnn`, `CN-nnnnn`, `ECN-nnnnn`, `EDROCN-nnnnn`; free-text extraction also reads the `CN-/ECN-/EDROCN-` forms.

## Rules (see the review for the evidence)
* Net invoiced = gross invoiced − exclusions; uncollected = net invoiced − collected; collection rate on net = collected ÷ net; zero or unknown denominator → «not calculable». «Collected of what is due to date» is a different figure and is labelled so.
* Three kinds of empty cell: **zero** (a confirmed 0), **not applicable yet** («—», an upcoming installment has no invoice) and **not available from source** (before the data range, or no invoice linked). Unknown is never summed as zero; totals print coverage.
* No date is derived as «due − 10» in the contract card: an invoice date is the invoice's own issue date, otherwise «not invoiced». (The generator still creates synthetic invoices 10 days before due — that is data creation, not display logic.)
* «Term ended on <date>» is a date fact kept apart from the contract status; no status is inferred from dates.
* An order's closure or referral changes no amount: contract totals are read only from invoices and payment events.
* The schedule (`ct.sched`) is built without any random draw. `ct.dues` (the invoicing window) and every generated invoice/payment/request are byte-identical to `main` (hash of the ledger identical on the compact and full worlds).

## Deviation from the plan
G4 proposed splitting «unlinked» into «no invoice» and «invoice not linked to this contract». The second needs the generator's hidden truth about unmatched invoices, which a real system cannot know, so the card shows one honest state — «Due — no invoice linked to this contract» — and says an unmatched invoice may exist elsewhere.

## Lateness — one rule (`src/data/lateness.js`)
Two questions, never mixed. **Overdue unpaid days** = max(0, reference date − (due date + grace days)), reported only while an amount is still owed and the invoice is neither excluded nor cancelled (contract card: `null` otherwise; invoice list: 0). The invoice page's payment panel no longer recomputes it: it takes the engine's value (grace included). **Payment lateness** describes a payment that was made: `offset` = payment date − due date and `lateBy` = days beyond the grace period (0 = on time); each payment event carries both. The grace period is the one global parameter (`cfg.graceDays`, default 0).

## Balance and source status — exactly what exists
* **Displayed amounts:** the «Collected (from the invoice)» and «Remaining (from the invoice)» columns are read from the installment's linked invoice and its payment events in the demo ledger — generated, illustrative data. In production the authoritative collection source is Tahseel (SADAD supports settlement analysis). No Furas field is used for them.
* **Scheduled contract balance:** NOT displayed and NOT returned. The generator still computes it internally; the API field `remainingContractBalance` was removed from the card. No Databank field supports a displayed balance: BALANCEAMOUNT is unconfirmed (a scheduled running balance in the report, fits 2 of 20 raw rows), BATCHAMOUNTBALANCE (the unpaid amount) is empty in the sample. Review proposal D4 stays deferred.
* **Furas source status:** NOT implemented — there is no column and no field. It depends on Data Bank (value list of BATCHSTATUS; three vocabularies exist; 7 of 10 raw «Paid» rows show no payment evidence). The page shows only the DERIVED installment state. The contract status is the source's own value (shown verbatim; unknown values marked «unrecognised»; empty → «Not provided by source»).

## Not in Phase 1 (still open)
D3 source status (above), D4 balance (above), D5 type / entry mode / facility, D9 source-data panel, D12 raw start/end dates, D13 service type, D14 municipality → Amanah table, D15 sub-batch grain, D20 CR number (rejected), G9 source labels in the invoice source-record view, G10 CR status card vs invoice, G15 Smart-report contract intents, G17 older docs. Databank-dependent items stay dependencies: nothing was mapped to a field the evidence does not support.

## Release checks (2 Nov 2026)
* **Fixtures:** the sample order Word files EN-6007 and EN-6098 name `CT-2023-0020`; contracts 0 and 1 keep their original `CT-yyyy-nnnn` numbers, the other contracts use the four forms. `CT-2026-0087` (used by the sample PDFs and extraction tests as «not in the contract data») still does not exist. A test fixes both. Enforcement ↔ contract navigation checked both ways in the browser (EN-6021 → contract reference → /contracts/CT-2023-0020 → «Back to EN-6021»; the contract page lists EN-6021 and EN-3111).
* **Parity:** `npm run verify:exports` passes (9 models × 3 formats; docx 1231/1231, xlsx 1231/1231, pptx 1231/1231; xlsx exact SAR 2155/2155). **Coverage gap:** no report model or export carries contract data, so the script does not test the new fields; contract totals and the rate were verified separately against the invoice CSV export of the same contract (independent code path, 30 contracts) and the list roll-up against its cards.
* **Authorization / cache:** `/contract` and `/contracts` apply the organisation scope the request carries; the server cache key includes the full body (scope, organisation, owner/session) and the client cache key includes the full body. Verified in the running app and by test that an out-of-scope request is 404 before and after another scope's answer was cached. **Limitation:** the demo's login is client-side, so the organisation scope is asserted by the client; the server cannot authenticate it. Real enforcement needs server-side identity.
* **Pages:** list and contract page checked in English and Arabic, RTL, mobile (375 px: no horizontal overflow, rows become cards), filters, timeline segments, missing-value labels, state legend, Decision Room item.
* **Origin:** the two commits ahead of local main (`ca7f3f7`, `f94e378`, «chore: trigger deployment») are empty: same tree as main, based on `dd2d107`, so they do not affect this branch. Pushing may still trigger a deployment.

## Verify
`npm test` (platform tests cover the schedule, identities, missing-value states, payment events, contract numbers and fixtures, lateness, scope/cache, and CSV reconciliation) · `npm run build` regenerates `api/`, `dist/`, `dist-server/`.
