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
  // This is a sample selection, not a verified match to the digits in the
  // file name. Keep enforcement-collected invoices first for the demo.
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
    const fileNameNumbers = digitGroups.slice(0, 3).join(', ');

    return [
      {
        title: pick(lang, 'Checking file name (demo)', 'فحص اسم الملف (عرض تجريبي)', '检查文件名（演示）'),
        detail: pick(lang, `File name: ${fileName}`, `اسم الملف: ${fileName}`, `文件名：${fileName}`)
      },
      {
        title: pick(lang, 'Finding number patterns in the file name', 'البحث عن أنماط رقمية في اسم الملف', '查找文件名中的数字模式'),
        detail: digitGroups.length
          ? pick(lang, `Found ${digitGroups.length} number pattern(s) of at least four digits; first examples: ${fileNameNumbers}.`, `عُثر على ${digitGroups.length} نمط رقمي من أربعة أرقام على الأقل؛ الأمثلة الأولى: ${fileNameNumbers}.`, `找到 ${digitGroups.length} 组至少四位的数字；前几组：${fileNameNumbers}。`)
          : pick(lang, 'No number pattern of at least four digits in the file name.', 'لا يوجد نمط رقمي من أربعة أرقام على الأقل في اسم الملف.', '文件名中没有至少四位的数字模式。')
      },
      {
        title: pick(lang, 'Selecting sample invoices', 'اختيار فواتير نموذجية', '选择示例发票'),
        detail: invoices.length
          ? pick(lang, `Showing ${invoices.length} sample invoice(s) from ${order.amanahEn}; file contents are not read.`, `عرض ${invoices.length} فاتورة نموذجية من ${order.amanahAr}؛ لا تتم قراءة محتوى الملف.`, `展示「${order.amanah}」的 ${invoices.length} 张示例发票；不读取文件内容。`)
          : pick(lang, 'No sample invoice selected from this file name.', 'لم تُحدَّد فاتورة نموذجية من اسم الملف هذا.', '未根据此文件名选出示例发票。')
      },
      {
        title: pick(lang, 'Demo result', 'نتيجة العرض التجريبي', '演示结果'),
        detail: invoices.length
          ? pick(
              lang,
              `Sample invoice(s): ${invoices.map((i) => i.id).join(', ')}. These are not document-verified matches.`,
              `فاتورة (فواتير) نموذجية: ${invoices.map((i) => i.id).join('، ')}. لم يتم التحقق من مطابقتها مع محتوى المستند.`,
              `示例发票：${invoices.map((i) => i.id).join('、')}。这些并非经文件内容核实的匹配结果。`
            )
          : pick(lang, 'No sample link could be generated from this file name.', 'تعذّر إنشاء ربط نموذجي من اسم الملف هذا.', '无法根据此文件名生成示例关联。')
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
