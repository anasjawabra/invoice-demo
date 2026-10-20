# «التقارير الذكية» — conversational workspace

The page is one conversation. A person asks in Arabic or English, attaches files, and refines the latest result in plain words. Everything that is shown can be downloaded, and the file is built from the **same model and view** the conversation shows.

## What is real, and what is not
| Capability | Status |
|---|---|
| Natural Arabic / English requests, follow-ups, context | **Rule-based** (keywords + the period / Amanah / source parsers) — not a language model. The page says so. |
| Attachments: digital PDF, Word `.docx`, Excel `.xlsx/.xls`, CSV, PowerPoint `.pptx` | Read in the browser (`src/data/chatFiles.js`); nothing is uploaded. |
| Images, scanned PDFs, legacy `.doc` / `.ppt` | **Not read** (no OCR in this system). Images get a preview only; the result says so. |
| Analysis with system data | Invoice / Sadad / violation numbers in the files are resolved **exactly** against the system's invoices (the same resolver as enforcement orders); a column whose groups are Amanahs is compared with the system's figures for the conversation scope. Amounts in a file are assumed SAR only for that comparison, and the table says so. |
| Refinements of the latest result | change chart (bar / horizontal bar / line / pie), show only tables / charts / indicators, show everything, summarise, compare by municipality / Amanah / source / month (system reports add the section; attachment results regroup by that column). |
| Downloads | Word, PowerPoint (native charts), PDF (the browser's print dialog → «Save as PDF»), Excel, CSV. Charts are images in Word and in the printed PDF. |
| Honesty | A request that needs a result / chart that does not exist is answered with that fact and options; unread files and missing links (Sanad, Tahseel) are listed under «حدود التحليل». |

## Code map
- `src/data/chatIntents.js` — what a person says about the latest result or about attached files (in front of `reportIntents.interpret`, which is unchanged).
- `src/data/chatFiles.js` — reading files into records (`status: ready | partial | unread`, with the reason).
- `src/data/chatAnalysis.js` — attachments → report model (files, references vs system, tables, group + chart, comparison with the system, excerpts, limits).
- `src/data/reportView.js` — the view of a result (chart kind, parts shown); exports read the same view.
- `src/utils/chartDraw.js` — SVG charts for the PDF and the Word file.
- `src/utils/exportReportModel.js` — Word / PowerPoint / Excel (existing) + CSV + PDF + `exportModel(kind, model)`.
- `src/pages/SmartReports.jsx` — the conversation, composer (attach, drag & drop, chips with state and preview), result cards, history.

## Storage
Conversations stay in `localStorage` (`ib_smart_convs_v1`). The answer built from attached files (`amodel`, plain JSON, tables capped at 200 rows) is stored with the message; the files themselves are never stored, so «regroup» after a reload asks for the file again.

## Tests
`npm run test:chat` (also run by `npm test`): intents, every file type, matching, group detection, comparison, views and the CSV / HTML (PDF) / Word / Excel outputs.
