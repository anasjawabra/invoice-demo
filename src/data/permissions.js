// MODULE ACCESS CATALOG (shared client + server, pure). docs/access-control.md «SIMPLIFIED MODEL» S1–S2 (7 Nov 2026).
// There are NO action permissions: a role is a set of MODULE ids (one switch per actual page / management module) plus ONE role-level «read-only» flag. Module access enables the module's existing
// functionality (view, its exports, its uploads, its confirmations, its follow-up flags) within the user's single geographic scope (see geoScope.js). Nothing here carries a geographic scope.
import { ENTITIES } from './catalog';
import { describeGeoScope, normalizeGeoScope } from './geoScope';

/* ---------- the 13 modules (FINAL ids) ---------- */
// `scoped:false` modules show no invoice figures (the metrics dictionary and the two administration modules): the delegation check does not compare geographic scopes for them.
const M = (id, group, nameAr, nameEn, routes, descriptionAr, descriptionEn, scoped = true) => ({ id, group, nameAr, nameEn, ar: nameAr, en: nameEn, routes, descriptionAr, descriptionEn, scoped });

export const MODULES = [
  M('dashboard', 'revenue', 'لوحة المعلومات والتقارير', 'Dashboard', ['/insights'],
    'المؤشرات والرسوم والأرقام الإجمالية وتصدير تقرير اللوحة.', 'The indicators, charts and totals, and the dashboard report export.'),
  M('invoices_collected', 'revenue', 'الفواتير المحصّلة', 'Collected Invoices', ['/invoices', '/invoices/:id'],
    'سجل الفواتير المحصّلة وصفحة الفاتورة ومستنداتها وتصدير القوائم.', 'The collected-invoice register, the invoice page and its documents, and the list export.'),
  M('invoices_uncollected', 'revenue', 'الفواتير غير المحصّلة', 'Uncollected Invoices', ['/collection', '/analysis/:taskId'],
    'قائمة عمل المتأخرات وتحليل أسباب عدم التحصيل وتصديرهما.', 'The uncollected worklist and the non-collection analysis, and their export.'),
  M('enforcement', 'revenue', 'إدارة أوامر التنفيذ', 'Enforcement Management', ['/enforcement', '/enforcement-orders/*'],
    'أوامر التنفيذ والمخالفات والتحصيلات المرتبطة، ورفع الملفات والمستندات ومراجعة الروابط.', 'Enforcement orders, violations and linked collections, with file and document upload and link review.'),
  M('exclusions', 'revenue', 'إدارة الاستبعادات', 'Exclusions Management', ['/exclusions'],
    'سجل الاستبعادات وأسبابها، ورفع قالب الاستبعادات وتطبيقها وإزالتها.', 'The exclusions register and its reasons, with the exclusions upload, apply and removal.'),
  M('contracts', 'revenue', 'العقود الاستثمارية', 'Investment Contracts', ['/contracts', '/contracts/:no'],
    'بطاقات العقود وبيانات المستثمر والأقساط والفواتير المرتبطة.', 'Contract cards, investor details, instalments and the linked invoices.'),
  M('planning', 'revenue', 'تخطيط التحصيل', 'Collection Planning', ['/planning'],
    'المستهدفات السنوية والتوقعات وتعديلها.', 'The annual targets and the forecasts, and editing them.'),
  M('smart_reports', 'revenue', 'التقارير الذكية', 'Smart Reports', ['/smart-reports'],
    'إنشاء التقارير وسجلها ونسخها المحفوظة وتصديرها.', 'Create reports, their history and saved versions, and export them.'),
  M('decisions', 'revenue', 'غرفة القرارات', 'Decision Room', ['/decisions'],
    'القرارات المنتظرة وبنودها، مع علامات المتابعة والملاحظات (بلا إسناد مهام).', 'The decisions awaiting action and their items, with follow-up flags and notes (no task assignment).'),
  M('data_sources', 'reference', 'مصادر البيانات', 'Data Sources', ['/products*'],
    'بطاقات المصادر وتقريرها، ورفع سجلات الفواتير.', 'The source cards and their report, and the invoice-records upload.'),
  M('metrics', 'reference', 'قاموس المقاييس', 'Metrics Dictionary', ['/settings/metrics*'],
    'تعريفات المقاييس والمصطلحات (بلا أرقام).', 'The metric and term definitions (no figures).', false),
  M('users', 'administration', 'إدارة المستخدمين', 'User Management', ['/settings/users'],
    'إنشاء المستخدمين وتعديلهم وتعطيلهم وإسناد الدور والنطاق الجغرافي وإصدار رموز التفعيل.', 'Create, edit and deactivate users, set the role and geographic scope and issue activation codes.', false),
  M('roles', 'administration', 'الأدوار والصلاحيات', 'Roles and Permissions', ['/settings/roles'],
    'إنشاء الأدوار وتعديلها وحذفها وسجل التدقيق.', 'Create, edit and delete roles, and the audit trail.', false)
];
export const MODULE_IDS = MODULES.map((m) => m.id);
const BY_ID = new Map(MODULES.map((m) => [m.id, m]));
const RANK = new Map(MODULE_IDS.map((id, i) => [id, i]));
export const moduleById = (id) => BY_ID.get(id) || null;
export const isModuleId = (id) => BY_ID.has(id);
export const unknownModules = (ids) => (ids || []).filter((i) => !BY_ID.has(i));
/** the modules whose pages read the shared metric layer / invoice rows (what a geographic scope applies to) */
export const isScopedModule = (id) => BY_ID.get(id)?.scoped === true;
/** the name / description of a module in a language ('ar' | 'en'); an unknown id returns the id itself */
export const moduleTitle = (id, lang = 'ar') => { const m = BY_ID.get(id); return m ? (lang === 'en' ? m.nameEn : m.nameAr) : String(id); };
export const moduleDescription = (id, lang = 'ar') => { const m = BY_ID.get(id); return m ? (lang === 'en' ? m.descriptionEn : m.descriptionAr) : ''; };
/** known module ids, de-duplicated, in catalog order. Input: array or Set. Output: array. */
export const normalizeModules = (ids) => { const have = new Set(ids || []); return MODULE_IDS.filter((id) => have.has(id)); };
/** does the set (Set or array) hold the module? */
export const hasModule = (set, id) => (!set ? false : set instanceof Set ? set.has(id) : Array.isArray(set) ? set.includes(id) : typeof set.has === 'function' ? set.has(id) : false);

/* ---------- roles ---------- */
export const ADMIN_ROLE_ID = 'role-system-admin'; // the id is kept from the earlier model so existing users and tokens keep resolving; the display name is «Administrator / مدير النظام»
export const AUDITOR_ROLE_ID = 'role-auditor';
/** the two modules the protected Administrator role can never lose (so someone can always manage users and roles) */
export const ADMIN_KEEP_MODULES = ['users', 'roles'];

/* Starter roles are ordinary editable roles (nothing special except the protected Administrator). Module sets follow the REAL responsibilities and the least privilege: because module access carries the module's own
   write actions (uploads, confirmations, follow-up flags), a role is given a module only where its holder really does that work.
   * Administrator                — all 13 modules (protected: always keeps «users» and «roles»).
   * Financial Manager / Analyst  — all 11 business / reference modules (dashboard, both invoice registers, enforcement, exclusions, contracts, planning, smart reports, decisions, data sources, metrics); no administration.
   * Collection Officer          — the invoice registers, dashboard, contracts, decisions (follow-up flags and notes), smart reports and the metrics dictionary; NOT exclusions, enforcement, planning or data sources (their uploads / review are other jobs).
   * Enforcement Reviewer        — enforcement, both invoice registers (the invoices an order refers to), contracts, decisions, smart reports, metrics; NOT exclusions, planning, data sources, dashboard.
   * Auditor                     — every module for reading and exporting (including the user / role pages and the audit trail), with the role-level «Read-only» switch ON: it can change nothing. */
const BUSINESS = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'enforcement', 'exclusions', 'contracts', 'planning', 'smart_reports', 'decisions', 'data_sources', 'metrics'];
export const STARTER_ROLES = [
  { id: ADMIN_ROLE_ID, nameAr: 'مدير النظام', nameEn: 'Administrator', descriptionAr: 'كل الوحدات، ويحتفظ دائمًا بإدارة المستخدمين والأدوار. دور محمي لا يُحذف.', descriptionEn: 'Every module, and always keeps user and role management. A protected role that cannot be deleted.', modules: [...MODULE_IDS], readOnly: false, starter: true, protected: true },
  { id: 'role-financial', nameAr: 'مدير مالي / محلل', nameEn: 'Financial Manager / Analyst', descriptionAr: 'كل وحدات الإيرادات والمرجع: يطّلع ويصدّر ويرفع الاستبعادات والسجلات ويحدّث المستهدفات، دون إدارة المستخدمين والأدوار.', descriptionEn: 'Every revenue and reference module: sees, exports, uploads exclusions and records and updates targets, without user and role management.', modules: BUSINESS, readOnly: false, starter: true, protected: false },
  { id: 'role-collection', nameAr: 'موظف تحصيل', nameEn: 'Collection Officer', descriptionAr: 'يتابع الفواتير المحصّلة وغير المحصّلة وقوائم العمل ويضع علامات المتابعة والملاحظات، دون الاستبعادات أو أوامر التنفيذ أو التخطيط أو رفع الملفات.', descriptionEn: 'Works the collected and uncollected invoices and worklists and records follow-up flags and notes, without exclusions, enforcement, planning or file uploads.', modules: ['dashboard', 'invoices_collected', 'invoices_uncollected', 'contracts', 'decisions', 'smart_reports', 'metrics'], readOnly: false, starter: true, protected: false },
  { id: 'role-enforcement', nameAr: 'مراجع التنفيذ', nameEn: 'Enforcement Reviewer', descriptionAr: 'يدير أوامر التنفيذ: يرفع الملفات والمستندات ويراجع الروابط بين الأمر والفواتير ويؤكدها أو يرفضها.', descriptionEn: 'Manages enforcement orders: uploads files and documents and reviews, confirms or rejects the links between an order and invoices.', modules: ['invoices_collected', 'invoices_uncollected', 'enforcement', 'contracts', 'decisions', 'smart_reports', 'metrics'], readOnly: false, starter: true, protected: false },
  { id: AUDITOR_ROLE_ID, nameAr: 'مدقق', nameEn: 'Auditor', descriptionAr: 'يطّلع على كل الوحدات وسجل التدقيق ويصدّر، دون أي تغيير أو رفع أو مراجعة (دور للقراءة فقط).', descriptionEn: 'Sees every module and the audit trail and may export, but changes nothing: no uploads, confirmations or edits (a read-only role).', modules: [...MODULE_IDS], readOnly: true, starter: true, protected: false }
].map((r) => ({ ...r, modules: normalizeModules(r.modules) }));
export const starterRoleById = (id) => STARTER_ROLES.find((r) => r.id === id) || null;

/** the effective module SET of a role ({ modules:[ids] } or a bare id list); unknown ids dropped; null → empty Set */
export function permissionsOf(role) {
  const ids = Array.isArray(role) ? role : role && Array.isArray(role.modules) ? role.modules : [];
  return new Set(normalizeModules(ids));
}
export const modulesOf = permissionsOf;

/* ---------- the one-line summary: «Collection Officer · Jeddah Amanah · 3 municipalities» ---------- */
const AMANAH_NAME = new Map(ENTITIES.map((e) => [e.en, e]));
/** user = { scope }, role = { nameAr, nameEn } (null → the role part is left out), lang 'ar' | 'en' */
export function describeUserSummary(user, role, lang = 'ar') {
  const ar = lang !== 'en'; const scope = normalizeGeoScope(user && user.scope);
  let geo = describeGeoScope(scope, lang);
  if (!scope.all && scope.grants.length === 1) { // one Amanah: name it («أمانة محافظة جدة · 3 بلديات»), the generic «1 Amanah» is replaced by its name
    const e = AMANAH_NAME.get(scope.grants[0].amanah); const lead = ar ? 'أمانة واحدة' : '1 Amanah';
    if (e && geo.startsWith(lead)) geo = (ar ? e.ar : e.en) + geo.slice(lead.length);
  }
  const roleName = role ? (ar ? role.nameAr : role.nameEn) || role.nameAr || role.nameEn || '' : '';
  return roleName ? `${roleName} · ${geo}` : geo;
}

/* ---------- compatibility with the earlier action-permission API (importers written against it keep working: a «permission» id is now a MODULE id) ---------- */
export const PERMISSION_IDS = MODULE_IDS;
/** one entry per module in the old permission shape (module = the id itself, action 'access') */
export const PERMISSIONS = MODULES.map((m) => ({ id: m.id, module: m.id, action: 'access', ar: m.nameAr, en: m.nameEn, descAr: m.descriptionAr, descEn: m.descriptionEn, dependsOn: [], scoped: m.scoped }));
export const PERMISSIONS_BY_MODULE = Object.fromEntries(PERMISSIONS.map((p) => [p.id, [p]]));
export const permissionById = (id) => PERMISSIONS.find((p) => p.id === id) || null;
export const isPermissionId = isModuleId;
export const permissionLabel = moduleTitle;
export const permissionDescription = moduleDescription;
export const isScopedPermission = isScopedModule;
export const hasPermission = hasModule;
/** identity: there are no dependencies between modules (known ids, de-duplicated, catalog order) */
export const closePermissions = normalizeModules;
export const missingDependencies = () => ({ ok: true, missing: [] });
export const unknownPermissions = unknownModules;
export const permissionsMissing = (set, ids) => (ids || []).filter((i) => !hasModule(set, i));
export const SYSTEM_ADMIN_ROLE_ID = ADMIN_ROLE_ID;
export const ADMIN_KEEP_PERMISSIONS = ADMIN_KEEP_MODULES;
