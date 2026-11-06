# 13 — Revised proposal: revenue plans («خطط الإيرادات»)

**Update (7 Nov 2026):** partly superseded by `docs/revenue-plans-spec.md` §10 (simplified workflow: no draft / active / archived states, no activation, no versions UI, no duplicate-baseline rule, no editable owner or status) — what was built is recorded in `14-revenue-plans-implementation-status.md`.
**Status:** proposal for approval. Nothing is implemented. This refines [12](12-revenue-plans-analysis.md) with the review direction; it does not repeat that study.
**Checked for this revision:** permissions and role model (`src/data/permissions.js`, `accessModel.js`, `server/endpointAccess.js`, identity service), the existing persistence pattern (`server/.data/identity.json`, atomic write + audit), and where the on-plan tolerance is consumed.

---

## 0. Findings that shape the design

| Question | Evidence |
|---|---|
| Is there an approval process? | **No.** Access is module-level (`planning`) plus one role-level read-only switch; the write gate `planning.update` = planning module AND not read-only. No approver role, workflow or approval record exists anywhere. The only "approved" values are code-level flags on exclusion rules and today's plan-status dropdown (self-service, labelled in the UI as having no workflow). |
| Is shared server persistence available? | Yes, as a pattern: the data service already keeps one JSON document per concern under `server/.data/` (git-ignored), written atomically (temp file + rename) with an audit array, behind `endpointAccess.js`. Plans follow it: `plans.json`. |
| What does the on-plan tolerance touch? | Only labels and one filter: the «متقدم / وفق الخطة / متأخر» badge on the position block, and the Decision Room item filter (`decisionRoom.js:331`, which excludes entities with status `on_plan`). **No amount, ratio or forecast depends on it.** |
| Entity model | Plans can only use entities that exist: the 18 appropriation entities (Amanahs + «قطاع الإسكان»; headquarters has no revenue). No sector/program classification exists, so none is added. Municipalities stay a *viewing* scope, not a plan scope. |

---

## 1. Final layout

### 1.1 `/planning` — revenue-plan list

One compact table, no charts, no totals row (no screen sums targets across plans).

| Column | Content |
|---|---|
| الخطة | name; period under it («1 يناير – 31 ديسمبر 2026») |
| النطاق | «الوزارة (كل الجهات)» or «N جهات مختارة» (hover lists them) |
| المالك | creator, or «غير معروف (سجل سابق)» |
| المستهدف | collection target of the version in force (draft: of the draft) |
| المحصّل حتى تاريخه | actual to the cut-off |
| نسبة تحقيق المستهدف حتى تاريخه | actual ÷ full-period target |
| المتوقعة بنهاية الفترة | expected achievement % (or «غير متاح» + reason) |
| الحالة | **مسودة / فعّالة / مؤرشفة** + version number for active plans |

Filters: period (year or range), entity, owner, state. Default: active and draft plans of the current year. Actions: open (row), «إنشاء خطة», «نسخ كمسودة» (copies a plan as a new draft with a visible "copied from" note). Mobile: card per row (name+period, target, achievement, expected, state). Draft rows are visibly marked and show no expected-achievement figure. A year with data but no plan shows one «لا توجد خطة» row, never an invented plan.

### 1.2 `/planning/:planId` — plan detail

```
← خطط الإيرادات
خطة إيرادات التحصيل 2026        [فعّالة · الإصدار 3]              [تعديل الخطة] [سجل الإصدارات] [⋯ أرشفة]
المالك: <creator> · آخر تعديل: <editor>، <date> · النطاق: الوزارة (كل الجهات)
الفترة: 1 يناير – 31 ديسمبر 2026 (افتراض: التقويم يناير–ديسمبر، بانتظار تأكيد الأعمال) · التاريخ المرجعي: 6 نوفمبر
جاهزية الخطة:  [التخصيص مكتمل ✓]  [التوزيع الشهري 100% — توزيع متساوٍ (افتراض)]        ← the compact management summary

┌ ملخص الخطة ───────────────────────────────────────────────────────────────┐   (target value appears ONLY here)
│ المستهدف │ المحصّل حتى تاريخه │ نسبة تحقيق المستهدف حتى تاريخه │ المتوقع بنهاية الفترة: المبلغ · النسبة · الفجوة │
└───────────────────────────────────────────────────────────────────────────┘
[سياق: تنبيهات البيانات / السنة انتهت — صف واحد عند الحاجة فقط]
الأداء مقابل الخطة   المحصّل | المخطط حتى تاريخه | نسبة الإنجاز مقابل المخطط | الانحراف (مبلغ بإشارة)
الرسم التراكمي: فعلي / مخطط / متوقع
التوقع والوتيرة المطلوبة   (سطر: لا تُقدَّر احتمالية — رابط القاموس) + «افتراضات هذا التوقع»
أين نركز: الانحراف حسب الجهة ← جدول الإجراءات
العوامل المؤثرة في الفجوة
```

- **The target is shown once** (in the summary). Header, readiness chips, position block and forecast block refer to it by name; the value is available in info-tips only.
- **«تعديل الخطة»** (visible only to users who may edit; otherwise a disabled control with the reason) opens the **editor** — a side panel on desktop, a full-screen sheet on mobile — with tabs: **بيانات الخطة** (name, scope, period) · **المستهدف** · **التخصيص** · **التوزيع الشهري** · **افتراضات متقدمة** · **الإصدارات**. Footer: «حفظ كمسودة» · «تفعيل كأساس للتقارير» (opens the check list, §3.4) · «إلغاء».
- Opening an older version or an archived plan shows a banner and read-only figures («نسخة تاريخية، لا تغذّي التقارير»).
- `#plan-targets` and the old `/planning` deep links redirect to the plan in force for the current year; the editor opens when the link asks for it.

### 1.3 The three percentages (always labelled, never merged)

| Label | Formula | Where |
|---|---|---|
| **نسبة تحقيق المستهدف حتى تاريخه** | actual collected ÷ full-period target | summary; list |
| **نسبة الإنجاز مقابل المخطط حتى تاريخه** | actual collected ÷ planned collected to the same cut-off | position block (replaces the deviation %, which is its complement; the signed deviation **amount** stays) |
| **نسبة تحقيق المستهدف المتوقعة بنهاية الفترة** | (actual to cut-off + forecast for the rest) ÷ full-period target | summary and forecast block, **always beside the forecast amount and the expected gap**; never called a probability |

Not capped at 100 %; aggregates come from amounts; zero target, no data, future period, and closed period are explicit states («لا نسبة» + reason / the final outcome). The large probability block is **removed**; the limitation lives in the dictionary (`probabilityStatus`) and in one sentence in the forecast block, with the method id, window and cut-off.

---

## 2. Plan model and overlap rules

### 2.1 Fields

```
plan      planId (opaque), name, type: 'baseline' | 'scenario'*, scope, period, state, createdBy{userId, nameSnapshot}, createdAt,
          origin: 'user' | 'seed' | 'imported', legacy{…original metadata, read-only}?, inForceVersion, revision (concurrency counter)
scope     { kind: 'ministry' } | { kind: 'entities', entityKeys: [...] }          — existing entity keys only
period    { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', preset: 'fiscal-year' | 'range', calendarAssumption?: true }
working   the editable draft: target, targetBasis?, allocations[], distribution{profile, weights[12 or n months]}, advanced{collectionRate?, billingTarget?}, lastEditedBy, updatedAt
version   n, snapshot (full copy of the working content at activation), activatedBy, activatedAt, supersededAt?
audit     event id, planId, at, actor{userId, nameSnapshot}, action, before/after summary
```
\* `scenario` is supported by the model and rule set (a scenario can never be active and always names its baseline); the first build creates baselines only.

### 2.2 The three relationships (kept apart)

| Relationship | What it is | Rule |
|---|---|---|
| **Parent allocation** | A row inside a plan's allocation table (e.g. Riyadh's share of the Ministry target) | Not a plan. No owner, no version of its own. |
| **Independent plan** | A plan whose scope is one or more entities (e.g. a Riyadh plan) | Own target, owner, versions. **May overlap** a Ministry plan. |
| **Alternative scenario** | A what-if of one baseline | Never the reporting baseline; excluded from every consolidated figure. |

### 2.3 Rules

1. **No duplicate active baseline for an identical scope and period.** Activation is blocked when another active baseline has the same entity set and the same start/end; the message names that plan and offers «أرشفة الخطة الأخرى» or «تعديلها كإصدار جديد».
2. **Overlaps are otherwise allowed**: Ministry vs subordinate entity plan; an annual plan and a plan for a date range inside it. The detail page shows an informational **«خطط متداخلة»** note listing them. An entity plan also shows its **difference from the Ministry plan's allocation** for that entity (information, not an error).
3. **No double counting in consolidated reporting.** A consolidated figure is read from **one plan** — the broadest active baseline covering the requested scope and period. Entity plans are never added on top of a Ministry plan; no screen sums targets across plans.
4. **Which target an entity-level report uses (default, stated on the figure):** the entity's own active baseline when one covers the period exactly; otherwise its allocation in the Ministry plan. Each figure is labelled with the plan it came from.
5. **Authority:** a user may create/edit/activate a plan only when their effective scope covers every entity in it (a Ministry plan needs all-scope access). Viewers see plans whose scope intersects theirs, with figures for the intersection labelled «إجمالي الجهات المتاحة لك» (existing behaviour).
6. **Period:** end ≥ start. Default preset = **January–December**, shown as an **assumption pending business confirmation** wherever the fiscal year is named. Distribution rows are the calendar months the period touches; partial first/last months keep their row, and "planned to date" within the current month uses the existing calendar-day proration. The target of a shorter period is entered directly; it is never derived from an annual target.

---

## 3. Editing, allocation and version behaviour

### 3.1 Target

- **Primary input:** the collection target amount (SAR; shown in the platform unit with the exact amount in a tooltip).
- **Calculation aid (optional):** «احسب من الميزانية × نسبة التغطية» — shows the communicated budget of the scope's entities (chapters 1–3) and a coverage % and offers the product as a suggestion; «استخدم هذا المبلغ» fills the target. It is **not a live dependency**: the plan stores a note («اشتُق بتاريخ … من ميزانية × تغطية»), later edits to the target do not re-run it. Available only where budget data exists (today: 2026).
- **Advanced settings (collapsed):** collection-rate assumption, derived required billing, optional billing target. Used only by the billing-sufficiency factor; they never change achievement, deviation or forecast.

### 3.2 Allocation — top-down, nothing implicit

- The plan target is **fixed**; allocation rows distribute it. Each row = entity, **amount**, share of target (derived), origin (`يدوي` / `موزَّع` / `مُرحَّل`).
- A bar above the table always shows three numbers: **المخصَّص**, **غير المخصَّص** (target − allocated, when positive) and **الزيادة** (allocated − target, when positive), in text and colour (colour never the only cue).
- A new plan starts with all rows empty: unallocated = target. **Nothing is distributed, spread or recalculated until the user presses an action.**
- **«توزيع المتبقي»** (explicit): choose the basis — by revenue-appropriation share · equally · in proportion to current allocations — and the rows it may fill (default: only empty rows). A **before/after preview** (per row and totals) appears; **تطبيق** or **إلغاء**. Rows with amounts are never touched unless the user ticks them into the preview. A second action, **«إعادة توزيع المستهدف كاملاً»**, behaves the same way for all rows.
- Changing the **target** never edits rows: the bar simply shows the new unallocated/excess amount with a prompt to run the action.
- Migrated allocations keep their current computed amounts as `مُرحَّل` rows with a note of the old rule, so no number changes silently.

### 3.3 Monthly distribution

- A plan holds one **explicit profile** (equal · manual · copied from another plan's profile). The profile name is shown wherever planned-to-date appears: «توزيع متساوٍ (افتراض)» when equal.
- The editor shows each month's % and amount plus **المجموع** and **المتبقي** (100 − total). Never normalised: a total ≠ 100 % is shown in text and colour and blocks activation (draft save still allowed).
- Explicit actions: **«توزيع بالتساوي»** (all months equal) and **«توزيع المتبقي»** (spread the remaining % over the months you pick), both with a before/after preview.
- Per-entity monthly overrides are optional; entity months must also total 100 %; plan months = Σ entity months by construction.
- Changing the **period** shows which months are added/removed and asks for confirmation; it does not rescale anything.

### 3.4 Draft vs reporting baseline

| | Draft save | Activation (becomes the reporting baseline) |
|---|---|---|
| Allowed with unallocated or excess amount | Yes | **No** — allocated must equal the target to the riyal |
| Monthly total ≠ 100 % | Yes | **No** |
| Target empty/zero | Yes (flagged) | **No** — target > 0 |
| Profile not chosen | Yes | **No** — an explicit profile is required |
| Duplicate active baseline, same scope + period | Yes | **No** — rule 2.3-1 |
| Scope outside the user's authority | **No** | **No** |
| Invalid dates, negative or non-numeric amounts | **No** | **No** |
| Permission | `planning` module, not read-only role, scope coverage | the same — no finer permission exists and none is invented |

A draft never feeds any report; it is labelled «مسودة» everywhere it appears. Activation shows the check list with each result; failing checks name what to fix. The word «معتمدة» is not used anywhere.

### 3.5 Versions, audit, concurrency

- **Versions = activations.** Each activation stores a full snapshot (v1, v2, …) that stays retrievable and read-only; the previous version becomes *superseded*. Draft edits are not numbered versions (the old behaviour of bumping on every field change goes away).
- Editing an active plan creates a **working revision**; reports keep reading the version in force until «تفعيل». A revision is a version of the same plan, never a new plan.
- **Archive** removes a plan from reporting but keeps every version and audit event; **restore** returns it to active if the checks and the duplicate rule pass.
- **Audit events** (all actions, with actor id and name snapshot): create, save draft, edit field summary, distribute (with basis), activate, archive, restore, import, seed. Never truncated.
- **Concurrency:** saves carry the `revision` they read; a stale save returns a conflict naming the last editor, and nothing is overwritten.
- **Version view:** open any version read-only and compare it with the version in force (target, allocation, distribution, assumptions).

### 3.6 Ownership and storage

- **Owner = authenticated creator**, stored as `userId` with a name snapshot; shown by resolving the current name from the id. **Read-only, immutable.** Another user's edit changes only `lastEditedBy`/`updatedAt` — the owner never changes.
- **Shared server persistence** through the existing data service: `server/.data/plans.json` (atomic write, git-ignored, audit inside), `/api/plans` endpoints behind `endpointAccess.js` with scope masking. Clients hydrate a plan cache after sign-in; `planTarget()` and `viewerTargets()` keep their output shape, so the Decision Room, Smart Reports, the assistant and the fixed reports read the same shared numbers.
- **Legacy records:** the browser's saved target (`ib_plan_targets_v1`) is **preserved untouched** and shown with its original metadata (version id, free-text owner, last-editor name, status flag, dates) as a read-only «سجل سابق». It is never re-labelled as an owner or as formal approval. Ownership stays **unknown**; no reassignment feature is built, and none is a prerequisite.
  - The server seeds one **illustrative 2026 baseline** (the current default computation, equal profile labelled, owner unknown, `origin: seed`) so reports have a target on day one.
  - A user may **import** this device's saved target as a **draft** with an audit event; an import never auto-activates.
- Local development files stay git-ignored; whether the hosted function deployment can keep this file store is not verified and must be checked before any deployment (nothing is deployed in this work).

---

## 4. Approval — what exists, what is proposed

- **Found:** no approval process, approver, or workflow. The page's old «معتمد» dropdown is self-service and has no meaning beyond a label.
- **Proposed states:** `مسودة` → `فعّالة` → `مؤرشفة`. Authorised actions are all gated by one permission (planning module, not read-only, scope coverage): create, edit draft, activate, archive, restore, import. Every action is audited with its actor. The UI never says «معتمدة»; the wording is «فعّالة» and «مفعّلة كأساس للتقارير».
- **Version locking in the business sense** (who may approve, whether approval freezes edits) is a **separate unresolved decision** (§7). Technically, activated snapshots are already immutable and retrievable.

---

## 5. Technical decisions in plain language (D-03, D-04, D-05)

### D-03 — Monthly profile (what "planned to date" means)

| | |
|---|---|
| **Current behaviour** | With no saved weights the plan assumes **equal months** («توزيع متساوٍ — افتراض»); the current month is prorated by calendar days. At 6 Nov this puts ≈ 85 % of the year's target (22.24 bn of 26.16 bn at the 80 % setting in this browser) "planned" already. |
| **Recommended default** | Every plan stores an **explicit profile**; creating a plan requires choosing one (equal / manual / copy). Equal distribution is permitted but **labelled** on the header chip and next to every planned-to-date figure. Do not infer seasonality from history. |
| **Financial effect** | Changes only **planned to date**, **نسبة الإنجاز مقابل المخطط**, the signed deviation and the entity gap ranking/«أين نركز» order. The target, actual, achievement-to-date, forecast and expected achievement are **unchanged**. A back-loaded profile lowers planned-to-date and shrinks today's deviation. |
| **Evidence / limitation** | No monthly plan file exists in the repository; 22 months of synthetic receipts cannot establish seasonality; Finance's profile (if one exists) is needed for real use. |

### D-04 — On-plan tolerance

| | |
|---|---|
| **Current behaviour** | A default ±0.5 % band (display resolution, not an approved threshold) turns the deviation into «متقدم / وفق الخطة / متأخر» with a symbol; the Decision Room additionally drops entities labelled `on_plan` from its items. |
| **Recommended default** | **Show the signed deviation (amount) and the نسبة الإنجاز مقابل المخطط; no classification.** Wording describes the sign only («أقل من المخطط بمقدار …»). A classification returns only when Finance supplies a threshold, stored as a versioned parameter with its basis. |
| **Financial effect** | **None** — no amount, ratio or forecast uses the tolerance. Visible effects: the position badge disappears; Decision Room item selection must stop depending on `on_plan` (it keeps its own gap thresholds, 10 %/25 %, which are separate demo values — flagged, not changed here). |
| **Evidence / limitation** | No source for any threshold exists in the repository. |

### D-05 — Forecast method and date alignment

| | |
|---|---|
| **Current behaviour** | One explainable baseline: the average of the **last three complete months** carried forward, the rest of the current month prorated by days; no seasonality, no recovery of overdue balances, no confidence range; stated as not aligned with the forecasting teams. |
| **Recommended default** | Keep it as the single baseline, and **validate date alignment** in the model: the forecast's `asOf`, its window months and the actual's cut-off must match the plan's cut-off; the window may contain only complete months before it; a forecast whose as-of differs is rejected, not displayed. Every figure carries «حتى {cut-off} على بيانات حتى {latest data}», the method id and window. Any future approved forecast plugs in through the same contract (total, as-of, method id, window). |
| **Financial effect** | Determines only the expected end-of-period collection, **نسبة التحقيق المتوقعة**, the expected gap and the pace comparison. |
| **Evidence / limitation** | No forecasting-team material exists in the repository; no back-test is possible (no payment load date; short history). |

---

## 6. Keep / merge / remove (final)

| Element | Decision |
|---|---|
| `/planning` as one fiscal-year page | **Replace** by list + detail |
| Four target tiles (target, coverage, collection, required billing) | **Merge**: target → summary (once); the rest → advanced settings |
| Target value repeated in position/forecast/chart/context | **Remove** repeats; named, with value in info-tip |
| Version / status / owner controls | **Replace** by read-only header + state chip; «تفعيل» action; owner read-only |
| «معتمد / توضيحي» dropdown | **Remove** (replaced by draft/active/archived) |
| Version bump on every edit | **Replace** by activation snapshots + audit |
| Per-entity coverage/collection table and override toggle | **Replace** by the top-down allocation editor |
| 12 weight inputs with silent rescale | **Replace** by the distribution editor (total, remaining, explicit actions) |
| Probability block | **Remove**; one sentence + dictionary |
| On-plan badge and tolerance label | **Remove**; signed deviation only |
| Deviation % | **Replace** by نسبة الإنجاز مقابل المخطط (amount stays) |
| Context chip repeating version/status | **Remove** |
| Cumulative chart, forecast block, assumptions collapsible, deviation bars, action table, factors | **Keep** |
| Browser-local target store | **Retire as source**; keep as legacy record + optional import |

---

## 7. Implementation phases and acceptance criteria

| Phase | Scope | Acceptance criteria |
|---|---|---|
| **P0 — Definitions** | Rename/add the three percentages; remove probability block, tolerance badge and deviation %; label equal distribution; dictionary and tests updated; Decision Room stops using `on_plan` | Labels and formulas exactly as §1.3; **no amount, ratio or forecast changes** (existing planning/cross-surface tests unchanged apart from removed labels); no «احتمالية» on any ratio; forecast date-alignment check present with a test for a mismatched as-of |
| **P1 — Shared plans** | `plans.json` store, `/api/plans` (list, get, create, patch draft, activate, archive, restore, versions, audit), scope masking, `endpointAccess` entries, optimistic concurrency, owner by user id, seed 2026 baseline, device import as draft, client plan cache feeding `planTarget()`/`viewerTargets()` | Two sessions see the same plan; owner immutable and never changed by edits; stale save → conflict; legacy record preserved byte-for-byte and shown read-only; every consumer (page, Decision Room, Smart Reports, assistant, fixed reports) reads identical targets; unauthorised scope → 403; no secrets in any payload; audit event for each action |
| **P2 — List and routes** | `/planning` list (8 columns, filters, mobile cards), `/planning/:planId`, redirects for old links, create/copy | Columns and states per §1.1; filters work; restricted viewers see intersection figures labelled; list shows no cross-plan totals; drafts show no expected achievement; accessibility and RTL/English checked |
| **P3 — Detail and editor** | Header, readiness chips, single summary, editor panel/sheet with tabs, advanced settings, version view/compare | Target value appears once on the detail page; «تعديل الخطة» opens the editor; read-only users see a disabled control with a reason; budget × coverage aid never stores a live link; version snapshot retrievable and read-only |
| **P4 — Allocation and distribution** | Top-down editor, allocated/unallocated/excess bar, explicit distribute actions with before/after preview, monthly total/remaining, equal/remaining actions, activation check list, migration of old allocations as `مُرحَّل` rows | No value changes without a preview-confirmed action; Σ allocations = target to activate; months total 100 % to activate; draft saves with incomplete data; migrated numbers identical to today's; overlap rules (identical scope + period blocked, other overlaps allowed and shown) enforced and tested; consolidated figures read one plan only |
| **P5 — Date ranges** | Range periods in create/edit, months-touched distribution, scenario type in the model only | A range plan is entered directly (never derived from an annual one); partial months keep one row; the calendar assumption is shown for the fiscal-year preset |

**Invariants every phase:** approved financial identities unchanged (net, uncollected, collection rate = collected ÷ net, achievement = collected ÷ target); invoice composite identity unchanged; synthetic data only; no passwords/hashes anywhere; terminology test green; `npm test`, `verify:exports`, `verify:identity`, `check-undef` and the build green. Visual check in Arabic and English, desktop and 375 px, and with a restricted and a read-only account.

---

## 8. Remaining essential business decisions

| ID | Decision | Why it cannot be settled from evidence | Default used until answered |
|---|---|---|---|
| B1 | **Formal approval and version locking** — whether an approval step, an approver and edit-locking are required | No approval process, role or record exists | Draft/active/archived; activation is not called approval; snapshots immutable but the plan can be revised |
| B2 | **Fiscal calendar** — is the fiscal year January–December? | Hard-coded; no Finance source | January–December, labelled as an assumption |
| B3 | **Monthly profile and entity-level targets of record** — does Finance supply an approved monthly profile, and may an entity plan differ from the Ministry's allocation to that entity? | No profile file; entity plans do not exist yet | Explicit profile (equal, labelled); an entity may differ and the difference is shown |
| B4 | **On-plan threshold** — does Finance want a classification, and at what threshold? | None exists | Signed deviation only |
| B5 | **Forecast alignment** — which forecast owns the platform's number? | No forecasting-team material | The labelled run-rate baseline with alignment validation |

Resolved by direction (not open): owner rule, shared persistence, overlap policy, top-down allocation, probability removal, legacy preservation, no sector/program classification.
