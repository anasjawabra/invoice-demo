import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { L } from './util';
import ReconciliationTable from './ReconciliationTable';
import { fmtMoney, RECON, STATUS, PAYER_MASTER, gfsForInvoice, INVOICES } from '../../data/mock';
import { useAsync } from '../../utils/useAsync';
import { legacyInvoiceFor } from '../../utils/legacyInvoice';
import { RULE_IDS } from '../../data/catalog';
import SourceRecordSection from '../revenue/SourceRecordSection';
import { OCR_SAMPLES } from '../../data/aiProcess';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';
import InvoiceLedgerSections from '../revenue/InvoiceLedgerSections';

/* Detail-drawer copy (tri-lingual, same {zh,en,ar} pattern as the AI data). */
const TX = {
  detail: { zh: '账单详情', en: 'Invoice Detail', ar: 'تفاصيل الفاتورة' },
  view: { zh: '查看详情', en: 'View details', ar: 'عرض التفاصيل' },
  overview: { zh: '概要', en: 'Overview', ar: 'نظرة عامة' },
  payer: { zh: '缴款方', en: 'Payer', ar: 'الجهة الدافعة' },
  amanah: { zh: '所属市政厅', en: 'Amanah', ar: 'الأمانة' },
  gfs: { zh: 'GFS 收入科目', en: 'GFS Revenue Account', ar: 'حساب الإيراد (GFS)' },
  org: { zh: '组织', en: 'Organization', ar: 'الجهة' },
  amount: { zh: '金额（不含税）', en: 'Amount (net)', ar: 'المبلغ (صافي)' },
  vat: { zh: '增值税 (15%)', en: 'VAT (15%)', ar: 'ضريبة القيمة المضافة (15%)' },
  total: { zh: '含税总额', en: 'Total (incl. VAT)', ar: 'الإجمالي (شامل الضريبة)' },
  ocrTitle: { zh: '提取字段 (OCR)', en: 'Extracted Fields (OCR)', ar: 'الحقول المستخرجة (OCR)' },
  ocrSub: { zh: 'OCR 提取 Agent · 每字段置信度', en: 'OCR Data Extraction Agent · per-field confidence', ar: 'وكيل استخراج البيانات (OCR) · ثقة لكل حقل' },
  reconTitle: { zh: '三单核验 / 对账', en: '3-Way Verification / Reconciliation', ar: 'المطابقة الثلاثية / التسوية' },
  reconSub: { zh: '账单 ↔ 催收单 ↔ 应计确认 · ZATCA VAT 复算', en: 'Invoice ↔ Collection Order ↔ Accrual Confirmation · ZATCA VAT recompute', ar: 'الفاتورة ↔ أمر التحصيل ↔ إثبات الاستحقاق · إعادة حساب الضريبة' },
  noRecon: { zh: '该账单暂无三单核验记录。', en: 'No reconciliation record for this invoice.', ar: 'لا يوجد سجل تسوية لهذه الفاتورة.' },
  aiTitle: { zh: 'AI 评估', en: 'AI Assessment', ar: 'تقييم الذكاء الاصطناعي' },
  risk: { zh: '风险评分', en: 'Risk score', ar: 'درجة المخاطر' },
  anomaly: { zh: '异常类型', en: 'Anomaly type', ar: 'نوع الانحراف' },
  viewAi: { zh: '查看完整 AI 分析', en: 'View full AI analysis', ar: 'عرض تحليل الذكاء الكامل' },
  none: { zh: '无', en: 'None', ar: 'لا يوجد' },
};

/* Per-scenario anomaly tag surfaced in the AI strip. */
const ANOMALY_TAG = {
  fraud: { zh: '费用偏离基准 +38% · 首次缴款方', en: 'Fee +38% over tariff · first-time payer', ar: 'الرسم +38٪ فوق المعيار · جهة دافعة جديدة' },
  dup: { zh: '重复账单（四元组一致）', en: 'Duplicate invoice (tuple match)', ar: 'فاتورة مكررة (تطابق رباعي)' },
  taxfail: { zh: '金额与明细合计差异（税额仅作来源属性）', en: 'Total vs line-item variance (VAT shown as a source attribute only)', ar: 'فرق بين الإجمالي وبنود الفاتورة (الضريبة سمة من المصدر فقط)' }
};

const SOURCE_BADGE = { Tahseel: 'badge--teal', Makin: 'badge--indigo', Efa: 'badge--green', Sanad: 'badge--gold' };

/* Where a human acts next, by invoice status. Statuses not listed (e.g.
   'duplicate' — already auto-blocked and archived, 'approved' — no action
   needed, 'pending'/'review' — no dedicated queue page in this build)
   render no next-step button. */
const NEXT_ACTION = {
  anomaly: { path: '/risk', labelKey: 'btn_go_risk' }
};

function statusBadge(color) {
  const map = { green: 'badge--green', red: 'badge--red', orange: 'badge--orange', gold: 'badge--gold', blue: 'badge--blue', indigo: 'badge--indigo', purple: 'badge--purple' };
  return map[color] || '';
}

/** A labelled value cell; `ltr` pins numeric/id content left-to-right. */
function Cell({ label, children, ltr }) {
  return (
    <div className="idd-cell">
      <span className="idd-cell__k">{label}</span>
      <span className="idd-cell__v" {...(ltr ? { dir: 'ltr' } : {})}>{children}</span>
    </div>
  );
}

/**
 * InvoiceDetailDrawer — a right-side slide-in detail panel reusing the shared
 * `.ai-drawer` shell for visual consistency with AIProcessDrawer. Renders a rich
 * header, OCR-extracted fields, a 3-way reconciliation summary and an AI-assessment
 * strip, plus a primary action that opens the full AI analysis trace.
 *
 * Props:
 *  - inv: an INVOICES record (or null)
 *  - open, onClose
 *  - onOpenAI(): opens the AIProcessDrawer for this invoice's scenario
 *  - suppressClose: when true (AI drawer stacked on top) ESC/overlay won't close
 */
export default function InvoiceDetailDrawer({ inv: invIn, invoiceId, open, onClose, onOpenAI, suppressClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const rev = useRevenue();
  const { L: LB, B, sar, ar } = useL();
  const id = invoiceId || invIn?.id || null;
  // ONE invoice's full record is loaded when the drawer opens (the list only ever holds a page of rows)
  const { data: det, error: detErr } = useAsync(() => (open && id ? rev.data.invoice(id) : Promise.resolve(null)), [open, id, rev.data]);
  const contractNo = det?.rec?.co || null;
  const { data: card } = useAsync(() => (open && contractNo ? rev.data.contract(contractNo) : Promise.resolve(null)), [open, contractNo, rev.data]);
  const nav = useNavigate();
  const closeRef = useRef(null);

  const onEsc = useCallback((e) => {
    if (e.key === 'Escape' && !suppressClose) onClose?.();
  }, [onClose, suppressClose]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onEsc]);

  // Move focus into the drawer when it opens (focus returns to the trigger row
  // in the parent on close).
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, id]);

  if (!open || !id) return null;
  const rec = det && det.rec && det.rec.id === id ? det.rec : null;
  const inv = rec ? legacyInvoiceFor(rec) : (invIn || { id, entity: '', entityEn: '', entityAr: '', amanah: '', amanahEn: '', amanahAr: '', amount: 0, currency: 'SAR', source: '', co: '—', date: '', status: 'pending', risk: 0, tag: 'normal' });

  const dv = det?.derived;
  const der = rec && dv ? dv : null;
  const cls = rec && det ? { primary: det.cls } : null;
  const reasons = dv ? RULE_IDS.filter((_, b) => dv.reasonMask & (1 << b)).sort((a, b) => (a === dv.primaryRuleId ? -1 : b === dv.primaryRuleId ? 1 : 0)) : [];
  const scenario = inv.tag || 'normal';
  // The sample OCR / 3-way reconciliation belong to the original fixture invoices only; generated or uploaded records have none.
  const isFixture = INVOICES.some((i) => i.id === inv.id);
  const recon = isFixture ? RECON[scenario] : undefined;
  const ocr = isFixture ? OCR_SAMPLES[scenario] : undefined;
  const st = STATUS[inv.status] || {};
  const stLabel = L({ zh: st.label, en: st.labelEn, ar: st.labelAr }, lang);
  const nextAction = NEXT_ACTION[inv.status];
  const cur = inv.currency || 'SAR';


  const payerName = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
  const amanahName = lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
  const gfs = gfsForInvoice(inv);
  const gfsName = gfs ? (lang === 'zh' ? gfs.name : lang === 'ar' ? gfs.nameAr : gfs.nameEn) : null;
  const pm = PAYER_MASTER[inv.entityEn];
  const orgName = user?.org ? L({ zh: user.org.name, en: user.org.nameEn, ar: user.org.nameAr }, lang) : '';
  const anomaly = ANOMALY_TAG[scenario] ? L(ANOMALY_TAG[scenario], lang) : L(TX.none, lang);

  return createPortal(
    <>
      <div className="ai-drawer-overlay" onClick={() => { if (!suppressClose) onClose?.(); }} />
      <aside className="ai-drawer idd" role="dialog" aria-modal="true" aria-label={`${L(TX.detail, lang)} · ${inv.id}`}>
        <div className="ai-drawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="ai-drawer__title">
              <span className={`badge ${SOURCE_BADGE[inv.source] || 'badge--teal'}`}>{inv.source}</span>
              <span dir="ltr">{inv.id}</span>
            </div>
            <div className="ai-drawer__sub">{L(TX.detail, lang)}</div>
          </div>
          <button type="button" className="ai-drawer__close" onClick={onClose} aria-label={t('close')} ref={closeRef}>
            ×
          </button>
        </div>

        <div className="ai-drawer__body">
          {/* Header / overview — amounts come from the revenue ledger; nothing is derived by adding VAT */}
          <div className="idd-section">
            <div className="idd-hero">
              <div>
                <div className="idd-hero__amt" dir="ltr">{fmtMoney(inv.amount)} <small>{cur}</small></div>
                <div className="muted" style={{ fontSize: 11 }}>{LB('Billed amount as recorded in the source (VAT basis not stated)', 'المبلغ المفوتر كما في المصدر (أساس الضريبة غير مذكور)')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {cls && <span className={`rv-cat rv-cat--${cls.primary}`}>{B(CATEGORY_LABELS[cls.primary] || { en: 'Collected', ar: 'محصّلة' })}</span>}
                {rec?.amountCheck?.status === 'conflict' && <span className="rv-tag rv-tag--bad">{LB('Amount conflict', 'تعارض مبلغ')}</span>}
              </div>
            </div>
            <div className="idd-grid">
              <Cell label={L(TX.payer, lang)}>{payerName}</Cell>
              <Cell label={L(TX.amanah, lang)}>{amanahName}</Cell>
              <Cell label={t('th_po')} ltr>{inv.co}</Cell>
              {gfsName ? <Cell label={L(TX.gfs, lang)}>{gfsName}</Cell> : null}
              <Cell label={LB('Source status (collection)', 'حالة المصدر (التحصيل)')}>{rec ? B({ uncollected: { en: 'Uncollected', ar: 'غير محصّلة' }, collected: { en: 'Collected', ar: 'محصّلة' }, cancelled: { en: 'Cancelled', ar: 'ملغاة' } }[rec.sourceStatus]) : '—'}</Cell>
              <Cell label={LB('AI workflow status (separate)', 'حالة سير عمل الذكاء الاصطناعي (منفصلة)')}><span className={`badge ${statusBadge(st.color)}`}>{stLabel}</span></Cell>
              <Cell label={L(TX.org, lang)}>{orgName}</Cell>
            </div>
          </div>

          {!rec && !detErr && <div className="idd-section"><div className="muted" role="status">{LB('Loading the invoice…', 'جارٍ تحميل الفاتورة…')}</div></div>}
          {detErr && <div className="idd-section"><div className="rv-callout rv-callout--bad" role="alert">{LB('This invoice is not available in your access scope.', 'هذه الفاتورة غير متاحة ضمن نطاق صلاحيتك.')}</div></div>}

          {rec && der && (
            <>
              {rec.amountCheck?.status === 'conflict' && (
                <div className="idd-section">
                  <div className="rv-callout rv-callout--bad" role="alert">
                    <b>{LB('Amount conflict — not corrected', 'تعارض في المبلغ — لم يُصحَّح')}</b>
                    <div>{LB(`Header amount ${sar(rec.amountCheck.headerAmount)} vs line-item total ${sar(rec.amountCheck.lineTotal)} (+ declared VAT ${sar(rec.amountCheck.vatDeclared || 0)} = ${sar(rec.amountCheck.impliedTotalWithVat)}).`, `مبلغ الرأس ${sar(rec.amountCheck.headerAmount)} مقابل مجموع البنود ${sar(rec.amountCheck.lineTotal)} (+ ضريبة معلنة ${sar(rec.amountCheck.vatDeclared || 0)} = ${sar(rec.amountCheck.impliedTotalWithVat)}).`)}</div>
                    <div>{LB(`Difference: ${sar(rec.amountCheck.differenceVsLineTotal)} vs line items, ${sar(rec.amountCheck.differenceVsWithVat)} vs line items + VAT. Which figure is correct cannot be determined from the data; metrics use the source header amount until the issuing Amanah confirms.`, `الفرق: ${sar(rec.amountCheck.differenceVsLineTotal)} مقابل البنود، و${sar(rec.amountCheck.differenceVsWithVat)} مقابل البنود + الضريبة. لا يمكن تحديد الرقم الصحيح من البيانات؛ وتعتمد المؤشرات مبلغ رأس المصدر حتى تؤكد الأمانة المُصدِرة.`)}</div>
                  </div>
                </div>
              )}

              <InvoiceLedgerSections rec={rec} der={der} cls={cls} reasons={reasons} card={card} onClose={onClose} />
              <SourceRecordSection sr={det?.sourceRecord} />
            </>
          )}

          {/* OCR extracted fields */}
          {ocr ? (
            <div className="idd-section">
              <div className="idd-section__head">
                <div className="idd-section__title">{L(TX.ocrTitle, lang)}</div>
                <div className="idd-section__sub">{L(TX.ocrSub, lang)}</div>
              </div>
              <div className="ocr-fields">
                {ocr.fields.map((f) => (
                  <div key={L(f.key, lang)} className="ocr-field ocr-field--in">
                    <div>
                      <div className="ocr-field__key">{L(f.key, lang)}</div>
                      <div className="ocr-field__val" dir="ltr">{f.val}</div>
                    </div>
                    <div className="ocr-field__meta">
                      <span className={`ocr-conf ${f.low ? 'ocr-conf--low' : 'ocr-conf--ok'}`}>{f.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Amount consistency: header amount vs line items. VAT is shown only as a source attribute. */}
          <div className="idd-section">
            <div className="idd-section__head">
              <div className="idd-section__title">{LB('Line items & amount consistency', 'بنود الفاتورة واتساق المبلغ')}</div>
              <div className="idd-section__sub">{LB('Header amount compared with the sum of line items. VAT is a source attribute only — no tax-compliance verdict is made here.', 'مقارنة مبلغ الرأس بمجموع البنود. الضريبة سمة من المصدر فقط — ولا يصدر هنا حكم امتثال ضريبي.')}</div>
            </div>
            {recon ? (
              <div className="rv-table-wrap"><table className="rv-table" style={{ minWidth: 0 }}>
                <thead><tr><th>{LB('Item', 'البند')}</th><th className="num">{LB('Qty', 'الكمية')}</th><th className="num">{LB('Unit price', 'سعر الوحدة')}</th><th className="num">{LB('Line total', 'إجمالي البند')}</th></tr></thead>
                <tbody>
                  {recon.lines.map((ln) => <tr key={ln.no}><td>{L(ln.item, lang)}</td><td className="num">{fmtMoney(ln.qty)}</td><td className="num">{fmtMoney(ln.invUnit)}</td><td className="num">{fmtMoney(ln.qty * ln.invUnit)}</td></tr>)}
                  <tr><td colSpan={3}><b>{LB('Sum of line items', 'مجموع البنود')}</b></td><td className="num"><b>{fmtMoney(recon.lines.reduce((a, l) => a + l.qty * l.invUnit, 0))}</b></td></tr>
                  <tr><td colSpan={3}>{LB('VAT declared (source attribute)', 'الضريبة المعلنة (سمة من المصدر)')}</td><td className="num">{fmtMoney(recon.vat?.declared || 0)}</td></tr>
                  <tr><td colSpan={3}><b>{LB('Header amount (source)', 'مبلغ الرأس (المصدر)')}</b></td><td className="num"><b>{fmtMoney(inv.amount)}</b></td></tr>
                </tbody>
              </table></div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>{LB('No line-item evidence for this invoice, so the amount could not be cross-checked. This is a limitation, not a pass.', 'لا توجد بنود تفصيلية لهذه الفاتورة لذا تعذّر التحقق من المبلغ. وهذا قيد وليس نجاحاً.')}</div>
            )}
          </div>

          {/* AI assessment strip */}
          <div className="idd-section">
            <div className="idd-section__head">
              <div className="idd-section__title">{L(TX.aiTitle, lang)}</div>
            </div>
            <div className="idd-grid">
              <Cell label={L(TX.risk, lang)} ltr>
                <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.risk}</span>
              </Cell>
              <Cell label={L(TX.anomaly, lang)}>{anomaly}</Cell>
            </div>

            <div className="idd-actions">
              <button type="button" className="btn btn-primary idd-aibtn" onClick={onOpenAI}>
                {L(TX.viewAi, lang)}
              </button>
              {nextAction ? (
                <button
                  type="button"
                  className="btn btn-ghost idd-aibtn"
                  onClick={() => { onClose?.(); nav(nextAction.path); }}
                >
                  {t(nextAction.labelKey)} →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
