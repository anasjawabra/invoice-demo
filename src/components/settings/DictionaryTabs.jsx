import React from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useL } from '../../utils/bi';
import { EXCLUSION_INTRO, exclusionDocs, precedenceList, FORMULA_GROUPS, DEV_REFERENCE } from '../../data/dictionaryDocs';
import { EXCLUSION_RULE_SET_VERSION } from '../../data/revenueMetrics';

const Code = ({ children }) => <pre className="dd-code" dir="ltr">{children}</pre>;

/* الاستبعادات — ما هي وكيف تُحسب كل واحدة وعلى ماذا تُبنى */
export function ExclusionsTab() {
  const rev = useRevenue(); const { L, B, ar, count, sar } = useL();
  const stats = rev.snapshot.ruleStats || {}; const docs = exclusionDocs();
  return (
    <div className="dd-tab">
      <div className="card card-pad">
        <h2 className="rv-sec-title">{L('What an exclusion is', 'ما هو الاستبعاد؟')}</h2>
        <p dir="auto">{B(EXCLUSION_INTRO.what)}</p>
        <h3 className="h3">{L('General rules (apply to every reason)', 'قواعد عامة (تنطبق على كل الأسباب)')}</h3>
        <ol className="dd-list">{EXCLUSION_INTRO.rules.map((r, i) => <li key={i} dir="auto">{B(r)}</li>)}</ol>
        <h3 className="h3">{L('How the amounts are computed (per invoice)', 'كيف تُحسب المبالغ (لكل فاتورة)')}</h3>
        <Code>{EXCLUSION_INTRO.amounts.map((a) => a.f).join('\n')}</Code>
        <ul className="dd-list">{EXCLUSION_INTRO.amounts.map((a) => <li key={a.f} dir="auto"><code dir="ltr">{a.f.split('=')[0].trim().split(' ')[0]}</code> — {B(a.note)}</li>)}</ul>
        <div className="muted" style={{ fontSize: 12 }}>{L('Rule-set version', 'إصدار مجموعة القواعد')}: <span dir="ltr">{EXCLUSION_RULE_SET_VERSION}</span> · {L('precedence (engine order)', 'الأسبقية (ترتيب المحرك)')}: <span dir="ltr">{precedenceList().join(' → ')}</span></div>
      </div>

      {docs.map((d) => {
        const st = stats[d.ruleId] || { primaryCount: 0, primaryAmount: 0 }; const on = rev.cfg.rules?.[d.ruleId];
        return (
          <article key={d.ruleId} className="card card-pad" id={`rule-${d.ruleId}`} aria-label={B(d)}>
            <div className="rv-card__head">
              <h2 className="rv-sec-title">{ar ? d.ar : d.en} {d.workingLabel && <span className="rv-tag rv-tag--warn">{L('working label', 'تسمية مؤقتة')}</span>} <span className={`rv-tag${on ? '' : ' rv-tag--warn'}`}>{on ? L('on', 'مفعّلة') : L('off (what-if)', 'معطّلة (ماذا لو)')}</span></h2>
              <div className="rv-metric-value" dir="ltr" title={L('Primary reason, current scope', 'السبب الرئيسي في النطاق الحالي')}>{count(st.primaryCount)} · {sar(st.primaryAmount)}</div>
            </div>
            <p dir="auto">{B(d.what)}</p>
            <dl className="rv-dl">
              <dt>{L('Built on', 'تُبنى على')}</dt><dd><ul className="dd-list">{d.basedOn.map((x, i) => <li key={i} dir="auto">{B(x)}</li>)}</ul></dd>
              <dt>{L('Exact rule', 'القاعدة بدقة')}</dt><dd><Code>{d.rule}</Code></dd>
              <dt>{L('Does not apply when', 'لا تنطبق عندما')}</dt><dd dir="auto">{B(d.notWhen)}</dd>
              <dt>{L('Source of the exclusion', 'مصدر الاستبعاد')}</dt><dd dir="auto">{d.source ? (ar ? d.source.ar : d.source.en) : '—'}</dd>
              <dt>{L('How the demo feeds it', 'كيف يُغذّى في العرض')}</dt><dd dir="auto">{B(d.feed)}</dd>
              <dt>{L('Engine', 'المحرك')}</dt><dd dir="ltr">id {d.ruleId} · bit {d.bitIndex} (mask {d.bit}) · precedence {d.priority} · code {d.code} · {d.approval} · {L('since', 'منذ')} {d.effectiveFrom}</dd>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

/* المعادلات والقواعد */
export function FormulasTab() {
  const { L, B } = useL();
  return (
    <div className="dd-tab">
      {FORMULA_GROUPS.map((g, gi) => (
        <section key={gi} className="card card-pad">
          <h2 className="rv-sec-title">{B(g.title)}</h2>
          {g.intro && <p className="muted" dir="auto">{B(g.intro)}</p>}
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table dd-table">
              <thead><tr><th>{L('Name', 'الاسم')}</th><th>{L('Formula', 'المعادلة')}</th><th>{L('Meaning and cautions', 'المعنى والتنبيهات')}</th><th>{L('Where in the code', 'مكانها في الشيفرة')}</th></tr></thead>
              <tbody>{g.rows.map((r, i) => <tr key={i}><td><b>{B(r.name)}</b></td><td><Code>{r.f}</Code></td><td dir="auto">{B(r.meaning)}</td><td dir="ltr"><code>{r.where}</code></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/* للمطورين */
export function DevelopersTab() {
  const { L, B } = useL(); const R = DEV_REFERENCE;
  const table = (rows, h1, h2) => (
    <div className="rv-table-wrap" tabIndex={0}><table className="rv-table dd-table"><thead><tr><th>{h1}</th><th>{h2}</th></tr></thead><tbody>{rows.map(([a, b]) => <tr key={a}><td dir="ltr"><code>{a}</code></td><td dir="auto">{b}</td></tr>)}</tbody></table></div>
  );
  return (
    <div className="dd-tab">
      <section className="card card-pad"><h2 className="rv-sec-title">{L('How a number is produced', 'كيف يُنتج الرقم')}</h2><ol className="dd-list">{R.flow.map((x, i) => <li key={i} dir="auto">{B(x)}</li>)}</ol></section>
      <section className="card card-pad"><h2 className="rv-sec-title">{L('Endpoints', 'نقاط الخدمة')}</h2>{table(R.endpoints, L('Endpoint', 'النقطة'), L('Returns', 'ما تعيده'))}</section>
      <section className="card card-pad"><h2 className="rv-sec-title">{L('Per-invoice columns (columnar store)', 'أعمدة الفاتورة (المخزن العمودي)')}</h2>{table(R.columns, L('Column', 'العمود'), L('Meaning', 'المعنى'))}</section>
      <section className="card card-pad"><h2 className="rv-sec-title">{L('Configuration and constants', 'الإعدادات والثوابت')}</h2>{table(R.config, L('Name', 'الاسم'), L('Effect', 'الأثر'))}</section>
      <section className="card card-pad"><h2 className="rv-sec-title">{L('Adding or changing an exclusion rule', 'إضافة قاعدة استبعاد أو تغييرها')}</h2><ol className="dd-list">{R.addRule.map((x, i) => <li key={i} dir="auto">{B(x)}</li>)}</ol></section>
    </div>
  );
}
