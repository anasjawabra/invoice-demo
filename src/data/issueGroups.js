// WHERE each kind of finding is reviewed. One list, two jobs — kept apart by function:
//  * RISKS & DEVIATIONS (daily operations, /risk): findings that need a BUSINESS look or decision — a payer or invoice that looks wrong, or a figure that departs from what is expected.
//  * DATA QUALITY (system settings, /settings/data-quality): record completeness and matching — what a data steward fixes or completes so that figures can be relied on.
// Codes are the data service's issue codes (server/lists.js `anomalies`) and the risk-radar categories (`risk`).
export const DEVIATION_CODES = ['amount_conflict', 'receipts_on_excluded'];            // header ≠ line items · payment received on an excluded invoice
export const DEVIATION_RISK_CATEGORIES = ['value_anomaly'];                            // far from the Amanah baseline
export const RISK_FLAG_CATEGORIES = ['duplicate', 'struck_off_registry', 'deceased_person']; // possible duplicate · struck-off registry · deceased debtor
export const QUALITY_CODES = ['missing_fields', 'contract_unlinked', 'contract_unmatched', 'exclusion_pending', 'enforcement_candidate'];
// pending links and exclusions are worked on their own screens; the data-quality page counts them and points there
export const QUALITY_WORKFLOW_PAGE = { exclusion_pending: '/noncollection', enforcement_candidate: '/enforcement' };

// where a link from elsewhere in the app should land for a given finding
export const issuePage = (code) => (QUALITY_CODES.includes(code) ? '/settings/data-quality' : '/risk');
