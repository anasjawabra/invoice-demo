// The name recorded on audit entries (plan history, versions, approvals, action log): the signed-in person's name in the language of the interface.
// (Records keep a plain string, so the language at the time of the action is the one stored; any other language value records the English name.)
// The legacy map below is ONLY for showing OLD stored audit text; it is never used for the current user.
export function actorName(user, lang) {
  if (!user) return null;
  return displayName(user, lang === 'ar' ? 'ar' : 'en') || null; // the single identity (utils/identity.js): the same name the header shows
}

import { displayName } from './identity';

// An audit entry written by an older version may hold the demo user's name in a language that no longer exists. The stored entry is kept as it is (it is a record);
// it is SHOWN under the same person's English name. (Escapes, not literal characters: no unsupported-language text lives in the code.)
const LEGACY_ACTOR_NAMES = { '\u674e\u82b3\u519b': 'Li Fangjun', '\u7cfb\u7edf\u7ba1\u7406\u5458': 'System Admin' };
const HAN = /[\u3400-\u9fff]/;
export function shownActor(by) {
  if (typeof by !== 'string' || !HAN.test(by)) return by;
  return LEGACY_ACTOR_NAMES[by.trim()] || by.replace(/[\u3400-\u9fff\u00b7\s]+/g, ' ').trim() || 'user';
}
