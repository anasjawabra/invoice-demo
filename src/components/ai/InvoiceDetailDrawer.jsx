import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { L } from './util';
import ReconciliationTable from './ReconciliationTable';
import { fmtMoney, RECON, STATUS, PAYER_MASTER, gfsForInvoice, SANAD_ENFORCEMENT } from '../../data/mock';
import { OCR_SAMPLES } from '../../data/aiProcess';
import AgentThinking from './AgentThinking';

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
  sanadTitle: { zh: 'سند 执行关联', en: 'Sanad Enforcement Linkage', ar: 'ربط تنفيذ سند' },
  sanadSub: { zh: '上传支持文件，系统将扫描其中的执行令编号', en: 'Attach a supporting document — the system scans it for an enforcement order reference', ar: 'أرفق مستندًا داعمًا — سيفحصه النظام بحثًا عن رقم أمر تنفيذ' },
  sanadAttach: { zh: '上传文件', en: 'Attach document', ar: 'إرفاق مستند' },
  sanadTryMatch: { zh: '示例：含编号的文件', en: 'Try sample: document with a number', ar: 'تجربة: مستند فيه رقم' },
  sanadTryNone: { zh: '示例：无编号的文件', en: 'Try sample: document without a number', ar: 'تجربة: مستند بدون رقم' },
  sanadScanning: { zh: '正在扫描文件（OCR）…', en: 'Scanning document (OCR)…', ar: 'جارٍ فحص المستند (OCR)…' },
  sanadMatchedPrefix: { zh: '已关联至执行令', en: 'Linked to enforcement order', ar: 'تم الربط بأمر التنفيذ' },
  sanadNotFound: { zh: '在该文件中未找到执行令编号。', en: 'No enforcement order reference found in this document.', ar: 'لم يُعثر على رقم أمر تنفيذ في هذا المستند.' },
  sanadTryAgain: { zh: '重新上传文件', en: 'Try another document', ar: 'تجربة مستند آخر' }
};

// No real OCR engine in this demo — the "scan" reads the attached file's NAME
// for a 4+ digit run as a transparent, viewer-controllable stand-in: name a
// test file with digits to simulate a found reference, or without to
// simulate a miss. A deterministic hash of the invoice id picks which sample
// Sanad order a "found" reference resolves to, so the same invoice always
// demos the same result.
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Per-scenario anomaly tag surfaced in the AI strip. */
const ANOMALY_TAG = {
  fraud: { zh: '费用偏离基准 +38% · 首次缴款方', en: 'Fee +38% over tariff · first-time payer', ar: 'الرسم +38٪ فوق المعيار · جهة دافعة جديدة' },
  dup: { zh: '重复账单（四元组一致）', en: 'Duplicate invoice (tuple match)', ar: 'فاتورة مكررة (تطابق رباعي)' },
  taxfail: { zh: 'ZATCA 税号校验失败 · 催收单单价差异', en: 'ZATCA tax-ID failed · Collection Order rate variance', ar: 'فشل الرقم الضريبي · فرق سعر أمر التحصيل' }
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
export default function InvoiceDetailDrawer({ inv, open, onClose, onOpenAI, suppressClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const closeRef = useRef(null);
  const scanTimer = useRef(null);

  const [sanadLink, setSanadLink] = useState(null);
  useEffect(() => {
    setSanadLink(null);
    return () => window.clearTimeout(scanTimer.current);
  }, [inv?.id]);

  function handleSanadFile(fileName) {
    setSanadLink({ status: 'scanning' });
    scanTimer.current = window.setTimeout(() => {
      const digitGroups = fileName.match(/\d{4,}/g) || [];
      if (!digitGroups.length) {
        setSanadLink({ status: 'notfound' });
        return;
      }
      const order = SANAD_ENFORCEMENT.sample[hashCode(inv.id) % SANAD_ENFORCEMENT.sample.length];
      setSanadLink({ status: 'matched', order });
    }, 1100);
  }

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
  const nextAction = NEXT_ACTION[inv.status];
  const cur = inv.currency || 'SAR';

  const subtotal = Math.round(inv.amount * scale);
  const vatVal = Math.round((recon?.vat?.declared ?? Math.round(inv.amount * 0.15)) * scale);
  const total = subtotal + vatVal;

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
          {/* Header / overview */}
          <div className="idd-section">
            <div className="idd-hero">
              <div className="idd-hero__amt" dir="ltr">{fmtMoney(total)} <small>{cur}</small></div>
              <span className={`badge ${statusBadge(st.color)}`}>{stLabel}</span>
            </div>
            <div className="idd-grid">
              <Cell label={L(TX.payer, lang)}>{payerName}</Cell>
              <Cell label={L(TX.amanah, lang)}>{amanahName}</Cell>
              <Cell label={t('th_po')} ltr>{inv.co}</Cell>
              {gfsName ? <Cell label={L(TX.gfs, lang)}>{gfsName}</Cell> : null}
              <Cell label={L(TX.amount, lang)} ltr>{fmtMoney(subtotal)} {cur}</Cell>
              <Cell label={L(TX.vat, lang)} ltr>{fmtMoney(vatVal)} {cur}</Cell>
              <Cell label={L(TX.total, lang)} ltr>{fmtMoney(total)} {cur}</Cell>
              <Cell label={t('th_date')} ltr>{inv.date}</Cell>
              {pm ? <Cell label="CR" ltr>{pm.cr}</Cell> : null}
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

          {/* Sanad enforcement-order linkage (attach a document, simulated OCR) */}
          <div className="idd-section">
            <div className="idd-section__head">
              <div className="idd-section__title">{L(TX.sanadTitle, lang)}</div>
              <div className="idd-section__sub">{L(TX.sanadSub, lang)}</div>
            </div>

            {(!sanadLink || sanadLink.status === 'notfound') && (
              <div className="grid" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="file"
                    id={`idd-sanad-file-${inv.id}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) handleSanadFile(f.name);
                      e.target.value = '';
                    }}
                  />
                  <label htmlFor={`idd-sanad-file-${inv.id}`} className="btn btn-sm btn-primary" style={{ cursor: 'pointer' }}>
                    📎 {L(TX.sanadAttach, lang)}
                  </label>
                  {sanadLink?.status === 'notfound' && (
                    <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 800 }}>✗ {L(TX.sanadNotFound, lang)}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 10.5 }} onClick={() => handleSanadFile('enforcement-notice-2607714.pdf')}>
                    {L(TX.sanadTryMatch, lang)}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 10.5 }} onClick={() => handleSanadFile('scanned-notice.pdf')}>
                    {L(TX.sanadTryNone, lang)}
                  </button>
                </div>
              </div>
            )}

            {sanadLink?.status === 'scanning' && <AgentThinking label={L(TX.sanadScanning, lang)} variant="spinner" />}

            {sanadLink?.status === 'matched' && (
              <div style={{ fontSize: 12.5 }}>
                <span style={{ color: 'var(--green)', fontWeight: 900 }}>✓ {L(TX.sanadMatchedPrefix, lang)}</span>{' '}
                <span dir="ltr" style={{ fontWeight: 800 }}>{sanadLink.order.enforceNum}</span>
                <button type="button" className="btn btn-sm btn-ghost" style={{ marginInlineStart: 8 }} onClick={() => setSanadLink(null)}>
                  {L(TX.sanadTryAgain, lang)}
                </button>
              </div>
            )}
          </div>

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
