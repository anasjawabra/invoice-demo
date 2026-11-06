// Every visible string of the two administration pages, in Arabic and English (the only two interface languages). `tt(key, lang, vars)` fills {placeholders}.
// tests/admin-ui.test.mjs checks that every entry has both languages, that every key used by the sources exists, and that no secret-like word appears in a label.

export const TEXT = {
  /* common */
  'common.all': ['الكل', 'All'], 'common.actions': ['إجراءات', 'Actions'], 'common.cancel': ['إلغاء', 'Cancel'], 'common.clearFilters': ['مسح التصفية', 'Clear filters'], 'common.close': ['إغلاق', 'Close'],
  'common.copied': ['تم النسخ', 'Copied'], 'common.delete': ['حذف', 'Delete'], 'common.dismiss': ['إخفاء الرسالة', 'Dismiss the message'], 'common.edit': ['تعديل', 'Edit'], 'common.view': ['عرض', 'View'],
  'common.forbiddenTitle': ['لا تملك الصلاحية', 'You do not have access'], 'common.loading': ['جارٍ التحميل…', 'Loading…'], 'common.off': ['غير مفعّل', 'Off'], 'common.on': ['مفعّل', 'On'],
  'common.retry': ['إعادة المحاولة', 'Try again'], 'common.save': ['حفظ', 'Save'], 'common.saving': ['جارٍ الحفظ…', 'Saving…'],
  'status.active': ['نشط', 'Active'], 'status.inactive': ['معطّل', 'Inactive'], 'status.invited': ['مدعو — بانتظار التفعيل', 'Invited — awaiting activation'],

  /* users page */
  'users.title': ['إدارة المستخدمين', 'User management'],
  'users.sub': ['لكل مستخدم دور واحد (الوحدات المتاحة له) ونطاق جغرافي واحد (الأمانات والبلديات التي تظهر سجلاتها).', 'Each user has one role (the modules available) and one geographic access (the Amanahs and municipalities whose records appear).'],
  'users.new': ['إضافة مستخدم', 'Add user'], 'users.filters': ['تصفية المستخدمين', 'Filter users'], 'users.search': ['بحث بالاسم أو اسم المستخدم أو البريد أو الدور', 'Search by name, username, e-mail or role'],
  'users.status': ['الحالة', 'Status'], 'users.count': ['{n} من {total} مستخدمًا', '{n} of {total} users'],
  'users.caption': ['جدول المستخدمين', 'Users table'], 'users.name': ['الاسم', 'Name'], 'users.account': ['اسم المستخدم / البريد', 'Username / e-mail'], 'users.roleAccess': ['الدور والوصول', 'Role and access'],
  'users.lastLogin': ['آخر دخول (بتوقيت الرياض)', 'Last sign-in (Riyadh time)'], 'users.you': ['أنت', 'You'],
  'users.activate': ['تفعيل', 'Activate'], 'users.deactivate': ['تعطيل', 'Deactivate'], 'users.reissue': ['رمز جديد', 'New code'],
  'users.empty': ['لا يوجد مستخدم يطابق التصفية.', 'No user matches the filters.'], 'users.none': ['لا يوجد مستخدمون بعد.', 'There are no users yet.'],
  'users.noViewRight': ['وحدة «إدارة المستخدمين» غير مفعّلة لدورك. اطلب من مدير النظام تفعيلها.', 'The "User Management" module is not enabled for your role. Ask an administrator to enable it.'],
  'users.storageNote': ['مخزن المستخدمين في هذه البيئة التجريبية غير دائم: قد تُفقد التغييرات عند إعادة تشغيل الخدمة.', 'The user store of this demo environment is not durable: changes may be lost when the service restarts.'],
  'user.readOnlyReason': ['للقراءة فقط: وحدة «إدارة المستخدمين» غير مفعّلة لدورك.', 'Read-only: the "User Management" module is not enabled for your role.'],
  'user.readOnlyRoleReason': ['دورك «للقراءة فقط»: يمكنك الاطلاع على المستخدمين دون تغيير أي شيء.', 'Your role is "Read-only": you can see the users but cannot change anything.'],
  'user.neverLoggedIn': ['لم يسجّل الدخول بعد', 'Has not signed in yet'],

  /* user form */
  'user.createTitle': ['إضافة مستخدم', 'Add user'], 'user.editTitle': ['تعديل المستخدم', 'Edit user'], 'user.create': ['إنشاء المستخدم وإصدار رمز التفعيل', 'Create user and issue activation code'],
  'user.nameAr': ['الاسم بالعربية', 'Name in Arabic'], 'user.nameEn': ['الاسم بالإنجليزية', 'Name in English'], 'user.username': ['اسم المستخدم', 'Username'],
  'user.usernameHint': ['3 إلى 40 حرفًا: حروف إنجليزية صغيرة وأرقام ونقطة وشرطة.', '3–40 characters: lowercase letters, digits, dot and dash.'], 'user.usernameFixed': ['لا يمكن تغيير اسم المستخدم.', 'The username cannot be changed.'],
  'user.email': ['البريد الإلكتروني (اختياري)', 'E-mail (optional)'],
  'user.role': ['الدور', 'Role'], 'user.chooseRole': ['اختر دورًا…', 'Choose a role…'],
  'user.status': ['حالة الحساب', 'Account status'], 'user.statusHintNew': ['يصبح الحساب نشطًا عندما يفتح المستخدم رابط التفعيل.', 'The account becomes active when the user opens the activation link.'], 'user.statusHint': ['الحساب المعطّل لا يستطيع الدخول.', 'An inactive account cannot sign in.'],
  'user.selfWhy': ['هذا حسابك: لا يمكنك تغيير دورك أو نطاقك الجغرافي بنفسك، حتى لا ترفع صلاحياتك أنت. اطلب ذلك من مدير نظام آخر.', 'This is your own account: you cannot change your own role or geographic access, so that nobody raises their own privileges. Ask another administrator.'],

  /* geographic access */
  'geo.title': ['الوصول الجغرافي', 'Geographic access'],
  'geo.opt.all': ['كل الكيانات والبلديات', 'All entities and municipalities'], 'geo.opt.allDesc': ['يرى سجلات كل الأمانات والبلديات والكيانات.', 'Sees the records of every Amanah, municipality and entity.'],
  'geo.opt.amanahs': ['أمانات محددة — بكل بلدياتها', 'Selected Amanahs — all their municipalities'], 'geo.opt.amanahsDesc': ['الأمانة كاملة: بلدياتها وسجلاتها المباشرة وغير المحددة.', 'The whole Amanah: its municipalities and its direct and unspecified records.'],
  'geo.opt.municipal': ['بلديات محددة ضمن أمانات محددة', 'Selected municipalities under selected Amanahs'], 'geo.opt.municipalDesc': ['تختار الأمانات ثم بلديات كل أمانة.', 'Choose the Amanahs, then the municipalities of each.'],
  'geo.amanahs': ['الأمانات', 'Amanahs'], 'geo.searchAmanahs': ['ابحث عن أمانة', 'Search Amanahs'], 'geo.searchMunis': ['ابحث عن بلدية', 'Search municipalities'],
  'geo.selectAll': ['تحديد الكل', 'Select all'], 'geo.selectShown': ['تحديد المعروض', 'Select shown'], 'geo.clear': ['إلغاء التحديد', 'Clear'], 'geo.clearShown': ['إلغاء تحديد المعروض', 'Clear shown'],
  'geo.amanahsSelected': ['{n} من {total} أمانة محددة', '{n} of {total} Amanahs selected'], 'geo.munisSelected': ['{n} من {total} بلدية', '{n} of {total} municipalities'],
  'geo.muniCount': ['{n} بلدية', '{n} municipalities'], 'geo.noAmanahsFound': ['لا توجد أمانة مطابقة.', 'No Amanah matches.'], 'geo.noMunisFound': ['لا توجد بلدية مطابقة.', 'No municipality matches.'],
  'geo.munisOf': ['بلديات {name}', 'Municipalities of {name}'], 'geo.removeAmanah': ['إزالة {name}', 'Remove {name}'], 'geo.pickAmanahFirst': ['اختر أمانة واحدة على الأقل لتظهر بلدياتها.', 'Choose at least one Amanah to see its municipalities.'],
  'geo.include': ['تضمين سجلات الأمانة المباشرة والبلدية غير المحددة', 'Include Amanah-level and unspecified-municipality records'],
  'geo.includeNote': ['بدون هذا الخيار لا يرى المستخدم المقيّد ببلديات سجلات الأمانة المباشرة ولا السجلات التي لم تُحدَّد بلديتها.', 'Without it, a municipality-restricted user does not see Amanah-level records or records whose municipality is not specified.'],
  'geo.summary': ['ملخص الوصول:', 'Access summary:'],
  'geo.doesNotFit': ['النطاق المحفوظ لهذا المستخدم ليس أحد الخيارات الثلاثة تمامًا. عند الحفظ يُستبدل بالخيار المحدد أدناه.', 'This user\'s saved scope is not exactly one of the three options. Saving replaces it with the option chosen below.'],

  /* what will they see */
  'see.title': ['ماذا سيرى؟', 'What will they see?'], 'see.choose': ['اختر الدور والوصول الجغرافي لتظهر المعاينة.', 'Choose the role and the geographic access to see the preview.'],
  'see.modules': ['الوحدات ({n} من {total}):', 'Modules ({n} of {total}):'], 'see.noModules': ['لا توجد وحدة مفعّلة لهذا الدور.', 'No module is enabled for this role.'],
  'see.figures': ['الأرقام المرئية:', 'Figures visible:'], 'see.invoices': ['فاتورة', 'invoices'], 'see.synthetic': ['أرقام اصطناعية للعرض فقط وليست بيانات فعلية للوزارة.', 'synthetic figures, illustrative only — not the Ministry\'s actual data.'],
  'see.withheld': ['لا تملك وحدة بيانات تتيح عرض الأرقام، فلا تُعرض.', 'You hold no data module that allows figures, so none are shown.'], 'see.noFigures': ['هذا الدور لا يفتح وحدة بيانات مالية، فلا توجد أرقام.', 'This role opens no financial data module, so there are no figures.'],
  'fig.net': ['صافي الإيراد', 'Net revenue'], 'fig.collected': ['المحصّل', 'Collected'], 'fig.uncollected': ['غير المحصّل', 'Uncollected'],

  /* confirmations / flash */
  'confirm.deactivateTitle': ['تعطيل الحساب', 'Deactivate the account'], 'confirm.deactivateBody': ['ينتهي دخول المستخدم عند طلبه التالي ولا يستطيع الدخول حتى يُعاد تفعيله. تبقى بياناته وسجل التدقيق.', 'The user is signed out at their next request and cannot sign in until re-activated. Their data and the audit trail are kept.'],
  'confirm.deactivateYes': ['تعطيل الحساب', 'Deactivate'], 'confirm.deactivateSelf': ['هذا حسابك: سينتهي دخولك أنت أيضًا.', 'This is your own account: your own session will end too.'],
  'confirm.activateTitle': ['تفعيل الحساب', 'Activate the account'], 'confirm.activateBody': ['يستطيع المستخدم الدخول من جديد بدوره ونطاقه الحاليين.', 'The user can sign in again with the current role and geographic access.'], 'confirm.activateYes': ['تفعيل الحساب', 'Activate'],
  'confirm.reissueTitle': ['إصدار رمز تفعيل جديد', 'Issue a new activation code'], 'confirm.reissueBody': ['يُلغى أي رمز سابق لم يُستخدم، ويُعرض الرمز الجديد مرة واحدة فقط. لا يُرسَل أي بريد.', 'Any earlier unused code is cancelled and the new code is shown once only. No e-mail is sent.'], 'confirm.reissueYes': ['إصدار الرمز', 'Issue the code'],
  'flash.created': ['تم إنشاء المستخدم {name}.', 'User {name} was created.'], 'flash.updated': ['تم حفظ تغييرات {name}.', 'Changes to {name} were saved.'], 'flash.deactivated': ['تم تعطيل حساب {name}.', 'The account of {name} was deactivated.'],
  'flash.activated': ['تم تفعيل حساب {name}.', 'The account of {name} was activated.'], 'flash.reissued': ['صدر رمز تفعيل جديد للمستخدم {name}.', 'A new activation code was issued for {name}.'],
  'flash.roleCreated': ['تم إنشاء الدور {name}.', 'Role {name} was created.'], 'flash.roleUpdated': ['تم حفظ الدور {name}.', 'Role {name} was saved.'], 'flash.roleDeleted': ['تم حذف الدور {name}.', 'Role {name} was deleted.'],

  /* activation dialog */
  'act.title': ['رمز التفعيل لمرة واحدة', 'One-time activation code'], 'act.titleReissue': ['رمز التفعيل الجديد', 'New activation code'], 'act.done': ['تم — أغلق', 'Done — close'],
  'act.onceTitle': ['يظهر هذا الرمز مرة واحدة فقط', 'This code is shown only once'], 'act.onceBody': ['انسخ الرابط وسلّمه للمستخدم الآن. لا يُخزَّن الرمز بصيغة مقروءة؛ بعد الإغلاق لا يبقى إلا «رمز جديد».', 'Copy the link and hand it to the user now. The code is not stored in readable form; after you close this, only "New code" remains.'],
  'act.link': ['رابط التفعيل', 'Activation link'], 'act.code': ['الرمز', 'Code'], 'act.copyLink': ['نسخ الرابط', 'Copy link'], 'act.copyCode': ['نسخ الرمز', 'Copy code'],
  'act.expires': ['ينتهي الرمز في {at} (بتوقيت الرياض) ولا يصلح إلا لمرة واحدة.', 'The code expires at {at} (Riyadh time) and works once only.'],
  'act.noteNoMail': ['لا يُرسَل أي بريد إلكتروني في النسخة التجريبية.', 'No e-mail is sent in the demo.'], 'act.noteSetPassword': ['يفتح المستخدم الرابط ويضع كلمة مروره بنفسه في صفحة الدخول.', 'The user opens the link and sets their own password on the sign-in page.'],
  'act.noteReissue': ['إن ضاع الرمز أو انتهى، أصدر رمزًا جديدًا من جدول المستخدمين.', 'If the code is lost or expires, issue a new one from the users table.'],

  /* audit */
  'audit.title': ['سجل التدقيق', 'Audit trail'], 'audit.help': ['سجل تغييرات المستخدمين والأدوار والنطاقات ومحاولات الوصول المرفوضة. لا يحتوي أي بيانات سرية.', 'The trail of user, role and access changes and denied attempts. It holds no secrets.'],
  'audit.search': ['بحث في المنفّذ أو الملخص', 'Search the actor or summary'], 'audit.action': ['الإجراء', 'Action'], 'audit.time': ['الوقت (بتوقيت الرياض)', 'Time (Riyadh)'],
  'audit.actor': ['المنفّذ', 'Actor'], 'audit.summary': ['الملخص', 'Summary'], 'audit.empty': ['لا توجد سجلات مطابقة.', 'No matching entries.'], 'audit.more': ['عرض المزيد', 'Show more'],
  'audit.count': ['{n} من {total} سجلًا', '{n} of {total} entries'], 'audit.tz': ['الأوقات بتوقيت الرياض', 'Times are Riyadh time'],

  /* roles page */
  'roles.title': ['الأدوار والصلاحيات', 'Roles and permissions'],
  'roles.sub': ['الدور يحدّد الوحدات المتاحة للمستخدم: فعّل الوحدة أو عطّلها. أما الأمانات والبلديات فتُحدَّد لكل مستخدم على حدة.', 'A role decides which modules a user can open: turn each module on or off. The Amanahs and municipalities are chosen per user.'],
  'roles.new': ['إنشاء دور', 'Create role'], 'roles.search': ['بحث في الأدوار', 'Search roles'], 'roles.count': ['{n} من {total} دورًا', '{n} of {total} roles'],
  'roles.caption': ['جدول الأدوار', 'Roles table'], 'roles.name': ['الدور', 'Role'], 'roles.explain': ['الشرح', 'Description'], 'roles.kind': ['النوع', 'Type'], 'roles.modulesCount': ['الوحدات المفعّلة', 'Modules enabled'], 'roles.userCount': ['المستخدمون', 'Users'],
  'roles.empty': ['لا يوجد دور يطابق البحث.', 'No role matches the search.'],
  'roles.protected': ['محمي', 'Protected'], 'roles.starter': ['دور مبدئي', 'Starter role'], 'roles.custom': ['دور مخصّص', 'Custom role'], 'roles.readOnlyTag': ['للقراءة فقط', 'Read-only'],
  'roles.protectedTitle': ['{name}: دور محمي', '{name}: a protected role'], 'roles.protectedWhy': ['يبقى «إدارة المستخدمين» و«الأدوار والصلاحيات» مفعّلين دائمًا لهذا الدور، حتى لا يفقد النظام آخر جهة قادرة على إدارته. يمكن تعديل اسمه ووحداته الأخرى، ولا يُحذف.', '"User Management" and "Roles and Permissions" always stay on for this role, so the system never loses its last way to be administered. Its name and other modules can be edited; it cannot be deleted.'],
  'roles.readOnlyReason': ['للقراءة فقط: وحدة «الأدوار والصلاحيات» غير مفعّلة لدورك.', 'Read-only: the "Roles and Permissions" module is not enabled for your role.'],
  'roles.readOnlyRoleReason': ['دورك «للقراءة فقط»: يمكنك الاطلاع على الأدوار دون تغيير أي شيء.', 'Your role is "Read-only": you can see the roles but cannot change anything.'],
  'roles.noViewRight': ['وحدة «الأدوار والصلاحيات» غير مفعّلة لدورك. اطلب من مدير النظام تفعيلها.', 'The "Roles and Permissions" module is not enabled for your role. Ask an administrator to enable it.'],
  'roles.cantDeleteProtected': ['الدور المحمي لا يُحذف.', 'A protected role cannot be deleted.'], 'roles.cantDeleteUsed': ['لا يُحذف الدور وهو مُسنَد إلى {n} مستخدمًا. انقلهم أولًا.', 'The role cannot be deleted while {n} users hold it. Move them first.'],
  'roles.deleteTitle': ['حذف الدور', 'Delete the role'], 'roles.deleteBody': ['يُحذف الدور نهائيًا. لا يمكن الحذف إن كان مُسنَدًا لأي مستخدم. يبقى الإجراء في سجل التدقيق.', 'The role is deleted for good. It cannot be deleted while any user holds it. The action stays in the audit trail.'], 'roles.deleteYes': ['حذف الدور', 'Delete role'],

  /* role form + module matrix */
  'role.createTitle': ['إنشاء دور', 'Create role'], 'role.editTitle': ['تعديل الدور', 'Edit role'], 'role.viewTitle': ['عرض الدور', 'View role'], 'role.create': ['إنشاء الدور', 'Create role'],
  'role.nameAr': ['اسم الدور بالعربية', 'Role name in Arabic'], 'role.nameEn': ['اسم الدور بالإنجليزية', 'Role name in English'],
  'role.descAr': ['وصف قصير بالعربية (اختياري)', 'Short description in Arabic (optional)'], 'role.descEn': ['وصف قصير بالإنجليزية (اختياري)', 'Short description in English (optional)'],
  'role.readOnly': ['للقراءة فقط', 'Read-only'], 'role.readOnlyHelp': ['يمكنه فتح الوحدات والتصدير ولا يغيّر شيئًا.', 'Can open the modules and export, but changes nothing.'],
  'role.readOnlyLocked': ['دور المدير لا يكون للقراءة فقط.', 'The Administrator role cannot be read-only.'],
  'mods.title': ['الوحدات المتاحة لهذا الدور', 'Modules available to this role'], 'mods.count': ['{n} من {total} وحدة مفعّلة', '{n} of {total} modules on'],
  'mods.enableAll': ['تفعيل الكل', 'Enable all'], 'mods.disableAll': ['تعطيل الكل', 'Disable all'], 'mods.locked': ['مقفلة: يحتاجها دور المدير دائمًا', 'Locked: the Administrator always needs it'],

  /* validation + errors */
  'err.nameRequired': ['الاسم مطلوب.', 'The name is required.'], 'err.nameLong': ['الاسم طويل جدًا.', 'The name is too long.'], 'err.descLong': ['الوصف طويل جدًا (300 حرف كحد أقصى).', 'The description is too long (300 characters at most).'],
  'err.usernameInvalid': ['اسم المستخدم من 3 إلى 40 حرفًا (حروف إنجليزية صغيرة وأرقام ونقطة وشرطة).', 'The username is 3–40 characters (lowercase letters, digits, dot, dash).'], 'err.emailInvalid': ['البريد الإلكتروني غير صالح.', 'The e-mail address is not valid.'],
  'err.modulesRequired': ['فعّل وحدة واحدة على الأقل.', 'Turn on at least one module.'], 'err.roleRequired': ['اختر دورًا للمستخدم.', 'Choose a role for the user.'],
  'err.fixFields': ['راجع الحقول المظلّلة أدناه.', 'Please review the highlighted fields below.'],
  'err.unauthenticated': ['انتهت الجلسة. سجّل الدخول من جديد.', 'Your session has ended. Please sign in again.'],
  'err.forbidden': ['لا تملك صلاحية هذا الإجراء.', 'You do not have permission for this action.'],
  'err.forbidden.protected_role': ['دور المدير محمي: لا يُحذف وتبقى فيه وحدتا «إدارة المستخدمين» و«الأدوار والصلاحيات».', 'The Administrator role is protected: it cannot be deleted and keeps "User Management" and "Roles and Permissions".'],
  'err.forbidden.delegation': ['لا يمكنك منح أو تعديل وصول يتجاوز دورك أو نطاقك أنت.', 'You cannot grant or change access beyond your own role or geographic access.'],
  'err.read_only_role': ['دورك «للقراءة فقط»: لا يمكنه تغيير أي شيء.', 'Your role is "Read-only": it cannot change anything.'],
  'err.self_elevation': ['لا يمكنك رفع وصولك أنت: لا تغيّر دورك أو نطاقك الجغرافي، ولا توسّع وحدات الدور الذي تحمله.', 'You cannot raise your own access: do not change your own role or geographic access, or widen the modules of the role you hold.'],
  'err.last_admin': ['لا يمكن تنفيذ ذلك: يجب أن يبقى مدير نظام نشط واحد على الأقل بدور «المدير» ونطاق كامل.', 'This cannot be done: at least one active administrator with full geographic access must remain.'],
  'err.role_in_use': ['لا يمكن حذف الدور لأن {n} مستخدمًا يحملونه. انقل مستخدميه إلى دور آخر أولًا.', 'The role cannot be deleted because {n} users hold it. Move them to another role first.'],
  'err.not_found': ['العنصر غير موجود (ربما حُذف).', 'The item was not found (it may have been deleted).'], 'err.validation_error': ['البيانات المدخلة غير صالحة.', 'The data entered is not valid.'],
  'err.network': ['تعذّر الاتصال بخدمة البيانات. تحقق من الاتصال ثم أعد المحاولة.', 'Could not reach the data service. Check the connection and try again.'], 'err.server_error': ['حدث خطأ في الخدمة. حاول مرة أخرى.', 'The service had an error. Please try again.'],
  'err.generic': ['تعذّر تنفيذ الطلب.', 'The request could not be completed.']
};

/** the text of `key` in `lang` with {placeholders} replaced; an unknown key returns «⟦key⟧» (the test fails on it) */
export function tt(key, lang = 'ar', vars) {
  const e = TEXT[key]; if (!e) return `⟦${key}⟧`;
  let s = lang === 'en' ? e[1] : e[0];
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return s;
}

/** the server's own message in the page language when it sends one ({message:{ar,en}} or messageAr / messageEn) — shown as sent */
const serverMessage = (body, lang) => {
  const m = body && body.message;
  if (m && typeof m === 'object') return String((lang === 'en' ? m.en : m.ar) || '');
  const v = body && (lang === 'en' ? body.messageEn : body.messageAr);
  return typeof v === 'string' ? v : '';
};

/** an API failure in the page language. The server's AR/EN message is shown as sent; otherwise only documented codes are turned into words — no server detail, value or stack is ever shown. */
export function errorText(error, lang = 'ar') {
  if (!error) return '';
  const body = error.body && typeof error.body === 'object' ? error.body : {}; const code = error.code || body.error || '';
  const own = serverMessage(body, lang); if (own) return own;
  if (code === 'validation_error') { const f = Array.isArray(body.fields) ? body.fields.find((x) => x && (x.ar || x.en)) : null; return f ? (lang === 'en' ? f.en : f.ar) || tt('err.validation_error', lang) : tt('err.validation_error', lang); }
  if (code === 'forbidden') return body.reason === 'protected_role' ? tt('err.forbidden.protected_role', lang) : body.reason === 'delegation' ? tt('err.forbidden.delegation', lang) : tt('err.forbidden', lang);
  if (code === 'role_in_use') return tt('err.role_in_use', lang, { n: body.users ?? '' });
  const k = `err.${code}`; if (TEXT[k]) return tt(k, lang);
  return tt('err.generic', lang);
}
