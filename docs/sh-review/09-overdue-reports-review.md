# 09 — Overdue-invoice reports in Smart Reports: review addendum (R4)

Agent R4 · 2026-11-06 · **REVIEW ONLY — nothing in this addendum is implemented.** No application code, test, `package.json` or data was changed. Probes and screenshots are under `scratch/r4/` and `docs/sh-review/screenshots/190…213`.
Labels: **VERIFIED** (ran / read / saw — `path:line`, number or screenshot given) · **RECOMMENDATION** · **SIMULATION** · **PENDING** · **UNVERIFIED**. All figures are the **synthetic demo baseline** (compact world, 929 invoices, cut-off 2026-11-06, account `demo`); no ministry figure appears here.

**Post-review state (already implemented, not part of this addendum):** the Collected-invoices card «نسبة التحصيل ضمن النطاق», the Exclusions-page refinement, the chart library (picker, 24 types, saved views, exports) and access control (server enforcement + `useReportAccess`) are in the working tree and were exercised as they are now. The working tree was in flux while I worked (at one point the dev server rendered no login page because another agent's edit to `src/data/accessModel.js` broke an import — `DATA_VIEWS`; it recovered minutes later and the affected capture was re-run).

## 0. Verdict in six lines

1. **None of the four reports exists.** «overdue» is not a report intent: the four titles are read as *a status filter «متأخرة» + generic sections* and return the generic «تقرير الإيرادات والتحصيل» (screenshots 190–197). The nearest real content is the non-collection analysis (NC), which is not reachable with overdue wording.
2. **The status filter is the wrong definition.** «حالة الفاتورة: متأخرة» is the *collection class* `overdue`, which silently drops overdue invoices that are partly paid, unlinked or with a missing debtor id: **−15 invoices / −369.41 m SAR** on the 2026 cohort, **−29 / −707.30 m** on the standing balance (Riyadh-only user: 2 of 4 invoices, 13.48 m of 58.09 m). The same filter makes the report show «المحصّل 0 · نسبة التحصيل 0.0 %».
3. **The numbers underneath are sound.** One overdue population (`outstanding>0`, due date present and before the reporting date, after approved exclusions) partitions exactly by Amanah, municipality (incl. direct / not-specified groups) and revenue source, equals the list with due position «overdue» and the NC population — to the riyal, national and restricted (§4). The engine needs **no new calculation**, only the right scope and a report that reads it.
4. **Four defects on the path to the user:** the default period is the *issue* date (hides 65 overdue invoices / 4.43 bn issued before 2026); Smart Reports drill links drop the overdue filter (Jeddah: row 23 → landing 57 → real 29); the supporting-invoice appendix has no debtor/municipality and prints the *product* under «مصدر الإيراد»; undated invoices would print `1970-01-01` / 20,762 days in rows and CSV.
5. **The interpreter drops constraints silently** when the sentence has no cue word like «تقرير» (all four exact titles lack it): «حسب البلدية رابغ», unknown Amanah, «older than 180 days», «منذ سنة» → a national report with no warning.
6. **New actions SH-A35…SH-A40** (6; §8), extending SH-A02, SH-A03, SH-A04, SH-A16, SH-A18; decisions **Q13–Q18** (05 §4).

## 1. Interpretation — the real interpreter on 50 phrasings (+ access, + follow-ups)

**How run (VERIFIED):** `interpret()` of `src/data/reportIntents.js` (+ `interpretChat` of `chatIntents.js`, which returned `null` for all 50: no chat intent matches), esbuild-bundled probe `scratch/r4/interp.mjs` (`.test-build/_r4_interp.mjs`, deleted afterwards), today = 2026-11-06, results in `scratch/r4/interp.json`. «Overdue report» recognised as an intent? **No.** The words are consumed by three unrelated mechanisms: the status vocabulary `STATUS_WORDS` (`reportIntents.js:124`, applied only when the sentence also contains «الفواتير/invoices/فقط/only», `:394`), the section word «aging» for «المتأخرات/التقادم/arrears/overdue balances» (`:51`, `:64`), and the special case «المتأخرات + حسب مصدر» (`:418`). There is no municipality section word: «حسب البلدية» selects the «الأمانات والبلديات» section (`:52`), the English «by municipality» selects nothing.

**What the generated model contains (VERIFIED, `scratch/r4/models.mjs`, UI 190–197):**

| Request | Sections generated | KPI strip | Overdue content |
|---|---|---|---|
| AR «تقرير عام عن الفواتير المتأخرة» | `aging` | gross 2.94 bn · exclusions 0 · net 2.94 bn · **collected 0** · uncollected 2.94 bn · **rate 0.0 %** · 58 invoices | standing aging 109 invoices / 7.04 bn (class filter), top-8 Amanah balances |
| AR «…حسب الأمانة» / «…حسب البلدية» | `amanah` + `aging` | same | Amanah / municipality tables are *collection performance* (net, collected, rate 0.0 %); heat map of collection rate = 0.0 % everywhere (screenshot 200) |
| AR «…حسب مصدر الإيراد» | `sources` + `aging` | same | sources table of net/collected/rate; no overdue-by-source |
| EN «General overdue invoices report» / «…by municipality» | `executive` | same | an executive summary of the overdue-class cohort («Follow-up opportunity … Rate 0.0 % vs a demo target of 60 %») — no overdue content |
| EN «…by Amanah» / «…by revenue source» | `amanah` / `sources` | same | as the Arabic ones without the aging section |
| Starter chip «حلّل المتأخرات حسب مصدر الإيراد» (landing) | `sources` + `aging`, **no filter** | gross 15.82 bn · collected 8.72 bn | the generic revenue report (screenshot 210) |
| «حلل أسباب عدم التحصيل» | `noncollection` (7 NC sections) | net unpaid · overdue 73 · not yet due 19 | **the only real overdue content** (screenshots 211, 212) |

The report title is always «تقرير الإيرادات والتحصيل» / «Revenue and collection report» (`reportModel.js:315`), never an overdue title; the context chips carry «حالة الفاتورة: متأخرة» and the basis «التحصيل حتى 2026-11-06».

**The 50 phrasings** (kind = what the interpreter returned; «class filter» = `scope.status='overdue'`; period shown only when it differs from the default YTD):

| # | Phrasing | Lang | kind | sections | scope set | Verdict (VERIFIED) |
|---|---|---|---|---|---|---|
| 1 | تقرير عام عن الفواتير المتأخرة | ar | report | aging | status=overdue | generic aging section + class filter; not an overdue report |
| 2 | الفواتير المتأخرة حسب الأمانة | ar | report | amanah, aging | status=overdue | «amanah»+«aging» sections + class filter; collection-performance tables, not overdue |
| 3 | الفواتير المتأخرة حسب البلدية | ar | report | amanah, aging | status=overdue | same as 2 (municipality = the table inside «الأمانات والبلديات») |
| 4 | الفواتير المتأخرة حسب مصدر الإيراد | ar | report | sources, aging | status=overdue | «sources»+«aging» + class filter |
| 5 | General overdue invoices report | en | report | executive | status=overdue | executive summary + class filter (collection rate 0.0 %) |
| 6 | Overdue invoices by Amanah | en | report | amanah | status=overdue | «amanah» only + class filter |
| 7 | Overdue invoices by municipality | en | report | executive | status=overdue | executive only: municipality not recognised as a dimension |
| 8 | Overdue invoices by revenue source | en | report | sources | status=overdue | «sources» only + class filter |
| 9 | الفواتير المتأخرة | ar | report | aging | status=overdue | aging + class filter |
| 10 | المتأخرات حسب الأمانة | ar | report | amanah, aging | — | sections OK, **no overdue filter** at all |
| 11 | تقرير المتأخرات لأمانة جدة | ar | report | aging | amanah=Jeddah | aging for Jeddah (variant-name confirm); no overdue filter |
| 12 | الفواتير المتأخرة في بلدية رابغ | ar | report | aging | amanah=Jeddah, muni=MREF-002-001, status=overdue | Rabigh resolved to Jeddah via the reference (confirm shown) |
| 13 | المتأخر حسب مصدر الإيراد | ar | report | sources | — | «المتأخر» (singular) not recognised: plain sources report, no aging, no filter |
| 14 | overdue invoices by municipality | en | report | executive | status=overdue | executive only (as 7) |
| 15 | overdue by revenue source for Jeddah | en | report | sources | amanah=Jeddah | overdue **ignored**: plain revenue-by-source report for Jeddah |
| 16 | general overdue report | en | report | executive | — | overdue **ignored**: executive summary |
| 17 | أنشئ تقرير الفواتير المتأخرة حسب البلدية لأمانة جدة | ar | report | amanah, aging | amanah=Jeddah, status=overdue | amanah+aging, Jeddah, class filter; municipality dimension not separate |
| 18 | الفواتير المتاخره حسب الامانه | ar | report | amanah, aging | status=overdue | misspelling tolerated; same as 2 |
| 19 | المتأخرات حسب البلدية في أمانة الرياض لهذا العام | ar | report | amanah, aging | amanah=Riyadh | overdue filter absent; Riyadh; YTD |
| 20 | أبغى تقرير عن المتأخرات | ar | report | aging | — | aging, no filter |
| 21 | كم عدد الفواتير المتأخرة؟ | ar | question | aging, status | status=overdue | «question»: answered with a full report (KPI 58 invoices, aging 109) |
| 22 | كم إجمالي المتأخرات؟ | ar | question | aging | — | «question»: aging section, no filter |
| 23 | الفواتير المتأخرة حسب مصدر الإيراد لأمانة الرياض | ar | report | sources, aging | amanah=Riyadh, status=overdue | sources+aging, Riyadh, class filter |
| 24 | الفواتير المتأخرة حسب البلديه في الشهر الماضي | ar | report | amanah, aging | status=overdue, issue-period 2026-10-01→2026-10-31 | period read as ISSUE month (October), class filter |
| 25 | أعمار الديون المتأخرة | ar | report | aging | — | aging, no filter |
| 26 | المتأخرات حسب العمر | ar | clarify | executive | — | **clarify** «unsupported grouping (age)» although an aging section exists |
| 27 | overdue invoices | en | report | executive | status=overdue | executive + class filter |
| 28 | Show me overdue invoices by Amanah | en | report | amanah | status=overdue | amanah + class filter |
| 29 | arrears by Amanah | en | report | amanah, aging | — | amanah+aging, no filter |
| 30 | overdue amounts by source | en | report | sources, aging | — | sources+aging, no filter |
| 31 | overdue invoices for Rabigh municipality | en | report | executive | amanah=Jeddah, muni=MREF-002-001, status=overdue | scope OK (Rabigh/Jeddah, confirm), executive + class |
| 32 | overdue invoices in Riyadh Amanah by municipality | en | report | executive | amanah=Riyadh, status=overdue | Riyadh OK; municipality dimension ignored |
| 33 | create an overdue report for Jeddah Amanah for 2026 | en | report | executive | amanah=Jeddah | **overdue ignored**; Jeddah, YTD |
| 34 | late invoices by municipality | en | report | executive | status=overdue | executive + class filter |
| 35 | past due invoices by revenue source | en | report | sources | status=overdue | sources + class filter |
| 36 | الفواتير المتاخره حسب مصدر الايراد | ar | report | sources, aging | status=overdue | as 4 |
| 37 | الفواتير المتأخره حسب البلدية | ar | report | amanah, aging | status=overdue | as 3 |
| 38 | overdu invoices by amanah | en | clarify | executive | — | **clarify** with 4 status options (good) |
| 39 | overdue invocies by municipality | en | unsupported | executive | — | **unsupported**, no suggestion |
| 40 | الفواتير المتأخرة في بلدية القوز | ar | report | aging | amanah=Jeddah, muni=MREF-002-005, status=overdue | municipality resolved (Qouz, Jeddah) with confirm |
| 41 | الفواتير المتأخرة حسب البلدية رابغ | ar | report | amanah, aging | status=overdue | **«رابغ» dropped silently** — all Amanahs, class filter only |
| 42 | الفواتير المتأخرة لأكثر من 90 يوماً | ar | clarify | executive | — | **clarify** «threshold unsupported»; continue-option text broken («الفواتير المتأخرة يوما») |
| 43 | الفواتير المتأخرة منذ سنة | ar | report | aging | status=overdue | **«منذ سنة» dropped silently** |
| 44 | overdue invoices older than 180 days | en | report | executive | status=overdue | **«older than 180 days» dropped silently** |
| 45 | الفواتير المتأخرة حسب المدين | ar | clarify | executive | — | **clarify** «unsupported grouping (debtor)» |
| 46 | الفواتير المتأخرة حسب تاريخ الاستحقاق | ar | clarify | executive | — | **clarify**; continue-option text garbled («…المتأخرة الاستحقاق») |
| 47 | الفواتير التي استحقت قبل 2026-06-30 | ar | report | executive | issue-period 2026-06-30→2026-06-30 | due date read as an ISSUE period (30 Jun→30 Jun), no confirm |
| 48 | invoices due before 30 June 2026 | en | clarify | executive | issue-period 2026-06-01→2026-06-30 | **clarify** on «due»; period read as June ISSUE month |
| 49 | الفواتير المتأخرة حسب أمانة غير موجودة | ar | report | amanah, aging | status=overdue | **unknown Amanah dropped silently** |
| 50 | الفواتير المتأخرة حسب بلدية الخرج | ar | report | aging | status=overdue | «حسب بلدية الخرج» **dropped silently** (while «تقرير بلدية الخرج» resolves to Riyadh/Kharj) |

**Unauthorised scope (restricted Riyadh-only access, `{access}` GeoScope, VERIFIED, `interp.json › acc`):** «تقرير المتأخرات لأمانة جدة», «overdue by revenue source for Jeddah» and «…في بلدية رابغ» → `clarify` («you don't have access to …», no figure shown) — correct; the offered option contains a duplicated noun: **«تقرير المتأخرات لأمانة أمانة الرياض»** (defect). «الفواتير المتأخرة حسب الأمانة/البلدية» → report, scope line «كل ما تتيحه صلاحيتك (أمانة واحدة …)» (screenshot 208).
**Follow-ups on an overdue report (VERIFIED):** «حسب البلدية» replaces `aging` by `amanah` (the overdue section disappears); «by municipality» (EN) is `unsupported` in the probe and in the UI creates a «Report for the current scope» v2 with no municipality content (screenshot 206); «لأمانة جدة», «for Riyadh», «حسب مصدر الإيراد» work.
**Questions:** «كم عدد الفواتير المتأخرة؟» is answered with a full report whose KPI says **58 invoices** while its aging table says **109** (true: 73 cohort / 138 standing) — screenshot 205.

**Reading of the table (VERIFIED):** (a) many phrasings that contain «overdue» carry no overdue filter (rows 10, 19, 20, 22, 25, 29, 30 get only the standing aging section) or ignore the word entirely (13, 15, 16, 33 and the landing chip); (b) 8 silently drop a stated qualifier (41, 43, 44, 49, 50 and the English municipality rows 7, 14, 32, whose «by municipality» is ignored); (c) 2 misread a *due-date* phrase as an *issue-date* period (47, 48); (d) the guard that should catch (b) is `unknownTerms` (`reportIntents.js:108`), which only inspects the words after a cue such as «تقرير / for / of / عن / في» (`:106`) — the four required titles contain none, so the unknown qualifier is never examined; with the cue («تقرير حسب البلدية رابغ») the same word **is** flagged (`scratch/r4/interp2.mjs`).

## 2. Existing coverage — every place that shows overdue invoices

| Place | What it shows about overdue | Evidence | Class for the ask |
|---|---|---|---|
| Smart Reports `aging` section | standing balance by 5 age buckets (bucket 0 = not yet due), top-8 Amanah balances; no municipality / source / invoice rows; no links | `reportModel.js:217–229`; 190–193 | **Partially** |
| Smart Reports `amanah` / `sources` sections | collection performance (net, collected, rate), not overdue; row links to `/collection` without any overdue filter | `reportModel.js:182–214`; 200, 201 | **Partially** (wrong measure) |
| Smart Reports `noncollection` section (NC report) | KPI: net unpaid · **overdue count + amount** · not yet due · (due unavailable if > 0); aging bar; overdue by Amanah / source charts + tables; heat map; municipality only as a companion chart; appendix of the 50 largest unpaid invoices | `ncReportModel.js:78–96, 178–192, 241–255`; 211, 212 | **Partially** (best content; wrong reachability, population, columns) |
| NC analysis page (`/analysis/nc-…`, from `/collection`) | overdue by Amanah (top 10) / source / **municipality (top 10)** charts, aging, heat map; every bar drills to the supporting invoices with «يطابق الرقم المعروض» (1 invoice · 70,984,010 SAR ✓); supporting-invoice table with **debtor** («الجهة المفوترة»); CSV of the filter | `ncModel.js:85–95`; `NcInvoices.jsx:67–76`; 203, 204 | **Partially → closest to Fully** (no due-date / source column; cohort only) |
| Uncollected list `/collection` | due-position bar (overdue 73 / 3.31 bn · +52 excluded · not yet due 19 …), segment click filters the list, days overdue, priority; CSV of the filtered rows | `DueBar.jsx`; `lists.js:126–128, 193–195`; 198, 199, 209 | **Partially** (no debtor; list = 125 rows = 73 open + 52 excluded) |
| Dashboard aging chart | standing balance by age (bars not clickable) | `InsightsDashboard.jsx`; 01b, 120 | **Partially** (SH-A01, A02 already cover) |
| Decision Room (`overdue_aging` items) | overdue and aged exposure by Amanah / source with evidence links | `decisionRoom.js:145–170`; 30–36 | **Partially** (link/population mismatch = SH-A04) |
| Fixed reports catalogue «الفواتير غير المسددة والتقادم» | `aging + gaps` sections | `fixedReports.js` | **Unreachable**: `FixedReports.jsx` has no importer (grep) |
| Saved reports | every generated report is saved with versions, scope and cut-off | screenshots 190–197 (v1/v2 bar) | works as a container |

## 3. Coverage: 4 requested reports × requested content

Cell = «what a user gets by asking in Smart Reports today / the closest existing route (NC analysis page and report)». F = Fully · P = Partially · M = Missing · U = Unverifiable. R1 general · R2 by Amanah · R3 by municipality · R4 by revenue source.

| Content item | R1 | R2 | R3 | R4 | Evidence |
|---|---|---|---|---|---|
| Number of overdue invoices | P / P | P / P | P / P | P / P | Smart Reports shows 58 (class filter, 2026 cohort) and 109 (aging); truth 73 cohort / 138 standing; NC KPI shows 73 (cohort only) — 190, 205, §4 |
| Total overdue outstanding (remaining) | P / P | P / P | P / P | P / P | 2.94 bn / 7.04 bn vs true 3.31 / 7.74 bn; NC 3.31 bn, the standing 7.74 bn only in the standing table |
| Aging breakdown | P / P | P / P | P / P | P / P | 5 buckets, 180+ = 74 % of the amount (SH-A02); not-yet-due inside the chart; NC has «unavailable» |
| Breakdown by the report's own dimension | — | P / F | P / P | P / F | R2/R4: NC chart + table with an overdue column; R3: municipality chart (top 10) only, no table in the report (`ncReportModel.js:189–190`); Smart Reports tables are collection performance |
| Debtor | M / P | M / P | M / P | M / P | on screen only in the NC table (204); NC appendix, Smart Reports, list, CSV: none (`ncReportModel.js:248`; `EXPORT_COLUMNS`, `lists.js:389`) |
| Amanah | P / F | P / F | P / F | P / F | NC appendix column; list column «الأمانة · البلدية» |
| Municipality | P / P | P / P | P / P | P / P | list column and NC table yes; NC appendix none |
| Revenue source | P / P | P / P | P / P | P / P | NC appendix header «مصدر الإيراد» prints the **product** («ممتثل» instead of «الغرامات والجزاءات») `ncReportModel.js:249`; NC screen table has no source column |
| Due date | M / P | M / P | M / P | M / P | NC appendix yes; NC screen table no; list: expanded row only |
| Days overdue | M / F | M / F | M / F | M / F | NC table, appendix, list column |
| Remaining balance | M / F | M / F | M / F | M / F | NC «غير المسدد» / list «غير المحصّل» are remaining amounts (partly-paid rows keep their remainder) |
| Suitable visualization | P / F | P / F | P / P | P / F | ranked bars, aging, heat map exist in NC (203); Smart Reports charts show collected vs net (200) |
| Data table | P / P | P / P | P / P | P / P | NC tables for Amanah and source; none for municipality; none overdue-only in Smart Reports |
| Invoice drill-through | P / F | P / F | P / F | P / F | NC page: bar → invoices, reconciled (204); Smart Reports links lose the overdue filter (201); NC report and aging tables have no links |
| Export | P / P | P / P | P / P | P / P | five formats with context chips (status, basis); appendix capped at 50 (`NC_APPENDIX_ROWS`, `ncReportModel.js:28`); list CSV streams all filtered rows but has no debtor, no reporting date |
| Reporting date shown | P | P | P | P | «بيانات حتى / التحصيل حتى 2026-11-06» present as data date; never as «overdue measured at» |
| Issue-date vs due-date filters distinguished | P | P | P | P | scope panel labels «الفترة · تاريخ الإصدار» (202); **no due-date filter exists**; default YTD hides older overdue |
| Missing due date kept separate | M (aging) / F (NC) | same | same | same | NC: «unavailable», never overdue (`noncollection.js:100–103`); snapshot/aging counts it as 180+ (§5, fixture) |
| Municipality options depend on Amanah | F | F | F | F | municipality control disabled «اختر أمانة أولاً» until an Amanah is chosen (202) |
| Access scope applied | F | F | F | F | restricted org: only Riyadh in every table, 13.48 m / 131.17 m (208); engine parity §4 |
| Filters preserved chart → table → drill → export | P | P | P | P | NC chain: 29 / 819,133,660 in chart, drill and CSV (29 rows) ✓; Smart Reports chain loses status/due (§4) |
| Unspecified municipality / source visible | F | F | F | F | explicit groups «مباشر على الأمانة», «بلا بلدية (غير محددة في المصدر)» are separate rows/bars; no unspecified revenue source exists in the data |

## 4. Numbers: one overdue population, five views (VERIFIED, `scratch/r4/recon.mjs`, `chain.mjs`, `allper.mjs`, compact world, cut-off 2026-11-06)

Definition used for «overdue collectible»: `outstanding > 0` (not cancelled, not excluded by an approved rule, remaining = billed − received) ∧ due date present ∧ `daysOverdue = max(0, cutoff − (due + grace)) > 0`.

| View | 2026 issue cohort (default period) | Standing, all issue periods | Riyadh-only user, cohort |
|---|---|---|---|
| **NC analysis `populations.overdue`** | 73 · 3,309,903,873 | **138 · 7,743,038,344** (`allper`) | 4 · 58,091,018 |
| List `state=open`, `dueState=overdue` | 73 · 3,309,903,873 ✓ | 138 · 7,743,038,344 ✓ (`allPeriods`) | 4 · 58,091,018 ✓ |
| Snapshot `stock.overdue` (standing) | — | 7,743,038,344 ✓ | 222,914,563 standing (list 8 ✓) |
| Σ NC by Amanah / municipality / source | 3,309,903,873 each ✓ | 7,743,038,344 each ✓ (rows: 12 Amanahs · 49 municipality groups · 7 sources; all-period NC: 14 · 56 · 7) | 58,091,018 each ✓ |
| Σ aging (NC 1–30…180+) | 3,309,903,873 ✓ | five proposed overdue buckets 412.51 m + 322.02 m + 824.01 m + **2,431.22 m (181–365, 38 inv)** + **3,753.27 m (>365, 54 inv)** = 7,743,038,344 ✓ | — |
| Per-Amanah / source / municipality parity vs the list (every row) | max difference **0 SAR** (12 + 7 + 43 rows) | — | 0 |
| **Smart Reports phrasing (class filter `overdue`)** | **58 · 2,940,491,690** ✗ | 109 · 7,035,740,770 ✗ | 2 · 13,475,880 ✗ (standing 4 · 131,165,770 ✗) |
| Collection page, segment «متأخرة» | **125 rows = 73 open + 52 excluded**; open amount 3,309,903,873 ✓ | — | 11 rows (4 + 7 excluded) |
| API without the browser's Sanad links (`/api/list`) | 124 rows = 73 + 51; the UI shows 125 / 54 excluded because the page attaches the demo Sanad cases (1 invoice, 0.36 m) — overdue net unchanged | | |

**What the class filter drops (VERIFIED, `scratch/r4/classes.mjs`):** cohort — partial 11 / 283.57 m, linkage-unresolved 3 / 85.58 m, ineligible-referral 1 / 0.27 m = 15 / **369.41 m**; standing — partial 24 / 554.46 m, linkage 4 / 152.57 m, ineligible 1 / 0.27 m = 29 / **707.30 m**. Partly paid invoices are counted correctly (by remaining amount) in NC / list / `dueState` — 13 partly-paid overdue invoices in the cohort, 322.52 m remaining, 277.87 m already collected — and **excluded** from «متأخرة».
**Excluded overdue** (approved rules) stays out of the collectible overdue and visible apart: cohort 52 invoices / 2.616 bn, standing **134 / 6.896 bn** (`facets.due`); «not yet due» 19 / 579.63 m; undated 0.
**Zero-overdue state (VERIFIED):** Al-Ahsa Amanah has 0 overdue and 2 not-yet-due invoices (57.64 m) → the report says «لا فواتير في هذا الاختيار؛ البيانات غير متاحة وليست صفراً» (screenshot 213) — wrong for «no overdue».

**Chain on one scenario (Jeddah Amanah, 2026 cohort):** NC chart value 819,133,660 → NC drill list 29 invoices / 819,133,660 ✓ → CSV of that filter 29 data rows ✓ → Collection segment «متأخرة» 50 rows (29 + 21 excluded) / 819,133,660 ✓. **Smart Reports row «أمانة محافظة جدة»: 23 invoices / 0.63 bn → its link lands on 57 invoices (34 open + 23 excluded), overdue part 29 / 819.13 m** (screenshots 200, 201). Lost on that hop: the overdue filter (status / due position) and the all-periods choice; kept: period, Amanah, source, municipality (`reportModel.js:86` builds only `from,to,amanah,src,muni`; `Collection.jsx:49–54` reads only those + `category`).

## 5. Definition check — traced end to end

| Rule asked | Where it lives | Verdict |
|---|---|---|
| due date < reporting date, remaining > 0, after exclusions | `engine.js:221` `overdueDays`; `noncollection.js:100–103` (`o.overdue`), `:176–206` populations; `lists.js:126–128` `dueClassOf`; `lists.js:179` `state=open` | **VERIFIED correct** in NC and list; the *report path* uses the class filter instead (`engine.js:282–287`) → wrong |
| Remaining amount, not invoice value | `D.outstanding = max(0, billed − received)` (`engine.js:217`); partial invoices keep their remainder | **VERIFIED** (13 partly-paid overdue, remaining 322.52 m) |
| Excluded invoices out of «overdue collectible», still visible | `noncollection.js:200` (`excludedUnpaid`), `lists.js:206–207` («+N مستبعدة» per bucket) | **VERIFIED**; but the Collection segment export contains the excluded rows (125) |
| Missing due date separate, never overdue | NC: `dueMissing` → `due='unknown'` (`noncollection.js:100–103`), list `dueClassOf` = 2, priority «unknown». Snapshot / aging: `overdueDays(cutoff, 0)` ⇒ about 20,762 days → **bucket 180+ and `stock.overdue`** | **VERIFIED by in-memory fixture** (`undated.mjs`; one invoice's due date blanked in the probe process only): NC overdue −268,000 and «unavailable» +1; `stock.overdue` unchanged (still counted overdue); the list row shows **`dueDate 1970-01-01`, `daysOverdue 20762`** (`lists.js:85`), also in the CSV (`days_overdue`) and the NC appendix. The world has **0** undated invoices, so none of this is demonstrable on screen. Snapshot part already recorded as SH-A02; the row/CSV/appendix values are new → extension of SH-A02's acceptance and SH-A38 |
| Grace period | `lateness.js:12`, `cfg.graceDays` default 0; effect (VERIFIED): standing overdue 7.743 bn (0 d) → 7.493 bn (10 d) → 7.331 bn (30 d). Not stated in any report text; open decision Q5 (EQ2) | **Partially** |
| Reporting date visibly displayed | «بيانات حتى 2026-11-06» (saved-report bar), basis chip «التحصيل حتى …»; the CSV context block repeats the basis | **Partially**: data date, not the measurement date of «days overdue» |
| Due-date filter vs issue-date filter | scope panel «الفترة · تاريخ الإصدار» (202); `dueFrom/dueTo` exist nowhere (grep) | **Missing**: «استحقت قبل 30 يونيو» becomes an *issue* period (rows 47, 48) |
| Default population | YTD issue date | **Gap**: cohort 73 / 3.31 bn vs standing 138 / 7.74 bn — **65 invoices / 4,433,134,471 SAR** issued before 2026 are overdue and hidden by the default (same figure as SH-A01's carry-over) |
| Debtor in rows / appendix / CSV | row object has `payerAr/En` (`lists.js:82`); uncollected list columns: الفاتورة · الأمانة·البلدية · المنتج · غير المحصّل · حالة السداد · أيام التأخر · الأولوية — expanded row: net, product, source, system, origin, item, amount, issue date, due date, next step (209); NC screen table has «الجهة المفوترة»; **NC appendix and `EXPORT_COLUMNS` have none** | **VERIFIED, still open** (SH-A03) |
| Municipality options depend on the Amanah | municipality select disabled until an Amanah is chosen (202) | **Fully** |
| Restricted user | every probe with a Riyadh-only GeoScope returns Riyadh rows only in all dimensions; UI 208 | **Fully** |

## 6. Specification (RECOMMENDATION) — one report, four entry points

**Smallest coherent delivery:** a new section key `overdue` in the existing report-model engine, fed by the **existing** `nonCollectionAnalysis` run on an *all-issue-periods* scope (proved to reconcile: 138 / 7,743,038,344, 20/20 NC checks, Σ dimensions equal) and the existing list for the appendix; a spec field `overdueBy ∈ {all | amanah | municipality | source}` chooses which dimension chart/table leads. No second calculation, no new endpoint except the optional due-date filter. The four titles are four entry points (starter chips, phrasings, follow-up chips «حسب البلدية»…).

| | R1 General | R2 By Amanah | R3 By municipality | R4 By revenue source |
|---|---|---|---|---|
| Title AR / EN | تقرير عام عن الفواتير المتأخرة / General overdue invoices report | الفواتير المتأخرة حسب الأمانة / Overdue invoices by Amanah | الفواتير المتأخرة حسب البلدية / Overdue invoices by municipality | الفواتير المتأخرة حسب مصدر الإيراد / Overdue invoices by revenue source |
| Leading chart (existing kinds) | `bar` aging (ordered, additive, whole = overdue) + `hbar` ranked by Amanah (top-N + «Other») | `hbar` ranked by Amanah | `hbar` ranked by municipality incl. explicit groups, parent Amanah in the label when several Amanahs | `hbar` ranked by source; `treemap` / `donut` allowed (whole = overdue) |
| Always present | KPI strip · reporting-date line · aging bar · table of the report's dimension · invoice appendix · export | same | same | same |
| Dimension table columns | Amanah (summary) | Amanah · overdue invoices · overdue remaining · share · longest overdue days · of which > 365 days · «+ excluded (separate)» | municipality (status chip: mapped / direct / not specified / needs review) + Amanah, same columns | revenue source, same columns |
| Drill (SH-A39) | KPI → list `dueState=overdue` | row → overdue + Amanah | row → overdue + Amanah + municipality key | row → overdue + source |

**KPIs (strip):** overdue invoices (count) · overdue remaining (SAR) · share of net unpaid · longest overdue · *separate dashed tiles*: not yet due · excluded overdue (approved rules) · due date unavailable (only if > 0). No collected amount and no collection rate in an overdue report.
**Charts:** only existing kinds; aging uses the ordered axis (no Pareto, SH-A16 a); ranked bars carry `dim.whole` = overdue total so share types and the «Other» fold are valid; Amanah × age heat map optional (existing).
**Appendix columns (SH-A38):** invoice (linked) · debtor · Amanah · municipality · revenue source · due date · days overdue · remaining; top 50 by remaining in the documents with «N of total» and the link/CSV for all rows.
**Export:** the existing five formats with a context block (reporting date, issue-date window, due-date window, grace, due position, scope incl. the access summary); CSV/XLSX appendix carries **all** overdue rows (streamed), PDF/PPT/Word the top 50.

**Metric definitions (RECOMMENDATION):**

| Metric | Definition / formula | Fields | Grain | Date basis | Filters | Missing / edge |
|---|---|---|---|---|---|---|
| Overdue invoice count | invoices with `remaining>0`, not excluded/cancelled, due date present, `days>0` | billed, received, exclusion, cancel flags, due | invoice (composite key) | reporting date (= data cut-off) + grace | scope ∩ access; issue window (default all); due window (optional) | undated → separate tile; excluded → separate tile; partly paid counted by remainder |
| Overdue outstanding | Σ `max(0, billed − received)` over the above | same | invoice | same | same | zero overdue → «لا توجد فواتير متأخرة» (not «غير متاح»), still showing not-yet-due |
| Days overdue | `max(0, reportDate − (due + graceDays))` | `due`, `cfg.graceDays` | invoice | reporting date | — | undated → blank (never 20,762) |
| Aging buckets | not due · 1–30 · 31–90 · 91–180 · 181–365 · > 365 · due unavailable (SH-A02) | days | invoice | same | same | Σ buckets = overdue + not yet due + unavailable |
| Unspecified municipality / source | explicit groups «مباشر على الأمانة», «بلا بلدية (غير محددة في المصدر)», «تحتاج مراجعة», «غير محدد» | `municipalityStatus`, source | invoice | — | — | never merged, never assigned to a municipality |

**Interpreter additions (SH-A40):** phrases → `overdue` section with `overdueBy` (aliases: «الفواتير المتأخرة», «المتأخرات», «المتأخر», «arrears», «overdue (invoices|amounts|balances)», «past due», «late invoices»; dimension words «حسب الأمانة/البلدية/مصدر الإيراد», «by Amanah/municipality/(revenue) source»; «general / عام / تقرير عام»); it never writes `scope.status`; the unknown-term guard runs for every sentence that contains an overdue term, not only after a cue word; an unauthorised or unresolved Amanah/municipality is always asked about; due-date phrasing («استحقت قبل … / due before …») maps to the due-date window, never to the issue period; thresholds («لأكثر من 90 يوماً») map to the age filter the list already supports (`ageMin/ageMax`, `lists.js:184`) or are asked about with a correct continue-option. No retired-terminology alias is needed (the retired word «المقبوضات» is unrelated; SH-A18 stays the single alias module).

**Acceptance criteria (shared by SH-A35…A40):** (1) KPI, ranked chart, table, drill-through list, CSV and appendix total reconcile for national and Riyadh-only access (use the §4 numbers: 138 / 7,743,038,344; 73 / 3,309,903,873 for 2026 invoices; 4 / 58,091,018 Riyadh); (2) Σ Amanah = Σ municipality (incl. explicit groups) = Σ source = Σ buckets = KPI; (3) Arabic and English titles/labels, RTL, 375 px; (4) a restricted user sees only authorised rows, labels and links; (5) a fixture invoice with a blank due date appears only in «due date unavailable», never in overdue or a day bucket, and prints «—» (no 1970 date); (6) a partly paid invoice counts with its remaining amount; (7) zero overdue says so and still shows not-yet-due; (8) 1000+ overdue invoices: CSV/XLSX contain every row (streamed), the document appendix says «top 50 of N» — **UNVERIFIED here** (the compact world has 138; the export-parity script ran 3,291/3,291 on the full world per 01 §0); (9) every phrasing in §1 rows 1–50 either builds the right report or asks a precise question — none drops a constraint.

## 7. Annotated placements and the wireframe (RECOMMENDATION — not implemented)

Banner «Proposed change — not implemented / تغيير مقترح — غير منفّذ», header strip with R-number and action ID, numbered callouts; originals untouched (`screenshots/`).

| Action | Image | On original |
|---|---|---|
| SH-A35 | [entry points](annotated/SH-A35-overdue-entry-points-ar.jpg) | 60 landing |
| SH-A35 | [title + KPI strip](annotated/SH-A35-overdue-report-header-and-kpis-ar.jpg) | 191 |
| SH-A35 | [**wireframe**](wireframes/SH-A35-wireframe-ar.jpg) · [current-vs-proposed](wireframes/SH-A35-current-vs-proposed.jpg) | 190b |
| SH-A36 | [status vs due position](annotated/SH-A36-overdue-status-and-due-position-ar.jpg) | 202 |
| SH-A37 | [reporting-date line](annotated/SH-A37-reporting-date-and-issue-vs-due-ar.jpg) · [due-date range](annotated/SH-A37-due-date-range-filter-ar.jpg) | 191 · 202 |
| SH-A38 | [appendix columns](annotated/SH-A38-invoice-appendix-columns-ar.jpg) · [NC table](annotated/SH-A38-invoices-table-due-date-and-source-ar.jpg) | 211 · 204 |
| SH-A39 | [row link](annotated/SH-A39-report-row-drill-link-ar.jpg) · [landing](annotated/SH-A39-collection-landing-after-drill-ar.jpg) | 200 · 201 |
| SH-A40 | [unresolved municipality](annotated/SH-A40-interpretation-unresolved-municipality-ar.jpg) | 207 |

The «current» half of the current-vs-proposed image is a crop of the original full-page capture 190b; the floating composer visible mid-page is an artefact of full-page capture, not of the layout.

## 8. Gaps → actions (register `03`, section «ADDENDUM R4»)

| Verified gap | Action | Extends / depends on |
|---|---|---|
| No overdue report; four titles → generic report with 0 % collection rate; no municipality table; zero state says «unavailable» | **SH-A35** one `overdue` section + `overdueBy` + four entry points | reuses the NC engine; SH-A02 (buckets), SH-A16 (a), SH-A23 (debtor view stays blocked) |
| «متأخرة» = collection class: drops 15 / 369.41 m (cohort), 29 / 707.30 m (standing); mislabelled | **SH-A36** due-position field + relabel the class | SH-A10 (dictionary text) |
| Default issue window hides 65 overdue invoices / 4.43 bn; no due-date filter; reporting date not the measurement date; grace not stated | **SH-A37** | SH-A01 (same carry-over), SH-A31 / Q5 |
| Appendix: no debtor/municipality; «مصدر الإيراد» prints product; NC screen table lacks due date/source; undated rows print 1970 / 20,762; CSV lacks debtor and reporting date; appendix capped at 50 | **SH-A38** | extends **SH-A03** (debtor in list/CSV) and **SH-A02** (undated acceptance) |
| Smart Reports links lose the overdue filter (23 → 57 → 29); `Collection.jsx` URL contract cannot carry it; no links on aging / NC report | **SH-A39** | extends **SH-A04** (URL contract `allPeriods`, age) |
| Interpreter drops qualifiers without a cue word; due-date phrases become issue periods; broken option texts («أمانة أمانة», «…يوما»); follow-up «by municipality» | **SH-A40** | alias module = SH-A18 (no alias needed) |

Already satisfied, **no action**: municipality-depends-on-Amanah (Fully), access scope in all dimensions (Fully), the NC engine's overdue / partition / reconciliation (Fully), explicit unspecified municipality groups (Fully), NC chart → invoices drill with the reconciled match bar (Fully), saved versions and the five exports as containers.

## 9. Decisions needed (recommendations in `05 §4`, Q13–Q18)

Q13 one report with four entry points vs four reports · Q14 default population (all issue periods vs the 2026 cohort) · Q15 due-date filter next to the issue-date period · Q16 grace period shown on the report (value stays 0 until Q5/EQ2) · Q17 wording of the collection-class «متأخرة» · Q18 excluded overdue: separate tile only.

## 10. What stays unverifiable

* **1000+ invoice export** (compact world: 138 overdue; the CSV streams by design, `exportChunks`) — **UNVERIFIED**.
* **Undated invoices on screen** — the world has none; behaviour proven only by an in-memory fixture in a probe process (nothing persisted).
* **PowerPoint / Word rendering** of any proposed report (SH-A34), **MOMAH guideline conformance** of the proposed layout (SH-A29).
* **Real data:** every figure is synthetic; nothing validates the real overdue picture or real debtor identifiers (SH-A33, D-10).
* **Browser-local Sanad links** change the excluded count by 1 invoice between the API and the UI (73 net unchanged); other local state (decisions, uploads) was not varied.
* **Working tree in flux** (another agent was editing `accessModel.js`); line numbers drift — re-verify before editing.

## 11. Files

Probes (kept): `scratch/r4/interp.mjs`, `interp2.mjs`, `models.mjs`, `recon.mjs`, `chain.mjs`, `allper.mjs`, `classes.mjs`, `undated.mjs`, `zero.mjs`, `ncapp.mjs`, `csvprobe.mjs`, `stand.mjs`; UI scripts `ui1…ui14.mjs`; generator `scratch/r4/gen/` (`specs.mjs`, `wire.mjs`, `run.mjs`). Screenshots 190–213 (log in `screenshots/index-draft.md` § R4). Annotated images and wireframes as §7. Bundles `.test-build/_r4_*.mjs` were deleted.
