// Tests of the conversational workspace of «التقارير الذكية»: the chat-level intents, reading of attached files (CSV · Excel · Word · PowerPoint · PDF · image),
// the analysis against the system data, the view (chart type / only tables), and the five export formats. Run with `npm run test:chat`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph } from 'docx';
import pptxgen from 'pptxgenjs';
import { interpretChat } from '../src/data/chatIntents.js';
import { parseNum, toTable, profileColumns, readAttachment, previewOf, attachmentPages, latinDigits } from '../src/data/chatFiles.js';
import { buildAttachmentModel, refsOfAttachments, detectGroup, matchAmanah } from '../src/data/chatAnalysis.js';
import { applyView, mergeView, emptyView, hasCharts, hasTables } from '../src/data/reportView.js';
import { buildCsv, modelToHtml, modelToLines, buildDocx, buildWorkbook } from '../src/utils/exportReportModel.js';
import { chartSvg } from '../src/utils/chartDraw.js';
import { tableToText, chartInfo } from '../src/data/reportFormat.js';
import { loadStore } from '../server/store.js';
import { snapshot, idOf } from '../server/engine.js';
import { resolveReferences } from '../server/orderMatch.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { defaultSpec, interpret } from '../src/data/reportIntents.js';
import { parsePeriod } from '../src/data/assistantRouter.js';
import { suggestionsFor } from '../src/data/reportSuggestions.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
const okA = async (name, fn) => { await fn(); n += 1; };
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-09'; const cfg = { cutoff: TODAY };

/* ---------------- numbers and tables ---------------- */
ok('parseNum', () => {
  assert.equal(parseNum('1,234.50'), 1234.5); assert.equal(parseNum('١٢٣٤'), 1234); assert.equal(parseNum('SAR 500'), 500); assert.equal(parseNum('1 234 ر.س'), 1234); assert.equal(parseNum('(250)'), -250); assert.equal(parseNum('12.5%'), 12.5);
  assert.ok(Number.isNaN(parseNum('177-2200000123'))); assert.ok(Number.isNaN(parseNum('الرياض'))); assert.ok(Number.isNaN(parseNum(''))); assert.ok(Number.isNaN(parseNum(null)));
  assert.equal(latinDigits('٣٫٥'), '3.5');
});
ok('toTable finds the header row, de-duplicates names, drops empty rows', () => {
  const t = toTable([[], ['تقرير'], ['البلدية', 'المبلغ', 'المبلغ'], ['الرياض', 100, 5], [], ['جدة', 50, 6]]);
  assert.deepEqual(t.headers, ['البلدية', 'المبلغ', 'المبلغ (2)']); assert.equal(t.rows.length, 2);
});

/* ---------------- chat intents ---------------- */
const R = { hasResult: true, resultKind: 'report', hasCharts: true, hasTables: true, pendingFiles: 0 };
ok('intents: chart type', () => {
  assert.deepEqual(interpretChat('غيّر الرسم إلى خطي', R), { type: 'chart', kind: 'line' });
  assert.deepEqual(interpretChat('change the chart to a pie chart', R), { type: 'chart', kind: 'pie' });
  assert.deepEqual(interpretChat('اعرضه كرسم أعمدة', R), { type: 'chart', kind: 'bar' });
  assert.equal(interpretChat('غيّر الرسم', R).type, 'need', 'no kind named → asks which');
  assert.equal(interpretChat('غيّر الرسم إلى خطي', { ...R, hasCharts: false }).type, 'need', 'a result without a chart is said so, never faked');
  assert.equal(interpretChat('غيّر الرسم إلى خطي', { ...R, hasResult: false }).type, 'need');
});
ok('intents: formats', () => {
  assert.deepEqual(interpretChat('حوّله إلى عرض تقديمي', R), { type: 'export', format: 'pptx' });
  assert.deepEqual(interpretChat('turn this into a presentation', R), { type: 'export', format: 'pptx' });
  assert.deepEqual(interpretChat('صدّره Word', R), { type: 'export', format: 'docx' });
  assert.deepEqual(interpretChat('أعطني ملف PDF', R), { type: 'export', format: 'pdf' });
  assert.deepEqual(interpretChat('export to excel', R), { type: 'export', format: 'xlsx' });
  assert.deepEqual(interpretChat('نزّله CSV', R), { type: 'export', format: 'csv' });
  assert.equal(interpretChat('حوّله إلى عرض تقديمي', { ...R, hasResult: false }).type, 'need', 'nothing to export yet');
  assert.equal(interpretChat('أنشئ تقرير الإيرادات لهذا الشهر وصدره Excel', R), null, 'a bigger request is left to the report interpreter (never half-handled)');
});
ok('intents: only / summary / regroup / files', () => {
  assert.deepEqual(interpretChat('اعرض الجداول فقط', R), { type: 'only', only: 'tables' });
  assert.deepEqual(interpretChat('show only the charts', R), { type: 'only', only: 'charts' });
  assert.deepEqual(interpretChat('اعرض الكل', R), { type: 'only', only: 'all' });
  assert.deepEqual(interpretChat('لخّص النتيجة', R), { type: 'summary' });
  assert.deepEqual(interpretChat('قارن حسب البلدية', R), { type: 'section', dim: 'municipality', text: 'قارن حسب البلدية' });
  assert.equal(interpretChat('compare by municipality', { ...R, resultKind: 'attachments' }).type, 'regroup');
  assert.equal(interpretChat('قارن حسب البلدية', { ...R, hasResult: false }), null, 'with no result the report interpreter handles it');
  assert.deepEqual(interpretChat('حلل حسب الأمانة', { pendingFiles: 2 }), { type: 'attach', groupTerm: 'امانة' });
  assert.equal(interpretChat('', { pendingFiles: 1 }).type, 'attach');
  assert.equal(interpretChat('تقرير الإيرادات لشهر مارس حسب الأمانة', R), null, 'a period next to a dimension is a new report');
  assert.equal(interpretChat('قارن بالشهر الماضي', R), null);
});

/* ---------------- reading files ---------------- */
const asFile = (name, bytes, type = '') => { const f = new File([bytes], name, { type }); return f; };
const sheetBytes = (aoa, bookType = 'xlsx') => XLSX.write((() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S1'); return wb; })(), { type: 'buffer', bookType });

const st = loadStore(TODAY);
const someIds = []; for (let i = 0; i < st.nGen && someIds.length < 3; i += 1) { if (st.issue[i] < 20000) someIds.push({ i, id: idOf(st, i) }); }
await okA('CSV with Arabic headers and an invoice column', async () => {
  const csv = `البلدية,المبلغ,رقم الفاتورة\nأمانة منطقة الرياض,"1,000",${someIds[0].id}\nأمانة محافظة جدة,500,${someIds[1].id}\nأمانة منطقة الرياض,250,999-000000000001\n`;
  const rec = await readAttachment(asFile('data.csv', new TextEncoder().encode(csv), 'text/csv'));
  assert.equal(rec.kind, 'csv'); assert.equal(rec.status, 'ready'); assert.equal(rec.tables[0].rows.length, 3);
  const prof = profileColumns(rec.tables[0]); assert.equal(prof[1].numeric, true); assert.equal(prof[1].sum, 1750); assert.equal(prof[0].numeric, false);
  const g = detectGroup(rec.tables[0], prof); assert.equal(g.group.header, 'البلدية'); assert.equal(g.measure.header, 'المبلغ'); assert.equal(g.groups[0].key, 'أمانة منطقة الرياض'); assert.equal(g.groups[0].sum, 1250);
  assert.equal(detectGroup(rec.tables[0], prof, { groupTerm: 'بلدية' }).group.header, 'البلدية'); assert.equal(detectGroup(rec.tables[0], prof, { groupTerm: 'قطاع' }).missing, 'قطاع', 'a column that does not exist is reported, not invented');
  const pv = previewOf(rec); assert.equal(pv.type, 'table'); assert.equal(pv.totalRows, 3);
  assert.ok(attachmentPages(rec)[0].text.includes(someIds[0].id));
});
await okA('Excel with two sheets, Word, PowerPoint, image, legacy and garbage', async () => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['المصدر', 'القيمة'], ['غرامات', 10], ['رسوم', 20]]), 'A'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x', 'y'], [1, 2]]), 'B');
  const x = await readAttachment(asFile('book.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
  assert.equal(x.kind, 'sheet'); assert.equal(x.tables.length, 2); assert.equal(x.status, 'ready');
  const d = await readAttachment(asFile('memo.docx', await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('خطاب رسمي'), new Paragraph(`الفاتورة ${someIds[0].id}`)] }] }))));
  assert.equal(d.kind, 'docx'); assert.ok(d.text.includes('خطاب رسمي'));
  const p = new pptxgen(); p.addSlide().addText('شريحة أولى', { x: 1, y: 1, w: 5, h: 1 }); p.addSlide().addText('Second slide', { x: 1, y: 1, w: 5, h: 1 });
  const pp = await readAttachment(asFile('deck.pptx', await p.write({ outputType: 'nodebuffer' })));
  assert.equal(pp.kind, 'pptx'); assert.equal(pp.pageCount, 2); assert.ok(pp.text.includes('شريحة أولى') && pp.text.includes('Second slide'));
  const img = await readAttachment(asFile('scan.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), 'image/png'));
  assert.equal(img.kind, 'image'); assert.equal(img.status, 'unread'); assert.ok(img.note.ar.includes('OCR'), 'an image is never reported as read');
  const legacy = await readAttachment(asFile('old.doc', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])));
  assert.equal(legacy.status, 'unread'); assert.equal(legacy.kind, 'doc');
  const junk = await readAttachment(asFile('x.bin', new Uint8Array([1, 2, 3])));
  assert.equal(junk.status, 'unread');
  const big = await readAttachment(asFile('big.pdf', new Uint8Array(1)), {}); assert.ok(big.status === 'unread' || big.status === 'ready');
});
const SPEC = 'pdfjs-dist/legacy/build/pdf.mjs'; const pdfLib = await import(SPEC);
await okA('PDF: digital sample is read page by page', async () => {
  const bytes = new Uint8Array(fs.readFileSync('public/samples/enforcement-orders/EN-5026-multi_partial_refs.pdf'));
  const rec = await readAttachment(asFile('order.pdf', bytes, 'application/pdf'), { pdfLib });
  assert.equal(rec.kind, 'pdf'); assert.ok(['ready', 'partial'].includes(rec.status)); assert.ok(rec.pageCount >= 1 && rec.text.length > 50);
  assert.ok(refsOfAttachments([rec]).total >= 1, 'the invoice references of the order are found');
});

/* ---------------- analysis against the system ---------------- */
await okA('analysis: exact matching, honest counts, system comparison, limits', async () => {
  const csv = `الأمانة,المبلغ,رقم الفاتورة\nأمانة منطقة الرياض,"1,000",${someIds[0].id}\nأمانة محافظة جدة,500,${someIds[1].id}\nأمانة منطقة الرياض,250,999-000000000001\nمجهول,10,\n`;
  const rec = await readAttachment(asFile('data.csv', new TextEncoder().encode(csv), 'text/csv'));
  const img = await readAttachment(asFile('scan.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), 'image/png'));
  const refs = refsOfAttachments([rec, img]); assert.equal(refs.total, 3);
  const resolved = resolveReferences(st, { refs: refs.unique, cfg });
  const snap = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  const m = buildAttachmentModel({ atts: [rec, img], refs, resolved, snapshot: snap, scopeText: '2026', lang: 'ar', cutoff: TODAY });
  assert.equal(m.refStats.references, 3); assert.equal(m.refStats.invoices, 2); assert.equal(m.refStats.unmatched, 1);
  const secs = m.sections.map((s) => s.key); assert.ok(secs.includes('files') && secs.includes('refs') && secs.includes('data0') && secs.includes('limits'));
  const files = m.sections[0].blocks[0]; assert.equal(files.rows.find((r) => r[0] === 'scan.png')[4], 'لم يُقرأ');
  const lim = m.sections.find((s) => s.key === 'limits').blocks[0].items.join(' '); assert.ok(lim.includes('OCR') && lim.includes('scan.png'));
  const data0 = m.sections.find((s) => s.key === 'data0');
  const cmp = data0.blocks.find((b) => b.id === 'cmp0'); assert.ok(cmp, 'group names that ARE Amanahs are compared with the system'); assert.ok(cmp.note.includes('بالريال'), 'the unit assumption is stated');
  assert.ok(data0.blocks.some((b) => b.type === 'chart' && b.plain), 'file numbers are charted as plain numbers, never as SAR');
  assert.equal(matchAmanah('أمانة منطقة الرياض') != null, true); assert.equal(matchAmanah('مجهول'), null);
  // regrouping by a column that does not exist says so
  const m2 = buildAttachmentModel({ atts: [rec], refs, resolved, snapshot: snap, scopeText: '', lang: 'en', groupTerm: 'قطاع', cutoff: TODAY });
  assert.ok(m2.sections.find((s) => s.key === 'limits').blocks[0].items.join(' ').includes('No column matches'));
  // the model drives every export
  const lines = modelToLines(m); assert.ok(lines.length > 10);
  const csvOut = buildCsv(m); assert.ok(csvOut.startsWith('﻿') && csvOut.includes('الملفات المرفقة') && csvOut.includes(someIds[0].id));
  const html = modelToHtml(m); assert.ok(html.includes('dir="rtl"') && html.includes('<svg') && html.includes('الملفات المرفقة'));
  assert.ok(Buffer.byteLength(await Packer.toBuffer(buildDocx(m))) > 3000);
  const wbk = buildWorkbook(m); assert.ok(wbk.SheetNames.length >= 3);
  const pl = (() => { const b = data0.blocks.find((x) => x.type === 'chart'); return chartInfo(b, 'ar'); })(); assert.equal(pl.unitText, '', 'a plain chart has no SAR unit');
  const tt = tableToText(data0.blocks.find((b) => b.id === 'grp0'), 'ar'); assert.ok(tt.rows[0][2].includes('1,250') || tt.rows[0][2].includes('1,250'), 'plain numbers keep their value and get thousands separators');
  assert.equal(JSON.parse(JSON.stringify(m)).title, m.title, 'the model is plain JSON (it is stored with the conversation)');
});

/* ---------------- views ---------------- */
ok('views: chart type and only-parts apply to the model and are reflected in every export', () => {
  const snap = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const spec = { ...defaultSpec(TODAY), sections: ['executive', 'trends', 'sources'], scope: { ...defaultSpec(TODAY).scope, from: '2026-01-01', to: TODAY } };
  const cash = { months: snap.byMonth.map((x) => x.month), values: snap.byMonth.map((x) => x.collected) };
  const model = buildReportModel({ spec, lang: 'ar', out, cash, targets: DEFAULT_TARGETS, cases: [], meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
  assert.equal(hasCharts(model), true); assert.equal(hasTables(model), true);
  const line = applyView(model, { chartKind: 'line' }); assert.ok(line.changed >= 1); assert.ok(line.model.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart').every((b) => b.kind === 'line'));
  assert.ok(chartSvg(line.model.sections.flatMap((s) => s.blocks).find((b) => b.type === 'chart'), { lang: 'ar' }).includes('<path'), 'line chart is drawn as a path');
  const pie = applyView(model, { chartKind: 'pie' }); assert.ok(pie.skipped >= 1 && pie.changed === 0, 'a multi-series chart is not turned into a pie');
  const only = applyView(model, mergeView(emptyView(), { only: 'tables' })).model; assert.equal(only.headline.length, 0); assert.ok(only.sections.every((s) => s.blocks.every((b) => b.type === 'table')));
  const htmlLine = modelToHtml(line.model); assert.ok(htmlLine.includes('<path'), 'the printed document carries the chart as the user last set it');
  assert.ok(buildCsv(only).split('\r\n').length > 5);
  for (const k of ['bar', 'hbar', 'line']) { const b = model.sections.flatMap((s) => s.blocks).find((x) => x.type === 'chart'); const svg = chartSvg({ ...b, kind: k }, { lang: 'en' }); assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>')); }
  const one = { type: 'chart', kind: 'pie', plain: true, valueTitle: 'v', title: 't', labels: ['a', 'b'], series: [{ label: 's', values: [3, 1] }] };
  assert.ok(chartSvg(one, { lang: 'ar' }).includes('75.0%'));
});

/* ---------------- interactivity (phase 1) ---------------- */
ok('reading the request: a numbered month with a glued preposition and Arabic digits is that month; the Amanah section is recognised in a list; «مقسم» is a known word', () => {
  for (const q of ['لشهر 6 2026', 'لشهر ٦ ٢٠٢٦', 'بشهر 6 2026']) assert.deepEqual([parsePeriod(q, TODAY).from, parsePeriod(q, TODAY).to], ['2026-06-01', '2026-06-30'], q);
  assert.equal(parsePeriod('شهر ٣ ٢٠٢٥', TODAY).from, '2025-03-01');
  const r = interpret('تقرير الإيرادات للسنة حتى اليوم حسب المصدر والأمانة والاتجاه الشهري', null, TODAY); assert.deepEqual(r.spec.sections, ['trends', 'amanah', 'sources']);
  const m = interpret('تقرير الإيرادات مقسم على مصادر الإيرادات لشهر ٦ ٢٠٢٦', null, TODAY); assert.equal(m.kind, 'report'); assert.equal(m.spec.scope.from, '2026-06-01'); assert.deepEqual(m.spec.sections, ['sources']);
});
ok('report tables: the Amanah and source rows carry a link to the uncollected invoices of that row, with the report’s own period; the links line up with the rows', () => {
  const snap = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const spec = { ...defaultSpec(TODAY), sections: ['executive', 'amanah', 'sources'], scope: { ...defaultSpec(TODAY).scope, from: '2026-01-01', to: TODAY } };
  const model = buildReportModel({ spec, lang: 'ar', out, targets: DEFAULT_TARGETS, cases: [], meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
  const blocks = model.sections.flatMap((x) => x.blocks); const am = blocks.find((b) => b.id === 'amanah'); const so = blocks.find((b) => b.id === 'sources');
  assert.equal(am.links.length, am.rows.length); assert.equal(so.links.length, so.rows.length);
  for (const l of [...am.links, ...so.links]) { assert.ok(l.startsWith('/collection?') && l.includes('from=2026-01-01') && l.includes(`to=${TODAY}`)); }
  assert.ok(am.links.every((l) => l.includes('amanah=')) && so.links.every((l) => l.includes('src=')));
  assert.ok(!am.links.some((l) => l.includes('src=')), 'the Amanah row does not invent a source');
  // suggestions come from the report itself
  const sg = suggestionsFor(model, spec); assert.ok(sg.length >= 2 && sg.length <= 4);
  const topAm = am.rows.slice().sort((a, b) => b[6] - a[6])[0][0]; assert.ok(sg.some((x) => x.ar === `اعرض ${topAm} فقط`), 'the Amanah with the largest uncollected balance is suggested');
  assert.ok(!sg.some((x) => /مصادر الإيراد/.test(x.ar) && x.ar.startsWith('أضف')), 'a section already in the report is not offered again');
  assert.ok(sg.some((x) => x.ar === 'أضف الاتجاه الشهري'), 'a missing analysis is offered');
  const one = suggestionsFor(model, { ...spec, scope: { ...spec.scope, amanah: 'Riyadh Amanah' } }); assert.ok(!one.some((x) => x.ar === `اعرض ${topAm} فقط`), 'with one Amanah selected, no other Amanah is suggested');
  assert.deepEqual(suggestionsFor({ empty: true, sections: [] }, spec), []);
});

console.log(`chat workspace: ${n} test groups passed`);
