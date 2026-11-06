# 05 — Probability assessment: is «احتمالية تحقيق المستهدف» supportable?

**Decision (summary): NO — a validated probability is not supportable with the data available.** The tile must be replaced by the forecast, the forecast achievement % and its assumptions, with the message **«لا تتوفر بيانات كافية لتقدير احتمالية موثوقة»**. The rest of this file is the evidence (all probes on the synthetic compact world, cut-off 6 Nov 2026) and the specification of what *would* be defensible once real inputs exist.

## 1. Definitions (§5)
| Quantity | Meaning | Today |
|---|---|---|
| (1) المتوقع تحصيله بنهاية السنة | monetary forecast `F` | 10,948 M (run-rate) [V] |
| (2) نسبة تحقيق المستهدف المتوقعة | `F ÷ T` | 47.8 % at 22.89 bn (50.7 % at 21.59) — **not shown** [V] |
| (3) احتمالية تحقيق المستهدف | `P(C(asOf) + future receipts ≥ T)` | displayed «1 %» = clamp floor (01 §4.3) |
Things that must **not** be shown as a probability: annual achievement % (40.2 %), `F ÷ T`, a manually assigned risk score, a lookup of thresholds, a deterministic forecast converted to a percentage — the current tile is the last of these in disguise (a normal tail with a hard-coded 3-point spread and clamp) [V].

## 2. Data-sufficiency measures [V probe4, synthetic]
| Criterion | Measured | Reading |
|---|---|---|
| History depth | `DATA_START = 2025-01-01` (`revenueLedger.js:27`); the generator also holds Oct–Dec 2024 as an opening history, but receipts of those months only cover invoices issued from Oct 2024 → **incomplete, excluded**; **22 complete months** (Jan 2025–Oct 2026); 1 complete fiscal year (2025: 9,238 M); 2026 is in progress | thin: < 2 years |
| Comparable periods per calendar month | 2 for Jan–Oct, **1 for Nov and Dec** | seasonality cannot be separated from noise |
| Seasonality estimability | month-pattern correlation 2025 vs 2026 (Jan–Oct) = **0.21**; CV of monthly receipts 0.26; the generator's seasonal shape is itself «an ASSUMED seasonal pattern» (`server/world.js:121-122`) | not estimable; any estimate would measure the generator |
| Missing periods / reporting delays | none missing; **the data carries payment date only — no load/posting date** (`st.pDay/pAmt/pCh`), so reporting lag, restatements and «data as known on date X» cannot be represented | leakage-free backtesting of what was knowable at a past date is impossible |
| One-offs | 14 payments ≥ 2.5 × the median payment (17.6 M) and ≥ 20 % of their month (`engine.js:526-527`); the trend model's stricter rule (≥ 35 % of month) flags none in its window | rule-based, no business confirmation of what is a one-off |
| Scope / target / process changes | targets have **no history** (budget loaded for 2026 only: `appropriations.js:6,30-33`); the target itself changed 66 % → 70 % in the screenshots; collection-process changes unknown | no stable target series |
| Entity / source differences | per-entity receipts are sparse: 8 of 18 entities have < 15 payments in 22 months (Hafr Al-Batin 1, Al Bahah 2, Ha'il 5, Najran 7, Al Jawf 9 …; CV up to 4.7); sources: housing sales 0 payments, white lands 16 payments in 10 months | entity/source-level probabilities are not estimable at all; the Ministry total is the only usable level |
| Target outcomes for calibration | 0 completed years with a defined target (2025 has no budget); even with one it would be **one** binary observation | calibration impossible |
Compact world = ~930 records (`server/store.js:13-15`): the synthetic receipts are ≈ 56 payments a month for the whole Ministry. Real data would be larger; the **structure** problems above (history length, no load date, no target history) would remain until real exports exist.

## 3. Backtest feasibility (time-ordered, no future leakage) [S, probe4]
| What can be done | Origins | Result on the synthetic series |
|---|---|---|
| 1-month-ahead rolling origin, training ≥ 12 months | months 13–22 → **10 origins** | last-3-month mean: MAE 207 M, RMSE 246 M, MAPE 25 %, bias +38 M · YTD mean: MAE 197 M, MAPE 22 %, bias +117 M · last-6 mean: MAE 177 M, MAPE 21 % |
| 2-month cumulative (the current horizon) | **9 origins** | MAE 243 M (last-3), 268 M (YTD), 262 M (last-6) |
| Interval coverage of the 80 % band built like the page (`mean ± 1.28 × SD of last 3`) | 10 | **8 of 10** — consistent with anything from ≈ 45 % to 97 % true coverage (binomial) → cannot validate |
| Year-end probability calibration | **0** events | impossible |
Interpretation: the **monthly baseline error** can be quantified roughly (≈ 20–25 % of a month; ≈ 0.25 bn on two months) — useful to say the 10.95 bn estimate is uncertain by order ±0.3–0.5 bn — but 9–10 origins from one generator **say nothing about real-world accuracy** and cannot calibrate a probability. A large simulation count would not change that.

## 4. What the data does support — facts, not probabilities [V]
* Required pace 7,601.9 M/month (day-based) vs the **best complete month in 22: 1,204 M (Jul 2026)** → 6.3× (page's own 6,841.7 M: 5.7×); vs recent pace 932 M: 7.3×.
* Target 22,893.5 M = **2.48×** the whole of 2025's receipts (9,238 M), 1.8× the net billed YTD (12,605 M).
* Year-end bridge: behind at cut-off 10,249 M + uncovered remaining plan 1,696 M = forecast gap 11,945 M.
These statements need no model; they tell a finance reader the target is far outside observed behaviour **without a manufactured percentage**. (They also expose that the illustrative budget/coverage inputs are out of scale with the synthetic world — a calibration question, D-02.)

## 5. The decision and what to show [R]
| Situation | Display |
|---|---|
| `probabilityStatus = 'unsupported'` (today, and whenever < 36 complete months or no validation) | tile «احتمالية تحقيق المستهدف»: «**لا تتوفر بيانات كافية لتقدير احتمالية موثوقة**» + one line «السبب: 22 شهرًا مكتملًا فقط، ولا سجل لمستهدفات سابقة، ولا تاريخ تحميل للمدفوعات» (expandable «لماذا؟»); **no %, no colour verdict** |
| beside it | «المتوقع تحصيله بنهاية السنة»: 10.95 مليار (method `runrate3_v2`, window «أغسطس–أكتوبر 2026», assumption list: no seasonality, no recovery of overdue balances, no action benefit, run-rate continues) · «نسبة تحقيق المستهدف المتوقعة»: 47.8 % · the gap `T − F` and the exact bridge (behind-at-cut-off + uncovered remaining plan) · «المطلوب مقابل أفضل شهر»: the facts of §4 |
| `C ≥ T` | «تحقق المستهدف» (fact) |
| target missing | no forecast achievement, no probability |
Also: remove the green/amber/red tone of the probability tile (`PlanForecast.jsx:20`), the dictionary row «الاحتمال» (`dictionaryDocs.js:162`) is replaced by the three definitions above, and the footnote stays.

## 6. If a method is later judged defensible — specification [R]
**Simplest suitable method (not a promise of accuracy):** a monthly collections model at the **Ministry** level only — level from the recent complete months (or a seasonal-ratio level when ≥ 36 months exist) — with a **predictive distribution built from the model's own time-ordered out-of-sample errors** (empirical, block-bootstrapped residuals of the h-month-ahead cumulative forecast), *not* a normal assumption on three points.
* **Definition:** `p = P( C(asOf) + Σ_{future days} receipts ≥ T | information available at asOf )` — from the share of simulated year-end totals ≥ T; the simulation count only controls Monte-Carlo noise, it is **not** evidence of accuracy.
* **Window:** all complete months in the validated history (≥ 36 required); the partial current month enters through its elapsed days only.
* **Exclusions:** months flagged by a business-confirmed scope/process/target change; payments flagged as one-off (listed beside the result, forecast shown with and without).
* **Assumptions printed:** stationarity of the recent level; no action benefit; no change of billing; receipts lag as observed; target and plan version in force.
* **Limitations printed:** Ministry level only; excludes data-quality uncertainty (kept separate: missing/conflicting records are a **data** uncertainty, not forecast variance); results change with every cut-off.
* **Validation protocol (all required before the % is switched on):**
  1. rolling-origin, expanding window, **as-of datasets** (only payments *recorded* on or before each origin) — needs the load date;
  2. point error vs two naive benchmarks (YTD mean, last-3 mean, seasonal naive when possible): MAE, MAPE, bias by horizon;
  3. interval coverage at 50/80/90 % with binomial confidence limits — accept only if the nominal level lies inside them over ≥ 24 origins per horizon;
  4. probability calibration on **pooled threshold events** (e.g. «next-3-months receipts ≥ x» over many x and origins), reliability diagram + Brier score vs a climatological baseline; require skill > 0 and calibration slope within tolerance;
  5. no leakage: features and targets built only from data with `loadedAt ≤ origin`; target version as it stood at the origin;
  6. re-validate at each quarter; auto-revert to «insufficient data» if any check fails.
* **Real-data inputs that unlock it:** ≥ 36 months of Tahseel payments with **payment date and load/posting date**; approved annual targets and monthly plans **by version** for at least 3 years; due dates and invoice status history; one-off/exceptional payment flags confirmed by Finance; scope/process change log; entity and source mapping history. Alignment with the forecasting teams' method and their inputs is pending (`docs/sh-review/00-materials-and-dependencies.md` §3).

## 7. Interaction with Smart Reports [V]
`revenueOutlook.js` already refuses accuracy claims («not a validated confidence interval», `:148`; «MAPE … small sample; not a guarantee», `:158`), but its figure (9.96 bn) is built with the horizon/partial-month defects (02 §5) and an unrelated target (11.5 bn). The probability decision above applies to every surface: no surface may print a probability until the validation passes.
