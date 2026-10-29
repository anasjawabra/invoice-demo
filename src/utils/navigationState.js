// Session snapshots are recoverable UI state, never trusted component props.
const TEXT_FIELDS = ['search', 'q', 'collectionFilter', 'kind', 'filter', 'cat', 'reason', 'detail', 'f', 'fAm', 'fRev', 'fSrc', 'fType', 'fDoc', 'fFin', 'fWhy', 'dFrom', 'dTo'];
export function sanitizeListMemory(key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const field of TEXT_FIELDS) if (typeof value[field] === 'string') result[field] = value[field];
  if (Number.isSafeInteger(value.page) && value.page >= 0) result.page = value.page;
  if (key === 'invoices' || key === 'invoices_all') {
    if (value.sort && ['id', 'issue', 'gross', 'outstanding', 'daysOverdue'].includes(value.sort.key) && ['asc', 'desc'].includes(value.sort.dir)) result.sort = { key: value.sort.key, dir: value.sort.dir };
  } else if (['recent', 'amount', 'request'].includes(value.sort)) result.sort = value.sort;
  return result;
}
export function validOrigin(value) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string' || !value.path.startsWith('/') || value.path.startsWith('//') || /[\\\u0000-\u0020?#]/.test(value.path)) return null;
  if (value.search != null && (typeof value.search !== 'string' || (value.search && !value.search.startsWith('?')))) return null;
  return { entryId: typeof value.entryId === 'string' ? value.entryId : undefined, path: value.path, search: value.search || '', label: typeof value.label === 'string' ? value.label : value.path, index: Number.isSafeInteger(value.index) && value.index >= 0 ? value.index : null };
}
export function canReturnInHistory(from, currentIndex) {
  return Number.isSafeInteger(from?.index) && from.index >= 0 && Number.isSafeInteger(currentIndex) && currentIndex === from.index + 1;
}
