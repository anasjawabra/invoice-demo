# Furas export reassessment — what superseded the 20-row findings

Earlier mapping and review work (Oct–Nov 2026) read 20-row raw samples of the Furas tables. Six Databank exports of 2 Nov 2026 (partition 20261025) replaced them as the latest evidence. This repository keeps **no real record and no real figure from them**; the reassessment lives in the handover folder:

* `~/Desktop/IIM-Requirements-Handover/02_Investment_Contracts/Furas_v2_Review_and_Plan.docx` (and `.pdf`) — result, critical review, plan A–D
* `…/Furas_v2_Review_Tables.xlsx` — every field and decision with the reviewed status (Confirmed / Superseded / Contradicted / Unresolved) and citations
* `…/Furas_Data_Verified_Map_v2.xlsx` — the 191 columns profiled on the exports (read it with the corrections in sheet `03_V2_corrections` of the review tables)
* `…/Data_Bank_Request_Furas_Payments_and_Contracts.docx` — the request to Data Bank (prepared, not sent)

## Limits that still apply
The Payment and IMSFW_Work exports are capped samples; the Contract view repeats contract numbers across records and has no version column; no update timestamp or extraction rule is exposed. Nothing here approves a business rule.

## Earlier statements that are superseded (kept as historical evidence in the documents that contain them)
| Earlier statement (20-row sample) | Status now |
|---|---|
| «7 of 10 raw Paid rows show no payment evidence» | Superseded: in the larger export almost every Paid row has a payment date |
| «BALANCEAMOUNT fits 2 of 20 raw rows» | Superseded: filled throughout; on the subset it does not behave as «remaining after payment» (most Paid rows carry a balance). Not displayed; the page shows `BATCHAMOUNTPAID` / `BATCHAMOUNTBALANCE` only where filled |
| «three status vocabularies exist» | Superseded: one value list per column, none with an approved meaning |
| Start/end, municipality, invoice/payment dates, amounts «0 of 20 / few of 20 filled» | Superseded: filled to very different degrees in the exports; see the review tables |
| Payment → Contract by contract number | **Observed match, and the schema's «points to the contract key» is contradicted** (re-checked 5 Nov on the scenario subset: every row matches a contract NUMBER, none a record key; one-to-many across contract records; the current record is not determined). See `docs/furas-dataset-mode.md` §«Verified vs schema-documented vs unresolved» |
| Installment → invoice | **Not verified**: no key on the Payment rows; never inferred from the contract-number match or from how a number looks |

## Where the demo applies this
`src/data/contractRules.js` (origin of a value, the candidate rule «due — no invoice linked»), `docs/contracts-lifecycle-phase1.md` (Group A corrections) and, for the contract list and details pages, `docs/furas-dataset-mode.md` §«Contract pages rework».

## Wording used on the contract pages
«Not available in the current data» (information the data does not support) · «Proposed rule — requires confirmation» (a rule no business owner has confirmed). See `docs/contracts-lifecycle-phase1.md`, section «Data-accuracy corrections».
