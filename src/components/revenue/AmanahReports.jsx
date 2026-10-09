// Two report-style tables, both computed from the shared snapshot (`snapshot.matrix`) — never re-derived here.
//  1. AmanahSourceReport — per revenue source, every Amanah: net billed, collected, collection rate, this period vs the like-for-like
//     comparison period (the layout of the monthly report's per-source Amanah tables).
//  2. ExclusionMatrix — Amanah × exclusion reason (each invoice once, under its primary reason) + cancelled; adds up to the
//     exclusions card (the monthly report's "excluded invoices" appendix).
import React, { useMemo, useState } from 'react';
import { useL } from '../../utils/bi';
import Amt from '../Amt';
import { REVENUE_SOURCES, REVENUE_SOURCE_KEYS } from '../../data/revenueLedger';
import { EXCLUSION_RULES } from '../../data/revenueMetrics';

const pct = (c, n) => (n > 0 ? (c / n) * 100 : null);
const ppText = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`);

function amanahLabelOf(snapshot) {
  const m = new Map(); for (const g of snapshot.byAmanah) m.set(g.key, g.label); return m;
}

export function AmanahSourceReport({ snapshot, prev, comparable }) {
  const { L, B, ar, count } = useL();
  const [src, setSrc] = useState('all');
  const labels = useMemo(() => amanahLabelOf(snapshot), [snapshot]);
  const rows = useMemo(() => {
    const fold = (snap) => {
      const m = new Map();
      for (const r of snap?.matrix?.amanahSource || []) {
        if (src !== 'all' && r.source !== src) continue;
        const a = m.get(r.amanah) || { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0 };
        a.count += r.count; a.gross += r.gross; a.exclusions += r.exclusions; a.net += r.net; a.collected += r.collected; m.set(r.amanah, a);
      }
      return m;
    };
    const cur = fold(snapshot); const old = comparable ? fold(prev) : new Map();
    return [...cur.entries()].map(([key, a]) => {
      const o = old.get(key); const rate = pct(a.collected, a.net); const prate = o ? pct(o.collected, o.net) : null;
      return { key, ...a, rate, prate, dpp: rate != null && prate != null ? rate - prate : null, dcol: o && o.collected > 0 ? ((a.collected - o.collected) / o.collected) * 100 : null };
    }).sort((x, y) => y.net - x.net);
  }, [snapshot, prev, comparable, src]);
  const tot = useMemo(() => rows.reduce((t, r) => ({ count: t.count + r.count, gross: t.gross + r.gross, exclusions: t.exclusions + r.exclusions, net: t.net + r.net, collected: t.collected + r.collected }), { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0 }), [rows]);
  const totPrev = useMemo(() => {
    if (!comparable) return null; let n = 0; let c = 0;
    for (const r of prev?.matrix?.amanahSource || []) { if (src !== 'all' && r.source !== src) continue; n += r.net; c += r.collected; }
    return pct(c, n);
  }, [prev, comparable, src]);
  const totRate = pct(tot.collected, tot.net);
  const srcName = (k) => (ar ? REVENUE_SOURCES[k].ar : REVENUE_SOURCES[k].en);
  return (
    <div className="card card-pad">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>{L('Amanah performance by revenue source', 'أداء الأمانات حسب مصدر الإيراد')}</div>
          <div className="page-sub">{L('Net billed = gross − exclusions; collection rate = collected ÷ net billed. The total row is Σ collected ÷ Σ net, not an average of rates. Compared with the same period last year, each measured at its own end.', 'صافي المفوتر = الإجمالي − الاستبعادات؛ نسبة التحصيل = المحصّل ÷ صافي المفوتر. صف الإجمالي = مجموع المحصّل ÷ مجموع الصافي لا متوسط النسب. المقارنة مع الفترة المماثلة من العام السابق وكل فترة تُقاس عند نهايتها.')}</div>
        </div>
      </div>
      <div role="group" aria-label={L('Revenue source', 'مصدر الإيراد')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {['all', ...REVENUE_SOURCE_KEYS].map((k) => (
          <button key={k} type="button" className={`btn btn-sm ${src === k ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={src === k} onClick={() => setSrc(k)}>{k === 'all' ? L('All sources', 'كل المصادر') : srcName(k)}</button>
        ))}
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table className="table" aria-label={L('Amanah performance by revenue source', 'أداء الأمانات حسب مصدر الإيراد')}>
          <thead>
            <tr>
              <th>{L('Amanah', 'الأمانة')}</th><th>{L('Invoices', 'الفواتير')}</th><th>{L('Net billed', 'صافي المفوتر')}</th><th>{L('Collected', 'المحصّل')}</th><th>{L('Collection rate', 'نسبة التحصيل')}</th>
              {comparable && <><th>{L('Last year rate', 'نسبة العام السابق')}</th><th>{L('Change (pp)', 'التغير (نقطة)')}</th><th>{L('Collected change', 'تغير المحصّل')}</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{B(labels.get(r.key)) || r.key}</td><td dir="ltr">{count(r.count)}</td><td dir="ltr"><Amt v={r.net} /></td><td dir="ltr"><Amt v={r.collected} /></td>
                <td dir="ltr">{r.rate == null ? L('Not available', 'غير متاحة') : `${r.rate.toFixed(1)}%`}</td>
                {comparable && <><td dir="ltr">{r.prate == null ? '—' : `${r.prate.toFixed(1)}%`}</td><td dir="ltr">{ppText(r.dpp)}</td><td dir="ltr">{r.dcol == null ? '—' : `${r.dcol >= 0 ? '+' : ''}${r.dcol.toFixed(0)}%`}</td></>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={comparable ? 8 : 5}><div className="rv-empty">{L('No invoices for this source in the selected period.', 'لا فواتير لهذا المصدر في الفترة المحددة.')}</div></td></tr>}
            {rows.length > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td>{L('Total', 'الإجمالي')}</td><td dir="ltr">{count(tot.count)}</td><td dir="ltr"><Amt v={tot.net} /></td><td dir="ltr"><Amt v={tot.collected} /></td>
                <td dir="ltr">{totRate == null ? L('Not available', 'غير متاحة') : `${totRate.toFixed(1)}%`}</td>
                {comparable && <><td dir="ltr">{totPrev == null ? '—' : `${totPrev.toFixed(1)}%`}</td><td dir="ltr">{ppText(totRate != null && totPrev != null ? totRate - totPrev : null)}</td><td /></>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExclusionMatrix({ snapshot }) {
  const { L, B, ar, count } = useL();
  const labels = useMemo(() => amanahLabelOf(snapshot), [snapshot]);
  const { cols, rows, colTot, grand } = useMemo(() => {
    const reasons = ['cancelled', ...EXCLUSION_RULES.map((r) => r.id)];
    const by = new Map(); const ct = {}; let g = { amount: 0, count: 0 };
    for (const r of snapshot.matrix?.amanahReasons || []) {
      const a = by.get(r.amanah) || { key: r.amanah, total: 0, totalCount: 0, cells: {} };
      a.cells[r.reason] = { amount: r.amount, count: r.count }; a.total += r.amount; a.totalCount += r.count; by.set(r.amanah, a);
      const c = ct[r.reason] || { amount: 0, count: 0 }; c.amount += r.amount; c.count += r.count; ct[r.reason] = c; g = { amount: g.amount + r.amount, count: g.count + r.count };
    }
    return { cols: reasons.filter((k) => ct[k]), rows: [...by.values()].sort((x, y) => y.total - x.total), colTot: ct, grand: g };
  }, [snapshot]);
  const name = (k) => (k === 'cancelled' ? L('Cancelled in the source', 'ملغاة في المصدر') : (() => { const r = EXCLUSION_RULES.find((x) => x.id === k); return r ? `${B(r.label)} (${k})` : k; })());
  const total = snapshot.totals.exclusions;
  return (
    <div className="card card-pad">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>{L('Excluded invoices by Amanah and reason', 'الفواتير المستثناة حسب الأمانة وسبب الاستثناء')}</div>
          <div className="page-sub">{L('Each invoice appears once, under its primary reason (cancelled takes precedence), so the grand total equals the exclusions card and several reasons never deduct twice. Reasons from unapproved rules are labelled in the rules register.', 'تظهر كل فاتورة مرة واحدة تحت سببها الرئيسي (الملغاة لها الأسبقية)، فيساوي الإجمالي بطاقة الاستبعادات ولا يتكرر الخصم عند تعدد الأسباب. أسباب القواعد غير المعتمدة موسومة في سجل القواعد.')}</div>
        </div>
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table className="table" aria-label={L('Excluded invoices by Amanah and reason', 'الفواتير المستثناة حسب الأمانة وسبب الاستثناء')}>
          <thead><tr><th>{L('Amanah', 'الأمانة')}</th>{cols.map((k) => <th key={k}>{name(k)}</th>)}<th>{L('Total exclusions', 'إجمالي الاستبعادات')}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{B(labels.get(r.key)) || r.key}</td>
                {cols.map((k) => <td key={k} dir="ltr">{r.cells[k] ? <><Amt v={r.cells[k].amount} /><div className="muted" style={{ fontSize: 12 }}>{count(r.cells[k].count)} {ar ? 'فاتورة' : 'inv.'}</div></> : '—'}</td>)}
                <td dir="ltr"><Amt v={r.total} /><div className="muted" style={{ fontSize: 12 }}>{count(r.totalCount)} {ar ? 'فاتورة' : 'inv.'}</div></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 2}><div className="rv-empty">{L('No exclusions in the selected period.', 'لا استبعادات في الفترة المحددة.')}</div></td></tr>}
            {rows.length > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td>{L('Total', 'الإجمالي')}</td>
                {cols.map((k) => <td key={k} dir="ltr"><Amt v={colTot[k].amount} /><div className="muted" style={{ fontSize: 12 }}>{count(colTot[k].count)} {ar ? 'فاتورة' : 'inv.'}</div></td>)}
                <td dir="ltr" title={Math.abs(grand.amount - total) < 1 ? '' : 'mismatch'}><Amt v={grand.amount} /><div className="muted" style={{ fontSize: 12 }}>{count(grand.count)} {ar ? 'فاتورة' : 'inv.'}</div></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
