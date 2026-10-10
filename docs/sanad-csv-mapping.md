# Sanad enforcement-request extract: field mapping, data review, and the source-style demo (branch `enforcement-order-matching`)

Synthetic-data demonstration; not production-ready. **No record of the real extract is imported or shipped.** This document records the extract's *structure* and an aggregate quality review (rounded percentages, no identifiable values); the demo cases carry synthetic values in the same structure. Builds on `docs/simplified-journey-and-ocr-simulation.md`; keeps the three-step journey, the OCR simulation, the full-page views and the matching corrections unchanged. `demo-baseline-final` unchanged; nothing pushed or merged.

Source reviewed: `New Qadaya View_Tab 1 …_20260901_1425.csv` (UTF-8 with BOM, 20 columns, ≈48.8 thousand rows; 51.4 thousand physical lines because some descriptions span several lines). Code: `src/data/sanadSource.js` (field dictionary, status vocabulary, deterministic adaptation).

> **Round 14 supersedes §3 (status classes), §5 (scientific notation) and §7 (the orders list) — see §11.** Sections 1, 2, 4, 6, 8 and 10 still stand.

## 1. Record grain

* **One row = one enforcement request.** «رقم طلب التنفيذ» is unique per row — it is the Sanad key.
* «رقم طلب المطالبة بالأداء» (claim request) groups requests: ≈36 thousand distinct claims for ≈48.8 thousand rows (mean 1.4, one claim with over a thousand requests).
* «رقم الانفاذ» is **shared by several rows** (≈25 thousand distinct; up to thousands of rows each) and equals the claim number in most rows; **its meaning is not confirmed**, so it is never treated as an invoice, contract or order number.
* **The extract carries no debtor name or identity — only the debtor type** (company / individual / charity / association / administrative body). Invoice-level and payer-level matching therefore cannot come from the structured fields: the payer appears only in the description or in documents. The demo's debtor name is a demo value used to test payer conflicts and is labelled so.
* There is **no «suspended» status** and no amount per invoice: one amount per request.

## 2. Field mapping (column → demo field → where it is shown)

| Source column (as written) | Demo field | Shown | Review note |
|---|---|---|---|
| رقم طلب المطالبة بألاداء | `source.claimNo` | detail | may arrive in scientific notation (≈ a quarter of rows) |
| **رقم طلب التنفيذ** | `source.requestNo` | **list** (key) + title | unique; the demo's `EN-…` key is kept for addresses and links |
| تاريخ المطالبة | `source.claimDate` | detail | date; precedes creation (0.3 % of rows break this) |
| **الأمانة** | `amanahEn` | **list** | always filled (18 values) |
| **البلدية** | `source.municipality` | **list** | **optional: empty in about half**, always empty for some Amanahs → shown as «فارغة في المصدر» |
| رقم حالة الرفع للتنفيذ | `source.statusId` | detail | 33 codes |
| **حالة الرفع للتنفيذ** | `source.statusText` | **list** + header | text verbatim; class provisional (§3) |
| رقم نوع المنفذ ضدة | `source.debtorTypeId` | detail | 5 codes (column name spelled «ضدة» in the source) |
| **نوع المنفذ ضدة** | `source.debtorType` | **list** | type only |
| **تاريخ الرفع للتنفيذ** | `source.raiseAt` / `openedDate` | **list** | date and time; never before creation |
| تاريخ انشاء الطلب | `source.createdAt` | detail | minutes before the referral |
| رقم اسم الموظف منشئ الطلب / اسم الموظف منشئ الطلب | `source.employeeId` / `employeeName` | detail | staff data — to be role-restricted in a real deployment; fictional in the demo |
| **المبلغ** | `amount` | **list** | one amount per request; 11 rows empty/non-numeric; very skewed |
| المبلغ كتابة | `source.amountWords` | detail | free text, not standardised; never used for matching |
| رقم الانفاذ | `source.enforcementNo` | detail | see §1; ≈ 46 % arrive in scientific notation |
| **رقم الفاتورة** | `source.invoiceNo` / structured `refs` | **list** | **empty in ≈ 98 %**; a single value; ≈ 3 in 10 of the filled ones are scientific notation; filled values are numeric (9–11 digits mostly) |
| رقم نوع التنفيذ / نوع التنفيذ | `source.executionTypeId` / `executionType` | detail | ≈ 98 % «عقود او محررات موثقة» |
| الوصف | `description` | detail (read in full) | see §4 |

Remaining fields, the documents and the **manual PDF/Word upload** stay in the order's detail page (step 1 of the journey; «حقول المصدر» section, all 20 columns with their source names and data-quality notes).

## 3. Statuses (33)

Code and text are kept **verbatim**, spelling included (several texts carry source typos). The demo's open / suspended / closed class is **provisional**:

* **closed — stated**: every text beginning «مغلق» (completion of execution, execution done, request left, missing documents, awaiting transfer of funds, execution impossible, no jurisdiction, permanent/temporary stop order…).
* **closed — inferred**: «حكم بعدم القبول الكلي», «طلب غير مقبول», «قرار باثبات ترك طلب التنفيذ», «مسودة محذوفة».
* **suspended — inferred**: only «… تم إصدار امر بوقف المهل». **No source status means «suspended».**
* **open — inferred**: everything else (verification, review, missing-documents request, judicial-circuit stages, execution order issued, central-bank / capital-market services, stop-services order, …). The largest single status (≈ 40 %) is «خدمات البنك المركزي»; the next are closure by completion (≈ 22 %) and request left (≈ 7 %).

«Closed … completed/executed» does **not** mean payment in this solution: closing never implies payment and never erases the referral. These mappings need Sanad's confirmation.

## 4. Description references (what the text carries)

* ≈ 35 % of descriptions contain a long number; ≈ 18 % name an invoice («الفاتورة / الفواتير رقم …»); **12-digit numbers dominate** (they are SADAD-type invoice numbers, which the system already resolves); 14-digit (violation) numbers are rare.
* **≈ 17.7 % of requests carry invoice numbers only in the description** (invoice column empty); only ≈ 0.3 % carry the same in both; ≈ 1.3 % only in the column. Several numbers can sit in one description.
* ≈ 46 % mention a contract and ≈ 42 % mention rent (mostly «دفعة رقم … من العقد رقم …» instalment texts) («إيجار - دفعة رقم … من العقد رقم …»); contract numbers have their own formats (not the demo's `CT-…`). Other frequent templates: fines and penalties, land fees, tobacco fees, housing occupancy fees, «التنفيذ على المدين بمقدار السند التنفيذي».
* Descriptions average ≈ 135 characters, up to ≈ 950; ≈ 3.6 % are multi-line.

## 5. Missing and corrupted values (and how the demo handles them)

* **Scientific notation** («2.414E+11», «9.9E+11») in the claim number, the enforcement number and the invoice-number column: the original digits are **lost**. The system detects it (`isCorruptedNumber`), lists the value as **«رقم فاتورة مشوّه (صيغة علمية)»**, **never matches, pads or repairs it**, adds the exception «رقم فاتورة مشوّه», and lets the reviewer look for the full number in the description or a document.
* Empty municipality is normal; empty invoice number is the norm; empty amount (11 rows) is shown as missing, never as zero.
* Spreadsheet-style identifiers must be handled as **text** (leading zeros, 12+ digits).

## 6. The demo adapted (synthetic, deterministic)

* Every demo case carries the 20-column structure (`adaptSourceCase`, applied to all cases): synthetic request/claim/enforcement numbers, dates in the source's relations, a status chosen **inside the case's class**, debtor/execution types, fictional employee names, amount in words, optional municipality, and a share of scientific-notation identifiers.
* Archetype orders reflecting the real patterns: **`desc_sadad`** (numeric 12-digit invoice numbers only in the description, nothing in the invoice-number field) and **`corrupted_structured`** (structured number corrupted; the description still carries the full numbers).
* Demo orders: **EN-6049** (description-only numeric numbers) · **EN-6056** (corrupted structured number + description). Earlier scenarios keep working; the prepared samples and the Word/PDF samples were regenerated for the new world (`npm run make:samples`, `make:samples:docx`, `make:samples:ar`, `make:samples:prepared`).

## 7. The orders list

One row per enforcement request: **رقم طلب التنفيذ** (with the demo reference), **الأمانة · البلدية**, **نوع المنفذ ضده**, **حالة الرفع للتنفيذ (المصدر)** with its provisional class, **تاريخ الرفع**, **المبلغ**, **رقم الفاتورة (الحقل)**, and **مراجعة المطابقة** — one concise status («لم يتم تحديد أرقام الفواتير — تحتاج مراجعة» · «N فواتير مربوطة» · «N مراجع تحتاج مراجعة») with short extras («صفحة واحدة لم تُقرأ», «يوجد فرق في المبلغ»). Filters: search by request / claim / enforcement number or debtor, status class, **source status**, debtor type, matching review (needs review / complete / incomplete / not identified), extraction, reconciliation.

## 8. ENF-1 — corrected again

The instruction that enforcement must not independently override a cancellation is confirmed, and **a reviewer action does not create an undocumented financial policy**. Therefore:

* **The reviewer action «apply ENF-1» is removed** (and with it the engine path that could change net billed or collectible balances). Nothing — a confirmed order, a closed or withdrawn one, a review note, or a stored decision — changes any amount.
* The **established treatment is preserved**: a source-cancelled invoice stays cancelled and out of net billed in every total; remaining collectible balance stays 0.
* The **cancellation/enforcement conflict stays visible** and flagged («source/enforcement conflict — review required»), on the invoice page, the invoices list (filter and tag), the order page and the landing count.
* **Decisions recorded by the previous build are retained** in the backup/store history (`enf1`, `enf1History`) and shown on the invoice with the note that their **policy basis is unresolved and they have no effect**. EQ3 stays unresolved; ENF-1's conditions and authority are unconfirmed.
* Source cancellation · effective exclusion treatment · payment status · active enforcement · historical referral remain five separate facts.

## 9. Verification

`npm test` **124 passed** (3 new: the 20-column mapping and the status vocabulary; source-style cases — determinism, class fit, date relations, optional municipality, scientific-notation share, amount in words; numeric description-only references and corrupted structured numbers — plus the rewritten ENF-1 test: identical amounts for every order status, with and without a stored decision, identities intact). Browser (isolated origin `127.0.0.1:3000`, start/end: localStorage empty, `ib_enforcement_docs` deleted): the new list (columns, municipality-empty, source status + class), the order page (source-fields table with column names, corrupted number and its chip, summary «تم العثور على فاتورتين — مرجع واحد يحتاج مراجعة», amount in words), and the invoice page of a cancelled invoice with a stored earlier decision (balance 0, no action buttons, history-only note). Screenshot: `docs/screenshots/r13-1-orders-list-source-fields.jpg`.

## 10. Open questions for Sanad / the business

Meaning of «رقم الانفاذ» and why it is shared; whether a debtor identity exists elsewhere in Sanad; the official class of each status (open / closed / suspended) and what «تم إصدار أمر إيقاف خدمات» and «خدمات البنك المركزي» mean for the invoice; the format of the invoice number in the structured column (numeric SADAD-type?) and an export that does not use scientific notation; contract-number formats; ENF-1's conditions and authority (EQ3). Still pending: live Sanad retrieval and attachments, actual OCR, legacy `.doc`.

## 11. Round 14 — corrections and simplification (supersede §3, §5, §7)

### 11.1 Statuses: show the source status, classify only what is stated
* The 33 statuses are shown **exactly as written** everywhere (list, order page, search). Only «مغلق …» is a stated closure (class `closed`). **Every other status is «غير مصنّف»** (unclassified): it is never counted as definitively active, suspended or closed, and no status is called «suspended» — in particular «… تم إصدار امر بوقف المهل» is **not** a suspension (the earlier inference is withdrawn).
* The landing page's expandable breakdown shows two request groups — *closed (the source text says «مغلق»)* and *not classified* — and the order list filters by the exact source status; the demo's synthetic cases use the same vocabulary (a legacy «موقوف» in a synthetic case is folded into «قيد التنفيذ», with the group and its basis recorded in `sourceMeta`).
* Four facts stay separate and independent: **source status**, **current enforcement** (a confirmed link on a non-closed order), **historical referral** (an invoice was ever on an order), and **payment status**. Closing or withdrawing an order never implies payment, never removes the referral history and never changes any balance.

### 11.2 Scientific notation: the exact raw string decides
Decided by string handling only (never `Number`, which cannot hold 12–17 digits exactly):

| Raw value | Verdict | Handling |
|---|---|---|
| `4.08380122907E+11` (mantissa writes all 12 digits) | **exact** — recoverable | raw string preserved; normalised to the 12 digits (SADAD) and matched like any other reference |
| `2.414E+11`, `9.9E+11` (fewer digits than the exponent needs) | **rounded** — digits missing | flagged «رقم غير موثوق»; **never padded, completed, repaired or matched** |
| `1.23456789012346E+17` (longer than the identifier lengths) | **unreliable** | flagged; not matched |
| `0.5E+11`, `1.5E+0`-style forms | not normalised / fractional | flagged; not matched |

* Only an exact value of a known identifier length (12 = SADAD, 14 = violation) is used. A flagged value never creates, confirms or removes a link by itself; the reviewer can look for the full number in the description or a document.
* Quality detail (raw string, how many digits were written vs needed) is on the order page; the list shows only a small alert («رقم غير موثوق»).
* **Limit:** an export that rounded the *last* digit but still wrote all of them cannot be told apart from an exact one by the string alone; the open question for Sanad (an export that keeps the identifier as text) covers it.
* Tests: exact, rounded, long, unreliable, and the generated archetypes `corrupted_structured` (rounded) and `notation_exact` (recoverable — **EN-6298**).

### 11.3 The orders list and the order page (simplified)
* **List** — one row per request: request number (with the demo reference), Amanah · municipality, source status, amount, linked invoices, **one** matching-review status («تحتاج إجراء / تحتاج مراجعة / أرقام غير محددة / مكتملة») and «فتح»; small alerts for an unreliable identifier, an attachment not yet added, an unread page or a financial gap.
* **Filters** — visible: search (request number or invoice reference — **never by debtor identity**), Amanah, matching-review status. Everything else (source status, debtor type, review reason, document read/not read, reconciliation) under «فلاتر إضافية». Active filters appear as removable chips with one «reset all». Filter, sort, page and scroll position are restored when the reviewer returns from an order, an invoice or a contract (and when returning to an order that was itself opened from the list).
* **Landing** — at most four cards, each with its counting unit stated (requests · requests needing action · referred invoices · cancelled-and-referred invoices; they are different units and are never added); the full breakdown is in an expandable section.
* **Order page** — leads with a compact summary (request number, amount, source status, Amanah · municipality, referral date, debtor type), then linked invoices, a financial-discrepancy notice if any, and the next action; the original description is under «الوصف الأصلي»; all 20 source columns are secondary under «بيانات المصدر».
