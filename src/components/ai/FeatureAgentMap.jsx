import React, { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { AGENTS, FEATURE_CATEGORIES } from '../../data/mock';

function badgeForColor(c) {
  switch (c) {
    case 'teal':
      return 'badge--teal';
    case 'indigo':
      return 'badge--indigo';
    case 'gold':
      return 'badge--gold';
    case 'green':
      return 'badge--green';
    case 'red':
      return 'badge--red';
    case 'orange':
      return 'badge--orange';
    case 'blue':
      return 'badge--blue';
    case 'purple':
      return 'badge--purple';
    default:
      return '';
  }
}

/**
 * FeatureAgentMap — the "proposed features" list from the Implementation Card
 * deck, reproduced as clickable chips. Focusing (keyboard Tab) or clicking a
 * feature reveals which agent(s) power it, by name, in a small popover.
 */
export default function FeatureAgentMap() {
  const { t, T } = useI18n();
  const [openKey, setOpenKey] = useState(null);

  function closeIfSelf(key) {
    setOpenKey((k) => (k === key ? null : k));
  }

  return (
    <div className="card card-pad">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>{t('feature_map_title')}</div>
          <div className="page-sub">{t('feature_map_sub')}</div>
        </div>
      </div>

      <div className="feature-map">
        {FEATURE_CATEGORIES.map((cat, ci) => (
          <div className="feature-col" key={ci}>
            <div className="feature-col__head">{T(cat, 'title')}</div>
            <div className="feature-col__body">
              {cat.features.map((f, fi) => {
                const key = `${ci}-${fi}`;
                const open = openKey === key;
                const agentObjs = f.agents.map((id) => AGENTS.find((a) => a.id === id)).filter(Boolean);
                return (
                  <div className="feature-item" key={key}>
                    <button
                      type="button"
                      className={`feature-chip${open ? ' feature-chip--open' : ''}`}
                      aria-expanded={open}
                      onFocus={() => setOpenKey(key)}
                      onBlur={() => closeIfSelf(key)}
                      onClick={() => setOpenKey(key)}
                    >
                      <span>{T(f, 'title')}</span>
                      <span className="feature-chip__agents">
                        {f.agents.map((id) => {
                          const a = AGENTS.find((x) => x.id === id);
                          return (
                            <span key={id} className={`badge badge--sm ${badgeForColor(a?.color)}`}>
                              {a ? T(a, 'short') : id}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                    {open ? (
                      <div className="feature-tooltip" role="tooltip">
                        <div className="feature-tooltip__desc">{T(f, 'desc')}</div>
                        <div className="feature-tooltip__agents">
                          {agentObjs.map((a) => (
                            <div className="feature-tooltip__agent" key={a.id}>
                              <span className={`badge ${badgeForColor(a.color)}`}>{T(a, 'short')}</span>
                              <span>{T(a, 'name')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
