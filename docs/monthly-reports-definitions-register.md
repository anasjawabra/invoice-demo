# Monthly revenue reports — definitions register

Source: the four decks supplied by the ministry (January, February, March and July 2026; the April–June decks were **not** supplied). Texts below were read directly from the slide XML on 2026-10-09. Only **structure, labels and definitions** are recorded — no amounts or rates from the decks are copied into this repository's code or UI (standing rule).

Status words: **Observed** = stated in a deck. **Inferred** = my reading, to be confirmed. **Unknown** = the decks do not say.

## 1. «Grace period» references — four different statements, not one rule

| # | Deck / slide | Slide subject (what the number is attached to) | Invoice category | Process | Exact footnote text | Applicability |
|---|---|---|---|---|---|---|
| G1 | January, slide 13 | Actual collection rate of each Amanah **against the collection target**, cumulative to January | Municipal sector invoices (the slide's own scope) | Measuring collection rate vs target | «(*): تم احتساب فترة سماح 5 أيام» | Observed. Applies to that slide's comparison only. *How* the grace is applied (to the due date? to which invoices?) is **Unknown** |
| G2 | February, slide 13 | Same slide, cumulative to February | same | same | «(*): تم احتساب فترة سماح 10 أيام» | Observed |
| G3 | March, slide 15 | Same slide, cumulative to March | same | same | «(*): تم احتساب فترة سماح 15 أيام» | Observed |
| G4 | July, slide 9 | Same slide, cumulative to July | same | same | «(*): تم احتساب فترة سماح 35 يوم» | Observed |
| G5 | July, slide 14 | **Enforcement performance** table — the column «الإيرادات غير المحصلة (2)» (uncollected revenue) | **White-lands fees only** (footnote (1) is attached to the ministry row «وزارة البلديات والإسكان(1)» and reads «رسوم الأراضي البيضاء فقط») | Eligibility for referral to enforcement | «تم الأخذ بعين الاعتبار فترة السماح وفقاً لنظام إيرادات الدولة (60 يوم)، بالإضافة إلى فترة اشعار المطالبة بالأداء وفقاً لنظام التنفيذ أمام ديوان المظالم (30 يوم)» | Observed. Two legal periods named («in addition to»): 60 days under the State Revenues Law and 30 days of payment-demand notice under the Enforcement-before-the-Board-of-Grievances law. Whether they are added (90) or overlap, and from which date they start, is **Unknown** |
| – | July, slide 13 | Referral details of penalties and fines on Efaa (all years) | Penalties and fines | Referral to enforcement | none (only «* آخر تحديث يوليو») | Observed: **no grace footnote** on this slide |

**Reading.** G1–G4 are 5, 10, 15 and 35 days in the January, February, March and July decks: the first three rise by 5 days per month and July continues the same 5-days-per-month step if the April–June decks used 20, 25 and 30. This is an **Inferred** pattern (grace = 5 × month number of the report) that cannot be confirmed without the missing decks. G5 is a different measure (legal periods, one revenue category, a different process). **The platform therefore must not treat 15, 35 and 60+30 as one universal grace value.**

Current platform behaviour: one global setting `graceDays` (see `Noncollection` page) and an assumption line «Grace period: N day(s) (unresolved)» in every report. Nothing was changed in Phase 0; the decision is EQ2 in the decision table below.

## 2. Coverage of operating expenditure (chapters 1–3)

| Aspect | Source decks (March slides 16–17, July slides 10–11) | Platform today | Gap |
|---|---|---|---|
| Title | «نسبة تغطية النفقات التشغيلية للأبواب الثلاث الأولى من الإيرادات المحصلة» | Budget report: «تغطية الإنفاق التشغيلي» | Same name |
| Columns (July slide 11) | «إجمالي الاعتماد الأصلي/السنوي», «إجمالي الاعتماد الأصلي حتى يوليو», «المحصل حتى يوليو», «نسبة تغطية الأبواب الثلاث الأولى حتى يوليو 2026»; footnote «تراكمي حتى يوليو 2026» | Receipts ÷ **cash payments** of chapters 1–3 (synthetic, national scope only) | **Different denominators**: the decks divide cumulative collections by the *original appropriation prorated to the report month* (an allocation basis); the platform divides by *cash actually paid* |

Rule adopted until decided (EQ5): the two measures are **never substituted silently**. Where the platform shows coverage it must name the basis («على أساس المخصص المتناسب» or «على أساس الصرف النقدي»); the interim wording already says the definition is not approved. A prorated-appropriation view cannot be computed today because the synthetic finance data has no original appropriation by month.

## 3. Targets — shown in a report vs formally approved

| Item | Observed | Unknown |
|---|---|---|
| Collection-rate target | Each deck shows one uniform target per Amanah beside the actual rate (slide «مقارنة أداء نسبة تحصيل الأمانات الفعلية بالمستهدف»); the value differs between decks | Whether it is a formally approved target, who approved it, from when, and whether it varies by Amanah/source |
| Annual revenue targets by sector | Shown on the executive summary as «مستهدف إعتماد من إيراد» | Approval status |
| In the platform | The target is a demo input labelled «غير معتمد»; no report says «approved» | – |

Rule adopted: a target seen in a source report is recorded as **«shown in source report (date)»**, never as **«approved for the platform»**; the second status needs a document and an approver (EQ6).

## 4. Readiness for the three new July report types

| Report | What it needs | What exists in the platform / data bank | Readiness |
|---|---|---|---|
| **Enforcement referral** (July slides 12–14: portfolio, referable, not enforceable, enforced-against, collected from enforcement, ratios) | Per-invoice link to an enforcement case on Sanad / Efaa / Tahseel; a clear *not-enforceable* classification (investment invoices not based on contracts, written-off records, fines on deceased persons, incomplete Efaa records, violations outside Efaa — as listed in footnote (3)); grace periods G5; bank-statement collections | Sanad enforcement cases and candidate links (demo); Risk Radar categories (duplicate, struck-off registry, deceased debtor, value anomaly); invoice-level status. **Not available:** an Efaa referral status, reliable invoice↔case keys on Sanad (the real data has a very high share of missing invoice numbers — see the real-data evidence note), Tahseel connection, G5 start dates | **Partial.** Structure and the not-enforceable classification can be prepared on synthetic data; real figures are blocked by the data gaps and by EQ2/EQ9 |
| **Income participation** (July slides 23–24: monthly counts per Amanah January–December, future months blank) | A defined source: what is counted (contracts? payments?), the owner, a record-level extract | **Nothing**: no field or file in the schema dictionaries mentions it | **Not ready.** Only the matrix layout (Amanah × month, future months left blank, one unit) can be built, and only after the source is identified |
| **E-invoice** (July slide 25: counts per Amanah × revenue source) | A per-invoice e-invoice indicator (issued / not issued) or identifier | No e-invoice field in the revenue schemas; the only related items are `RENTAL_INVOICE_CALL_UUID` (rental payments) and a «ZATCA API» mention in the tax-exemption catalogue — neither is an e-invoice status | **Not ready.** Needs the field and its definition from the data owner |

## 5. Other items from the decks (unchanged conclusions)

* Comparison tables: cumulative 2026 vs 2025 with change columns (percent for amounts, points for rates); **the date at which collections are measured is not stated** → EQ1.
* Units: one unit per table (million or thousand SAR); future months are blank, not zero — already applied in the platform.
* Identity: ministry logo and a teal/dark-green template (not DGA green). The logo seen in the decks is a **candidate asset only**: it has not been copied into the project or used in the UI until the official logo, its variants and its usage rules are confirmed (decision D1, gap G-01).
