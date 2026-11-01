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

## Not in Phase 1 (still open)
D3 source status, D4 balance column (stale note removed; `remainingContractBalance` is now correct but not shown), D5 type/entry mode/facility, D9 source-data panel, D12 raw start/end dates, D13 service type, D14 municipality → Amanah table, D15 sub-batch grain, D20 CR number (rejected), G9 source labels in the invoice source-record view, G10 CR status card vs invoice, G15 Smart-report contract intents, G16 PaymentPanel grace, G17 older docs. See the review for dependencies.

## Verify
`npm test` (platform tests 244–252 cover the schedule, identities, missing-value states, payment events and contract numbers) · `npm run build` regenerates `api/`, `dist/`, `dist-server/`.
