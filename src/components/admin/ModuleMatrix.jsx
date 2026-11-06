import React, { useId } from 'react';
import { MODULES } from '../../data/permissions';
import { useTx, AIcon, Switch } from './adminBits';
import { LOCKED_MODULES, moduleName, moduleNameOther, setModule, setAllModules, moduleCountText } from './adminLogic';

/* The module matrix of a role: ONE row per module with ONE On/Off switch (text «مفعّل / غير مفعّل» + symbol, never colour alone). No action codes, no nested trees, no dependency prompts.
   `protectedRole` (the Administrator): «users» and «roles» stay on, shown locked with the reason. */
export default function ModuleMatrix({ selected, onChange, protectedRole = false, disabled = false, error }) {
  const { tx, lang } = useTx(); const idp = useId().replace(/:/g, ''); const set = new Set(selected || []); const c = moduleCountText(selected);
  return (
    <fieldset className="adm-mods" disabled={disabled} aria-describedby={error ? `${idp}-err` : undefined}>
      <legend>{tx('mods.title')}</legend>
      <div className="adm-mods__bar">
        <span className="adm-muted" role="status">{tx('mods.count', c)}</span>
        <span className="adm-mods__helpers">
          <button type="button" className="btn btn-sm" disabled={disabled || c.n === c.total} onClick={() => onChange(setAllModules(true, { protectedRole }))}>{tx('mods.enableAll')}</button>
          <button type="button" className="btn btn-sm" disabled={disabled || c.n === 0 || (protectedRole && c.n === LOCKED_MODULES.length)} onClick={() => onChange(setAllModules(false, { protectedRole }))}>{tx('mods.disableAll')}</button>
        </span>
      </div>
      <ul className="adm-modlist">
        {MODULES.map((m) => {
          const on = set.has(m.id); const locked = protectedRole && LOCKED_MODULES.includes(m.id); const id = `${idp}-${m.id}`;
          return (
            <li key={m.id} className={`adm-mod${on ? ' is-on' : ''}`} data-module={m.id}>
              <div className="adm-mod__txt"><span id={id} className="adm-mod__t">{moduleName(m, lang)}</span><small className="adm-mod__o" lang={lang === 'en' ? 'ar' : 'en'}>{moduleNameOther(m, lang)}</small>
                {locked && <small className="adm-mod__lock" id={`${id}-why`}><AIcon name="lock" size={12} />{tx('mods.locked')}</small>}</div>
              <Switch checked={on} disabled={disabled || locked} labelledBy={id} describedBy={locked ? `${id}-why` : undefined} onChange={(v) => onChange(setModule(selected, m.id, v, { protectedRole }))}
                onText={<><AIcon name="check" size={12} /> {tx('common.on')}</>} offText={<><AIcon name="minus" size={12} /> {tx('common.off')}</>} />
            </li>
          );
        })}
      </ul>
      {error && <div id={`${idp}-err`} className="adm-fielderr" role="alert">{error}</div>}
    </fieldset>
  );
}
