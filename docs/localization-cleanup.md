# Localization cleanup — Arabic and English only (2026-11-06)

The Chinese interface language was removed from the whole application. **Supported languages: العربية (default) and English.**
Nothing else is a language of the interface, of the data service, of reports or of exports.

## 1. Inventory (what was found, what was done)

| File / area | What it held | Action |
|---|---|---|
| `src/data/i18n.js` | `translations.zh` (~860 keys), `switched_zh`, a «Supports 中文» assistant subtitle | zh dictionary and keys deleted; subtitle now «Supports العربية / English»; merge loop is `['en','ar']` |
| `src/data/revenueI18n.js` | empty `zh: {}` registration | removed |
| `src/context/I18nContext.jsx` | `zh` as a language (`html lang zh-CN`; `T()` used an EMPTY suffix for zh, so base fields — which were Chinese — were the zh text) | rewritten: `lang` is `'ar' \| 'en'` only; `setLang` and the initial `sessionStorage.ib_lang` go through `normalizeLang`; `t()` falls back en → ar → key; `T()` = `pickText` |
| `src/data/lang.js` (new) | — | the ONE normaliser (`normalizeLang`), `readStoredLang` (reads + rewrites `ib_lang` once), `pickText` / `pickBi` (Ar ↔ En ↔ base fallback, never another language), `migrateLangFields` (stored data) |
| `src/data/mock.js` | 156 lines with Chinese: base `name` / `role` / `entity` / `amanah` / `label` fields, `item.zh`, `defendant.zh`, the unused `AGENTS` roster (12 agents, Chinese-first) | base fields now hold the English text (the Ar/En variants were already there); `.zh` sub-keys removed; `AGENTS` deleted (unused since the Agents page was removed, no importer); no record, id, amount or relation changed |
| `src/data/catalog.js` | `ENTITIES[].zh` (Amanah names) | removed; `ar` / `en` are the canonical fields |
| `src/data/revenueLedger.js` | `zh` on source labels, revenue sources, entity options | removed |
| `src/data/revenueMetrics.js` | `zh` on `NOT_CALCULABLE_LABEL`, `byAmanah` and amanah labels | removed |
| `server/engine.js`, `server/lists.js`, `server/materialize.js` | `labelOfEnt().zh`, row field `amanahZh`, record base `amanah: ent.zh` | removed; record base `amanah` = English name (as `entity` already was) |
| `src/components/invoices/CoreInvoiceTable.jsx`, `InvoiceListTable.jsx` | `lang === 'zh' ? r.amanahZh …` | Ar ↔ En fallback only |
| `src/data/exclusionUpload.js` | Amanah name matching accepted the Chinese name | matches `ar` / `en` only (an uploaded file's own text is data and is matched as written) |
| `src/utils/bi.js`, `actor.js`, `smartReport.js`, `revenueI18n.js` | comments / `actorName` branch for the base (Chinese) `name` | comments updated; `actorName` = nameAr (ar) / nameEn (otherwise) |
| `src/styles/variables.css` | CJK fallback fonts (`PingFang SC`, `Microsoft YaHei`, `Noto Sans SC`) in `--font` | removed; the stack is IBM Plex Sans Arabic → system Latin/Arabic fonts. No font files or locale assets existed under `public/` |
| `src/components/Layout.jsx`, `src/pages/Login.jsx` | zh buttons, labels, notice banner | removed by the header / sign-in rebuild (not part of this change) |
| `src/context/AuthContext.jsx` | stored session `ib_user` carried the Chinese base `name` / `role` / org name | on load the display fields are re-read from the demo accounts / organisations and the stored value is rewritten once |
| `src/data/localBackup.js`, `src/components/LocalDataPanel.jsx` | backup import | see §2 |
| `src/data/reportStore.js` | `modelOfRecord(rec, lang)` | see §2 |
| audit-entry names (`by`) | older entries hold the demo user's Chinese name | stored entries are never rewritten; `shownActor()` (`src/utils/actor.js`) shows them under the same person's English name in the decision, exclusion-upload, Sanad review/workflow, order and invoice-note views |
| `docs/` | statements that Chinese is supported / incomplete | `demo-handover.md` updated; `platform-audit-en.md` and `findings-register.md` (history) get a dated note at the top; `enforcement-sources-*.md` lose the ZH page title |
| `tests/localization.test.mjs` (new), `package.json` | — | `npm run test:l10n`, chained at the end of `npm test` |

Export / report language: `ExportDialog`, `exportReportModel`, `pdfReport`, `pptxDeckPlan`, `pptxTemplate`, `chartDraw` already offered and handled `ar` / `en` only (everything else is treated as English there); no change was needed. The PowerPoint templates (`public/templates/momah-{ar,en}.pptx`) are untouched.

## 2. Migration of saved Chinese preferences

| Stored value | Behaviour |
|---|---|
| `sessionStorage.ib_lang` = zh, zh-CN, cn, garbage, empty, an object string | read as `ar`; the key is rewritten to `ar` on first load. `en`, `en-US`, `EN` → `en`. Storage that throws → `ar` |
| `setLang(anything)` | normalised before it is stored or applied |
| `ib_user` (session) | name / role / organisation display fields refreshed from the demo accounts; rewritten once |
| Backup file (`localBackup`) | a Chinese preference at `lang`, `preferences.lang` or `data.ib_lang` imports normally, becomes `ar` (returned as `result.lang` and written to the session's `ib_lang`); `lang` / `language` / `locale` fields inside the stored records are normalised (only language-code-shaped strings; names, notes, amounts and attachments' text are copied unchanged). A backup without a preference leaves the current language alone. Export (`buildBackup`) never writes a language |
| Smart Reports stored records (`reportStore`) | `modelOfRecord` normalises the wanted language and the record's own: ar/en model first, then the other of ar/en, only then whatever is stored (never blank); a model whose `lang` is unsupported is returned as ar/en |
| URL | the app reads no language/locale URL parameter |
| `analysisStore`, `decisionStore`, `enforcementStore`, `collectionGoal` | store no language value (nothing to migrate) |

## 3. What was deliberately kept

* **Business data and user content**: no record, attachment, id, amount, composite key or exclusion was changed or removed. Plans, actions, notes and history already saved in a browser keep their text (including old audit names); only their display of the legacy actor name is localized.
* **`docs/checkpoints/phase0-pre-data.json`**: a point-in-time capture of stored records (it contains the old Chinese audit name) — data, not a statement of language support.
* **`docs/ocr-assessment/vision-probe-output.txt`**: raw output of an OCR probe listing the languages the operating system's Vision framework recognizes — not a product statement.
* **`api/_handler.mjs` and `dist-server/server.mjs`**: tracked build outputs that still contain the old bundle until `npm run build` is run.
* **`docs/platform-audit-en.docx`**: a built copy of the audit; regenerated from the `.md` when the audit is next exported.

## 4. Verification

* `node scripts/check-undef.mjs`; `npm run test:l10n` (normaliser table, `T()` fallbacks, dictionaries, demo data, backup + stored-report migration, repository scan: no Han characters and no quoted retired-language code or CJK font stacks in `src/` and `server/`; the allowlist of data fixtures that may keep source-language text is empty).
* In the running app: `ib_lang` set to the retired value then reload → Arabic (`html lang=ar dir=rtl`, key rewritten); Insights, Collection, Invoices, Exclusions, Enforcement, Contracts, Planning, Smart Reports, Decisions and Data Sources in `ar` and `en` contain no Han characters in `document.body.innerText`.
