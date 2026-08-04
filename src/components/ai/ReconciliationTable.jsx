import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import { fmtMoney } from '../../data/mock';

/** Derive a per-line 3-way status from raw invoice/PO/GRN values. */
function lineStatus(line, tol) {
  const qtyOk = line.qty === line.poQty && line.qty === line.grnQty;
  const priceDiff = line.poUnit ? Math.abs(line.invUnit - line.poUnit) / line.poUnit : 0;
  if (!qtyOk) return { key: 'mismatch', tone: 'danger' };
  if (priceDiff === 0) return { key: 'match', tone: 'ok' };
  if (priceDiff <= tol) return { key: 'tolerance', tone: 'warn' };
  return { key: 'mismatch', tone: 'danger' };
}

const STATUS_ICON = { match: '✓', tolerance: '⚠', mismatch: '✗' };

/**
 * ReconciliationTable — a real 3-way match table (Invoice ↔ PO ↔ Goods Receipt)
 * built from concrete values, with per-line status chips (match ✓ / within-
 * tolerance ⚠ / mismatch ✗), a subtotal, a ZATCA 15% VAT-recompute row
 * (declared vs computed vs expected) and a tax-ID validity row.
 *
 * Props:
 *  - recon: a RECON[scenario] record
 *  - tolerance: fractional price tolerance (default 0.02 = 2%)
 */
export default function ReconciliationTable({ recon, tolerance = 0.02 }) {
  const { t, lang } = useI18n();
  if (!recon) return null;

  const cur = recon.currency || 'SAR';
  const statusLabel = { match: t('recon_match'), tolerance: t('recon_tolerance'), mismatch: t('recon_mismatch') };

  const vat = recon.vat || {};
  const computed = Math.round((vat.subtotal || 0) * ((vat.rate || 15) / 100));
  const vatOk = vat.declared === vat.expected;
  const vatVariance = (vat.expected || 0) - (vat.declared || 0);

  return (
    <div className="recon">
      <div className="recon__caption">
        <span>{recon.invoiceNo} · {recon.po} · {recon.grn}</span>
        <span className="recon__contract">{recon.contract}</span>
      </div>

      <div className="recon__table" role="table" aria-label={t('recon_title')}>
        <div className="recon__row recon__row--head" role="row">
          <span className="recon__c recon__c--item">{t('recon_item')}</span>
          <span className="recon__c">{t('recon_qty')}</span>
          <span className="recon__c">{t('recon_unit_price')}</span>
          <span className="recon__c">{t('recon_line_total')}</span>
          <span className="recon__c recon__c--st">{t('recon_status')}</span>
        </div>

        {recon.lines.map((ln) => {
          const st = lineStatus(ln, tolerance);
          const qtyOk = ln.qty === ln.poQty && ln.qty === ln.grnQty;
          const priceOk = ln.invUnit === ln.poUnit;
          return (
            <div className="recon__row" role="row" key={ln.no}>
              <span className="recon__c recon__c--item">
                <b>{L(ln.item, lang)}</b>
              </span>
              <span className="recon__c">
                <span dir="ltr">{fmtMoney(ln.qty)}</span>
                {!qtyOk ? <em className="recon__alt" dir="ltr">PO {fmtMoney(ln.poQty)}</em> : null}
              </span>
              <span className="recon__c">
                <span dir="ltr">{fmtMoney(ln.invUnit)}</span>
                {!priceOk ? <em className="recon__alt recon__alt--bad" dir="ltr">PO {fmtMoney(ln.poUnit)}</em> : null}
              </span>
              <span className="recon__c" dir="ltr">{fmtMoney(ln.qty * ln.invUnit)}</span>
              <span className="recon__c recon__c--st">
                <span className={`recon__chip recon__chip--${st.tone}`}>{STATUS_ICON[st.key]} {statusLabel[st.key]}</span>
              </span>
            </div>
          );
        })}

        <div className="recon__row recon__row--sub" role="row">
          <span className="recon__c recon__c--item"><b>{t('recon_line_total')}</b></span>
          <span className="recon__c" />
          <span className="recon__c" />
          <span className="recon__c" dir="ltr"><b>{fmtMoney(vat.subtotal)} {cur}</b></span>
          <span className="recon__c recon__c--st" />
        </div>
      </div>

      {/* VAT recompute + tax-ID rows */}
      <div className="recon__foot">
        <div className="recon__footrow">
          <span className="recon__footlabel">{t('recon_vat_row')}</span>
          <span className="recon__footvals">
            <span className="recon__kv"><i>{t('recon_declared')}</i><b dir="ltr">{fmtMoney(vat.declared)}</b></span>
            <span className="recon__kv"><i>{t('recon_computed')}</i><b dir="ltr">{fmtMoney(computed)}</b></span>
            <span className="recon__kv"><i>{t('recon_expected')}</i><b dir="ltr">{fmtMoney(vat.expected)}</b></span>
            <span className={`recon__chip recon__chip--${vatOk ? 'ok' : 'danger'}`}>
              {vatOk ? '✓' : `✗ ${t('recon_variance')} ${vatVariance > 0 ? '+' : ''}${fmtMoney(vatVariance)}`}
            </span>
          </span>
        </div>
        <div className="recon__footrow">
          <span className="recon__footlabel">{t('recon_taxid')}</span>
          <span className="recon__footvals">
            <code dir="ltr" className="recon__taxid">{recon.taxId?.value}</code>
            <span className={`recon__chip recon__chip--${recon.taxId?.valid ? 'ok' : 'danger'}`}>
              {recon.taxId?.valid ? `✓ ${t('recon_valid')}` : `✗ ${t('recon_invalid')}`}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
