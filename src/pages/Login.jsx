import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { AGENTS, ORGS } from '../data/mock';
import { SOURCE_SYSTEMS } from '../data/revenueLedger';
import { api } from '../api/client';
import { fmtInt } from '../utils/money';

export default function Login() {
  const { t, lang, setLang, T } = useI18n();
  const { login } = useAuth();
  const nav = useNavigate();

  const [ytdInvoices, setYtdInvoices] = useState(null);
  useEffect(() => { let off = false; api.meta().then((m) => { if (!off) setYtdInvoices(m.counts.invoicesYtd); }).catch(() => {}); return () => { off = true; }; }, []);
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('demo123');
  const [orgId, setOrgId] = useState(ORGS[0]?.id || 'mof-hq');
  const [scopeByOrg, setScopeByOrg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const loginTimer = useRef(null); useEffect(() => () => window.clearTimeout(loginTimer.current), []); // a pending sign-in must not navigate after the page was left

  // The consolidated HQ org is the "all-orgs" context used when org scoping
  // is turned off, so downstream pages still have a valid org to render.
  const consolidatedOrgId = ORGS[0]?.id || 'mof-hq';

  function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    loginTimer.current = window.setTimeout(() => {
      const effectiveOrgId = scopeByOrg ? orgId : consolidatedOrgId;
      const ok = login(username.trim(), password, effectiveOrgId, scopeByOrg);
      setBusy(false);
      if (!ok) {
        setErr(t('login_err'));
        return;
      }
      nav('/insights', { replace: true });
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
              <b dir="ltr">{ytdInvoices == null ? '…' : fmtInt(ytdInvoices)}</b>
              <span>{lang === 'ar' ? 'فاتورة تجريبية في السنة الحالية حتى اليوم' : 'demo invoices, year to date'}</span>
            </div>
            <div className="hero-stat">
              <b>0 / {SOURCE_SYSTEMS.length - 1}</b>
              <span>{lang === 'ar' ? 'أنظمة مصدرية متصلة' : 'source systems connected'}</span>
            </div>
            <div className="hero-stat">
              <b>{lang === 'ar' ? 'عرض' : 'Demo'}</b>
              <span>{lang === 'ar' ? 'بيانات غير إنتاجية' : 'non-production data'}</span>
            </div>
          </div>

          <div className="hero-agents">
            {AGENTS.map((a) => (
              <span key={a.id} className="hero-chip">
                {T(a, 'en') || a.en}
              </span>
            ))}
          </div>
        </div>

        <div className="muted" style={{ marginTop: 18, fontSize: 12, lineHeight: 1.6 }}>
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

            <div className="pill" aria-label="Language">
              <button
                type="button"
                className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-ghost'}`}
                title="中文（不完整）：大部分页面以英文显示 · Chinese (incomplete): most pages are shown in English"
                onClick={() => setLang('zh')}
              >
                中文
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'ar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setLang('ar')}
              >
                العربية
              </button>
            </div>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t('welcome')}</h2>
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
                  <label className="org-select-label">{t('org_label')}</label>
                  <select
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
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    {t('org_login_hint')}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                    {t('rbac_note')}
                  </div>
                </div>
              </div>

              {!scopeByOrg ? (
                <div className="muted org-scope-off" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  {t('org_scope_off_note')}
                </div>
              ) : null}
            </div>

            <div className="row">
              <div className="field">
                <label>{t('label_user')}</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('placeholder_user')}
                  autoComplete="username"
                />
              </div>
              <div className="field">
                <label>{t('label_pass')}</label>
                <input
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
              <button className="btn btn-primary" style={{ width: '100%', height: 46 }} disabled={busy} type="submit">
                {busy ? t('logging_in') : t('btn_login')}
              </button>
              <div className="login-err">{err}</div>
            </div>

            <div className="field">
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {t('or_sso')}
              </div>
              <div className="sso-reserved" aria-disabled="true">
                <span>{t('sso_reserved')}</span>
                <span className="pill" style={{ fontSize: 12 }}>{t('sso_coming')}</span>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              {t('org_scope')} · {t('org_scope_note')}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
