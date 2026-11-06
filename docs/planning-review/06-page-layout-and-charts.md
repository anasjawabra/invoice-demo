# 06 — Proposed page layout and chart decisions

The page must answer, in this order: **Are we on track? · What is the expected year-end outcome? · Which entities/sources contribute most to the gap? · Where do we act first? · What does the evidence say?** (§9/§10 of the request). All proposals are **[R]**; the current-page facts are **[V]** from 01.

## 1. Hierarchy: proposed vs existing — section mapping
| # | Proposed section | Replaces / reuses | Action |
|---|---|---|---|
| 1 | **Context bar** — year · entity · (source) · target version & status · plan profile («افتراض: توزيع متساوٍ» / «معتمد») · reporting cut-off · data freshness | `LocalFilterToolbar` (`PlanningArea.jsx:97-104`), the basis note (`:79-86`), the definitions line (`:96`), the budget line (`:101-102`) | **merge**: keep toolbar; add the basis chip row; definitions collapse into «التعريفات» expander; budget moves to the targets section |
| 2 | **Actual vs planned to date** — 3 numbers + status text + one cumulative chart | tiles «المحصّل حتى …», deviation tile (`PlanForecast.jsx:50-54`), chart (`:38-39`) | **merge + move up**; status text new |
| 3 | **Year-end forecast and required pace** — forecast, forecast achievement %, gap bridge, required vs recent vs best month; probability slot (message) | probability tile (`:45-49`), tile «المتبقي للوصول» (`PlanningArea.jsx:140`), reason `pace_short` | **replace**: probability → honest message; remaining merged here |
| 4 | **Contribution to the gap** — sorted horizontal deviation bars by entity; by source: collected and rate only | table «المحصّل حتى اليوم/نسبة التحقق» (`TargetsPanel.jsx:101-136`), map | **new** (shared `hbar`) |
| 5 | **Prioritised actions** — ranked table | «أين نركز» (`PlanForecast.jsx:59-63`) | **replace** (07) |
| 6 | **Factors affecting the target gap** + details | «مبررات…» (`:65-68`), targets editor, monthly split, map + reconciliation table | **rename/restructure**; targets editor and monthly split → collapsed «إدارة المستهدفات»; map → optional |
| – | repeated figures | target appears in 4 places (section 2, tile, forecast tile, map card); achievement in 5 | **remove** duplicates: the target is printed once in the context bar and once in the pace block |
| – | `Budget`, `coverage ratio` tiles | `PlanningArea.jsx:128,130` | **move** to the targets section (budget measures, not performance) |

Result: from ~12 numeric blocks to 6 sections; the only inputs on the performance view are year/entity/source.

## 2. Chart decisions (with reasons)
| Candidate (§9) | Decision | Reason / evidence |
|---|---|---|
| **Cumulative line: actual vs planned** | **KEEP, refine** | the natural «are we on track» view; refine: plan drawn as month-end points **plus the plan-to-date marker at the cut-off**; actual ends at the cut-off (null after, `collectionGoal.js:58`); forecast as a **separate dashed segment** labelled with the method id; plan source shown in the legend («خطة افتراضية متساوية»). Existing `UnitLines.jsx` already supports null-ended series. |
| **Uncertainty band** | **NOT NOW** | a band without a validated interval would be a manufactured precision (05); only the monetary baseline is drawn. Add when `probabilityStatus = supported` (needs a `band` series type in the chart code) |
| **Sorted horizontal bars of monetary deviation by Amanah** | **ADD (primary comparison)** | entity deviations reconcile exactly (Σ = −10,249.43 M, probe2); sorted bars rank by money, which the % map hides (Asir reddest but 5th in money; Jeddah/Riyadh −1.9 bn each). Use the shared `hbar` kind with signed values and a text label per bar («−1.91 مليار · 55 % من الخطة») |
| **By source** | **table/bars of collected share and collection rate only** | no source-level target ⇒ no source deviation can be defined (`revenueAnalysis.js:12`) |
| **Bullet chart** (actual vs planned-to-date vs annual target) | **ADD for Ministry + top-N entities** | three comparable quantities on one axis answer «where are we against plan and against the year» without two percentages; shared `bullet` kind exists and requires a **planning-store target** (`docs/chart-library.md` bullet row); rows without a target are listed in the note |
| **Ranked action table** | **ADD** | the decision surface; replaces the five sentences (07) |
| **Waterfall** | **NO waterfall for causes; only a 3-term bridge strip** | the only exact decomposition by cause is the year-end bridge (behind-at-cut-off + uncovered remaining plan = gap, 02/07) — three numbers fit a one-line strip, not a chart; the entity decomposition is additive but sorted bars show it without implying a process; a driver waterfall would imply the causes add up when the plan side is itself assumed (07 §5) |
| **Map** | **KEEP as optional secondary view, collapsed, measure changed** | mapping/aggregation verified (below); location is context, not the ranking device; colour by **position vs planned-to-date** (collected ÷ planned; diverging scale, text label «متأخر ▼ 55 %») instead of annual %; keep the reconciliation table with the unmapped rows; remove stale «غير المحدد». Alternative if the team wants fewer duplicates: drop it, since the dashboard already offers a map with a «deviation» measure (`revenueAnalysis.js:135`) — but that map is on the 11.5 bn basis until the single basis lands |
| Donut/pie for contributions | **NO** | negative contributions exist (entities ahead) and sorted comparison is the goal |

### Map verification (§9) [V]
| Check | Result |
|---|---|
| Regions vs Amanat vs housing sector vs headquarters | 13 regions are **sums of 17 Amanahs** (`ksaProvinces.js:19-132`); Housing Sector is a separate card «نطاق مستقل عن المناطق»; HQ appears only in the table with no target (`EntityMap.jsx:55-59`) — levels are not mixed |
| Aggregation | region % = Σ collected ÷ Σ target of its Amanahs (`:20`); Ministry card uses the page totals (`:48`) |
| Reconciliation | regions + housing + HQ + remainder = Ministry, to the million; at 70 % target: regions 8,420.88 collected, housing 789.16, HQ 0 → 9,210.04 [V probe2] |
| Unmapped entities | none today; the remainder row «جهات أخرى» appears only if non-zero (`:65`) — **must stay visible, never folded** |
| Scope | with an Amanah selected the map still shows the Ministry (`planInputs.js:11`); in the new design it is always national and highlights the selection |
| Caps | `100%+` text only; true value in the card/table |

## 3. Wireframes (RTL; text is Arabic, English twin keeps the same structure mirrored)
Legend: `[ ]` control · `▓` chart · `░` collapsed.
```
┌ تخطيط إيرادات التحصيل ───────────────────────────────────────────────────────────────┐
│ [العام 2026 ▾] [الأمانة/الجهة: الوزارة ▾] [مصدر الإيراد: الكل ▾]        التعريفات ▸     │
│ المستهدف: 22.89 مليار · مستهدف توضيحي (غير معتمد) · آخر تعديل 6 نوفمبر · سيناريو: الأساس │
│ الخطة: افتراض — توزيع متساوٍ على 12 شهرًا · حتى 6 نوفمبر 2026 · بيانات حتى 6 نوفمبر ✔  │
├─ 2 · الفعلي مقابل المخطط حتى تاريخه ──────────────────────────────────────────────────┤
│ الفعلي 9.21 مليار   المخطط 19.46 مليار   الانحراف −10.25 مليار (−52.7%)  ▼ متأخر عن الخطة │
│ ▓▓▓ خط تراكمي: الخطة (متقطع) · الفعلي (متصل حتى 6 نوفمبر) · التقدير (قطعة منفصلة) ▓▓▓   │
├─ 3 · نهاية السنة والوتيرة المطلوبة ───────────────────────────────────────────────────┤
│ المتوقع تحصيله 10.95 مليار (متوسط أغسطس–أكتوبر)  ·  نسبة التحقق المتوقعة 47.8%         │
│ الفجوة 11.95 = متأخر حتى الآن 10.25 + جزء من المتبقي من الخطة غير مغطى 1.70             │
│ المطلوب 7.60 مليار/شهر (249 مليون/يوم)  ·  الحالي 0.93  ·  أفضل شهر مسجّل 1.20          │
│ احتمالية تحقيق المستهدف: لا تتوفر بيانات كافية لتقدير احتمالية موثوقة   [لماذا؟ ▸]      │
├─ 4 · من يساهم في الفجوة ──────────────────────────────────────────────────────────────┤
│ أشرطة أفقية مرتبة: جدة −1.91 ▬▬▬▬▬▬ · الرياض −1.89 ▬▬▬▬▬▬ · قطاع الإسكان −1.11 ▬▬▬ ·… │
│ (صف «أخرى» = الباقي؛ مجموع الأشرطة = الانحراف الكلي)        المصادر: حصة المحصّل ونسبة التحصيل │
├─ 5 · أين نتحرك أولًا ─────────────────────────────────────────────────────────────────┤
│ # │ الأمانة │ المصدر │ المبلغ القابل للعمل │ السبب │ الإجراء المقترح │ سجلات ◂         │
├─ 6 · العوامل المؤثرة في فجوة المستهدف ────────────────────────────────────────────────┤
│ حقائق مرصودة │ مؤشرات محسوبة (لا تُجمع) │ فرضيات تحتاج تحقق │ فجوات بيانات (منفصلة)       │
├ ░ التفاصيل: جدول الجهات · الخريطة (اختيارية) · إدارة المستهدفات · التوزيع الشهري ───────┤
└───────────────────────────────────────────────────────────────────────────────────────┘
```
English note: same order, left-to-right; the context bar reads «Target 22.89 bn · illustrative (not approved) · last edited 6 Nov · scenario Baseline / Plan: assumption — equal split / Data to 6 Nov»; the probability slot reads «Not enough data for a reliable probability estimate» with the forecast and forecast achievement beside it. Keyboard: every control and the details expanders reachable in DOM order; tables focusable; chart has the existing sr-only table; each status uses text + ▲▼= beside colour.

## 4. States (what each section shows)
| State | Context bar | Sections 2–3 | Sections 4–5 |
|---|---|---|---|
| **Above target** (`C ≥ T`) | «تحقق المستهدف — تجاوز بمقدار X» | deviation vs plan still shown; remaining 0; no pace; no gap | bars show who is behind plan (some entities may still lag); actions list only overdue/blocked balances («لا فجوة») |
| **Zero target** | «لا مستهدف» (existing callout, `PlanningArea.jsx:117-130`) | actual only; no %, no status, no forecast gap | bars hidden; table of collected only |
| **Missing plan** | «لا خطة معتمدة» + the assumed-even banner with a switch «استخدم افتراض التوزيع المتساوي» | deviation shown only if the assumption is accepted | contribution uses the same profile |
| **Partial month** | «حتى 6 نوفمبر» on every figure | plan prorated by days; recent pace excludes November | — |
| **Stale data** | «بيانات حتى 3 نوفمبر (متأخرة 3 أيام)» | all figures `asOf = latest data date`; remaining days from that date | same |
| **Year-end** | «اكتملت السنة» | outcome statement; no required pace, no forecast | final contributions; actions are for next year's carry-over |
| **Restricted user** | «إجمالي الجهات المتاحة لك» + share of the Ministry target computed on the full set | as above | only visible entities |

## 5. Reuse and consistency [R]
Use `MetricTile`, `LocalFilterToolbar`, `PageChart` (+ `hbar`, `bullet`, `line`) and the MOMAH tokens already used (IBM Plex Sans; Hugeicons not available locally, so existing icon set); `PctBadge` stays the only percentage colour scale; no new chart component and no second map implementation.
