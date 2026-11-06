import React, { useId, useMemo, useState } from 'react';
import { normText } from '../../data/textNorm';
import { useTx, AIcon } from './adminBits';
import { GEO_OPTIONS, setOption, toggleAmanah, addAmanahs, clearAmanahs, municipalityOptions, setMunicipalities, toggleMunicipality, setIncludeDirect, validateAccess, accessSummary } from './adminLogic';

/* «الوصول الجغرافي / Geographic access» — THREE clear options over the unchanged GeoScope:
   1 all entities and municipalities · 2 selected Amanahs (with all their municipalities) · 3 selected municipalities under selected Amanahs (the municipality list DEPENDS on the Amanah),
   plus, under option 3 only, ONE unticked-by-default checkbox for the Amanah-level and unspecified-municipality records. value = the model of adminLogic.emptyAccess(); hier = hierarchyIndex(catalog.hierarchy). */
const nameOf = (o, ar) => (ar ? o.nameAr || o.nameEn : o.nameEn || o.nameAr);
const both = (o) => [o.nameAr, o.nameEn].filter(Boolean).join(' ');

function AmanahPicker({ value, onChange, hier, disabled, idp }) {
  const { tx, ar } = useTx(); const [q, setQ] = useState(''); const needle = normText(q);
  const shown = useMemo(() => hier.amanahs.filter((a) => !needle || normText(both(a)).includes(needle)), [hier, needle]);
  return (
    <div className="adm-pick">
      <div className="adm-pick__bar">
        <label className="adm-search adm-search--sm"><AIcon name="search" size={14} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('geo.searchAmanahs')} aria-label={tx('geo.searchAmanahs')} disabled={disabled} /></label>
        <button type="button" className="btn btn-sm btn-ghost" disabled={disabled || !shown.length} onClick={() => onChange(addAmanahs(value, shown.map((a) => a.key), hier))}>{needle ? tx('geo.selectShown') : tx('geo.selectAll')}</button>
        <button type="button" className="btn btn-sm" disabled={disabled || !value.amanahs.length} onClick={() => onChange(clearAmanahs(value))}>{tx('geo.clear')}</button>
      </div>
      <div className="adm-muted adm-pick__count" role="status">{tx('geo.amanahsSelected', { n: value.amanahs.length, total: hier.amanahs.length })}</div>
      {shown.length === 0 ? <div className="adm-empty adm-empty--sm">{tx('geo.noAmanahsFound')}</div> : (
        <ul className="adm-ticklist adm-ticklist--amanahs" aria-label={tx('geo.amanahs')}>
          {shown.map((a) => {
            const id = `${idp}-a-${a.key.replace(/[^a-z0-9]/gi, '')}`;
            return <li key={a.key}><label htmlFor={id}><input id={id} type="checkbox" checked={value.amanahs.includes(a.key)} disabled={disabled} onChange={(e) => onChange(toggleAmanah(value, a.key, e.target.checked, hier))} /><span>{nameOf(a, ar)}</span><small className="adm-muted">{tx('geo.muniCount', { n: a.refs.length })}</small></label></li>;
          })}
        </ul>
      )}
    </div>
  );
}

/** the municipality tick list of ONE selected Amanah — only that Amanah's municipalities are offered */
function MunicipalityCard({ amanahKey, value, onChange, hier, disabled, idp }) {
  const { tx, ar } = useTx(); const [q, setQ] = useState(''); const needle = normText(q);
  const entry = hier.map.get(amanahKey); if (!entry) return null;
  const all = municipalityOptions(hier, amanahKey); const visible = all.filter((m) => !needle || normText(both(m)).includes(needle));
  const picked = new Set(value.munis[amanahKey] || []);
  return (
    <section className="adm-muni" aria-labelledby={`${idp}-h`} data-amanah={amanahKey}>
      <header className="adm-muni__head">
        <h4 id={`${idp}-h`} className="adm-muni__name"><AIcon name="building" size={14} />{nameOf(entry, ar)}</h4>
        <span className="adm-muted" role="status">{tx('geo.munisSelected', { n: picked.size, total: all.length })}</span>
        <button type="button" className="adm-iconbtn" disabled={disabled} onClick={() => onChange(toggleAmanah(value, amanahKey, false, hier))} aria-label={tx('geo.removeAmanah', { name: nameOf(entry, ar) })}><AIcon name="close" size={14} /></button>
      </header>
      <div className="adm-pick__bar">
        <label className="adm-search adm-search--sm"><AIcon name="search" size={14} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('geo.searchMunis')} aria-label={`${tx('geo.searchMunis')} — ${nameOf(entry, ar)}`} disabled={disabled} /></label>
        <button type="button" className="btn btn-sm btn-ghost" disabled={disabled || !visible.length} onClick={() => onChange(setMunicipalities(value, amanahKey, visible.map((m) => m.ref), true, hier))}>{needle ? tx('geo.selectShown') : tx('geo.selectAll')}</button>
        <button type="button" className="btn btn-sm" disabled={disabled || !visible.length} onClick={() => onChange(setMunicipalities(value, amanahKey, visible.map((m) => m.ref), false, hier))}>{needle ? tx('geo.clearShown') : tx('geo.clear')}</button>
      </div>
      {visible.length === 0 ? <div className="adm-empty adm-empty--sm">{tx('geo.noMunisFound')}</div> : (
        <ul className="adm-ticklist" aria-label={tx('geo.munisOf', { name: nameOf(entry, ar) })}>
          {visible.map((m) => {
            const id = `${idp}-${m.ref}`;
            return <li key={m.ref}><label htmlFor={id}><input id={id} type="checkbox" checked={picked.has(m.ref)} disabled={disabled} onChange={(e) => onChange(toggleMunicipality(value, amanahKey, m.ref, e.target.checked, hier))} /><span>{nameOf(m, ar)}</span></label></li>;
          })}
        </ul>
      )}
    </section>
  );
}

export default function GeoAccess({ value, onChange, hier, disabled = false, showMessages = true, doesNotFit = false, forceMessages = false }) {
  const { tx, lang } = useTx(); const idp = useId().replace(/:/g, '');
  const check = useMemo(() => validateAccess(value, lang, hier), [value, lang, hier]);
  const optText = { all: [tx('geo.opt.all'), tx('geo.opt.allDesc')], amanahs: [tx('geo.opt.amanahs'), tx('geo.opt.amanahsDesc')], municipal: [tx('geo.opt.municipal'), tx('geo.opt.municipalDesc')] };
  return (
    <fieldset className="adm-geo" disabled={disabled} data-option={value.option || ''}>
      <legend>{tx('geo.title')}</legend>
      {doesNotFit && <p className="adm-hint adm-hint--warn" role="status"><AIcon name="info" size={14} />{tx('geo.doesNotFit')}</p>}
      <div className="adm-geo__opts" role="radiogroup" aria-label={tx('geo.title')}>
        {GEO_OPTIONS.map((o) => (
          <label key={o} className={`adm-opt${value.option === o ? ' is-on' : ''}`}>
            <input type="radio" name={`${idp}-opt`} value={o} checked={value.option === o} onChange={() => onChange(setOption(value, o))} />
            <span><b>{optText[o][0]}</b><small>{optText[o][1]}</small></span>
          </label>
        ))}
      </div>
      {value.option === 'amanahs' && <AmanahPicker value={value} onChange={onChange} hier={hier} disabled={disabled} idp={`${idp}-p`} />}
      {value.option === 'municipal' && (
        <>
          <AmanahPicker value={value} onChange={onChange} hier={hier} disabled={disabled} idp={`${idp}-p`} />
          {value.amanahs.length === 0 ? <div className="adm-empty adm-empty--sm">{tx('geo.pickAmanahFirst')}</div> : (
            <div className="adm-munis">
              {value.amanahs.map((k) => <MunicipalityCard key={k} amanahKey={k} value={value} onChange={onChange} hier={hier} disabled={disabled} idp={`${idp}-m-${k.replace(/[^a-z0-9]/gi, '')}`} />)}
            </div>
          )}
          <div className="adm-include">
            <label className="adm-check"><input type="checkbox" checked={value.includeDirect === true} disabled={disabled} onChange={(e) => onChange(setIncludeDirect(value, e.target.checked))} aria-describedby={`${idp}-inc`} /><span><b>{tx('geo.include')}</b></span></label>
            <p id={`${idp}-inc`} className="adm-hint"><AIcon name="info" size={14} />{tx('geo.includeNote')}</p>
          </div>
        </>
      )}
      <div className="adm-geo__sum" aria-live="polite"><span className="adm-muted">{tx('geo.summary')}</span> <b>{accessSummary(value, lang, hier)}</b></div>
      {showMessages && !check.ok && (value.option || forceMessages) && <ul className="adm-errlist" role="alert">{check.messages.map((m, i) => <li key={`${m.code}-${i}`}>{m.text}</li>)}</ul>}
    </fieldset>
  );
}
