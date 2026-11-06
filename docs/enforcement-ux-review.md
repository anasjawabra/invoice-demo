# إدارة أوامر التنفيذ — BA and UX review, and the design brief

Reviewed 2026-11-05 on branch `feat/enforcement-sources` (screens at 1360 px, Arabic RTL, synthetic data). Guideline applied: the product's own design system (tokens in `src/styles/variables.css`, which follow the DGA Saudi digital-government palette: AA contrast, visible focus ring, green = primary), its record-page conventions (summary first, statuses kept separate, secondary detail collapsed — `docs/full-page-records.md`), WCAG 2.1 AA, and Nielsen's heuristics. No new visual language: shared components (`rp-*`, `oj-*`, `rv-*`) are reused.

## 1. Who uses the page and for what
| Persona | Job to be done | What they must see first |
|---|---|---|
| Revenue & Collection analyst | Work the queue: which requests / violations need action today | Counts per source that need action; one list with status, amount, what is missing |
| Reviewer | Confirm the invoices an order refers to, resolve Eefaa↔Mumtathil proposals | The document, the extracted references, the matches and what is pending |
| Sector head | Understand how much enforcement is moving and what it collected | 3–4 numbers, each with an unmistakable unit and source |

## 2. Findings (BA + UX)
**Information architecture**
* **F1 — one tab bar mixes four different things**: the source switch (الكل / سند / إيفاء), related invoice views (eligible, referred, contracts) and a utility (import). Users cannot tell what is a filter, a view or a tool. → *Source switch is its own control; related views are secondary; import is a header action.*
* **F2 — «الكل 88» adds Sanad requests and Eefaa violations**, contradicting the rule printed two lines above it ("units are never added"). → *Every segment shows only its own count.*
* **F3 — six KPI cards of three different units sit in one undifferentiated row**, with long unit sentences inside each card and a money value (`232.65 مليون ريال`) that is visually heavier than the counts beside it. The reader must parse text to know what is counted. → *Group by source (سند · إيفاء · التحصيل) with a group label; one short unit caption per card; long definitions in an info disclosure.*
* **F4 — a wall of disclaimers** (reading limits, synthetic notices, Eefaa warning) is permanently visible above every list; the real content is pushed below the fold. → *One quiet note with "details" disclosure; keep the demo/OCR chip in the header only.*

**Lists**
* **F5 — alarm fatigue**: «مستند سند غير متوفر» is a red chip on almost every Sanad row (the generated demo feed has no documents). Red then stops meaning "error". → *Semantic colour rule: red = conflict / failure only; amber = needs attention (missing document); grey = neutral/not applicable; green = done. Count of missing documents shown once as a filter.*
* **F6 — column noise**: the "ingestion · last import" column repeats "تغذية تجريبية (مولّدة)" on every row and wraps to three lines; the amount column repeats its definition under every number; the "source-specific" column is vague. → *Provenance moves to details (and a hover title); the amount definition moves to the column header (tooltip); the last column is renamed «المراجعة» and holds the one status that matters per source.*
* **F7 — weak scanning path**: the "open" action sits at the far end of the row, away from the identifier; only the number is a link in the Eefaa list. → *Whole row is a target with a visible «فتح ›» affordance next to the identifier; identifier has a muted sub-line (claim no. / serial).*
* **F8 — filters inconsistent between lists**: «الكل» has search + Amanah only; Sanad has a different set; Eefaa another. → *One toolbar pattern: search, source status, "needs action" toggle, more filters (collapsed), result count, active-filter chips, reset, sort.*

**Details pages**
* **F9 — Sanad order page: two competing document flows** (the original journey step 1–3 and the new document panel) are separated by unrelated sections, so the path *document → extraction → matching → confirm* is split and repeated. → *Sequence them under one heading; the page order follows the task.*
* **F10 — no way to jump** around long record pages. → *Sticky in-page section chips (anchors) on both detail pages.*
* **F11 — Eefaa details: provenance noise** — every value carries its report names in full underneath, so the key facts are hard to read. → *Key facts as a compact grid; provenance as numbered report badges with one legend; the per-report table is secondary (collapsed).*
* **F12 — dense, repeated explanatory paragraphs** (rp-limit callouts) inside sections. → *One callout per section at most; the rest as tooltip/disclosure.*

**Accessibility / consistency**
* **F13** — colour is the only carrier of some meanings (tones without icon/text). → status chips always carry text and an icon; **F14** — touch targets of small buttons below 44 px on phone width; **F15** — inconsistent chip vocabulary between lists and details (same status, two wordings).

## 3. Target design
**Landing** — header: title + one-line subtitle + actions on the leading side (`استيراد البيانات` outline button; the demo/OCR chip). KPI region: three labelled clusters — **سند** (طلبات سند · تحتاج إجراء), **إيفاء** (مخالفات إيفاء · تحتاج مراجعة), **التحصيل** (إجمالي المحصل من أوامر التنفيذ + caption «17 دفعة · 11 فاتورة»). Card = label · value (28 px, tabular) · one-line unit caption; a clickable card shows a chevron and an `aria-expanded` state. Under the KPIs one muted line «الأعداد بوحدات مختلفة ولا تُجمع — تفاصيل ▾». Navigation: source segmented control (الكل | سند | إيفاء, each its own count) then, visually lighter, related views (الفواتير القابلة للإحالة · الفواتير المحالة · العقود ذات الصلة).

**Lists** — toolbar pattern in F8; chips follow the colour rule in F5; columns:
* الكل (7 columns): **المصدر** (source tag سند / إيفاء) · **المعرّف** (id link + muted sub-line: claim no. for Sanad, serial no. for Eefaa) · الحالة كما وردت · الأمانة/البلدية · المبلغ ⓘ · المراجعة · فتح ›
* سند: رقم الطلب (+ رقم المطالبة) · الأمانة/البلدية · الحالة · المبلغ ⓘ · الفواتير المربوطة · المستند · المراجعة · فتح ›
* إيفاء: رقم المخالفة (+ الرقم التسلسلي) · الحالة كما وردت (+n) · الجهة/المدينة · قيمة المخالفة ⓘ · التنفيذ · ممتثل · الفواتير المرشحة · فتح ›

**Details** — common anatomy: breadcrumb → title block (kind, id, status chips) → summary figures → sticky section chips → sections in task order → secondary details collapsed.
* Sanad order: الملخص · الفواتير المربوطة · **من المستند إلى الربط** (document & extraction → review → confirm, one block) · الوصف الأصلي · السجل · المصدر والاستيراد (collapsed).
* Eefaa violation: الملخص · التفاصيل (grid, report badges) · التنفيذ · ممتثل · الفواتير المرتبطة · المصدر والاستيراد (collapsed, per-report table).

## 4. Acceptance checks
No combined Sanad+Eefaa count anywhere; red used only for conflict/failure; every status chip has text; all interactive elements keyboard-reachable with the shared focus ring; targets ≥ 44 px at phone width; no horizontal page scroll at 375 px; each list shows ≤ 7 columns at desktop; the same status uses the same wording in list and details; no information removed — anything demoted (provenance, ingestion, definitions) is still reachable in one step.
