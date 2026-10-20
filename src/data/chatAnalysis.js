// Turns the files attached to a conversation (read by chatFiles.js) into a REPORT MODEL — the same structure the system reports use, so the
// answer is rendered in the conversation and exported (Word / PowerPoint / PDF / Excel / CSV) from one source.
// What is computed here is only what the files and the system data support:
//   · every column's real counts / sums (nothing assumed about meaning beyond the header words the person can see in the table)
//   · invoice references found in the files, resolved EXACTLY against the system's invoices (by the data service; never by amount, never by similarity)
//   · a table grouped by a column the person can choose (municipality, Amanah, type…), compared with the system's figures only where a group name IS an Amanah of the system
// Whatever cannot be read or compared is listed under «limits» — it is never filled in.
import { buildExtraction, INVOICE_KINDS } from './orderMatching';
import { attachmentPages, parseNum, profileColumns, kindLabel, noteText, sizeText } from './chatFiles';
import { amanahOptionsOf } from './revenueLedger';
import { normAr } from './assistantRouter';
import { sourceAr, sourceEn } from './insightsEngine';
import { ENTITIES } from './catalog';
import { CATEGORY_LABELS } from './revenueMetrics';

export const MAX_REFS = 400;
const CAP_ROWS = 200;
const H = (label, kind = 'text') => ({ label, kind });
const tbl = (id, title, headers, rows, { total = null, note = null } = {}) => ({ type: 'table', id, title, headers, rows, total, note });
export const fmtNum = (n) => (n == null || !Number.isFinite(n) ? '—' : Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));

/* ------------------------------------------------------------------ references */
// → { unique: [{kind,value}], byFile: { [attId]: [{kind,value}] } } — only references that can point at an invoice
export function refsOfAttachments(atts) {
  const byFile = {}; const seen = new Map();
  for (const a of atts) {
    const pages = attachmentPages(a); if (!pages.length) { byFile[a.id] = []; continue; }
    const ex = buildExtraction(pages, 'text_layer');
    byFile[a.id] = ex.refs.filter((r) => INVOICE_KINDS.includes(r.kind)).map((r) => ({ kind: r.kind, value: r.value }));
    for (const r of byFile[a.id]) { const k = `${r.kind}|${r.value}`; if (!seen.has(k)) seen.set(k, r); }
  }
  const all = [...seen.values()];
  return { unique: all.slice(0, MAX_REFS), byFile, total: all.length, capped: all.length > MAX_REFS };
}

/* ------------------------------------------------------------------ choosing the group and the measure of a table */
const DIM_WORDS = [
  ['municipality', /بلدي|municip/i], ['amanah', /امان|أمان|amanah|جه[ةه]|entity|authority/i], ['region', /منطق|region|مدين|city|محافظ|province/i],
  ['source', /مصدر|source|نوع|type|فئ|category|بند|خدم|service/i], ['status', /حال[ةه]|status/i], ['month', /شهر|month|فترة|period/i]
];
const MEASURE_WORDS = /مبلغ|amount|قيم[ةه]|value|total|اجمالي|إجمالي|ايراد|إيراد|revenue|محصل|collected|سداد|paid|رصيد|balance|cost|تكلف/i;
const ID_WORDS = /\bid\b|رقم|number|\bno\.?\b|code|كود|رمز|serial|iban|هوية|sadad|سداد\s*رقم/i;
const dimOf = (term) => { const t = String(term || ''); const hit = DIM_WORDS.find(([, re]) => re.test(t)); return hit ? hit[0] : null; };

export function detectGroup(table, profs, { groupTerm = null, measureTerm = null } = {}) {
  const nRows = table.rows.length; if (!nRows) return null;
  const groupable = profs.filter((p) => !p.numeric && p.filled >= Math.max(2, nRows * 0.5) && p.distinct >= 2 && p.distinct <= 60 && p.distinct < nRows * 0.9 + 1);
  let g = null;
  if (groupTerm) { const nt = normAr(groupTerm); const want = dimOf(groupTerm); g = groupable.find((p) => normAr(p.header).includes(nt) || nt.includes(normAr(p.header))) || (want ? groupable.find((p) => DIM_WORDS.find(([k]) => k === want)[1].test(p.header)) : null) || null; if (!g) return { missing: groupTerm }; }
  if (!g) for (const [, re] of DIM_WORDS) { g = groupable.find((p) => re.test(p.header)); if (g) break; }
  g = g || groupable[0] || null;
  const numerics = profs.filter((p) => p.numeric && !(ID_WORDS.test(p.header) && p.distinct >= p.filled * 0.9));
  let m = null;
  if (measureTerm) m = numerics.find((p) => normAr(p.header).includes(normAr(measureTerm)));
  m = m || numerics.find((p) => MEASURE_WORDS.test(p.header)) || numerics.slice().sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))[0] || null;
  if (!g) return null;
  const groups = new Map();
  for (const r of table.rows) {
    const key = String(r[g.j] ?? '').trim(); if (!key) continue;
    const e = groups.get(key) || { key, count: 0, sum: 0 }; e.count += 1;
    if (m) { const n = parseNum(r[m.j]); if (Number.isFinite(n)) e.sum += n; }
    groups.set(key, e);
  }
  const list = [...groups.values()].sort((a, b) => (m ? b.sum - a.sum : b.count - a.count));
  return { group: g, measure: m, groups: list };
}

/* ------------------------------------------------------------------ the Amanah a group name stands for */
const coreName = (s) => String(s || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').replace(/^المنطقة\s+/, '').replace(/\s*amanah$/i, '').trim();
export function matchAmanah(label) {
  const n = normAr(label); if (!n) return null;
  for (const a of amanahOptionsOf()) {
    const names = [a.ar, a.en, coreName(a.ar), coreName(a.en), a.key].filter(Boolean).map(normAr).filter((x) => x.length >= 3);
    if (names.some((x) => x === n)) return a.key;
  }
  for (const a of amanahOptionsOf()) { // «أمانة الرياض» / «الرياض» / «Riyadh» written inside a longer label
    const core = normAr(coreName(a.ar)); const coreEn = normAr(coreName(a.en));
    if ((core.length >= 4 && (n === core || n.endsWith(` ${core}`) || n.startsWith(`${core} `))) || (coreEn.length >= 4 && (n === coreEn || n.startsWith(`${coreEn} `)))) return a.key;
  }
  return null;
}

/* ------------------------------------------------------------------ the model */
const entityAr = (en) => ENTITIES.find((e) => e.en === en)?.ar || en;
const STATUS_AR = { collected: ['محصّلة بالكامل', 'Collected in full'], ...Object.fromEntries(Object.entries(CATEGORY_LABELS).map(([k, v]) => [k, [v.ar, v.en]])) };

export function buildAttachmentModel({ atts, refs, resolved = null, snapshot = null, scopeText = '', lang = 'ar', groupTerm = null, generatedAt = new Date(), cutoff = '', question = '' }) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const headline = []; const sections = []; const limits = [];
  const readable = atts.filter((a) => a.status !== 'unread'); const unread = atts.filter((a) => a.status === 'unread');

  /* ---- 1. the files */
  const fileRows = atts.map((a) => {
    const extent = a.tables?.length ? L(`${a.tables.length} ورقة · ${a.tables.reduce((t, x) => t + x.rows.length, 0).toLocaleString('en-US')} صف`, `${a.tables.length} sheet(s) · ${a.tables.reduce((t, x) => t + x.rows.length, 0).toLocaleString('en-US')} rows`) : a.pageCount ? L(`${a.pageCount} ${a.kind === 'pptx' ? 'شريحة' : 'صفحة'}`, `${a.pageCount} ${a.kind === 'pptx' ? 'slides' : 'pages'}`) : '—';
    return [a.name, kindLabel(a.kind, ar), sizeText(a.size), extent, a.status === 'ready' ? L('قُرئ', 'Read') : a.status === 'partial' ? L('قُرئ جزئياً', 'Partly read') : L('لم يُقرأ', 'Not read'), noteText(a.note, ar) || ''];
  });
  const fileBlocks = [tbl('files', L('الملفات المرفقة', 'Attached files'), [H(L('الملف', 'File')), H(L('النوع', 'Type')), H(L('الحجم', 'Size')), H(L('المحتوى', 'Content')), H(L('الحالة', 'Status')), H(L('ملاحظة', 'Note'))], fileRows)];
  unread.forEach((a) => limits.push(L(`«${a.name}»: ${noteText(a.note, true)}`, `“${a.name}”: ${noteText(a.note, false)}`)));
  atts.filter((a) => a.status === 'partial').forEach((a) => limits.push(L(`«${a.name}»: ${noteText(a.note, true)}`, `“${a.name}”: ${noteText(a.note, false)}`)));

  /* ---- 2. invoice references resolved against the system */
  const results = new Map(); (resolved?.results || []).forEach((r) => results.set(`${r.ref.kind}|${r.ref.value}`, r));
  const refBlocks = [];
  let refStats = null;
  if (refs && refs.total > 0) {
    const all = refs.unique; const rs = all.map((r) => ({ r, res: results.get(`${r.kind}|${r.value}`) }));
    const matched = rs.filter((x) => x.res?.status === 'matched'); const ambiguous = rs.filter((x) => x.res?.status === 'ambiguous'); const unmatched = rs.filter((x) => x.res && ['unmatched', 'corrupted'].includes(x.res.status)); const notChecked = rs.filter((x) => !x.res);
    // one invoice found by two references is counted once
    const inv = new Map(); matched.forEach((x) => { const c = x.res.candidates[0]; if (!inv.has(c.invoiceId)) inv.set(c.invoiceId, { c, refs: [x.r.value] }); else inv.get(c.invoiceId).refs.push(x.r.value); });
    const sum = (f) => [...inv.values()].reduce((t, x) => t + (x.c[f] || 0), 0);
    refStats = { references: refs.total, checked: all.length - notChecked.length, matched: matched.length, invoices: inv.size, ambiguous: ambiguous.length, unmatched: unmatched.length, net: sum('netAmount'), collected: sum('collected'), outstanding: sum('outstanding') };
    refBlocks.push({ type: 'kpis', items: [
      { label: L('مراجع فواتير في الملفات', 'Invoice references in the files'), value: fmtNum(refs.total), raw: refs.total, sub: refs.capped ? L(`فُحص أول ${MAX_REFS} مرجعاً`, `the first ${MAX_REFS} were checked`) : L('أرقام فواتير / سداد / مخالفات', 'invoice / Sadad / violation numbers') },
      { label: L('وُجدت في النظام', 'Found in the system'), value: fmtNum(inv.size), raw: inv.size, sub: L('فاتورة بمطابقة دقيقة', 'invoices, exact match') },
      { label: L('متعددة المطابقة', 'Ambiguous'), value: fmtNum(ambiguous.length), raw: ambiguous.length, sub: L('رقم يطابق أكثر من فاتورة', 'one number, several invoices') },
      { label: L('غير موجودة', 'Not found'), value: fmtNum(unmatched.length), raw: unmatched.length, sub: L('لا فاتورة بهذا الرقم', 'no invoice with this number') }
    ] });
    if (inv.size) {
      refBlocks.push({ type: 'kpis', items: [
        { label: L('صافي المفوتر للفواتير المطابقة', 'Net billed of the matched invoices'), value: fmtNum(Math.round(sum('netAmount'))) + L(' ريال', ' SAR'), raw: sum('netAmount'), sub: L('من بيانات النظام', 'from the system data') },
        { label: L('المحصّل', 'Collected'), value: fmtNum(Math.round(sum('collected'))) + L(' ريال', ' SAR'), raw: sum('collected'), sub: L('حتى تاريخ البيانات', 'to the data date') },
        { label: L('غير المحصّل', 'Uncollected'), value: fmtNum(Math.round(sum('outstanding'))) + L(' ريال', ' SAR'), raw: sum('outstanding'), sub: L('رصيد قائم', 'balance owed') }
      ] });
      const rows = [...inv.values()].map(({ c, refs: v }) => [c.invoiceId, ar ? sourceAr(c.source) : sourceEn(c.source), ar ? entityAr(c.amanahEn) : c.amanahEn, (STATUS_AR[c.paymentStatus] || [c.paymentStatus, c.paymentStatus])[ar ? 0 : 1], c.netAmount, c.collected, c.outstanding, v.join(' ، ')]);
      refBlocks.push(tbl('matched', L('الفواتير المطابقة في النظام', 'Matched invoices in the system'), [H(L('رقم الفاتورة', 'Invoice')), H(L('المصدر', 'Source')), H(L('الأمانة / الجهة', 'Amanah')), H(L('الحالة', 'Status')), H(L('الصافي', 'Net'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('المرجع في الملف', 'Reference in the file'))], rows.slice(0, CAP_ROWS), { note: rows.length > CAP_ROWS ? L(`عُرض أول ${CAP_ROWS} من ${rows.length} فاتورة.`, `The first ${CAP_ROWS} of ${rows.length} invoices are shown.`) : null }));
    }
    if (unmatched.length || ambiguous.length) {
      const rows = [...ambiguous, ...unmatched].map((x) => [x.r.value, x.r.kind === 'invoice_no' ? L('رقم فاتورة', 'Invoice no.') : x.r.kind === 'sadad_no' ? L('رقم سداد', 'Sadad no.') : x.r.kind === 'violation_no' ? L('رقم مخالفة', 'Violation no.') : x.r.kind === 'invoice_serial' ? L('رقم تسلسلي', 'Serial') : x.r.kind, x.res.status === 'ambiguous' ? L(`يطابق ${x.res.candidates.length} فواتير`, `matches ${x.res.candidates.length} invoices`) : L('غير موجود', 'Not found')]);
      refBlocks.push(tbl('unmatched', L('مراجع لم تُحسم', 'References not resolved'), [H(L('المرجع')), H(L('النوع')), H(L('النتيجة'))], rows.slice(0, 100), { note: L('لا يُطابق النظام برقم قريب ولا بالمبلغ؛ المطابقة بالرقم الدقيق فقط.', 'The system never matches by a similar number or by amount; only the exact number counts.') }));
    }
    if (notChecked.length) limits.push(L('تعذّر فحص بعض المراجع مع خدمة البيانات.', 'Some references could not be checked with the data service.'));
    sections.push({ key: 'refs', title: L('المراجع مقابل بيانات النظام', 'References against the system data'), purpose: L('أرقام الفواتير الموجودة في الملفات، وهل هي في النظام وما حالتها.', 'The invoice numbers found in the files, and whether and in what state the system holds them.'), blocks: refBlocks });
  } else if (readable.length) {
    limits.push(L('لم أجد في الملفات أرقام فواتير أو سداد أو مخالفات لمطابقتها مع النظام.', 'No invoice, Sadad or violation numbers were found in the files to match against the system.'));
  }

  /* ---- 3. tables */
  const tabular = []; atts.forEach((a) => (a.tables || []).forEach((t) => tabular.push({ a, t })));
  let sysCompareDone = false; const groupMissing = []; const facts = [];
  tabular.slice(0, 4).forEach(({ a, t }, i) => {
    const profs = profileColumns(t); const blocks = [];
    const gp = detectGroup(t, profs, { groupTerm });
    if (gp?.missing) groupMissing.push(gp.missing);
    const fallback = gp?.missing ? detectGroup(t, profs, {}) : gp;
    blocks.push({ type: 'kpis', items: [{ label: L('الصفوف', 'Rows'), value: fmtNum(t.rows.length), raw: t.rows.length, sub: a.name }, { label: L('الأعمدة', 'Columns'), value: fmtNum(t.headers.length), raw: t.headers.length, sub: t.name || '' }, ...(fallback?.measure ? [{ label: fallback.measure.header, value: fmtNum(fallback.measure.sum), raw: fallback.measure.sum, sub: L('مجموع العمود كما ورد في الملف', 'column total as it appears in the file') }] : [])] });
    if (fallback?.groups?.length) {
      const { group, measure, groups } = fallback; const top = groups.slice(0, 20);
      { const tot = groups.reduce((t, g) => t + (measure ? g.sum : g.count), 0); const g0 = groups[0]; const v0 = measure ? g0.sum : g0.count;
        if (tot > 0 && groups.length > 1) facts.push(L(`في «${a.name}» أكبر ${group.header}: ${g0.key} (${fmtNum(v0)}، ${((v0 / tot) * 100).toFixed(1)}% من ${measure ? measure.header : 'الصفوف'} الإجمالي) من ${groups.length} مجموعات.`, `In “${a.name}” the largest ${group.header} is ${g0.key} (${fmtNum(v0)}, ${((v0 / tot) * 100).toFixed(1)}% of total ${measure ? measure.header : 'rows'}) among ${groups.length} groups.`)); }
      const rows = top.map((g) => [g.key, g.count, ...(measure ? [g.sum] : [])]);
      blocks.push(tbl(`grp${i}`, L(`${measure ? measure.header : 'العدد'} حسب ${group.header}`, `${measure ? measure.header : 'Count'} by ${group.header}`), [H(group.header), H(L('الصفوف', 'Rows'), 'count'), ...(measure ? [H(measure.header, 'plain')] : [])], rows, { total: [L('الإجمالي', 'Total'), groups.reduce((s, g) => s + g.count, 0), ...(measure ? [groups.reduce((s, g) => s + g.sum, 0)] : [])], note: groups.length > top.length ? L(`عُرضت أكبر ${top.length} من ${groups.length} مجموعة.`, `The largest ${top.length} of ${groups.length} groups are shown.`) : null }));
      blocks.push({ type: 'chart', kind: 'bar', plain: true, valueTitle: measure ? measure.header : L('عدد الصفوف', 'Rows'), title: L(`${measure ? measure.header : 'عدد الصفوف'} حسب ${group.header}`, `${measure ? measure.header : 'Rows'} by ${group.header}`), labels: top.map((g) => g.key), series: [{ label: measure ? measure.header : L('الصفوف', 'Rows'), values: top.map((g) => (measure ? g.sum : g.count)) }] });
      // compared with the system only where a group name IS an Amanah of the system
      if (snapshot && !sysCompareDone && measure) {
        const hits = groups.map((g) => ({ g, key: matchAmanah(g.key) })).filter((x) => x.key);
        if (hits.length) {
          sysCompareDone = true;
          const rows2 = hits.map(({ g, key }) => { const s = snapshot.byAmanah.find((x) => x.key === key); return [s ? (typeof s.label === 'string' ? s.label : s.label?.[ar ? 'ar' : 'en']) : g.key, g.sum, s ? Math.round(s.net) : null, s ? Math.round(s.collected) : null, s && s.net > 0 ? s.collected / s.net : null]; }); // whole riyals as plain numbers: a file's amounts and the system's are comparable only in one unit, and the file's are often small
          const missed = groups.filter((g) => !matchAmanah(g.key));
          blocks.push(tbl(`cmp${i}`, L('المرفق مقابل بيانات النظام', 'The file against the system data'), [H(L('الأمانة / الجهة', 'Amanah')), H(L(`${measure.header} (الملف)`, `${measure.header} (file)`), 'plain'), H(L('صافي المفوتر (النظام، ريال)', 'Net billed (system, SAR)'), 'plain'), H(L('المحصّل (النظام، ريال)', 'Collected (system, SAR)'), 'plain'), H(L('نسبة التحصيل (النظام)', 'Collection rate (system)'), 'pct')], rows2, { note: L(`نطاق النظام: ${scopeText}. يُفترض أن مبالغ الملف بالريال لأن الملف لا يحدد وحدة؛ تأكد من ذلك قبل الاعتماد على المقارنة.${missed.length ? ` لم تُقابَل مع أمانات النظام: ${missed.slice(0, 8).map((g) => g.key).join('، ')}.` : ''}`, `System scope: ${scopeText}. The file amounts are assumed to be in SAR because the file states no unit; confirm that before relying on the comparison.${missed.length ? ` Not matched to a system Amanah: ${missed.slice(0, 8).map((g) => g.key).join(', ')}.` : ''}`) }));
        }
      }
    } else blocks.push({ type: 'callout', tone: 'info', text: L('لا يوجد عمود يصلح للتجميع (نصي بقيم متكررة)، لذلك عُرضت أوصاف الأعمدة فقط.', 'No column suits grouping (text with repeated values), so only the column facts are shown.') });
    blocks.push(tbl(`cols${i}`, L('الأعمدة', 'Columns'), [H(L('العمود')), H(L('المعبّأ'), 'count'), H(L('رقمي؟')), H(L('المجموع'), 'plain'), H(L('الأدنى'), 'plain'), H(L('الأعلى'), 'plain'), H(L('قيم مختلفة'), 'count')], profs.map((p) => [p.header, p.filled, p.numeric ? L('نعم', 'Yes') : L('لا', 'No'), p.sum, p.min, p.max, p.capped ? '200+' : p.distinct])));
    blocks.push(tbl(`rows${i}`, L('أول الصفوف', 'First rows'), t.headers.slice(0, 8).map((h) => H(h)), t.rows.slice(0, 10).map((r) => r.slice(0, 8).map((c) => (typeof c === 'number' ? fmtNum(c) : String(c)))), { note: t.rows.length > 10 ? L(`عُرض 10 من ${t.rows.length.toLocaleString('en-US')} صفاً${t.headers.length > 8 ? ' وأول 8 أعمدة' : ''}.`, `10 of ${t.rows.length.toLocaleString('en-US')} rows${t.headers.length > 8 ? ' and the first 8 columns' : ''} are shown.`) : null }));
    sections.push({ key: `data${i}`, title: `${a.name}${t.name && tabular.filter((x) => x.a === a).length > 1 ? ` — ${t.name}` : ''}`, purpose: '', blocks });
  });
  if (tabular.length > 4) limits.push(L(`حُلّلت أول 4 جداول من ${tabular.length}.`, `The first 4 of ${tabular.length} tables were analysed.`));
  if (groupMissing.length) limits.push(L(`لا يوجد عمود يطابق «${groupMissing[0]}» في الجداول المرفقة، فاستُخدم أنسب عمود للتجميع.`, `No column matches “${groupMissing[0]}” in the attached tables, so the most suitable grouping column was used.`));
  if (snapshot && tabular.length && !sysCompareDone) limits.push(L('لم تُطابَق أسماء مجموعات الجداول مع أمانات النظام، فلا مقارنة بمبالغ النظام.', 'No group name in the tables matched an Amanah of the system, so there is no comparison with the system amounts.'));

  /* ---- 4. documents (text) */
  const docs = atts.filter((a) => !a.tables?.length && a.text && a.status !== 'unread');
  if (docs.length) {
    sections.push({ key: 'docs', title: L('مقتطفات المستندات', 'Document excerpts'), purpose: L('أول أسطر كل مستند كما وردت؛ هذه مقتطفات وليست تلخيصاً.', 'The first lines of each document as written; these are excerpts, not a summary.'), blocks: docs.flatMap((a) => [{ type: 'text', text: `${a.name} — ${kindLabel(a.kind, ar)} · ${a.pageCount} ${a.kind === 'pptx' ? L('شريحة', 'slides') : L('صفحة', 'pages')} · ${a.text.length.toLocaleString('en-US')} ${L('حرفاً', 'characters')}` }, { type: 'list', items: a.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => (l.length > 220 ? `${l.slice(0, 219)}…` : l)) }]) });
  }

  /* ---- 5. limits, always stated */
  limits.push(L('لا يجري هذا النظام OCR ولا يحلل الصور؛ والتحليل هنا حسابي بقواعد محددة وليس نموذجاً لغوياً.', 'This system performs no OCR or image analysis; the analysis here is calculated with fixed rules, not a language model.'));
  limits.push(L('الربط المباشر بسند وتحصيل غير متصل في هذا العرض؛ المقارنة تتم مع بيانات النظام التجريبية الاصطناعية.', 'The live links to Sanad and Tahseel are not connected in this demo; the comparison is with the system’s synthetic demo data.'));
  sections.push({ key: 'limits', title: L('حدود التحليل', 'Limits of this analysis'), purpose: '', blocks: [{ type: 'list', items: limits }] });
  sections.unshift({ key: 'files', title: L('ما قُرئ من الملفات', 'What was read from the files'), purpose: '', blocks: fileBlocks });

  const totalRows = tabular.reduce((t, x) => t + x.t.rows.length, 0);
  headline.push({ type: 'kpis', items: [
    { label: L('الملفات المقروءة', 'Files read'), value: `${readable.length} / ${atts.length}`, raw: readable.length, sub: unread.length ? L(`${unread.length} لم تُقرأ`, `${unread.length} not read`) : L('كلها قُرئت', 'all were read') },
    ...(tabular.length ? [{ label: L('صفوف البيانات', 'Data rows'), value: fmtNum(totalRows), raw: totalRows, sub: L(`${tabular.length} جدول`, `${tabular.length} table(s)`) }] : []),
    ...(refStats ? [{ label: L('فواتير مطابقة', 'Invoices matched'), value: fmtNum(refStats.invoices), raw: refStats.invoices, sub: L(`من ${fmtNum(refStats.references)} مرجع`, `of ${fmtNum(refStats.references)} references`) }] : [])
  ] });

  const summaryText = [
    L(`قرأتُ ${readable.length} من ${atts.length} ملفاً${unread.length ? ` (لم يُقرأ ${unread.length}: ${unread.map((a) => a.name).join('، ')})` : ''}.`, `I read ${readable.length} of ${atts.length} files${unread.length ? ` (${unread.length} not read: ${unread.map((a) => a.name).join(', ')})` : ''}.`),
    tabular.length ? L(`في الجداول ${fmtNum(totalRows)} صفاً.`, `The tables hold ${fmtNum(totalRows)} rows.`) : '',
    ...facts.slice(0, 2),
    refStats ? L(`وجدتُ ${fmtNum(refStats.references)} مرجع فاتورة؛ ${fmtNum(refStats.invoices)} فاتورة طابقت النظام بدقة${refStats.unmatched ? `، و${fmtNum(refStats.unmatched)} غير موجودة` : ''}${refStats.ambiguous ? `، و${fmtNum(refStats.ambiguous)} متعددة المطابقة` : ''}.`, `I found ${fmtNum(refStats.references)} invoice references; ${fmtNum(refStats.invoices)} invoices matched the system exactly${refStats.unmatched ? `, ${fmtNum(refStats.unmatched)} were not found` : ''}${refStats.ambiguous ? `, ${fmtNum(refStats.ambiguous)} are ambiguous` : ''}.`) : ''
  ].filter(Boolean).join(' ');

  const names = atts.map((a) => a.name);
  return {
    id: `att-${generatedAt.getTime()}`, kind: 'attachments', title: names.length === 1 ? L(`تحليل «${names[0]}»`, `Analysis of “${names[0]}”`) : L(`تحليل ${names.length} ملفات مرفقة`, `Analysis of ${names.length} attached files`),
    subtitle: names.join(' · '), generatedAt: generatedAt.toISOString(), cutoff, lang, depth: 'summary', compare: 'none', synthetic: true,
    dataNote: L('تحليل الملفات المرفقة مع بيانات النظام التجريبية الاصطناعية (وليست بيانات الوزارة الفعلية).', 'Analysis of the attached files together with the system’s synthetic demo data (not the Ministry’s actual data).'),
    context: [
      { k: 'files', label: L('المرفقات', 'Attachments'), value: names.join(' · ') },
      ...(question ? [{ k: 'request', label: L('الطلب', 'Request'), value: question.slice(0, 160) }] : []),
      ...(scopeText ? [{ k: 'scope', label: L('نطاق النظام للمقارنة', 'System scope for comparison'), value: scopeText }] : []),
      { k: 'basis', label: L('الأساس', 'Basis'), value: L('أرقام الملفات كما وردت؛ المطابقة مع النظام بالرقم الدقيق فقط', 'Figures as they appear in the files; matching with the system by exact number only') },
      { k: 'data', label: L('البيانات', 'Data'), value: L('الملفات التي أرفقتها + بيانات النظام التجريبية الاصطناعية', 'The files you attached + the system’s synthetic demo data') }
    ],
    totals: null, empty: !readable.length, equationOk: true, headline, sections, summaryText, refStats
  };
}
