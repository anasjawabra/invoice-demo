import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, INVOICES, SANAD_ENFORCEMENT } from '../data/mock';
import AgentThinking from '../components/ai/AgentThinking';
import { Attachment01Icon, CancelCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import UIIcon from '../components/UIIcon';
import DirectionalIcon from '../components/DirectionalIcon';

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

// No real OCR engine in this demo — the "scan" reads the attached file's NAME
// for a 4+ digit run as a transparent, viewer-controllable stand-in: name a
// test file with digits to simulate a found invoice reference, or without to
// simulate a miss. Everything the animated timeline narrates below is
// derived from this same computation, so the steps can never contradict
// the final conclusion.
function matchInvoicesForOrder(order, fileName) {
  const digitGroups = fileName.match(/\d{4,}/g) || [];
  if (!digitGroups.length) return { digitGroups, invoices: [] };
  const candidates = INVOICES.filter((inv) => inv.amanahEn === order.amanahEn);
  // Enforcement-collected invoices in the same Amanah are the most plausible
  // match, so they sort first — but every candidate stays eligible, since a
  // document naming several reference numbers can plausibly resolve to
  // several invoices, not just the one already flagged as enforcement-collected.
  const sorted = [...candidates].sort((a, b) => (b.collectedVia === 'enforcement' ? 1 : 0) - (a.collectedVia === 'enforcement' ? 1 : 0));
  const count = Math.min(digitGroups.length, sorted.length, 3);
  return { digitGroups, invoices: sorted.slice(0, count) };
}

export default function SanadOrderDetail() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { enforceNum } = useParams();
  const order = SANAD_ENFORCEMENT.sample.find((s) => s.enforceNum === enforceNum);

  const [phase, setPhase] = useState('idle'); // idle | analyzing | done
  const [tick, setTick] = useState(0);
  const [scan, setScan] = useState(null); // { fileName, digitGroups, invoices }

  function startScan(fileName) {
    const { digitGroups, invoices } = matchInvoicesForOrder(order, fileName);
    setScan({ fileName, digitGroups, invoices });
    setTick(0);
    setPhase('analyzing');
  }

  const steps = useMemo(() => {
    if (!scan) return [];
    const { fileName, digitGroups, invoices } = scan;
    const confidence = digitGroups.length ? 90 + (digitGroups[0].length % 8) : 41;
    const snippetRefs = digitGroups.slice(0, invoices.length || 1).join(', ');
    const snippet = digitGroups.length
      ? pick(lang, `"…referral case ${order.enforceNum}… invoice ref(s) ${snippetRefs}…"`, `"…إحالة رقم ${order.enforceNum}… مرجع فاتورة (فواتير) ${snippetRefs}…"`, `"…转执行案件 ${order.enforceNum}…发票参考号 ${snippetRefs}…"`)
      : pick(lang, `"…referral case ${order.enforceNum}… no structured reference number detected…"`, `"…إحالة رقم ${order.enforceNum}… لم يُكتشف رقم مرجعي مهيكل…"`, `"…转执行案件 ${order.enforceNum}…未检测到结构化参考编号…"`);

    return [
      {
        title: pick(lang, 'Reading attached document', 'قراءة المستند المرفق', '读取上传的文件'),
        detail: pick(lang, `File: ${fileName}`, `الملف: ${fileName}`, `文件：${fileName}`)
      },
      {
        title: pick(lang, 'Extracting text (OCR)', 'استخراج النص (OCR)', '文本提取（OCR）'),
        detail: pick(lang, `Extracted fragment: ${snippet}`, `المقطع المستخرج: ${snippet}`, `提取片段：${snippet}`),
        confidence
      },
      {
        title: pick(lang, 'Searching for an invoice reference', 'البحث عن مرجع فاتورة', '搜索发票参考号'),
        detail: digitGroups.length
          ? pick(lang, `Found ${digitGroups.length} numeric reference candidate(s) — cross-checking against invoices in ${order.amanahEn}.`, `تم العثور على ${digitGroups.length} مرجع رقمي محتمل — تجري مقارنته بفواتير ${order.amanahAr}.`, `找到 ${digitGroups.length} 个候选数字参考号——正在与「${order.amanah}」的发票进行比对。`)
          : pick(lang, 'No numeric reference pattern found in the extracted text.', 'لم يُعثر على أي نمط مرجعي رقمي في النص المستخرج.', '提取的文本中未找到任何数字参考模式。')
      },
      {
        title: pick(lang, 'Conclusion', 'الخلاصة', '结论'),
        detail: invoices.length
          ? pick(
              lang,
              `${invoices.length > 1 ? 'Matches' : 'Match'} found: ${invoices.map((i) => i.id).join(', ')} — confidence ${confidence}%.`,
              `تم العثور على ${invoices.length > 1 ? 'تطابقات' : 'تطابق'}: ${invoices.map((i) => i.id).join('، ')} — نسبة الثقة ${confidence}%.`,
              `找到${invoices.length > 1 ? '多个匹配项' : '匹配项'}：${invoices.map((i) => i.id).join('、')}——置信度 ${confidence}%。`
            )
          : pick(lang, 'No matching invoice could be linked from this document.', 'تعذّر ربط أي فاتورة مطابقة من هذا المستند.', '无法从该文件中关联到匹配的发票。')
      }
    ];
  }, [scan, lang, order]);

  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const totalTicks = steps.length * 2;
    if (tick >= totalTicks) {
      const id = window.setTimeout(() => setPhase('done'), 300);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setTick((n) => n + 1), 550);
    return () => window.clearTimeout(id);
  }, [phase, tick, steps.length]);

  const activeStepIndex = Math.min(Math.floor(tick / 2), steps.length - 1);
  const activeRevealed = tick % 2 === 1;

  if (!order) {
    return (
      <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
        <div className="page-head">
          <h1 className="page-title">{t('sanad_order_not_found')}</h1>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/sanad-orders')}>
          <DirectionalIcon direction="back" /> {t('sanad_orders_back')}
        </button>
      </div>
    );
  }

  const amanah = lang === 'zh' ? order.amanah : lang === 'ar' ? order.amanahAr : order.amanahEn;
  const defendant = lang === 'zh' ? order.defendant.zh : lang === 'ar' ? order.defendant.ar : order.defendant.en;

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title" dir="ltr">{order.enforceNum}</h1>
          <div className="page-sub">{t('sanad_order_detail_sub')}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/sanad-orders')}>
          <DirectionalIcon direction="back" /> {t('sanad_orders_back')}
        </button>
      </div>

      <div className="card card-pad">
        <div className="idd-grid">
          <div className="idd-cell">
            <span className="idd-cell__k">{t('sanad_order_amount')}</span>
            <span className="idd-cell__v" dir="ltr">{fmtMoney(order.amount)} SAR</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('th_amanah')}</span>
            <span className="idd-cell__v">{amanah}</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('sanad_order_defendant')}</span>
            <span className="idd-cell__v">{defendant}</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('sanad_order_status')}</span>
            <span className="idd-cell__v">
              <span className="badge badge--red">{t('dash_sanad_stat_unlinked')}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('sanad_order_ocr_title')}</div>
        <div className="page-sub">{t('sanad_order_ocr_sub')}</div>
        <div className="hr" />

        {phase === 'idle' && (
          <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="file"
                id="sanad-order-file"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) startScan(f.name);
                  e.target.value = '';
                }}
              />
              <label htmlFor="sanad-order-file" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                <UIIcon icon={Attachment01Icon} size={16} /> {t('dash_sanad_attach_btn')}
              </label>
            </div>
            <div className="muted" style={{ fontSize: 'var(--text-2xs)', fontWeight: 700 }}>{t('sanad_order_try_examples')}</div>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 'var(--text-2xs)' }} onClick={() => startScan(`enforcement-notice-${order.enforceNum.replace('EN-', '')}.pdf`)}>
                {t('dash_sanad_try_match')}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 'var(--text-2xs)' }} onClick={() => startScan('enforcement-notice-2607714-4482210-7765531.pdf')}>
                {t('dash_sanad_try_multi')}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" style={{ fontSize: 'var(--text-2xs)' }} onClick={() => startScan('scanned-notice.pdf')}>
                {t('dash_sanad_try_none')}
              </button>
            </div>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="ai-timeline">
            {steps.slice(0, activeStepIndex + 1).map((step, i) => {
              const isActive = i === activeStepIndex;
              const revealed = !isActive || activeRevealed;
              let cls = 'ai-step';
              cls += isActive ? (revealed ? ' ai-step--done' : ' ai-step--running') : ' ai-step--done';
              return (
                <div className={cls} key={i}>
                  <div className="ai-step__tag">{i + 1}</div>
                  <div className="ai-step__title">{step.title}</div>
                  <div className="ai-step__detail">
                    {revealed ? (
                      <>
                        <span>{step.detail}</span>
                        {step.confidence != null && (
                          <div className="ai-step__conf">
                            <span className={`ocr-conf ${step.confidence >= 70 ? 'ocr-conf--ok' : 'ocr-conf--low'}`}>{step.confidence}%</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <AgentThinking />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {phase === 'done' && scan && (
          <div className={`ai-conclusion${scan.invoices.length ? '' : ' ai-conclusion--danger'}`}>
            <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
            <div className="ai-conclusion__text">
              <UIIcon icon={scan.invoices.length ? CheckmarkCircle02Icon : CancelCircleIcon} size={16} />
              <span>{scan.invoices.length
                ? (scan.invoices.length > 1 ? t('sanad_order_matched_prefix_multi') : t('sanad_order_matched_prefix'))
                : t('sanad_order_notfound')}</span>
            </div>
            {scan.invoices.length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginTop: 'var(--spacing-md)' }}>
                {scan.invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className="btn btn-sm btn-primary"
                    dir="ltr"
                    onClick={() => nav(`/invoices?co=${inv.co}`)}
                    data-tooltip={t('dash_sanad_view_invoice')}
                  >
                    {inv.id} · {fmtMoney(inv.amount)} SAR <DirectionalIcon />
                  </button>
                ))}
              </div>
            )}
            <div className="ai-conclusion__action" style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginTop: 'var(--spacing-md)' }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setPhase('idle'); setScan(null); }}>
                {t('dash_sanad_try_again')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
