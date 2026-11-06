// Public surface of the identity core (what server/api.js and the data functions import).
export { authenticate, effectiveScopeFor, computeAccess, accessViolation, buildMe, userRow, meOf, publicUser, currentAccessVersion, auditDenied, auditLog, listAudit, login, activate, issueToken,
  ApiError, hierarchyForPickers, adminCatalog, listUsers, getUser, createUser, updateUser, reissueActivation, listRoles, createRole, updateRole, deleteRole, setClockForTests } from './service';
export { storageInfo, resetStore, reloadFromDisk, getDb, dbFile, SCHEMA_VERSION, migrate, mapOldRole } from './store';
export { setScryptCostForTests } from './crypto';

import { getDb } from './store';
import { resetStore as _reset } from './store';
import { setClockForTests as _clock } from './service';
import { setScryptCostForTests as _cost } from './crypto';
/** the roles as stored (array of { id, modules, readOnly, … }); with computeAccess this is what a preview needs */
export const getRoles = () => getDb().roles.map((r) => ({ ...r, modules: [...r.modules] }));
/** tests: a fresh store in `file` (a temp path) or in memory; resets the clock; optionally a cheaper scrypt cost */
export function resetForTests(file, { scryptN = 1024 } = {}) { _clock(null); _cost(scryptN); return _reset(file || ':memory:'); }
