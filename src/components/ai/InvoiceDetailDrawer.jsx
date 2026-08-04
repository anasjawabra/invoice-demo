import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { L } from './util';
import ConfidenceBar from './ConfidenceBar';
import ReconciliationTable from './ReconciliationTable';
import { fmtMoney, RECON, STATUS, VENDOR_MASTER } from '../../data/mock';
import { OCR_SAMPLES } from '../../data/aiProcess';

/* Detail-drawer copy (tri-lingual, same {zh,en,ar} pattern as the AI data). */
const TX = {
  detail: { zh: '账单详情', en: 'Invoice Detail', ar: 'تفاصيل الفاتورة' },
  view: { zh: '查看详情', en: 'View details', ar: 'عرض التفاصيل' },
  overview: { zh: '概要', en: 'Overview', ar: 'نظرة عامة' },
  vendor: { zh: '供应商', en: 'Vendor', ar: 'المورد' },
  org: { zh: '组织', en: 'Organization', ar: 'الجهة' },
  amount: { zh: '金额（不含税）', en: 'Amount (net)', ar: 'المبلغ (صافي)' },
  vat: { zh: '增值税 (15%)', en: 'VAT (15%)', ar: 'ضريبة القيمة المضافة (15%)' },
  total: { zh: '含税总额', en: 'Total (incl. VAT)', ar: 'الإجمالي (شامل الضريبة)' },
  ocrTitle: { zh: '提取字段 (OCR)', en: 'Extracted Fields (OCR)', ar: 'الحقول المستخرجة (OCR)' },
  ocrSub: { zh: '摄取 Agent A1 · 每字段置信度', en: 'Ingestion Agent A1 · per-field confidence', ar: 'وكيل الاستيعاب A1 · ثقة لكل حقل' },
  reconTitle: { zh: '三单匹配 / 对账', en: '3-Way Match / Reconciliation', ar: 'المطابقة الثلاثية / التسوية' },
  reconSub: { zh: '账单 ↔ PO ↔ 实收 · ZATCA VAT 复算', en: 'Invoice ↔ PO ↔ GRN · ZATCA VAT recompute', ar: 'الفاتورة ↔ PO ↔ الاستلام · إعادة حساب الضريبة' },
  noRecon: { zh: '该账单暂无三单匹配记录。', en: 'No reconciliation record for this invoice.', ar: 'لا يوجد سجل تسوية لهذه الفاتورة.' },
  aiTitle: { zh: 'AI 评估', en: 'AI Assessment', ar: 'تقييم الذكاء الاصطناعي' },
  risk: { zh: '风险评分', en: 'Risk score', ar: 'درجة المخاطر' },
  anomaly: { zh: '异常类型', en: 'Anomaly type', ar: 'نوع الشذوذ' },
  decision: { zh: '处理决策 (HITL)', en: 'Decision (HITL)', ar: 'القرار (HITL)' },
  viewAi: { zh: '查看完整 AI 分析', en: 'View full AI analysis', ar: 'عرض تحليل الذكاء الكامل' },
  none: { zh: '无', en: 'None', ar: 'لا يوجد' }
};

/* Per-scenario anomaly tag surfaced in the AI strip. */
const ANOMALY_TAG = {
  fraud: { zh: '价格偏离基准 +38% · 首次交易', en: 'Price +38% over benchmark · first-time vendor', ar: 'السعر +38٪ فوق المعيار · مورد جديد' },
  dup: { zh: '重复账单（四元组一致）', en: 'Duplicate invoice (tuple match)', ar: 'فاتورة مكررة (تطابق رباعي)' },
  taxfail: { zh: 'ZATCA 税号校验失败 · PO 单价差异', en: 'ZATCA tax-ID failed · PO price variance', ar: 'فشل الرقم الضريبي · فرق سعر PO' }
};

const SOURCE_BADGE = { Tahseel: 'badge--teal', Makin: 'badge--indigo', Efa: 'badge--green', Sanad: 'badge--gold' };

function statusBadge(color) {
  const map = { green: 'badge--green', red: 'badge--red', orange: 'badge--orange', gold: 'badge--gold', blue: 'badge--blue', indigo: 'badge--indigo', purple: 'badge--purple' };
  return map[color] || '';
}

/* Derive the HITL decision + tone from the invoice status/risk/confidence. */
function decisionFor(inv) {
  switch (inv.status) {
    case 'approved':
      return { tone: 'ok', gate: 'auto', text: { zh: 'AI 自动通过，风险低且合规', en: 'Auto-processed by AI — low risk & compliant', ar: 'معالجة تلقائية — مخاطر منخفضة ومتوافق' } };
    case 'anomaly':
      return { tone: 'danger', gate: 'human', text: { zh: '欺诈警告，暂停付款转审计师人工复核', en: 'Fraud warning — payment paused, referred to auditor', ar: 'تحذير احتيال — إيقاف الدفع وإحالة للمدقق' } };
    case 'duplicate':
      return { tone: 'warn', gate: 'human', text: { zh: '自动拦截重复付款，等待人工确认后归档', en: 'Auto-blocked double payment — awaiting human confirm', ar: 'حظر تلقائي للدفع المزدوج — بانتظار التأكيد' } };
    case 'review':
      return { tone: 'warn', gate: 'human', text: { zh: '置信度 < 75%，转合规人工复核', en: 'Confidence < 75% — referred to compliance review', ar: 'الثقة < 75٪ — محال للامتثال' } };
    case 'pending':
    default:
      return { tone: 'ok', gate: 'human', text: { zh: 'AI 建议批准，等待人工确认（HITL）', en: 'AI recommends approve — awaiting human confirm (HITL)', ar: 'يوصي الذكاء بالموافقة — بانتظار التأكيد (HITL)' } };
  }
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
export default function InvoiceDetailDrawer({ inv, open, onClose, onOpenAI, suppressClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
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
  }, [open, inv]);

  if (!open || !inv) return null;

  const scale = user?.org?.scale ?? 1;
  const scenario = inv.tag || 'normal';
  const recon = RECON[scenario];
  const ocr = OCR_SAMPLES[scenario];
  const st = STATUS[inv.status] || {};
  const stLabel = L({ zh: st.label, en: st.labelEn, ar: st.labelAr }, lang);
  const decision = decisionFor(inv);
  const conf = Math.round((inv.confidence || 0) * 100);
  const cur = inv.currency || 'SAR';

  const subtotal = Math.round(inv.amount * scale);
  const vatVal = Math.round((recon?.vat?.declared ?? Math.round(inv.amount * 0.15)) * scale);
  const total = subtotal + vatVal;

  const vendorName = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
  const vm = VENDOR_MASTER[inv.entityEn];
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
          {/* Header / overview */}
          <div className="idd-section">
            <div className="idd-hero">
              <div className="idd-hero__amt" dir="ltr">{fmtMoney(total)} <small>{cur}</small></div>
              <span className={`badge ${statusBadge(st.color)}`}>{stLabel}</span>
            </div>
            <div className="idd-grid">
              <Cell label={L(TX.vendor, lang)}>{vendorName}</Cell>
              <Cell label={t('th_po')} ltr>{inv.po}</Cell>
              <Cell label={L(TX.amount, lang)} ltr>{fmtMoney(subtotal)} {cur}</Cell>
              <Cell label={L(TX.vat, lang)} ltr>{fmtMoney(vatVal)} {cur}</Cell>
              <Cell label={L(TX.total, lang)} ltr>{fmtMoney(total)} {cur}</Cell>
              <Cell label={t('th_date')} ltr>{inv.date}</Cell>
              {vm ? <Cell label="CR" ltr>{vm.cr}</Cell> : null}
              <Cell label={L(TX.org, lang)}>{orgName}</Cell>
            </div>
          </div>

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

          {/* 3-way match / reconciliation */}
          <div className="idd-section">
            <div className="idd-section__head">
              <div className="idd-section__title">{L(TX.reconTitle, lang)}</div>
              <div className="idd-section__sub">{L(TX.reconSub, lang)}</div>
            </div>
            {recon ? (
              <ReconciliationTable recon={recon} tolerance={0.02} />
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>{L(TX.noRecon, lang)}</div>
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
            <div style={{ marginTop: 12 }}>
              <ConfidenceBar value={conf} label={t('ai_confidence')} />
            </div>
            <div className={`idd-decision idd-decision--${decision.tone}`} style={{ marginTop: 12 }}>
              <div className="idd-decision__head">
                <span className="idd-decision__tag">{L(TX.decision, lang)}</span>
                <span className={`idd-decision__gate idd-decision__gate--${decision.gate}`}>
                  {decision.gate === 'auto'
                    ? L({ zh: '自动', en: 'Auto', ar: 'تلقائي' }, lang)
                    : L({ zh: '人工复核', en: 'Human review', ar: 'مراجعة بشرية' }, lang)}
                </span>
              </div>
              <div className="idd-decision__text">{L(decision.text, lang)}</div>
            </div>

            <button type="button" className="btn btn-primary idd-aibtn" onClick={onOpenAI}>
              {L(TX.viewAi, lang)}
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
