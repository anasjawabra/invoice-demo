# Dashboard redesign (`/insights`) — 5 Nov 2026

## Inventory: kept / merged / moved
| Section before | Decision |
|---|---|
| Title + subtitle (period · scope) + filter chips + «invoices issued…» line | **Merged**: one title + export; the filter chips are the single shared filter area; ONE scope-and-cutoff line below them |
| Six KPI tiles (5 + 1 isolated) | **Kept**, same six metrics and definitions, 3 × 2 grid (2 × 3 on tablets, 1 column on phones); sub-lines state the formula (gross − exclusions, net − collected, collected ÷ net) |
| Stacked relation bars («gross = exclusions + net …») | **Removed**: it repeated the six cards |
| «To date» toggle | **Kept** under the KPIs (only where a closed period has a to-date variant) |
| Decision-room preview at the top | **Moved** to the end as «الإجراءات ذات الأولوية» (compact preview + link); scores are now labelled (High / Medium / Low priority, with the 0–1 score and its factors in a tooltip) |
| Monthly cumulative chart | **Kept** as the one trend chart: explicit basis (cumulative, oldest → newest; net by issue month, collected by payment month), unit stated, last point reconciled to the cards |
| Entities table | **Kept** in «تفصيل الأداء» (tab 1); five decision columns, two secondary measures behind «more measures»; size column no longer mixes count and amount on one line |
| (new) revenue-source table | **Added** as tab 2 of «تفصيل الأداء», from the same snapshot as the KPIs; no per-source target; change in percentage points |
| Analysis: heading + entity/source selectors, four «answers», KPI row | **Removed**: duplicated the page filters, the KPIs and the decision room (concentration = share columns; follow-up = decision room; improving/declining = the chart + the Changes tab; rate / attainment / deviation = KPI cards and Planning) |
| Map (interactive) | **Kept** as «الخريطة الجغرافية»: its measure and source buttons are explicitly local («للخريطة فقط»); the map source buttons disappear when the page already filters one source; the side summary no longer repeats the collected amount; a **table alternative** was added; the housing sector stays outside the geographic regions |
| Details / Changes / Heat matrix / Analytic summary tabs and «limits» note | **Moved** into one collapsed drill-down «تحليل تفصيلي» (opens when a region, entity or change is picked) |

## Financial meaning (unchanged)
Net = gross − exclusions · uncollected = net − collected · rate = collected ÷ net × 100 (zero denominator → «غير متاحة», never 0%). The KPIs and the breakdowns use the **issue-period** basis (collected on the period's invoices); attainment / deviation (payment-date basis against the appropriation) stay in the drill-down and in Planning and are labelled as a different basis. Percentage changes (%) and percentage-point changes (pp) are labelled separately. The entity comparison and the map use the national snapshot of the same period; no per-source target is invented.

## Validation
`npm test` (208 + chat + decisions + furas) passes: the existing reconciliation tests cover «breakdowns add up to the totals» for entities and sources. Browser: six cards in a 3 × 2 grid, one scope line, one H2 per section, no horizontal overflow at 375 px, Arabic and English, region click opens the drill-down, map table alternative lists regions and the housing sector separately.

## Unresolved
* The map still compares all Amanahs across the Ministry for the selected period; an Amanah / municipality page filter focuses the KPIs, the chart and the breakdown but does not hide the other regions on the map (by design: a map of one region is not a comparison).
* Hugeicons / the MOMAH guideline are not available locally: app tokens and existing icons were used.
