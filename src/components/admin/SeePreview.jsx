import React, { useId } from 'react';
import { useL } from '../../utils/bi';
import { fmtInt } from '../../utils/money';
import { useTx, usePreview, AIcon } from './adminBits';
import { errorText } from './adminText';
import { MODULE_IDS } from '../../data/permissions';
import { modulesOfRole, moduleName, previewFigures } from './adminLogic';

/* «ماذا سيرى؟ / What will they see?» — two or three lines under the user form: the modules of the chosen role and the SYNTHETIC figures visible under the chosen geographic access
   (POST /admin/preview {roleId, scope}). No drawer, no comparison. `scope` is null while the geographic access is not valid → no request. */
export default function SeePreview({ role, scope }) {
  const { tx, lang, ar } = useTx(); const { money } = useL(); const hid = useId();
  const body = role && scope ? { roleId: role.id, scope } : null;
  const p = usePreview(body);
  const mods = modulesOfRole(role); const f = previewFigures(p.data);
  const sep = ar ? '، ' : ', ';
  return (
    <section className="adm-see" aria-labelledby={hid} aria-live="polite">
      <h3 id={hid} className="adm-see__h"><AIcon name="info" size={14} />{tx('see.title')}</h3>
      {!role || !scope ? <p className="adm-muted">{tx('see.choose')}</p> : (
        <>
          <p className="adm-see__line"><b>{tx('see.modules', { n: mods.length, total: MODULE_IDS.length })}</b>{' '}{mods.length ? mods.map((m) => moduleName(m, lang)).join(sep) : tx('see.noModules')}{role.readOnly ? <> · <span className="adm-tag adm-tag--ro"><AIcon name="lock" size={11} />{tx('roles.readOnlyTag')}</span></> : null}</p>
          {p.loading && !p.data ? <p className="adm-muted" role="status">{tx('common.loading')}</p>
            : p.error ? <p className="adm-muted">{errorText(p.error, lang)}</p>
            : f ? (
              <p className="adm-see__line"><b>{tx('see.figures')}</b>{' '}{fmtInt(f.count)} {tx('see.invoices')} · {tx('fig.net')} {money(f.net)} · {tx('fig.collected')} {money(f.collected)} · {tx('fig.uncollected')} {money(f.uncollected)}
                <small className="adm-muted"> — {tx('see.synthetic')}</small></p>
            ) : <p className="adm-muted">{p.data && p.data.figuresWithheld ? tx('see.withheld') : tx('see.noFigures')}</p>}
        </>
      )}
    </section>
  );
}
