# IIM v2 — implementation status (after the meetings of 18 and 19 Oct 2026)

Branch `feat/iim-v2` (local; branched from `feat/iim-oct18-review`; nothing pushed or merged). Plan: `docs/iim-v2-full-plan.md`. Tests: 149 passing; `npm run build` passes.

## Decisions applied (defaults — the questions were answered «لا يوجد أي معلومات», so the recommended defaults were used)
| # | Applied | Where to change |
|---|---|---|
| Q1 / S9 | An invoice cancelled in Sadad because it was referred stays in إجمالي المفوتر and is excluded as «منفذ ضده – قضايا (سند)»; no «ملغاة ومحالة» | `REFERRED_CANCELLED_STAYS_BILLED` in `src/data/iim.js` |
| Q2 / S12 | «إفادات الأمانات» (`ATT-1`) and «التعديات / استغلال المواقع» (`ENC-1`) are separate reasons | `EXCLUSION_RULES` in `revenueMetrics.js`; assignment in `server/world.js` |
| Q5 | «التحديات» is a section of the product page, not a page | `src/pages/ProductPage.jsx` |

## Status per action (v2 numbering)
| ID | Status | Notes |
|---|---|---|
| 01–05 | Done | `entityType` (أمانة/جهة), products incl. شاشة إلكترونية / رسوم الأراضي البيضاء / الأنظمة الداخلية, ten exclusion reasons, S9, KPI module. |
| 06 labels | Done | تصفية · الاستثمار (فرص only as a product) · الأمانة / الجهة · نسبة التحصيل · التغيرات. |
| 07 | Done | The «ملغى» indicator is gone; payment status shows only محصلة بالكامل / مستحقة متأخرة / لم يحن استحقاقها. |
| 08 | Done | «يحتاج انتباه»: top item + ranking of all sources (uncollected × shortfall from the collection-rate target), follows the selected الأمانة / الجهة. |
| 09 | Done | «الأداء الشهري للإيرادات» cumulative; last point = the cards (tested); closed months do not move. |
| 10 | Done | Lowest collection rate first; map legend «نسبة تحقيق المستهدف» / «نسبة التحصيل (لا تتجاوز 100%)»; target in the tooltip. Map geometry unchanged (S13). |
| 11 | Done | Year-on-year heading «التغيرات»; ranked by value with the % beside it. |
| 12 | Done (PDF via print) | «طباعة / تصدير PDF» with the current filters. |
| 13 | Done | No spending metrics anywhere; budget and coverage = collected ÷ budget. |
| 14 | Done | «المستهدفات»: coverage / collection-rate / billing per الأمانة / الجهة, monthly split, derived target, saved on the device with «آخر تعديل». |
| 15 | Done | «أين نحن من الخطة»: target · estimate · actual, probability, «أين نركز», reasons, deviation; labelled «تقدير تجريبي – للعرض التوضيحي». |
| 16–22 | Done (v1) | Lists and invoice page; the uncollected card opens إدارة الاستبعادات. |
| 23 | Done | `/exclusions`. |
| 24 | Done (first version) | `/products` + `/products/:key`; Furas page: contract values, receivables to date, collected, expected, contracting growth, asset link placeholder (no valuation invented). |
| 25 | Done | «الفواتير القابلة للإحالة» view; «ملغاة ومحالة» removed; period filter on orders; orders show their own request number. |
| 26 | Done | ✓/✗ criteria, partial match, confidence score (% + level), manual upload kept as the labelled interim path, automatic retrieval shown as a disabled future step. |
| 27 | Done | Licences prepaid (100 %); referred-and-cancelled fixture; all ten reasons used; entity types. |

## Not done / to confirm
- Dashboard export is the browser's print-to-PDF (one format).
- The estimate is a demonstration; it is not a model.
- The budget figures are illustrative (`src/data/appropriations.js`); the real file replaces only that table.
- The two new reasons (Q2) and S9 (Q1) are defaults awaiting the business's confirmation.
- Smart-report formats (D36) were not touched.
