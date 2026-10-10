# Enforcement management, status semantics and return journeys (branch `enforcement-order-matching`)

Synthetic-data demonstration; not production-ready. Builds on `docs/full-page-records.md`. `demo-baseline-final` unchanged; nothing pushed or merged.

## 1. «إدارة التنفيذ» — primary entry and landing
Navigation: **Dashboards & reports · Planning · Enforcement management** (primary), then the operational submenu. Landing `/enforcement` (`EnforcementHome.jsx`) owns no data: it composes the existing relationships (`relations.js`, `orderMatching.js`) and the existing order list (`EnforcementOrders.jsx` is now its «Orders» view). `/enforcement-orders` and `/sanad-orders` redirect; order pages stay `/enforcement-orders/:n`.

**Counts, each defined on the page.** Orders (each once): all · in execution (proceeding) · suspended (open, **not** proceeding) · closed (says nothing about payment). Invoices (each once, even with several orders): under an order in execution · only suspended orders · referred before with all orders closed · **ever referred** (the three; confirmed links only). Contracts: **directly referred** (a Sanad order names the contract number) · **with referred invoices** (own invoices carrying a confirmed order). Exceptions: orders needing review.

**Views.** *Orders* (search/filters; three completeness states) · *Referred invoices* (payment status and remaining beside the separate enforcement chips and the orders) · *Related contracts* (the two contract facts side by side) · *Review exceptions* (7 typed exceptions with definitions and counts: no references · unaccounted references · proposals awaiting confirmation · conflicts no evidence resolves · unread pages · amount difference · contract-level request without invoices; click a type to filter the orders).

## 2. Status semantics (corrected)
Four dimensions, never merged: **payment / remaining balance**, **historical referral**, **open enforcement case**, and within it **in execution vs suspended**. The uncollected classification (`cls`, `payStatus`, the Noncollection categories, the collection worklist) follows the **payment state only**. Before, an open or suspended order moved an invoice into an «enforcement» category and a closed order moved it back — which could drop an unpaid invoice from the uncollected view; this is removed (the class no longer exists as a category; `noncollection.enforcement` is kept at zero for compatibility). A cancelled-in-source invoice with **any** confirmed referral (closed included) stays an uncollected invoice. Enforcement is reported by `stock.enforcement` (unique invoices: in execution / suspended / closed-only / ever referred, with remaining amounts), by the invoice-list filter (an order in execution · only suspended · referred before, all closed · ever · never), and by tags on rows. Tests assert: unchanged category, `payStatus`, net uncollected and identities for every link status; unchanged overdue count when an order closes; the cancelled-invoice case; the filters.

**Not resolved — Sanad's official statuses.** The demo feed has three statuses (قيد التنفيذ / موقوف / مغلق). Sanad's real status codes, who suspends and why, partial execution, settlement/cancellation reasons and the closure reasons the live feed provides are **unknown**; the mapping must come from Sanad's specification (integration dependency). Until then «suspended» is shown as «open, not proceeding» and a closure reason is shown only when the feed gives one («unknown» otherwise).

## 3. Contracts
Two facts, never implied from each other: *directly referred* (source evidence: a Sanad request carries the contract number — shown with the order) and *invoices referred* (x of y invoiced installments carry a confirmed order, from the contract's own schedule). A contract is never linked by amount or payer name; invoices without a contract remain fully supported.

## 4. Return journeys
Collection, Risk and Noncollection now restore their filters, page and scroll like Invoices, Contracts and Orders (all via `returnContext`). Scroll restoration retries until the page has grown (up to ≈ 6 s) and uses timers, not animation frames; record pages open at the top. A real bug surfaced and was fixed: the invoice-list cache ignored link *status* changes.

## 5. Verification (isolated origin 127.0.0.1:3000; start/end: localStorage empty, IndexedDB deleted, list/scroll memory cleared; `localhost:3000` untouched)
| Check | Result |
|---|---|
| Primary entry | «إدارة التنفيذ» between planning and the operations menu; landing counts as above (28 orders: 17 / 4 / 7; invoices 8 / 6 / 7 / 21; contracts 4 / 4) |
| Closed order keeps an unpaid invoice uncollected | INV-2026-0000076 (order EN-5026 closed): *Due and overdue* + tag «referred before»; filter «all orders closed» lists it |
| Suspended separate | filter «suspended» → 2 invoices tagged «order suspended»; chip «Only suspended orders — not proceeding»; landing «Open but NOT proceeding» |
| Collected invoice with an order in execution stays collected | INV-2026-0722 / 0635 shown *Collected* + «order in execution» |
| Contracts | CT-2023-0013: «Directly referred by 1 order (EN-3100, closed)» **and** «3 of 21 invoiced installments carry a confirmed order»; CT-2023-0048: no order names it, 2 of 16 invoices referred |
| Return journeys | Collection (chip «Not yet due · 23» + scroll 1899 → 1899), Risk (chip + 927 → 927), Noncollection (filter *overdue*, page 2/4, 1855 → 1855), Orders (status *open*, 2342 → 2342); record pages open at scroll 0 |
| Inventory of former drawer entry points | 15 pages scanned (dashboard, planning, invoices, collection, risk, noncollection, contracts + page, the four enforcement views, order page, invoice page, data sources): **0 legacy addresses** (`?id=`, `?no=`, `/sanad-orders`, `/investment-invoices`, bare `/enforcement-orders`), **0 dialogs/drawers**; record links found: invoices 6–38 per list, orders up to 28, contracts 7 |
Automated: `npm test` **104 passed** (84 baseline); build ok; `npm run verify:exports` 100 %.

## 6. Remaining dependencies
Live Sanad retrieval and PDF retrieval; **real OCR** (pending — see `docs/ocr-integration-assessment.md`, `docs/old-ocr-review.md`); **Sanad's official order statuses and closure reasons**; Arabic-PDF accuracy on real documents; server-side store with identity/audit (F-19); screen readers and other browsers unverified. EQ2–EQ6, EQ9, logo/Figma/icon licence unresolved.
