# IIM — demo update after the review of 21 Oct 2026 (v3)

Source: «IIM Demo Update Action Plan v3 – 21 Oct 2026» (M4: Issa + Abu Sultan). Branch `feat/iim-oct21-review`, cut from `main` (which already contains `feat/iim-oct18-review` and `feat/iim-v2`). Nothing is pushed, merged or deployed. Where v3 and v2 disagree, v3 wins.
All data stays simulated; every budget / target is labelled illustrative.

## 1. What the meeting decided (and what changed during it)

| Topic | Final position |
|---|---|
| Dashboard, smart reports | No change. Dashboard KPIs still to be reviewed by Abu Sultan. |
| Planning | Two **separate overall** targets: coverage (default 66 %) and collection (default 68 %). Per-Amanah values become an optional override, off by default. |
| Execution | Invoice-number rule confirmed. Remove internal explanatory panels. Order detail shows the fields read in M4 (pending Abu Sultan's written review). |
| Exclusions | Eleven reasons R1–R11, all on **uncollected invoices only**. «متوفى» removed (deferred). «اعتراضات قائمة بإيفاء» → «اعتراضات قائمة», source ممتثل. Upload template for R8/R9. |
| Products | Started, not finished: out of scope here (v2 IIM-24 only). |
| Eefaa «منفذ ضده» | No longer "any complete violation": complete/incomplete comes only from the *إشعار المطالبة بالأداء* report; «منفذ ضده – إيفاء» is a separate report. |

## 2. Status of the v2 items (Step 0 of the prompt, checked in code)

IIM-01 … IIM-27: **Implemented** per `docs/iim-oct18-implementation.md` and `docs/iim-v2-implementation.md` (both merged into `main`). The ones v3 amends:

| v2 item | State before this update | v3 change |
|---|---|---|
| D10 / IIM-04 exclusion model | Implemented with 11 rules, **including «متوفى» (DEC-1) and not R2** | Replace by R1–R11 (below) |
| D39 / IIM-14 target panel | Per-Amanah coverage + collection %, billing derived, «مستهدف تغطية واحد» spread helper | Overall inputs; per-Amanah optional override |
| IIM-15 forecast | Implemented | Unchanged logic; reacts to both targets |
| IIM-23 exclusions screen | Cards + reason table + rows | Add upload template, R7 status, R11 link, collapsed rules panel |
| IIM-27 seed data | 8–10 reasons | R1–R11, five objection statuses, duplicate pair |

## 3. New items → where they land (all verified in code first)

| ID | Pri | Action | Files |
|---|---|---|---|
| IIM-28 | P1 | Planning: overall مستهدف نسبة التحصيل beside coverage (66 / 68 %); label «من الميزانية المبلغة للأبواب الثلاثة»; no «المصروفات» | `PlanningArea.jsx`, `strategic/TargetsPanel.jsx`, `data/planTargets.js` |
| IIM-29 | P1 | R7 status rule + status shown on the invoice | `catalog.js`, `engine.js`, `world.js`, `iim.js`, `InvoicePage.jsx` |
| IIM-30 | P1 | Exclusion upload template (R8 / R9) | new `data/exclusionUpload.js`, `components/revenue/ExclusionUpload.jsx`, `Exclusions.jsx`, `engine.js` (file-exclusion overlay) |
| IIM-31 | P2 | R2 service-company stay of execution | `revenueMetrics.js`, `iim.js`, `engine.js`, `world.js`, `names.js` |
| IIM-32 | P1 | Execution: hide internal panels behind `SHOW_INTERNAL_NOTES = false`; order-detail field list | `EnforcementOrderPage.jsx`, `EnforcementHome.jsx`, `OrderJourney.jsx` |
| IIM-33 | P2 | Invoice detail: source sections (Furas / Eefaa-Mumtathil / CR) + exclusion block | `InvoicePage.jsx`, `server/iimRow.js`, `server/materialize.js` |

## 4. The exclusion model (the core change)

One module owns the list: `EXCLUSION_RULES` (rule engine ids stay, so stored decisions keep resolving) + a display layer in `iim.js` with the **code**, **label** and **source** of each reason. Precedence when an invoice meets several: R3 > R6 > R7 > R4 > R5 > R2 > R1 > R10 > R8 > R9 > R11; one primary reason per invoice (counted once).

| # | Code | Label | Engine id | Source | Rule |
|---|---|---|---|---|---|
| R1 | NO_CONTRACT | فواتير لا تستند على عقود | NOC-1 | فرص | investment revenue account **and** no contract in Furas — any Amanah/entity, central or internal |
| R2 | SERVICE_CO_STAY | إيقاف التنفيذ – الشركات الخدمية *(working label)* | **STY-1 (new)** | قائمة الوزارة | customer is on the configurable list (seed: شركة المياه الوطنية + one more service company); wins over R1 |
| R3 | SANAD_EXECUTED | منفذ ضده – قضايا (سند) | SND-1 | سند | any invoice in Sanad with an execution number, whatever the order status |
| R4 | EEFAA_INCOMPLETE | غير مكتمل | INC-1 | إيفاء – تقرير إشعار المطالبة بالأداء | status غير مكتمل → violation number → invoice number |
| R5 | OUTSIDE_EEFAA | خارج إيفاء | EFA-1 | المديونيات مقابل قائمة إيفاء | uncollected, main class الغرامات والجزاءات only, no Eefaa record |
| R6 | EEFAA_EXECUTED | منفذ ضده – إيفاء | EXE-1 | إيفاء – تقرير المنفذ ضده | every violation in the report is linked to its invoice |
| R7 | OPEN_OBJECTION | اعتراضات قائمة | OBJ-1 | ممتثل (حالة الاستئناف) | exclude: بانتظار توجيه العضو · بانتظار مراجعة اللجنة · مقبول جزئيًا · مكتمل مقبول. Keep: مكتمل مرفوض |
| R8 | ENCROACHMENT | التعديات واستغلال المواقع (محضر التعدي) | ENC-1 | ملف الأمانة (رفع يدوي) | upload template only |
| R9 | AMANAH_STATEMENT | إفادات الأمانات | ATT-1 | ملف الأمانة (رفع يدوي) | upload template only |
| R10 | STRUCK_OFF_CR | سجلات مشطوبة | CR-1 | بلدي + عرض السجل التجاري | CR status Deleted or Cancelled |
| R11 | DUPLICATE | فاتورة مكررة | DUP-1 | الكشف بالذكاء الاصطناعي | same customer, amount, product, revenue account and **issue date**, different invoice number; earliest-numbered kept, the others flagged. Yearly repeats are not duplicates |

Removed: **«متوفى»** (DEC-1): out of the enum, filters, legends, seed data, charts, the Risk radar category, the invoice flag and the rule registry. A code comment marks it as deferred (`DECEASED_DEFERRED`).

## 5. Work groups (order of delivery)

1. **Model + KPIs** — rule list, labels, precedence, `EXCLUSION_RULE_SET_VERSION` v4, engine changes (R7 status, R2 list, file overlay), tests (one per reason, positive and negative; collected invoice never excluded; precedence; reasons sum to the card).
2. **Seed data** — ≥ 3 invoices per reason; R2 invoices moved out of R1; all five objection statuses (the rejected one stays collectable); same-day duplicate pair + a yearly repeat that is *not* a duplicate; Eefaa records incomplete / executed / missing penalties; CR Active / Deleted / Cancelled; no deceased; illustrative budget 32.7 bn, collections ≈ 8 bn.
3. **Exclusions screen** — R1–R11 table with a one-line rule, rows with the full column list, R7 status, R11 link to the matching invoice, filters, rules panel collapsed.
4. **Upload template (IIM-30)** — download `.xlsx` (drop-downs), upload `.xlsx/.csv`, row validation against the invoice data (Amanah + invoice number; must exist and be uncollected; account matches), preview, confirm, rejected-rows file, applied rows recorded with file name / date / user / source «ملف الأمانة». Stored on this device only. ~150-row sample in `public/samples/`.
5. **Planning (IIM-28)** — in parallel.
6. **Execution (IIM-32)** — in parallel.
7. **Invoice detail (IIM-33)** + R7 status on the invoice.

## 6. Decisions I took (please confirm — these are the v3 open questions)

| Q | Applied | Where to change |
|---|---|---|
| Q1 | Overall targets; per-Amanah override optional and **off**; monthly split kept | `planTargets.js` |
| Q2 | 66 % / 68 % labelled illustrative | `planTargets.js` |
| Q3 | Budget stays 32.7 bn (already the demo's); collections ≈ 8 bn from the generated data, not forced to 8.5 | `appropriations.js` |
| Q4 | R2 label is a working label; list = 2 fictional/real-named companies, constant | `SERVICE_COMPANY_LIST` in `iim.js` |
| Q5 | R8 and R9 two reasons, one template | |
| Q6 | مقبول جزئيًا excludes the whole invoice | `OBJECTION_STATUSES` in `iim.js` |
| Q7 | Duplicates excluded automatically; earliest invoice number kept | |
| Q8 | R5 rule written against Tahseel uncollected data; Makeen not named | |
| Q9 | R10 = Balady invoice joined with the CR record | |
| Q10 | Template has the seven columns; rejected rows returned with a reason | |
| Q11 | Internal panels hidden behind `SHOW_INTERNAL_NOTES = false`, not deleted | |
| Q12–Q14 | Fields as read in M4; status labels as heard; precedence as written | |
| Q15 | M3 transcript unavailable; v2 defaults stand | |
| — | **«متوفى» is removed from the Risk radar too** (validation: "no «متوفى» anywhere"). The Risk radar had it as one of four categories; it is hidden by the same deferral flag and comes back by switching it on. | `DECEASED_DEFERRED` |

## 7. Not built
User roles, live integrations, automatic exclusion of anything not listed, changes to إدارة المنتجات beyond v2, «متوفى».

## 8. Acceptance
Unit tests + `npm run build`; in the running app: no «متوفى», no «اعتراضات قائمة بإيفاء», no «المصروفات» on planning; reason totals = the dashboard exclusion card; gross − exclusions = net everywhere; the sample upload gives the expected accepted / rejected rows and the rejected file downloads; coverage and collection targets move independently (70 % → low probability, 30 % → high); no internal panel with the flag off; RTL, no console errors, no truncated labels at laptop width.
