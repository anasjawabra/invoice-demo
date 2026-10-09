import React, { useState } from 'react';
import Pager from '../components/Pager';
import { Link, useNavigate } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { MetricTile, ProvenanceBadge } from '../components/revenue/RevenueUI';
import { caseSummary } from '../data/enforcementMatching';
import { SANAD_ENFORCEMENT } from '../data/mock';

const STATE_LABEL = {
  linked: { en: 'Linked (confirmed)', ar: 'مربوطة (مؤكدة)', cls: 'rv-cat--enforcement' },
  candidate: { en: 'Candidate — needs review', ar: 'مرشح — يحتاج مراجعة', cls: 'rv-cat--partial' },
  ambiguous: { en: 'Ambiguous — needs a human choice', ar: 'ملتبس — يحتاج اختياراً بشرياً', cls: 'rv-cat--partial' },
  unresolved: { en: 'Unresolved', ar: 'غير محسومة', cls: '' }
};

// Enforcement workspace: Sanad / Efaa cases and their (human-reviewed) links to invoices.
export default function SanadOrders() {
  const { cases } = useRevenue();
  const { L, B, short, ar, sar, count: fmt } = useL();
  const nav = useNavigate();
  const [page, setPage] = useState(0);
  const rows = cases.map((c) => ({ c, s: caseSummary(c) }));
  const count = (st) => rows.filter((r) => r.s.state === st).length;
  const totalUnalloc = rows.reduce((a, r) => a + r.s.unallocated, 0);

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Enforcement workspace — case-to-invoice linking', 'مساحة عمل الإنفاذ — ربط القضايا بالفواتير')}</h1>
          <div className="page-sub">{L('Structured identifiers first; document-extracted references when needed. One case can link to several invoices. Ambiguous matches stay unresolved until a person decides, and every decision keeps its history inside this solution — no source system is changed.', 'المعرّفات المهيكلة أولاً؛ ثم المراجع المستخرجة من المستندات عند الحاجة. يمكن لقضية واحدة أن ترتبط بعدة فواتير. تبقى المطابقات الملتبسة غير محسومة حتى يقرر شخص، ويحتفظ كل قرار بسجله داخل هذه المنصة — ولا يتغير أي نظام مصدر.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ProvenanceBadge kind="demo" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/noncollection')}>{L('Noncollection & exclusions', 'عدم التحصيل والاستبعادات')}</button>
        </div>
      </div>

      <div className="rv-callout">{L('Requests and statuses come from the Sanad report loaded in Data sources (demo data). A request linked to a contract number without identified invoices stays at contract level and is never added to the uncollected debt.', 'الطلبات وحالاتها من تقرير سند المحمّل في مصادر البيانات (بيانات تجريبية). والطلب المرتبط برقم عقد دون فواتير محددة يبقى على مستوى العقد ولا يُضاف إلى المديونية غير المحصلة.')}</div>

      <div className="rv-tiles">
        <MetricTile label={L('Cases', 'القضايا')} value={fmt(cases.length)} />
        <MetricTile label={L('Linked (confirmed)', 'مربوطة (مؤكدة)')} value={fmt(count('linked'))} />
        <MetricTile label={L('Awaiting review', 'بانتظار المراجعة')} value={fmt(count('candidate') + count('ambiguous'))} tone={count('candidate') + count('ambiguous') ? 'warn' : undefined} />
        <MetricTile label={L('Unresolved', 'غير محسومة')} value={fmt(count('unresolved'))} />
        <MetricTile label={L('Unallocated case amount', 'مبلغ القضايا غير الموزع')} value={short(totalUnalloc)} sub={L('Case amounts are not spread across invoices unless the pair is exact', 'لا تُوزّع مبالغ القضايا على الفواتير ما لم يكن الزوج مطابقاً')} />
      </div>

      <div className="card card-pad">
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr><th>{L('Case', 'القضية')}</th><th>{L('Platform', 'المنصة')}</th><th>{L('Amanah', 'الأمانة')}</th><th className="num">{L('Case amount', 'مبلغ القضية')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Linked invoices', 'فواتير مربوطة')}</th><th className="num">{L('Unallocated', 'غير موزع')}</th><th /></tr></thead>
            <tbody>
              {rows.slice(page * 25, (page + 1) * 25).map(({ c, s }) => (
                <tr key={c.enforceNum}>
                  <td dir="ltr"><b>{c.enforceNum}</b></td>
                  <td>{c.system === 'sanad' ? 'Sanad' : c.system === 'white_lands' ? L('White-lands file', 'ملف الأراضي البيضاء') : 'Efaa'}</td>
                  <td>{c.amanahEn}</td>
                  <td className="num" dir="ltr">{sar(c.amount)}</td>
                  <td><span className={`rv-cat ${STATE_LABEL[s.state].cls}`}>{B(STATE_LABEL[s.state])}</span>{s.candidates > 0 && <span className="rv-tag" style={{ marginInlineStart: 6 }}>{L(`${s.candidates} candidate(s)`, `${s.candidates} مرشح`)}</span>}</td>
                  <td className="num">{s.confirmed}</td>
                  <td className="num" dir="ltr">{sar(s.unallocated)}</td>
                  <td><Link className="btn btn-sm btn-primary" to={`/sanad-orders/${encodeURIComponent(c.enforceNum)}`}>{L('Open', 'فتح')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={rows.length} size={25} onPage={setPage} />
        <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
          {L(`Illustrative portfolio statistics (not derived from the cases above): ${SANAD_ENFORCEMENT.ordersUnlinked} of ${SANAD_ENFORCEMENT.ordersIssued} issued orders reported without a linked invoice.`, `إحصاءات توضيحية للمحفظة (غير مشتقة من القضايا أعلاه): ${SANAD_ENFORCEMENT.ordersUnlinked} من ${SANAD_ENFORCEMENT.ordersIssued} أمراً صادراً بلا فاتورة مرتبطة.`)}
        </p>
      </div>
    </div>
  );
}
