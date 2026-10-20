# IIM — demo update after the meeting of 18 Oct 2026

Source: `IIM_Demo_Update_Action_Plan.md` (prepared 19 Oct 2026). Branch: `feat/iim-oct18-review` (local; nothing pushed or merged).
Every action below was inspected in code before it was changed. Status = what the demo does now.

## Status per action

| ID | Status | Where |
|---|---|---|
| IIM-01 invoice model | Done. Derived, not stored per invoice: biller, origin, product, GFS account, sub/main class, invoice kind. Stored: one `gfs` column. Discount fields did not exist in the demo model (nothing to remove). `نوع الحساب` is not present. | `src/data/iim.js`, `server/iimRow.js`, `server/world.js`, `server/fixtures.js` |
| IIM-02 invoice id | Done. `{billerId}-{sadad}` everywhere (lists, detail, orders, deviations, contract rows, search, exports, sample PDFs). No `INV-` remains in code or seed data (the three static first-demo invoice PDFs under `public/samples/` still print the old number as text; they are not referenced by the app). | `server/names.js`, `server/engine.js` (`idOf`, `lookupId`, `lookupSadad`) |
| IIM-03 classification | Done. GFS table from the «تصنيف الإيرادات» file; biller override (advertising boards: municipal when billed by 177, investment when billed by an Amanah); unknown code = «غير مصنف», counted. | `src/data/iim.js` |
| IIM-04 exclusion model | Done. The eight reasons of D11/D11a (+ the existing duplicate rule, see OQ-1). Exclusions apply only to uncollected invoices; an exclusion on a collected invoice is ignored and counted as a data warning; a part-collected invoice loses only its remainder. `EXCLUSIONS_AUTO_APPLY = true` (S6). New rule `SND-1` (any uncollected invoice found in Sanad). | `src/data/revenueMetrics.js`, `server/engine.js` |
| IIM-05 one KPI module | Done. `kpiOf(totals)`; invariants tested over 14 filter combinations; «أخرى» changes no KPI. | `src/data/kpis.js`, tests |
| IIM-06 uncollected list | Done. Three cards, reason column and filter, partly-collected removed from the status chips, list includes excluded invoices. | `src/pages/Collection.jsx`, `server/lists.js` (`worklist`) |
| IIM-07 exclusion breakdown | Done. Click إجمالي المستبعد → reason / count / amount / share; rows drill into the filtered list; sums to the card. | `src/pages/Collection.jsx` |
| IIM-08 collected list header | Done. Count + collected prominent, net billed muted with the hint, rate kept, collected by product and by origin (each sums to the total). | `src/pages/Invoices.jsx` |
| IIM-09 origin / product filters | Done in the shared scope bar (so the dashboard, both lists and exports follow). Invoice-type filter appears when tobacco or accommodation is selected. | `RevenueUI.jsx`, `RevenueContext.jsx` |
| IIM-10 search by Sadad number | Done. A Sadad number returns every invoice that carries it; rows show biller id, biller name and Amanah. Two Sadad numbers repeat across billers in the seed. | `server/lists.js` |
| IIM-11 date preset | Done. «من بداية العام حتى نهاية الشهر الماضي» (19 Oct 2026 → 01/01–30/09). | `src/data/periodPresets.js` |
| IIM-12 invoice header and core fields | Done, in the order of the plan; empty fields are hidden. «البلدية الفرعية», licence, ISIC and activity have no source in the demo, so they never show. | `src/pages/InvoicePage.jsx` |
| IIM-13 financial summary | Done. قيمة الفاتورة · حالة التحصيل · تاريخ السداد; no remaining balance, no separate collected figure; no «صافي المفوتر» on the page. | `InvoiceParts.jsx` |
| IIM-14 tobacco / accommodation | Done. تفاصيل الإفصاح; إشغالات (year/month) or فروقات (no coverage period, A3). | `InvoicePage.jsx`, `server/iimRow.js` |
| IIM-15 investment section | Done. «مرتبطة بعقد»، «الدفعة 5 من 17»، «قيمة العقد»; contract drill-down unchanged. | `InvoicePage.jsx` |
| IIM-16 investment flag | Done. Internal → information note; central and in Furas → linked; central and not in Furas → «فاتورة استثمار غير مرتبطة بعقد» with the four causes, listed in المخاطر والانحرافات. | `server/iimRow.js`, `server/lists.js`, `src/data/issueGroups.js` |
| IIM-17 execution orders | Done. Primary action «استرجاع المستند من سند تلقائيًا» → OCR → match, labelled as a simulation; manual upload demoted. Three criteria ✓/✗; anything less is «مطابقة جزئية – تحتاج تأكيد المستخدم» and is not preselected. An order with no linked invoice reads «تحتاج مراجعة». A confirmed link excludes the invoice (SND-1). | `OrderJourney.jsx`, `orderSummary.js` |
| IIM-18 seed data | Done by the generator plus fixtures (see below). | `server/world.js`, `src/data/mock.js`, `src/data/revenueLedger.js` |

## Assumptions kept configurable (A2 of the plan)
S1 list structure kept · S2 three cards · S3 partial removed from the chips · S4 collected header · S5 invoice summary · S6 exclusions applied automatically (`EXCLUSIONS_AUTO_APPLY`) · S7 only biller 177 is central (`CENTRAL_BILLER_IDS`; Housing is billed under 171, internal) · S8 date preset.

## Decisions I had to take (please confirm)
- **OQ-1** The duplicate-invoice rule (`DUP-1`) is not in the meeting's list. It stays on (it was already approved) and appears as «فاتورة مكررة». Remove it if the business does not want it.
- **OQ-2** The classification file has seven main classes: رسوم بلدية، استثمار، جزاءات وغرامات، إيرادات مختلفة، إيواء، تبغ، and «أخرى» (the six codes you sent). Only «أخرى» leaves إجمالي المفوتر (D7); «إيرادات مختلفة» stays in. Account 1431 (الجزاءات والغرامات) is «أخرى» in your table while 1438/1439 are «جزاءات وغرامات» — kept exactly as sent.
- **OQ-3** Cancelled invoices stay a separate deduction (not in the meeting): gross = collected + uncollected + cancelled; net = collected + collectible.
- **OQ-4** Illustrative shares: 38 % of the miscellaneous stream carries the six «أخرى» codes, 3 % carries an unknown code, 14 % of tobacco/accommodation invoices are فروقات.
- **OQ-5** The invoice id uses a 12-digit Sadad number (the plan's example has 10).
- **OQ-6** An invoice found in Sanad is excluded as «منفذ ضده – قضايا (سند)» on top of the Efaa reason when both apply (the primary reason follows the rule priority).

## Seed data
Biller 177 + 17 Amanah billers + 171 (Housing). Duplicate Sadad numbers: `882508100000` and `882605200000` (177 and an Amanah biller). Products: فرص، بلدي، ممتثل، تبغ، إيواء، أنظمة الأمانات الداخلية. All eight exclusion reasons are used on uncollected invoices (test). One exclusion on a collected invoice (`177-882606200000`). One unclassified account (`177-882608010000`). «أخرى» invoices, tobacco and accommodation of both kinds, internal advertising boards (override), partly collected invoices, central investment invoices linked / not linked, and the prepared execution-order scenarios (full, amount discrepancy, no reference).

## Not built (A3)
Mixed-item invoices, coverage period of a فروقات invoice, live integrations, user roles.

## Side effects to know about
- Saved browser state keyed by the old invoice ids (analysis decisions, enforcement links, notes) no longer resolves; the configuration key moved to `ib_rev_cfg4` so the new rule defaults apply.
- Headline totals moved: the confirmed reasons are on by default and «أخرى» is outside إجمالي المفوتر.
- The first-demo sample PDFs `public/samples/invoice_*.pdf` still show their legacy number; they are not used by any screen.
