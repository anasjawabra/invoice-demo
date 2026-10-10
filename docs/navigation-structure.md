# Navigation structure — daily operations vs system settings (branch `enforcement-order-matching`)

Synthetic-data demonstration; not production-ready. Preserves every calculation, data set and workflow; only where things live, what they are called, and the links between them changed. `demo-baseline-final` unchanged; nothing pushed or merged.

## 1. Review that led to the structure

| Question | Finding |
|---|---|
| Who uses «مصادر البيانات» and «قاموس المقاييس», and how often? | Administrators, data stewards and the occasional analyst or auditor; rarely, and not as part of a daily operational routine. Contents: source freshness, versions, the import log, report upload, open business decisions; metric definitions. They describe and configure *the system*, not the work it supports. |
| Was there a system-configuration area? | No. The only "settings" was the topbar control (language, theme, organisation, notifications, account), which holds **personal preferences**. |
| What did «جودة البيانات والمخاطر» contain? | Two jobs in one list. **Business review:** a possible duplicate, a struck-off registry, a deceased debtor, a value far from the Amanah baseline, an amount that differs from its line items, a payment on an excluded invoice. **Record stewardship:** missing mandatory fields, contracts not linked or matched, and links/exclusions awaiting a decision (decided elsewhere). |
| Roles in the demo | Manager (can review), auditor (read-only review), platform admin. No page is role-gated today and none was added: the dictionary must stay readable by everyone who meets a figure and asks "how is this calculated?". |

## 2. The structure

**Main bar:** لوحة المعلومات والتقارير · التخطيط المالي والاستراتيجي · إدارة التنفيذ · **وحدات تشغيلية ▾** · **إعدادات النظام** (set apart at the far end, with a gear icon).

* **وحدات تشغيلية** (daily work): سجل الفواتير · عدم التحصيل والاستبعادات · قائمة التحصيل · العقود والتنفيذ · **المخاطر والانحرافات**.
* **إعدادات النظام** (rare, configuration and administration; one sub-navigation + breadcrumb «إعدادات النظام › …» on each page):
  * **مصادر البيانات** — `/settings/data-sources` (source status, versions, imports, upload, open decisions; unchanged content);
  * **جودة البيانات** — `/settings/data-quality` (new home of the record-completeness worklist);
  * **قاموس المقاييس** — `/settings/metrics` (unchanged content).
* The topbar control is now **«التفضيلات والحساب»** (personal preferences), so it is not confused with system settings.

## 3. «المخاطر والانحرافات» — what it is and what it is not

* **Risks:** possible duplicate · struck-off registry · deceased debtor.
* **Deviations:** value anomaly against the Amanah baseline · amount conflict (header ≠ line items) · payment on an excluded invoice.
* Tiles: risk flags, deviations (counted per finding, an invoice can carry several), amount conflicts, collected-but-flagged. A flag is a reason to look, never a conclusion about the payer; collected invoices appear only labelled «للمراجعة فقط».
* Not on this page any more: missing mandatory fields, contract not linked / not matched, exclusions and enforcement links awaiting a decision → **جودة البيانات**.

## 4. «جودة البيانات» — where existing data-quality monitoring belongs

Data quality is monitoring of *the data*, owned by whoever administers it, and it sits beside the source-level status it explains (freshness, versions, matching results on «مصادر البيانات»). The page keeps the same worklist (same rows, same filters by finding, same «تحليل ومراجعة» action) for the five record-level findings and links to Noncollection and Enforcement management for the two that are decided there. The source page links to it («قائمة العمل على مستوى الفاتورة»), and the dashboard's data-completeness insight now drills to it.

## 5. Routes and links

| Route | Behaviour |
|---|---|
| `/risk` | unchanged address; page renamed **المخاطر والانحرافات** (menu, title, browser tab, return labels) |
| `/settings` | redirects to `/settings/data-sources` |
| `/settings/data-sources`, `/settings/data-quality`, `/settings/metrics` | new |
| `/data-sources`, `/metrics` | redirect to the new addresses (old links and bookmarks keep working) |

Repointed: the metric-definition popover, the data-freshness strip, the missing-fields and contract tiles (→ data quality), the Collection worklist note (names both pages), the data-completeness insight, the Data sources «records that need treatment» block, and the «العودة إلى …» return labels. Amount-conflict links still go to **المخاطر والانحرافات**.

## 6. Technical notes

* One list component, two pages: `src/components/revenue/IssueWorklist.jsx`; the split lives in one place, `src/data/issueGroups.js`.
* The data service's issue list accepts an optional group of codes (`codes`); without it the result is identical to before. A test asserts that every issue code and risk category belongs to exactly one page and that a group request returns the same per-code counts as the ungrouped one.
* Not changed: figures, formulas, scope handling, exports, the data service's other endpoints, permissions (none are role-gated), light/dark styling, Arabic RTL.

## 7. Open points

* Whether «إعدادات النظام» should be limited to administrators (and the dictionary to read-only for others) is a business decision; the demo has no role gating and none was invented.
* The data-sources page still shows its own record-quality counts for the whole base, while «جودة البيانات» follows the period and Amanah selected on the page; both are labelled with their scope.
