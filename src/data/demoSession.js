import { CREDENTIALS, ORGS } from './mock';

// This is a demo identity, not server authentication. Rebuild permissions and
// organisation metadata from the demo catalogue; never persist the password.
export function demoSession(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const account = CREDENTIALS.find((c) => c.user === value.user);
  const scoped = value.orgScoped !== false;
  const org = scoped ? ORGS.find((o) => o.id === value.org?.id) : ORGS[0];
  if (!account || !org) return null;
  const { pass, ...identity } = account;
  return { ...identity, org, orgScoped: scoped };
}

export function safeReturnPath(value) {
  if (!value || typeof value !== 'object') return '/insights';
  const { pathname, search = '', hash = '' } = value;
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//') || /[\\\u0000-\u0020]/.test(pathname) || pathname === '/login') return '/insights';
  if (typeof search !== 'string' || typeof hash !== 'string' || (search && !search.startsWith('?')) || (hash && !hash.startsWith('#'))) return '/insights';
  return pathname + search + hash;
}
