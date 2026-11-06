// useGate('export.dashboard') → { allowed, reason, permission /* = the module id */, module, readOnly } with the reason already in the page language (null when allowed). The keys are src/data/accessModel.js ACTIONS:
// allowed = the module is held AND (an action that changes something ⇒ the role is not read-only; exports are never blocked by read-only).
import { useAccess } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';

export default function useGate(key) {
  const access = useAccess(); const { lang } = useI18n();
  const g = access.gate(key);
  return { allowed: g.allowed, permission: g.permission, module: g.module ?? g.permission, readOnly: !!g.readOnly, reason: g.reason ? (lang === 'en' ? g.reason.en : g.reason.ar) : null };
}
