import { localize } from '../../utils/zh';
import React from 'react';
import { useL } from '../../utils/bi';
import { BILLERS, CENTRAL_BILLER, HOUSING_BILLER, invoiceKey } from '../../data/iim';

/* مثال: رقم السداد ومعرّف المُفوتر — مفتاح الفاتورة = معرّف المُفوتر + رقم السداد */
export default function SadadExample() {
  const { L, B, ar , lang } = useL();
  const ex = { sadad: '409280122502' };
  const riyadh = BILLERS.find((b) => b.en === 'Riyadh Amanah');
  const rows = BILLERS.filter((b) => b.id !== HOUSING_BILLER.id);
  return (
    <section className="card card-pad" id="sadad-example" aria-label={L('Example: SADAD number and biller ID', 'مثال: رقم السداد ومعرّف المُفوتر')}>
      <div className="rv-card__head">
        <h2 className="rv-sec-title">{L('Example: the SADAD number and the biller ID', 'مثال: رقم السداد ومعرّف المُفوتر')} <span className="rv-tag">{L('invoice identity', 'تعريف الفاتورة')}</span></h2>
      </div>
      <dl className="rv-dl">
        <dt>{L('Invoice key', 'مفتاح الفاتورة')}</dt>
        <dd dir="auto">{L('Biller ID + SADAD number. The SADAD number also stays a separate, searchable field.', 'معرّف المُفوتر + رقم السداد، مع إبقاء رقم السداد حقلاً مستقلاً قابلاً للبحث.')}</dd>
        <dt>{L('Formula', 'المعادلة')}</dt>
        <dd><pre className="dd-code" dir="ltr">{'invoice id = billerId + "-" + sadadNumber'}</pre></dd>
        <dt>{L('Example', 'مثال')}</dt>
        <dd dir="auto">
          <ul className="dd-list">
            <li><code dir="ltr">{invoiceKey(CENTRAL_BILLER.id, ex.sadad)}</code> — {L(`billed under the Ministry's biller ID ${CENTRAL_BILLER.id}; SADAD number ${ex.sadad}.`, `فاتورة مفوترة بمعرّف المُفوتر الخاص بالوزارة ${CENTRAL_BILLER.id}؛ رقم السداد ${ex.sadad}.`)}</li>
            <li><code dir="ltr">{invoiceKey(riyadh.id, ex.sadad)}</code> — {L(`the same SADAD number under the Riyadh Amanah's own biller ID ${riyadh.id}: a different invoice. Searching the SADAD number returns both.`, `رقم السداد نفسه بمعرّف المُفوتر الخاص بأمانة الرياض ${riyadh.id}: فاتورة مختلفة. والبحث برقم السداد يعرض الفاتورتين.`)}</li>
          </ul>
        </dd>
        <dt>{L('Where the biller ID comes from', 'مصدر معرّف المُفوتر')}</dt>
        <dd dir="auto">{L('177 is the Ministry\'s biller ID in SADAD. Some Amanahs, for example Riyadh, have biller IDs of their own for their revenues. In the supplied list the "SADAD number" column is the biller number, not a revenue-item code.', '177 هو معرّف المُفوتر الخاص بالوزارة في سداد. ولبعض الأمانات، مثل أمانة الرياض، معرّفات مُفوتر خاصة بإيراداتها. و«رقم السداد» في القائمة المقدَّمة هو رقم المفوتر، وليس رمز بند الإيراد.')}</dd>
      </dl>
      <h3 className="h3">{L('SADAD biller IDs of the Ministry and the Amanahs', 'معرّفات المُفوترين في سداد للوزارة والأمانات')}</h3>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table dd-table">
          <thead><tr><th>{L('Entity', 'اسم الجهة')}</th><th>{L('Biller ID', 'معرّف المُفوتر')}</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.en}>
                <td dir="auto">{ar ? b.ar : localize(b.en, lang)}</td>
                <td dir="ltr">{b.verified === false ? <span title={L('No independent number verified; the demo uses a placeholder', 'لم يُتحقق من رقم مستقل؛ يستخدم العرض رقماً مؤقتاً')}>— <span className="muted">({b.id} {L('demo placeholder', 'مؤقت في العرض')})</span></span> : b.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" dir="auto" style={{ fontSize: 12 }}>{L('"—" means no independent biller number could be verified for the entity. Some sources still use earlier entity names and do not by themselves prove that the number applies to every service. The Housing sector (' + HOUSING_BILLER.id + ') is not in the supplied list. Sources: Ministry of Finance, government e-payment SADAD; Arab National Bank, SADAD billers directory.', '«—» تعني عدم التحقق من رقم مستقل للجهة. وبعض المصادر تستخدم أسماء الجهات السابقة ولا تثبت وحدها سريان الرقم لكل خدمة. وقطاع الإسكان (' + HOUSING_BILLER.id + ') ليس في القائمة المقدَّمة. المصادر: وزارة المالية — السداد الحكومي الإلكتروني؛ البنك العربي الوطني — دليل مفوتري سداد.')}</p>
    </section>
  );
}
