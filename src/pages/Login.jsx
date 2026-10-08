import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { AGENTS, KPIS, ORGS } from '../data/mock';

export default function Login() {
  const { t, lang, setLang, T } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [orgId, setOrgId] = useState(ORGS[0]?.id || 'mof-hq');
  const [scopeByOrg, setScopeByOrg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // The consolidated HQ org is the "all-orgs" context used when org scoping
  // is turned off, so downstream pages still have a valid org to render.
  const consolidatedOrgId = ORGS[0]?.id || 'mof-hq';

  const kpiAuto = KPIS.find((k) => k.id === 'automation');
  const kpiCycle = KPIS.find((k) => k.id === 'cycle');

  const statAuto = useMemo(() => (kpiAuto ? `${kpiAuto.value.toFixed(1)}%` : '96%'), [kpiAuto]);
  const statSpeed = useMemo(() => (kpiCycle ? `${kpiCycle.value}${lang === 'en' ? 'd' : t('unit_day')}` : '0.8d'), [kpiCycle, lang, t]);

  function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    setTimeout(() => {
      const effectiveOrgId = scopeByOrg ? orgId : consolidatedOrgId;
      const ok = login(username.trim(), password, effectiveOrgId, scopeByOrg);
      setBusy(false);
      if (!ok) {
        setErr(t('login_err'));
        return;
      }
      nav('/dashboard', { replace: true });
    }, 650);
  }

  return (
    <div className="login-wrap">
      <div className="bg-fx" />
      <div className="bg-grid" />

      <section className="login-hero">
        <div>
          <div className="hero-badge">{t('hero_badge')}</div>
          <div className="hero-title" dangerouslySetInnerHTML={{ __html: t('hero_title') }} />
          <p className="hero-sub">{t('hero_sub')}</p>

          <div className="hero-stats">
            <div className="hero-stat">
              <b>{AGENTS.length}</b>
              <span>{t('stat_agents')}</span>
            </div>
            <div className="hero-stat">
              <b>{statAuto}</b>
              <span>{t('stat_auto')}</span>
            </div>
            <div className="hero-stat">
              <b>{statSpeed}</b>
              <span>{t('stat_speed')}</span>
            </div>
          </div>

          <div className="hero-agents">
            {AGENTS.map((a) => (
              <span key={a.id} className="hero-chip">
                {T(a, 'short') || T(a, 'name')}
              </span>
            ))}
          </div>
        </div>

        <div className="muted" style={{ marginTop: 'var(--spacing-xl)', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
          <div dangerouslySetInnerHTML={{ __html: t('demo_hint') }} />
        </div>
      </section>

      <section className="login-panel">
        <div className="card login-card">
          <div className="brand-row">
            <div className="brand-left">
              <div className="brand-logo">IB</div>
              <div className="brand-name">
                <b>INTELLIBILL</b>
                <small>{t('brand_tagline')}</small>
              </div>
            </div>

            <div className="login-language" role="group" aria-label={t('language_label')}>
              {[
                ['en', 'EN'],
                ['zh', '中文'],
                ['ar', 'العربية']
              ].map(([code, label]) => (
                <button
                  key={code}
                  type="button"
                  className={`login-language__option${lang === code ? ' is-active' : ''}`}
                  aria-pressed={lang === code}
                  onClick={() => setLang(code)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <h1 className="login-title">{t('welcome')}</h1>
          <div className="lead">{t('login_lead')}</div>

          <form onSubmit={onSubmit}>
            <div className="field">
              <div className="switch-row">
                <label htmlFor="org-scope-switch" className="switch-row__label">
                  {t('org_scope_toggle')}
                </label>
                <button
                  id="org-scope-switch"
                  type="button"
                  role="switch"
                  aria-checked={scopeByOrg}
                  aria-label={t('org_scope_toggle')}
                  className={`switch ${scopeByOrg ? 'switch--on' : ''}`}
                  onClick={() => setScopeByOrg((v) => !v)}
                >
                  <span className="switch__track">
                    <span className="switch__thumb" />
                  </span>
                </button>
              </div>

              <div className={`org-collapse ${scopeByOrg ? 'org-collapse--open' : ''}`} aria-hidden={!scopeByOrg}>
                <div className="org-collapse__inner">
                  <label className="org-select-label" htmlFor="login-org">{t('org_label')}</label>
                  <select
                    id="login-org"
                    className="select"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    disabled={!scopeByOrg}
                  >
                    <option value="" disabled>
                      {t('org_ph')}
                    </option>
                    {ORGS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {T(o, 'name')} · {t(o.tier === 'central' ? 'tier_central' : 'tier_local')}
                      </option>
                    ))}
                  </select>
                  <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-md)' }}>
                    {t('org_login_hint')}
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)', lineHeight: 1.5 }}>
                    {t('rbac_note')}
                  </div>
                </div>
              </div>

              {!scopeByOrg ? (
                <div className="muted org-scope-off" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-md)', lineHeight: 1.5 }}>
                  {t('org_scope_off_note')}
                </div>
              ) : null}
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="login-username">{t('label_user')}</label>
                <input
                  id="login-username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('placeholder_user')}
                  autoComplete="username"
                />
              </div>
              <div className="field">
                <label htmlFor="login-password">{t('label_pass')}</label>
                <input
                  id="login-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('placeholder_pass')}
                  type="password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="field">
              <button className="btn btn-primary login-submit" disabled={busy} type="submit">
                {busy ? t('logging_in') : t('btn_login')}
              </button>
              <div className="login-err">{err}</div>
            </div>

            <div className="field">
              <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-md)' }}>
                {t('or_sso')}
              </div>
              <div className="sso-reserved" aria-disabled="true">
                <span>{t('sso_reserved')}</span>
                <span className="pill" style={{ fontSize: 'var(--text-2xs)' }}>{t('sso_coming')}</span>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-md)' }}>
              {t('org_scope')} · {t('org_scope_note')}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
