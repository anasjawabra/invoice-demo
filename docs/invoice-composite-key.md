# Invoice Composite Key (مفتاح الفاتورة المركّب)

**Rule.** An invoice number alone is not globally unique: it can repeat between Amanahs (and between GFS codes). An invoice is identified by

`invoice number + GFS code + Amanah id [+ municipality id]`

One shared mechanism builds, validates, parses and resolves it: `src/data/invoiceIdentity.js` (used by the server, the client and the tests).

## Components — verified against the schemas, and what is still open
Source: `Revenues_Schema.xlsx` (ENT_REVENUES, TB_DIM_BALADYAT, TB_DIM_GFS_ACCOUNTS). Schema-documented only: the schemas carry no rows, so uniqueness in real data cannot be tested.

| Component | Source column (schema) | Status |
|---|---|---|
| Invoice number | `ENT_REVENUES.ACCOUNT_NO` («رقم الفاتورة — the number used to identify and pay the invoice») | Documented. Whether `ACCOUNT_NO` equals the SADAD number is **unverified**; the SADAD number is a separate field and is never substituted. |
| GFS code | `ENT_REVENUES.GFS_MAIN_CODE` (TB_DIM_GFS_ACCOUNTS) | Documented. |
| Amanah id (required) | `TB_DIM_BALADYAT.AMANA_NO` («كود الأمانة») | Documented. A stable code, never a name. |
| Municipality id (optional) | `BALADYA_KEY` (رقم البلدية) / `MAIN_BALADYA_NO` / `BRANCH_BALADYA_NO` | Optional and only meaningful **inside its Amanah** (codes repeat across Amanahs; never interchangeable with the Amanah id). Which column is the approved identifier, and whether the key needs it for uniqueness, is **open**. |
| Biller number | `ENT_REVENUES.BILLER_KEY` («رقم المفوتر») | Separate field, **not** a key component. |

Key format: `ick1|inv=<…>|gfs=<…>|am=<…>[|mu=<…>]`, values percent-encoded (the separators can never occur inside a value), components kept as **text** (leading zeros and long digit strings preserved; a JavaScript number that is not a safe integer is rejected). A missing required component gives **no key** and the missing names are reported; an incomplete key is never equal to anything.

## Demo world mapping
The synthetic world generates one number per invoice; it exposes it as `invoiceNo` (a distinct field from `sadadNo` and `billerId`). Amanah id = a 3-digit stable demo code (`001`…), municipality id = a 3-digit code **local to its Amanah** (`001` exists under every Amanah — which is exactly the case the key must survive). These are demo codes standing in for `AMANA_NO` / `BALADYA_KEY` until the real codes are mapped. The **internal invoice id** `biller-sadad` is kept (stored links, old URLs, notes, decisions): it points to exactly one invoice in the store and is not the business key.

## What changed
| Area | Change |
|---|---|
| Shared mechanism | `src/data/invoiceIdentity.js`: `compositeKey`, `parseCompositeKey`, `sameInvoice`, `resolveByNumber`, `migrateReference`, candidate summary |
| Invoice rows (backend) | `server/iimRow.js` adds `invoiceNo`, `amanahId`, `municipalityId`, `compositeKey`, `keyComplete`, `keyMissing` to every row and detail |
| Resolution | `server/engine.js`: `lookupRef` (composite key → exact; legacy id → exact when unique; bare number → candidates, several = ambiguous), `lookupComposite`, `lookupId` accepts a composite key |
| API / routes | `/api/invoice` answers **409 `invoice_ambiguous` with the candidates** for a bare number several invoices carry; `/invoices/:id` accepts a composite key, a legacy id or a bare number |
| UI | invoice page: «مفتاح الفاتورة المركّب» as a secondary row under «تعريف الفاتورة» (with invoice number, SADAD number and biller as separate rows); an ambiguity page lists the candidates (invoice number, GFS code, Amanah/municipality, source, amount, status) and opens the chosen one |
| Search | a number search already returned every invoice carrying it (never one silently) |
| Exclusion upload | the Amanah decides among invoices that carry the number; **inside one Amanah the GFS code (account) decides; several remaining → `invoice_ambiguous`**, never `mine[0]` |
| Invoice upload | a repeated import of the same invoice (same id or same composite key) is a duplicate; the same number under another Amanah / GFS code is a different invoice |
| Enforcement (Sanad / Eefaa matching) | order-reference resolution adds `composite_key` and returns the composite fields on every candidate; a **confirmed link stores the composite key** in its snapshot; `migrateLinkIdentity` adds the key to a stored link only when its id resolves uniquely, otherwise flags `needs_review_ambiguous` / `needs_review_unresolved` (never reassigns) |
| Exports | invoice CSV: + `invoice_number`, `gfs_code`, `amanah_id`, `municipality_id`, `invoice_composite_key` (the SADAD and internal id columns stay) |
| Dictionary / docs | the glossary term «مفتاح الفاتورة المركّب» (components, schema columns, open points), `dictionaryDocs.js` identity formula, this document |

## Not changed, and why
* **Furas contracts and installments** — the exports hold no invoices and Payment has no bill key; an installment→invoice link is unavailable (`docs/furas-dataset-mode.md`). No composite key applies until a key exists.
* **Eefaa / Mumtathil violations** — linked by violation number or SADAD candidates through the same reference resolution (ambiguity already returned as candidates); no invoice identity is inferred.
* **Dashboards, planning, Smart Reports, Decision Room** — aggregate over the store; they reference invoices by internal id, which maps to one invoice. No total changed.
* **Chatbot** — recognises the full internal id (`biller-sadad`, unique); a bare number is not resolved by chat. Composite keys are technical and are not parsed from chat.

## Validation
`npm run verify:identity [compact|full]` (counts only). Full demo world: 1,716,496 invoices; invoice numbers 1,716,494 distinct, **2 numbers carried by 2 invoices each** (each pair differs by Amanah and by GFS code); internal ids 1,716,496 distinct; composite keys 1,716,496 distinct, 0 repeated, 0 incomplete; 12,452 invoices carry no municipality id (hand-anchored / housing — the optional component). Round trip: composite keys resolve back to their invoice; each shared number resolves to several candidates, never one. Unit and system tests: `tests/platform.test.mjs` (Invoice Composite Key ×4). **Totals did not change**: nothing was merged or split in the demo world (the keys were already distinct), so there is no difference to reconcile; the financial formulas are untouched.

## Unresolved data gaps
1. Real `ACCOUNT_NO` ↔ SADAD number equivalence; 2. which municipality column is the identifier and whether it is needed for uniqueness; 3. real `AMANA_NO` codes (demo codes used); 4. uniqueness cannot be tested on real data (schemas only); 5. runtime migration of stored enforcement links is implemented and tested as a pure function but not run automatically at start-up (internal ids stay valid); 6. other persisted stores (decisions, notes) key by the internal id and were not re-keyed.
