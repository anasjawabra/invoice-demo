// The name recorded on audit entries (plan history, versions, approvals, action log): the signed-in person's name in the language of the interface.
// (The Arabic UI used to record the Chinese display name; records keep a plain string, so the language at the time of the action is the one stored.)
export function actorName(user, lang) {
  if (!user) return null;
  const pick = lang === 'ar' ? user.nameAr : lang === 'en' ? user.nameEn : user.name;
  return pick || user.nameEn || user.name || user.email || null;
}
