// Real, working file exports for the Smart Reports page. Each function takes
// a fully render-ready `report` object (all text already localized by the
// caller) and produces an actual downloadable file — no placeholders.
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType } from 'docx';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------------------- Word / DOCX ---------------------------- */
export async function exportReportToDocx(report, filename = 'smart-report.docx') {
  const cell = (text, opts = {}) => new TableCell({ children: [new Paragraph({ text: String(text), alignment: opts.right ? AlignmentType.RIGHT : undefined })], width: { size: opts.width || 20, type: WidthType.PERCENTAGE } });
  const headerRow = (headers) => new TableRow({ children: headers.map((h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) });
  const dataTable = (headers, rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow(headers), ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))] });

  const children = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: report.subtitle, spacing: { after: 200 } }),
    new Paragraph({ text: report.generatedOn, spacing: { after: 300 } }),

    new Paragraph({ text: report.labels.executiveSummary, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: report.executiveSummary, spacing: { after: 200 } }),

    new Paragraph({ text: report.labels.keyMetrics, heading: HeadingLevel.HEADING_1 }),
    dataTable(
      [report.labels.metric, report.labels.value, report.labels.note],
      report.keyMetrics.map((m) => [m.label, m.value, m.caption])
    ),
    new Paragraph({ text: '', spacing: { after: 200 } }),

    new Paragraph({ text: report.labels.detailedAnalysis, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: report.detailedAnalysis.intro, spacing: { after: 150 } }),
    dataTable(report.detailedAnalysis.table.headers, report.detailedAnalysis.table.rows),
    new Paragraph({ text: '', spacing: { after: 200 } }),

    new Paragraph({ text: report.labels.aiDiscoveries, heading: HeadingLevel.HEADING_1 }),
    ...report.discoveries.map((d) => new Paragraph({ text: `• ${d}`, spacing: { after: 80 } })),

    new Paragraph({ text: report.labels.risksAlerts, heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    ...report.risks.flatMap((r) => [
      new Paragraph({ children: [new TextRun({ text: `[${r.priority}] `, bold: true }), new TextRun({ text: r.title, bold: true })] }),
      new Paragraph({ text: r.rationale, spacing: { after: 120 } })
    ]),

    new Paragraph({ text: report.labels.predictions, heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    ...report.predictions.flatMap((p) => [
      new Paragraph({ children: [new TextRun({ text: p.prediction, bold: true })] }),
      new Paragraph({ text: `${report.labels.timeframe}: ${p.timeframe}` }),
      new Paragraph({ text: `${report.labels.confidence}: ${p.confidence}` }),
      new Paragraph({ text: `${report.labels.supportingFactors}: ${p.supporting}` }),
      new Paragraph({ text: `${report.labels.changingFactors}: ${p.changing}`, spacing: { after: 150 } })
    ]),

    new Paragraph({ text: report.labels.additionalReports, heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    ...report.additionalReports.map((a) => new Paragraph({ text: `• ${a.title} — ${a.description}`, spacing: { after: 80 } })),

    new Paragraph({ text: report.labels.recommendations, heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    ...report.recommendations.map((r) => new Paragraph({ text: `[${r.priority}] ${r.text}`, spacing: { after: 80 } })),

    new Paragraph({ text: report.labels.dataAssumptions, heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    ...report.assumptions.map((a) => new Paragraph({ text: `• ${a}`, spacing: { after: 80 } }))
  ];

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename);
}

/* ---------------------------- Excel / XLSX ---------------------------- */
export function exportReportToXlsx(report, filename = 'smart-report.xlsx') {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    [report.title],
    [report.subtitle],
    [report.generatedOn],
    [],
    [report.labels.metric, report.labels.value, report.labels.note],
    ...report.keyMetrics.map((m) => [m.label, m.value, m.caption])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), report.labels.keyMetrics.slice(0, 28) || 'Summary');

  const analysisRows = [report.detailedAnalysis.table.headers, ...report.detailedAnalysis.table.rows];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(analysisRows), (report.labels.detailedAnalysis || 'Analysis').slice(0, 28));

  const riskRows = [
    [report.labels.priority, report.labels.title, report.labels.rationale],
    ...report.risks.map((r) => [r.priority, r.title, r.rationale])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riskRows), (report.labels.risksAlerts || 'Risks').slice(0, 28));

  const recRows = [
    [report.labels.priority, report.labels.recommendations],
    ...report.recommendations.map((r) => [r.priority, r.text])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recRows), (report.labels.recommendations || 'Recommendations').slice(0, 28));

  const discoveryRows = [[report.labels.aiDiscoveries], ...report.discoveries.map((d) => [d])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(discoveryRows), (report.labels.aiDiscoveries || 'Discoveries').slice(0, 28));

  XLSX.writeFile(wb, filename);
}

/* ---------------------------- PowerPoint / PPTX ---------------------------- */
export async function exportReportToPptx(report, filename = 'smart-report.pptx') {
  const pptx = new pptxgen();
  const PRIMARY = '26634B';
  const DARK = '222222';

  function titleSlide(title, subtitle) {
    const s = pptx.addSlide();
    s.background = { color: PRIMARY };
    s.addText(title, { x: 0.5, y: 2.2, w: 9, h: 1.2, fontSize: 32, bold: true, color: 'FFFFFF' });
    s.addText(subtitle, { x: 0.5, y: 3.3, w: 9, h: 0.8, fontSize: 16, color: 'FFFFFF' });
    return s;
  }

  function bulletSlide(heading, bullets) {
    const s = pptx.addSlide();
    s.addText(heading, { x: 0.4, y: 0.3, w: 9.2, h: 0.6, fontSize: 22, bold: true, color: PRIMARY });
    s.addText(bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), { x: 0.5, y: 1.1, w: 9, h: 4.8, fontSize: 14, color: DARK, valign: 'top' });
    return s;
  }

  titleSlide(report.title, `${report.subtitle} · ${report.generatedOn}`);
  bulletSlide(report.labels.executiveSummary, [report.executiveSummary]);

  const kpiSlide = pptx.addSlide();
  kpiSlide.addText(report.labels.keyMetrics, { x: 0.4, y: 0.3, w: 9.2, h: 0.6, fontSize: 22, bold: true, color: PRIMARY });
  kpiSlide.addTable(
    [
      [report.labels.metric, report.labels.value, report.labels.note].map((t) => ({ text: t, options: { bold: true, fill: { color: 'EFEFEF' } } })),
      ...report.keyMetrics.map((m) => [m.label, m.value, m.caption])
    ],
    { x: 0.4, y: 1.1, w: 9.2, fontSize: 12, autoPage: false }
  );

  bulletSlide(report.labels.aiDiscoveries, report.discoveries);
  bulletSlide(report.labels.risksAlerts, report.risks.map((r) => `[${r.priority}] ${r.title} — ${r.rationale}`));
  bulletSlide(report.labels.predictions, report.predictions.map((p) => `${p.prediction} (${report.labels.confidence}: ${p.confidence}, ${report.labels.timeframe}: ${p.timeframe})`));
  bulletSlide(report.labels.recommendations, report.recommendations.map((r) => `[${r.priority}] ${r.text}`));
  bulletSlide(report.labels.additionalReports, report.additionalReports.map((a) => `${a.title} — ${a.description}`));

  await pptx.writeFile({ fileName: filename });
}
