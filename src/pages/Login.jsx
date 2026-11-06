import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { authErrorText } from '../data/accessModel';
import LanguageSwitch from '../components/header/LanguageSwitch';

export default function Login() {
  const { t, lang } = useI18n();
  const { user, login, activate, notice, clearNotice } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const code = sp.get('activate') || ''; // /login?activate=<one-time code>: set the first password (or a new one) with the code an administrator gave you
  const activating = !!code;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [errCode, setErrCode] = useState('');
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []); // a pending sign-in must not touch the page after it was left
  useEffect(() => { if (user) nav('/', { replace: true }); }, [user, nav]);

  const err = errCode ? authErrorText(errCode, lang) : '';
  const noticeText = notice && !errCode ? authErrorText(notice.code === 'account_inactive' ? 'account_inactive' : 'unauthenticated', lang) : '';

  // The password is posted once to the data service and dropped. What the person sees afterwards is decided ONLY by their account (role + geographic scope), never by anything chosen on this page.
  async function onSubmit(e) {
    e.preventDefault();
    setErrCode(''); clearNotice();
    if (activating) {
      if (password.length < 8) { setErrCode('weak_password'); return; }
      if (password !== password2) { setErrCode('password_mismatch'); return; }
    }
    setBusy(true);
    let r;
    try {
      r = activating ? await activate(code, password) : await login(username.trim(), password);
    } catch { r = { ok: false, error: 'network' }; }
    if (!alive.current) return;
    setBusy(false); setPassword(''); setPassword2('');
    if (!r.ok) { setErrCode(r.error || 'invalid_credentials'); return; }
    if (activating) setSp({}, { replace: true });
    nav('/', { replace: true });
  }

  return (
    <div className="login-wrap">
      <div className="bg-fx" />
      <div className="bg-grid" />

      <section className="login-hero">
        <div>
          <div className="hero-title" dangerouslySetInnerHTML={{ __html: t('hero_title') }} />
          <p className="hero-sub">{t('hero_sub')}</p>
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

            <LanguageSwitch />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{activating ? (lang === 'en' ? 'Activate your account' : 'تفعيل الحساب') : t('welcome')}</h2>
          <div className="lead">{activating ? (lang === 'en' ? 'Choose your password to finish. The activation code works once.' : 'اختر كلمة المرور لإكمال التفعيل. رمز التفعيل يُستخدم مرة واحدة.') : t('login_lead')}</div>
          {noticeText ? <div className="rv-callout rv-callout--warn" role="status" style={{ marginBlock: 8 }}>{noticeText}</div> : null}

          <form onSubmit={onSubmit}>
            <div className="row">
              {!activating && <div className="field">
                <label htmlFor="login-user">{t('label_user')}</label>
                <input
                  id="login-user"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('placeholder_user')}
                  autoComplete="username"
                />
              </div>}
              <div className="field">
                <label htmlFor="login-pass">{activating ? (lang === 'en' ? 'New password' : 'كلمة المرور الجديدة') : t('label_pass')}</label>
                <input
                  id="login-pass"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('placeholder_pass')}
                  type="password"
                  autoComplete={activating ? 'new-password' : 'current-password'}
                />
              </div>
              {activating && <div className="field">
                <label htmlFor="login-pass2">{lang === 'en' ? 'Confirm the password' : 'تأكيد كلمة المرور'}</label>
                <input id="login-pass2" className="input" value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" autoComplete="new-password" />
              </div>}
            </div>

            <div className="field">
              <button className="btn btn-primary" style={{ width: '100%', height: 46 }} disabled={busy} type="submit">
                {busy ? t('logging_in') : activating ? (lang === 'en' ? 'Activate and sign in' : 'تفعيل الحساب ودخول') : t('btn_login')}
              </button>
              <div className="login-err" role="alert" aria-live="assertive">{err}</div>
              {activating && <div style={{ marginTop: 8 }}><button type="button" className="rv-link" onClick={() => { setSp({}, { replace: true }); setErrCode(''); }}>{lang === 'en' ? 'Back to sign in' : 'العودة إلى تسجيل الدخول'}</button></div>}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
