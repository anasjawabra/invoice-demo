# Stable demo identifiers — rules, the old → new record, and what to do with older saved work (branch `enforcement-order-matching`)

Synthetic-data demonstration; not production-ready. `demo-baseline-final` unchanged; nothing pushed or merged.

## 1. Why this exists

A demo order such as **EN-6049** is not a database row: it is generated deterministically. Builds `be75c40` and `71fdb03` numbered the generated scenario orders by *position in a list* (`EN-6000 + 7 × position`), so adding or re-ordering a scenario silently moved every later id to a different scenario and different invoices. Work saved under an id (confirmed links, uploaded-document records, history) then described the wrong order. From `cd27e3c` the ids are fixed, and this round makes that a rule with tests.

## 2. The rules now in force

1. **Each scenario has a fixed id** — the table `E2_IDS` in `server/world.js`, keyed by `archetype:rep`. An id never depends on how many scenarios exist.
2. **The scenario list is append-only.** A new scenario is added at the **end**; its id comes from its fixed list position `EN-(6200 + 7 × (rep × 20 + position))` (e.g. `notation_exact` → **EN-6298**) and it is generated **after** the existing scenarios (generation passes in `E2_PASSES`), so it can never change which invoices an existing order covers.
3. **Never renumber, reorder or reuse** an id. Retire a scenario by leaving its slot in place.
4. **Test:** `tests/platform.test.mjs` embeds the `STABLE_IDS` table (id → archetype + the invoices it covers) and fails if any id changes meaning.
5. **Saved work is stamped** with `idScheme: 3`. A store without the stamp (written by an earlier build) holds records whose ids may mean a different order today.

## 3. What happens to older saved work (never silent, never overwritten)

On load, a store without `idScheme: 3` is migrated by `migrateIdScheme` (`src/data/orderMatching.js`):

* records under ids **outside** the generated range `EN-60xx / EN-61xx` (hand-anchored `EN-50xx…`, first-batch, contract-level) never changed → kept exactly as they were;
* records under ids **inside** that range are **moved aside** (`store.legacy`) and **applied to no order**. Nothing is deleted, merged or guessed.
* The Enforcement management landing then shows a notice («N سجل محفوظ بأرقام أوامر قديمة لم يُطبَّق على أي أمر») listing each record with its document and link counts, and a selector **«استعادة إلى»**: the reviewer picks the order the record really belongs to and restores it. A target that already has its own record is refused. The move is written to the order's history (`restored_from_legacy_id`, from → to).
* The restore is also part of the backup/restore path (`restoreLegacy`), so a backup file made by an older build is handled the same way.

Direct addresses (`/enforcement-orders/EN-6049`) always open the **current** order of that id; they never show quarantined work.

## 4. Old → new record (informational — never applied automatically)

Computed by generating the world at each build with the date pinned to 2026-10-09 and matching scenarios by archetype. **The invoices covered also differ between builds**, so this is a guide for choosing a restore target, not a mapping that the app applies.

### `cd27e3c` → current
All 17 ids are **identical** (same scenario, same invoices). The only addition is **EN-6298** (`notation_exact`). Records saved by `cd27e3c` can therefore be restored to the **same id**.

### `71fdb03` → current (scenario that the old id meant → the id of that scenario today)
EN-6000 one_attached → **EN-6014** · EN-6007 contract_mention → **EN-6021** · EN-6014 same_serial_two_years → **EN-6028** · EN-6021 genuine_conflict → **EN-6035** · EN-6028 mixed_sources → **EN-6042** · EN-6035 attach_unreadable → **EN-6063** · EN-6042 desc_multi → **EN-6070** · EN-6049 desc_only → **EN-6077** · EN-6056 attach_pdf → **EN-6000** · EN-6063 attach_docx → **EN-6007** · EN-6070 cancelled_closed → **EN-6091** · EN-6084 contract_mention (2nd) → **EN-6105** · EN-6112 desc_only (2nd) → **EN-6112** · EN-6119 attach_docx (2nd) → **EN-6098**.
No equivalent today (second copy of the scenario not generated): EN-6077, EN-6091, EN-6098, EN-6105, EN-6126, EN-6133.

### `be75c40` → current
EN-6000 desc_multi → **EN-6070** · EN-6007 desc_only → **EN-6077** · EN-6014 attach_pdf → **EN-6000** · EN-6021 attach_docx → **EN-6007** · EN-6042 attach_unreadable → **EN-6063** · EN-6049 cancelled_open → **EN-6084** · EN-6056 contract_mention → **EN-6021** · EN-6070 desc_only (2nd) → **EN-6112** · EN-6084 attach_docx (2nd) → **EN-6098** · EN-6119 contract_mention (2nd) → **EN-6105**.
No equivalent today: EN-6028 and EN-6091 (source_conflict), EN-6035 and EN-6098 (source_conflict_unresolved — the scenario was replaced by `genuine_conflict`), EN-6063, EN-6077, EN-6105, EN-6112.

### Identified ambiguous ids
Every id in `EN-6000 … EN-6133` from `be75c40`/`71fdb03` is ambiguous (the same number meant a different scenario). Only a person who knows which order the work was for can restore it; the app asks, and does not guess.

## 5. The current table (frozen)

| Id | Scenario | Id | Scenario |
|---|---|---|---|
| EN-6000 | attach_pdf (1st) | EN-6070 | desc_multi |
| EN-6007 | attach_docx (1st) | EN-6077 | desc_only (1st) |
| EN-6014 | one_attached | EN-6084 | cancelled_open |
| EN-6021 | contract_mention (1st) | EN-6091 | cancelled_closed |
| EN-6028 | same_serial_two_years | EN-6098 | attach_docx (2nd) |
| EN-6035 | genuine_conflict | EN-6105 | contract_mention (2nd) |
| EN-6042 | mixed_sources | EN-6112 | desc_only (2nd) |
| EN-6049 | desc_sadad | EN-6298 | notation_exact |
| EN-6056 | corrupted_structured | EN-6063 | attach_unreadable |

The first-batch orders (`EN-5000 + 13 × k`, generated by their own index in `server/world.js`) do not depend on the scenario list; the scenario ids above are the only ones that moved between builds.

## 6. Sample files and instructions

* **Prepared samples** (`public/samples/prepared`): tied to ids EN-6014, EN-5039, EN-6042, EN-6028, EN-5065, EN-6035, EN-5078, EN-5143 — all unchanged; regenerated this round, the PDFs and transcripts are byte-identical except the printed status line of EN-6042 (see below).
* **PDF/Word samples** (`public/samples/enforcement-orders`): file names carry the order id; regenerating with `npm run make:samples`, `make:samples:docx`, `make:samples:ar`, `make:samples:prepared` leaves the ids and invoices unchanged.
* The sample generators no longer print «Suspended» (the source has no suspended status): an order not stated as closed is printed as «In execution». Six sample PDFs (EN-5000, EN-5013, EN-5052, EN-5195, EN-6000, EN-6042) changed in that one line only.
* **To add a scenario later:** append it to the end of the `E2` list in `server/world.js`, give it the next list position (no entry in `E2_IDS` is needed — the fixed formula assigns its id), run `npm test` (the stable-id test must stay green), and add its id to the `STABLE_IDS` table. Do not insert, reorder or remove anything above it.
