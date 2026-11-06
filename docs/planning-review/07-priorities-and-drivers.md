# 07 — Priorities («أين نركز») and drivers («مبررات…»)

## 1. Review of the existing «أين نركز» [V]
Code: `focusRanking` (`src/data/planForecast.js:62-65`), rendered at `PlanForecast.jsx:59-63`.
```
population  = matrix.amanahSource cells of invoices ISSUED in the period (2026)    Σ outstanding = 3,889.54 M
rate        = collected ÷ net of the cell
shortfall   = max(0, 0.68 − rate)           (cell with rate ≥ 68 % gets weight 0.02)
score       = outstanding × shortfall       → top 5
```
Output on the synthetic world at 6 Nov (cohort amounts; M): 1 Housing Sector · white lands 1,725.9 (rate 30.8 %) · 2 Asir · fines 293.9 (26.2 %) · 3 Housing · housing sales 71.0 (0 %) · 4 Eastern · fines 77.8 (18.8 %) · 5 Asir · investment 176.5 (48.8 %). Jeddah · fines (732.9 M, rate 66.5 %, the 2nd-largest cell) is 7th; a 71 M cell with 0 % rate outranks it.
| Issue | Evidence |
|---|---|
| ranks by **balance × low rate** — exactly what §7 says not to do | `planForecast.js:63` |
| population = the 2026 cohort (3.89 bn) while «reasons» use the all-time stock (8.32 bn) and the forecast uses cash | `PlanningArea.jsx:58` (cells), `planInputs.js:17` (`standing`) — the five lines cover 2,345 M = 28 % of the stock; the **4.43 bn on 2024–2025 invoices is invisible** to the list |
| no age/due/blocker input although the cells carry them (`overdue`, `notDue`, `maxDaysOverdue`, `engine.js:437`) | cells unused fields |
| a «rate shortfall» is time-dependent for a cohort (recent invoices are not due) | cohort rate = 69.1 % overall |
| no recommended action, no reason, no per-line drill-down, no recoverable amount | one generic link «عرض الفواتير غير المحصّلة» (`:63`) |
| no double counting **within** the list (cells are disjoint: one invoice → one entity × source cell) | `engine.js:437` |
| overlaps three other prioritisation surfaces (list tiers, Decision Room factors, legacy numeric score) — SH review GAP-R4-1 | `docs/sh-review/01` |

## 2. Supported and unsupported inputs [V probe5/6]
| Input requested | Supported? | Source / note |
|---|---|---|
| Contribution to the monetary gap | **Yes** (entity) | `g_i = P_i − C_i`, Σ = ministry gap exactly (04 §2); not by source (no source target) |
| Amounts due within the remaining period | **Yes at invoice level, not aggregated today** | `st.due[i]`; all 579.63 M of not-yet-due balance is due by 31 Dec in this world; needs one new aggregate (08) |
| Overdue balances and ageing | **Yes** | stock aging: not due 579.6 · 1–30 412.5 · 31–90 322.0 · 91–180 824.0 · > 180 **6,184.5** (M; `engine.js:317,458`) |
| Known blockers (objection, enforcement, unresolved linkage, ineligible referral, exclusions) | **Yes (data)**; amounts 0 / small in this world | `stock.objectionOutstanding` = 0, open enforcement 0, linkage-unresolved 152.6, ineligible 0.3 (probe5) |
| Revenue source and entity | **Yes** | cells |
| Time required for action | **No** | no workflow-duration data |
| Already included in the forecast | **No** | the run-rate is not invoice-level; amounts must be labelled «رصيد قائم، وليس إضافيًا إلى التقدير» |
| Expected recoverable amount | **No (unvalidated)** → «غير متاح» | the only evidence is a synthetic recovery table [S]: by overdue age at 12 Sep: not due 43 %, 1–30 d 58 %, 31–90 d 30 %, **> 90 d 0 %** — a property of the generator, not a rate to publish |
| Permission/scope | **Yes** | org-masked data service; targets must not depend on the visible set (D6) |

## 3. Proposed prioritisation logic [R]
**Unit:** an *action line* = entity × revenue source × **action class**. **No double counting:** every invoice with `outstanding > 0` at `asOf` is assigned to **exactly one** class by the existing unified-state precedence (`derive().cls`: cancelled > excluded > collected > objection > unresolved-linkage > ineligible-referral > partial > overdue > not-due; `dictionaryDocs.js` «الحالة الموحدة») refined by age; lines therefore never overlap, and Σ lines = the stock (8,322.7 M, verified by scan).
| Class | Rule | Action (rule-based dictionary, not a generated cause) |
|---|---|---|
| A — حسم العائق (blocked) | objection · unresolved linkage · ineligible referral · enforcement-linked | open the blocker workflow (exclusions register / enforcement) |
| B — مستحق متأخر ≤ 180 يومًا (overdue, recoverable window) incl. partial | `0 < daysOverdue ≤ 180` | follow-up list |
| C — يستحق قبل نهاية السنة (due in the remaining period) | not yet due, `due ≤ year-end` | pre-due reminder |
| D — رصيد قديم > 180 يومًا (long-outstanding) | `daysOverdue > 180` | review/escalation decision — **listed separately and not counted as collectible this year** |
**Ranking (not a probability, no composite score shown):** within B + C by **actionable amount** (B + C) descending; tie-break by the entity's share of the gap; A and D shown in their own sections with their amounts. A large balance (Housing · white lands: 4,173.7 M) is thereby separated from an actionable opportunity (578.0 M within 180 days; 3,595.7 M older than 180 days, oldest 720 days).
Prototype on the stock population [V probe6] (M): by **total balance** — Housing white lands 4,173.7 · Jeddah fines 1,096.4 · Jeddah investment 763.0 · Asir investment 511.5 · Asir fines 355.0; by **actionable (B + C)** — Housing white lands 578.0 · **Jeddah fines 466.0** · Asir fines 253.1 · Asir investment 176.5 · Riyadh fines 101.4 · Jeddah investment 88.0 · N. Borders investment 87.6 · Jeddah municipal fees 62.2; Σ actionable 2,138.2, Σ > 180 d 6,184.5. The order differs from today's list (Jeddah fines 7th → 2nd; housing-sales 71 M drops out).
**Table spec (one row per line):**
| Column | Content |
|---|---|
| الأولوية | rank 1…N (no score); class badge A/B/C |
| الأمانة / الجهة | name; entity gap share in a sub-line |
| مصدر الإيراد | source name |
| المبلغ ذو الصلة | actionable amount (B + C); sub-line: متأخر X · يستحق Y · جزئي Z; and «أقدم تأخر N يومًا» |
| السبب | one rule sentence with amounts and dates: «متأخر ≤ 180 يومًا: 466 م في 29 فاتورة (أقدمها 214 يومًا)» |
| الإجراء المقترح | from the class dictionary |
| الأثر المتوقع | **«غير متاح»** (with «لماذا؟») |
| سجلات | link to `/collection` with `amanah`, `source`, due-state/aging filters carried — **parity test: row amount = list total** (the list already shares the scope filters) |
Section footnote: «المبالغ رصيد قائم وليست إضافية إلى التقدير؛ لا يُقدَّر مبلغ قابل للاسترداد لعدم توفر بيانات تتحقق منه.» A separate line below the table: «رصيد قديم > 180 يومًا: 6.18 مليار — يحتاج قرارًا لا متابعة» (class D total).
Restricted user: lines are computed from the user's visible entities only; the entity gap share is relative to the visible total with the label «إجمالي الجهات المتاحة لك» (no cross-entity leakage); the Ministry target is not recomputed from the visible set (D6).

## 4. «مبررات عدم تحقيق المستهدف» → «العوامل المؤثرة في فجوة المستهدف» [V review, R decision]
**Decision: rename** (before year-end, failure is not a confirmed outcome; «مبررات» also reads as excuses). When no gap: «العوامل الداعمة لتحقيق المستهدف». Present **four separate groups**, never summed:
| Group | Content (examples with current numbers) |
|---|---|
| **Observed facts** | collected 9.21 vs planned 19.46 (to 6 Nov); net billed 12,605 M YTD = **44 %** of the billing the target requires to date (28.6 bn at 70 %; 46.7 % at 66 %); cohort collection rate 69.1 % vs the 68 % target (at/above target); 494 M received on prior-year invoices; exclusions 3,213 M = 20.3 % of gross; open balance 8.32 bn of which 6.18 bn older than 180 days; objection and open-enforcement amounts 0 |
| **Calculated contributors** (arithmetic; shown as separate indicators, no waterfall implying they sum to causes) | entity contributions to the deviation (exact Σ); the billing-volume/collection-rate/prior-invoice identity (below); year-end bridge |
| **Hypotheses requiring investigation** (labelled as such, none asserted) | why billing is below the target's requirement (scale of the illustrative target vs the billing base); whether late payment is shifting receipts beyond year-end; whether aged balances are collectible |
| **Data gaps** (separate from performance) | no load date on payments; 17 records with missing fields and 5 amount conflicts in the 2026 cohort (`snapshot.quality`); due dates/Sanad links where unresolved (152.6 M); an assumed, not approved, plan |
Rules: low collection never stands as a reason; no cause (investor delay, dispute, enforcement delay, operations) without a record; no «maximum collectible» unless the calculation covers future billing, due dates, exclusions, scope and overlap — which the current one does not (02 §6); every statement carries amount, period and a drill link.

## 5. Is there a reconciled gap decomposition? — proved/disproved with numbers
| Decomposition | Reconciles? | Numbers (70 % target; 66 % in brackets) | Use |
|---|---|---|---|
| **By entity** (`P_i − C_i`) | **Yes — exactly** | Σ over 18 entities = −10,249.43 M (−9,137.46) = ministry deviation; residual < 1 SAR [probe2] | sorted bars; table |
| **By source** | **No** — no source target exists, so planned per source is undefined | — | collected share and rate only |
| **Year-end gap, 2 terms** | **Yes — exact** | `T − F` 11,945.39 = behind at cut-off 10,249.43 + (planned remaining 3,434.02 − expected remaining 1,738.07) (10,637.19 = 9,137.46 + 3,237.79 − 1,738.07) | one-line bridge strip |
| **By driver: billing volume / collection rate / prior-invoice receipts** | **Arithmetic identity holds** but is **not a causal waterfall** | volume `(B_net − B_req)·rt` = −10,887.85 · rate `B_net·(r − rt)` = +144.17 · prior-year receipts +494.20 · overpayment +0.05 → **−10,249.43** (66 %: −9,775.88 + 144.17 + 494.20 + 0.05 = −9,137.46) [probe5] | indicators only: the «required billing» is derived from the target ÷ an illustrative 68 %, the plan is an assumed even split, and a cohort's collection rate at the cut-off depends on invoice age — so «volume −10.9 bn» restates that the target is 2.3× the billing base, it does not prove billing was the cause |
| **By cause (investor delay, dispute, enforcement, operations)** | **Not supportable** | no records; objection/enforcement amounts are 0 | never shown |
**Conclusion:** show the entity decomposition (exact) and the year-end bridge (exact); show the driver identity as three separate indicators with its assumptions; **no waterfall of causes**.

## 6. What the existing sentences become
| Today | Replacement |
|---|---|
| `billing_insufficient` «… الحد الأقصى الممكن 19.74 …» | observed fact «الفوترة 44 % مما يتطلبه المستهدف حتى تاريخه» + the aging composition of the open balance; no «maximum» |
| `pace_short` «وتيرة … أقل من المطلوب» | the pace block (required day-based vs recent vs best month) |
| `run_rate` / `balance_covers` / `achieved` (reach reasons) | «العوامل الداعمة…» group with the same evidence rules; `achieved` becomes the above-target state |
