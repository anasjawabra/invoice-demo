// Tab 3 · الأولويات والفواتير الداعمة — ranked action groups as concise finding cards, the eight management questions answered only from the data, and the supporting-invoice table below.
import React, { useMemo } from 'react';
import { useL } from '../../../utils/bi';
import { useNc, FactTag, EvidenceText, LimitNote } from './NcBits';
import NcInvoices from './NcInvoices';
import { groupDrill, groupFactKind, managementQuestions, processText, titleOf } from './ncModel';

function GroupCard({ g, rank }) {
  const { ar, f, openDrill } = useNc(); const { L, invoices } = useL();
  const factors = [
    [L('Unpaid amount', 'المبلغ غير المسدد'), <span dir="ltr" title={f.exact(g.amount)}>{f.money(g.amount)}</span>],
    [L('Longest overdue', 'أطول تأخر'), g.maxOverdueDays > 0 ? <span dir="ltr">{L(`${f.count(g.maxOverdueDays)} days`, `${f.count(g.maxOverdueDays)} يوماً`)}</span> : <span className="muted">—</span>],
    [L('Process recorded', 'الإجراء المسجَّل'), <span dir="auto">{processText(g, ar) || '—'}</span>],
    [L('Data issues', 'مشكلات البيانات'), <span dir="ltr">{f.count(g.dataIssues)}</span>]
  ];
  return (
    <article className={`nc-gcard${g.noAction ? ' nc-gcard--quiet' : ''}`} aria-labelledby={`nc-g-${g.key}`}>
      <header className="nc-gcard__h">
        <span className="nc-gcard__rank" aria-label={L(`Rank ${rank}`, `الترتيب ${rank}`)}>{rank}</span>
        <div className="nc-gcard__t"><h3 id={`nc-g-${g.key}`}>{titleOf(g, ar)}</h3><p dir="auto">{ar ? g.rationaleAr : g.rationaleEn}</p></div>
        <div className="nc-gcard__n"><b>{invoices(g.count)}</b></div>
      </header>
      <dl className="nc-factors" aria-label={L('Ranking factors (no composite score)', 'عوامل الترتيب (بلا درجة مركّبة)')}>
        {factors.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <dl className="nc-gfacts">
        <div><dt>{L('Evidence', 'الدليل')}</dt><dd><FactTag kind={groupFactKind(g)} />{!(groupFactKind(g) === 'calculated' && g.evidence.status === 'calculated') && <> <EvidenceText status={g.evidence.status} /></>}<span className="nc-gfacts__t" dir="auto"> — {ar ? g.evidence.textAr : g.evidence.textEn}</span></dd></div>
        <div><dt>{L('What is missing', 'الناقص')}</dt><dd dir="auto">{ar ? g.missingAr : g.missingEn}</dd></div>
        <div><dt>{L('Proposed next step', 'الخطوة المقترحة')}</dt><dd dir="auto">{ar ? g.nextStepAr : g.nextStepEn} <span className="nc-sug">{L('suggested', 'مقترح')}</span></dd></div>
        <div><dt>{L('Owner · deadline', 'المالك · الموعد')}</dt><dd dir="auto">{(ar ? g.suggestedOwner.ar : g.suggestedOwner.en).replace(/\s*\((suggested|مقترح)\)\s*$/, '')} <span className="nc-sug">{L('suggested', 'مقترح')}</span> · {L('deadline set when a person takes it on', 'الموعد يحدده من يتولى المتابعة')} <span className="nc-sug">{L('suggested', 'مقترح')}</span></dd></div>
      </dl>
      <footer className="nc-gcard__f">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => openDrill(groupDrill(g, ar))}>{L('Show invoices', 'عرض الفواتير')}</button>
        {g.nonAdditiveTags.count > g.count && <span className="nc-fine">{L(`Also applies, as a secondary tag, to ${invoices(g.nonAdditiveTags.count)} in total (not added to the figures above).`, `ينطبق أيضاً كوسم ثانوي على ${f.count(g.nonAdditiveTags.count)} فاتورة في المجموع (لا يُجمع مع الأرقام أعلاه).`)}</span>}
      </footer>
    </article>
  );
}

function Questions() {
  const { a, ar, f, openDrill } = useNc(); const { L } = useL();
  const qs = useMemo(() => managementQuestions(a, ar, f), [a, ar, f.money, f.count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="nc-card" aria-labelledby="nc-q-h">
      <h2 id="nc-q-h" className="nc-h">{L('Management questions', 'أسئلة الإدارة')}</h2>
      <p className="nc-fine">{L('Each answer comes only from this analysis; where the data does not support one, it says so.', 'كل إجابة من هذا التحليل فقط؛ وحيث لا تدعمها البيانات يُذكر ذلك.')}</p>
      <ol className="nc-qs">
        {qs.map((q) => (
          <li key={q.key} className="nc-q">
            <h3 className="nc-q__q" dir="auto">{ar ? q.q.ar : q.q.en}</h3>
            {q.na
              ? <p className="nc-q__a nc-q__a--na"><b>{L('Not available in the data', 'غير متاح في البيانات')}</b>{q.naNote ? ` — ${ar ? q.naNote.ar : q.naNote.en}` : ''}</p>
              : <p className="nc-q__a" dir="auto">{ar ? q.a.ar : q.a.en}</p>}
            {q.open && <div className="nc-q__act">{q.open.map((o, i) => <button key={i} type="button" className="btn btn-sm" onClick={() => openDrill(o.drill)}>{ar ? o.label.ar : o.label.en}</button>)}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function NcPriorities() {
  const { a, ar } = useNc(); const { L } = useL();
  const live = a.groups.filter((g) => g.count > 0); const empty = a.groups.filter((g) => g.count === 0);
  return (
    <div className="nc-stack">
      <section aria-labelledby="nc-prio-h">
        <h2 id="nc-prio-h" className="nc-h">{L('Priorities — where to act first', 'الأولويات — أين نبدأ')}</h2>
        <p className="nc-fine">{L('Each unpaid invoice is in exactly one group (the first that applies), so the groups add up to the net unpaid. They are ranked by the visible factors on each card — unpaid amount first, then the longest overdue — with no composite score. Owners and deadlines are suggestions only; nothing here starts enforcement, approves an exclusion or changes a source record.', 'كل فاتورة غير مسددة في مجموعة واحدة فقط (أولى ما ينطبق) فتجمع المجموعات إلى صافي غير المسدد. وتُرتَّب بالعوامل الظاهرة في كل بطاقة — المبلغ ثم أطول تأخر — دون درجة مركّبة. المالك والموعد مقترحان فقط؛ ولا شيء هنا يبدأ إنفاذاً أو يعتمد استبعاداً أو يغيّر سجلاً في المصدر.')}</p>
        <div className="nc-gcards">{live.map((g) => <GroupCard key={g.key} g={g} rank={g.rank} />)}</div>
        {empty.length > 0 && <details className="nc-fold"><summary>{L(`${empty.length} groups with no invoices`, `${empty.length} مجموعات بلا فواتير`)}</summary><ul className="nc-emptylist">{empty.map((g) => <li key={g.key} dir="auto">{titleOf(g, ar)}</li>)}</ul></details>}
      </section>
      <Questions />
      <LimitNote>{L('A proposed enforcement link is unverified and a confirmed order does not mean any payment; part-paid invoices keep their collected amount.', 'الربط المقترح بالإنفاذ غير مؤكَّد، والأمر المؤكَّد لا يعني حدوث سداد؛ والفواتير المسددة جزئياً تحتفظ بمبلغها المحصَّل.')}</LimitNote>
      <NcInvoices />
    </div>
  );
}
