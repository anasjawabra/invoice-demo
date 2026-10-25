// Reference list of exclusions produced by the 21 Oct 2026 session (transcribed from the supplied PDF; English is a translation).
// Generated from the handover document build (exclusions_reference.json). It is a REFERENCE, not an approval: the source says several points still need confirmation.
export const EXCLUSIONS_REFERENCE = {
 "title": {
  "ar": "قائمة الاستبعادات المعتمدة – الإدارة الذكية للفواتير",
  "en": "Approved exclusions list – Intelligent Invoice Management"
 },
 "origin": {
  "ar": "مخرجات جلسة 21 أكتوبر 2026 · الجهة: وزارة البلديات والإسكان – قطاع الخدمات المشتركة",
  "en": "Output of the 21 October 2026 session · Entity: Ministry of Municipalities and Housing – Shared Services Sector"
 },
 "caution": {
  "ar": "مرجع منقول من المستند المصدر دون تعديل في المعنى. ويذكر المستند نفسه أن عدة نقاط تحتاج إلى تأكيد قبل اعتماد القواعد نهائياً، وقسم «النقاط المفتوحة» الذي يشير إليه غير موجود في النسخة المتاحة. لذلك لا يُعد هذا العرض اعتماداً جديداً.",
  "en": "Reference transcribed from the source document without changing its meaning. The document itself says that several points need confirmation before the rules are finally adopted, and the \"open points\" section it refers to is missing from the copy supplied. This is therefore not a new approval."
 },
 "summary": [
  {
   "ar": "أُكدت خلال الجلسة تسعة أسباب استبعاد فاعلة تُطبَّق على الفواتير غير المحصلة فقط، وتُخصم من إجمالي المفوتر للوصول إلى صافي المفوتر. وتقرّر تأجيل سبب «متوفى في السجل المدني» إلى مرحلة لاحقة لعدم تطبيقه حالياً، مع الاتفاق على فتح سبب استبعاد مستقل لاحقاً لفواتير شركة المياه الوطنية والشركات الخدمية المصنّفة حالياً ضمن «فواتير لا تستند إلى عقود».",
   "en": "The session confirmed nine active exclusion reasons. They apply to uncollected invoices only and are deducted from gross billed to reach net billed. The reason \"Deceased in the civil registry\" was deferred to a later phase because it is not applied today. It was also agreed to open a separate exclusion reason later for the invoices of the National Water Company and the service companies, which are currently classified under \"Invoices not based on contracts\"."
  },
  {
   "ar": "ويتطلب سببان من هذه الأسباب (التعديات واستغلال المواقع، وإفادات الأمانات) ميزة جديدة لرفع ملفات الاستبعاد عبر نموذج موحّد، نظراً لورودها من الأمانات عبر البريد الإلكتروني دون تكامل آلي. وتبقى عدة نقاط بحاجة إلى تأكيد قبل اعتماد القواعد نهائياً، وهي موضّحة في قسم النقاط المفتوحة.",
   "en": "Two of these reasons (encroachments and site exploitation; Amanah statements) require a new feature for uploading exclusion files through a unified form, because the Amanahs send them by email with no automatic integration. Several points still need confirmation before the rules are finally adopted; they are described in the open-points section."
  }
 ],
 "principles_title": {
  "ar": "المبادئ العامة للاستبعاد",
  "en": "General principles of exclusion"
 },
 "principles": [
  {
   "ar": "تُطبَّق الاستبعادات على الفواتير غير المحصلة فقط، ولا يُستبعد أي جزء من المحصل.",
   "en": "Exclusions apply to uncollected invoices only; no part of what has been collected is excluded."
  },
  {
   "ar": "صافي المفوتر = إجمالي المفوتر − إجمالي الفواتير المستبعدة.",
   "en": "Net billed = gross billed − total excluded invoices."
  },
  {
   "ar": "يُعتمد رقم الفاتورة مفتاحاً موحداً للربط بين الأنظمة، ويتكوّن من البادئة 177 مضافاً إليها رقم السداد، وفق ما اتُّفق عليه مسبقاً مع المالك الأعمالي. [توضيح لاحق من الأعمال، 25 أكتوبر 2026: مفتاح الفاتورة هو معرّف المُفوتر + رقم السداد، ويبقى رقم السداد حقلاً مستقلاً قابلاً للبحث؛ و177 هو معرّف المُفوتر الخاص بالوزارة في سداد، ولبعض الأمانات، مثل أمانة الرياض، معرّفات مُفوتر خاصة بإيراداتها.]",
   "en": "The invoice number is the unified key for linking systems. It consists of the prefix 177 followed by the SADAD number, as previously agreed with the business owner. [Later clarification from the business, 25 October 2026: the invoice key is the biller ID + the SADAD number, and the SADAD number stays a separate, searchable field; 177 is the Ministry's own biller ID in SADAD, and some Amanahs, for example Riyadh, have biller IDs of their own for their revenues.]"
  },
  {
   "ar": "تُربط أرقام المخالفات الواردة من إيفاء وممتثل برقم الفاتورة المقابل قبل تطبيق قاعدة الاستبعاد.",
   "en": "Violation numbers received from Efaa and Momtathel are linked to the corresponding invoice number before an exclusion rule is applied."
  },
  {
   "ar": "تُعرض كل فاتورة مستبعدة مع سبب استبعادها ومصدره، بما يتيح المراجعة والتحقق.",
   "en": "Every excluded invoice is shown with its exclusion reason and source, so it can be reviewed and verified."
  }
 ],
 "table_title": {
  "ar": "ملخص قائمة الاستبعادات",
  "en": "Summary of the exclusions list"
 },
 "table_head": {
  "ar": "#|سبب الاستبعاد|مصدر البيانات|نطاق الفواتير|معيار الاستبعاد|الحالة|يقابله في العرض",
  "en": "#|Exclusion reason|Data source|Invoice scope|Exclusion criterion|Status|Demo rule"
 },
 "rows": [
  {
   "n": 1,
   "rule": "R1",
   "reason": {
    "ar": "فواتير لا تستند إلى عقود",
    "en": "Invoices not based on contracts"
   },
   "source": {
    "ar": "فرص، والأنظمة الداخلية للأمانات",
    "en": "Furas and the Amanahs' internal systems"
   },
   "scope": {
    "ar": "فواتير حساب إيراد الاستثمار",
    "en": "Invoices on an investment revenue account"
   },
   "criterion": {
    "ar": "عدم وجود عقد للفاتورة في منصة فرص",
    "en": "The invoice has no contract in Furas"
   },
   "status": {
    "ar": "معتمد مع ملاحظة",
    "en": "Approved with a note"
   }
  },
  {
   "n": 2,
   "rule": "R3",
   "reason": {
    "ar": "منفذ ضده في سند",
    "en": "Executed against in Sanad"
   },
   "source": {
    "ar": "سند",
    "en": "Sanad"
   },
   "scope": {
    "ar": "جميع الفواتير",
    "en": "All invoices"
   },
   "criterion": {
    "ar": "وجود رقم تنفيذ للفاتورة، بغض النظر عن حالة أمر التنفيذ",
    "en": "The invoice has an execution number, regardless of the status of the enforcement order"
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 3,
   "rule": "R4",
   "reason": {
    "ar": "غير مكتمل في إيفاء",
    "en": "Incomplete in Efaa"
   },
   "source": {
    "ar": "إيفاء: تقرير إشعار المطالبة بالأداء",
    "en": "Efaa: the payment-demand notice report"
   },
   "scope": {
    "ar": "المخالفات (الجزاءات والغرامات)",
    "en": "Violations (penalties and fines)"
   },
   "criterion": {
    "ar": "حالة المخالفة «غير مكتمل»",
    "en": "The violation status is \"Incomplete\""
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 4,
   "rule": "R5",
   "reason": {
    "ar": "خارج إيفاء",
    "en": "Outside Efaa"
   },
   "source": {
    "ar": "تحصيل (الداخلية والمركزية)، مقارنةً بإيفاء",
    "en": "Tahseel (internal and central), compared with Efaa"
   },
   "scope": {
    "ar": "مديونيات الجزاءات والغرامات غير المحصلة",
    "en": "Uncollected penalty and fine debts"
   },
   "criterion": {
    "ar": "عدم وجود المخالفة في إيفاء",
    "en": "The violation does not exist in Efaa"
   },
   "status": {
    "ar": "معتمد، يتطلب تأكيد النطاق",
    "en": "Approved; scope to be confirmed"
   }
  },
  {
   "n": 5,
   "rule": "R8 + R9",
   "reason": {
    "ar": "التعديات واستغلال المواقع (محضر التعدي) وإفادات الأمانات",
    "en": "Encroachments and site exploitation (encroachment report) and Amanah statements"
   },
   "source": {
    "ar": "الأمانات عبر البريد الإلكتروني (ملفات Excel)",
    "en": "The Amanahs, by email (Excel files)"
   },
   "scope": {
    "ar": "فواتير الاستثمار من فرص، أو فواتير داخلية للأمانات",
    "en": "Investment invoices from Furas, or internal Amanah invoices"
   },
   "criterion": {
    "ar": "ورود الفاتورة ضمن إفادة رسمية من الأمانة",
    "en": "The invoice appears in an official statement from the Amanah"
   },
   "status": {
    "ar": "معتمد، يتطلب ميزة رفع",
    "en": "Approved; requires an upload feature"
   }
  },
  {
   "n": 6,
   "rule": "R6",
   "reason": {
    "ar": "منفذ ضده في إيفاء",
    "en": "Executed against in Efaa"
   },
   "source": {
    "ar": "إيفاء: تقرير المنفذ ضده",
    "en": "Efaa: the executed-against report"
   },
   "scope": {
    "ar": "المخالفات",
    "en": "Violations"
   },
   "criterion": {
    "ar": "ورود المخالفة في تقرير المنفذ ضده",
    "en": "The violation appears in the executed-against report"
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 7,
   "rule": "R7",
   "reason": {
    "ar": "اعتراضات قائمة",
    "en": "Open objections"
   },
   "source": {
    "ar": "ممتثل حالياً، وإيفاء مستقبلاً",
    "en": "Momtathel now, Efaa in future"
   },
   "scope": {
    "ar": "المخالفات المعترض عليها",
    "en": "Violations under objection"
   },
   "criterion": {
    "ar": "حالة الاعتراض (عمود «حالة الاستئناف») ضمن الحالات المحددة",
    "en": "The objection status (the \"appeal status\" column) is one of the defined statuses"
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 8,
   "rule": "R10",
   "reason": {
    "ar": "سجلات تجارية مشطوبة",
    "en": "Struck-off commercial registrations"
   },
   "source": {
    "ar": "بلدي (بيانات تغيير السداد) مع CR View",
    "en": "Balady (payment-change data) with CR View"
   },
   "scope": {
    "ar": "الفواتير المرتبطة بسجل تجاري",
    "en": "Invoices linked to a commercial registration"
   },
   "criterion": {
    "ar": "حالة السجل Deleted أو Cancelled",
    "en": "The registration status is Deleted or Cancelled"
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 9,
   "rule": "R11",
   "reason": {
    "ar": "فواتير مكررة",
    "en": "Duplicate invoices"
   },
   "source": {
    "ar": "فرص غالباً، مع كشف التكرار بالذكاء الاصطناعي",
    "en": "Mostly Furas, with duplicates detected by artificial intelligence"
   },
   "scope": {
    "ar": "فواتير الاستثمار في الغالب",
    "en": "Mostly investment invoices"
   },
   "criterion": {
    "ar": "تطابق العميل والمبلغ والمنتج وتاريخ الإصدار مع اختلاف رقم الفاتورة",
    "en": "Same customer, amount, product and issue date, with a different invoice number"
   },
   "status": {
    "ar": "معتمد",
    "en": "Approved"
   }
  },
  {
   "n": 10,
   "rule": "—",
   "reason": {
    "ar": "متوفى في السجل المدني",
    "en": "Deceased in the civil registry"
   },
   "source": {
    "ar": "غير محدد",
    "en": "Not specified"
   },
   "scope": {
    "ar": "غير محدد",
    "en": "Not specified"
   },
   "criterion": {
    "ar": "غير مطبّق حالياً",
    "en": "Not applied at present"
   },
   "status": {
    "ar": "مؤجل لمرحلة لاحقة",
    "en": "Deferred to a later phase"
   }
  }
 ],
 "details_title": {
  "ar": "تفاصيل أسباب الاستبعاد",
  "en": "Details of the exclusion reasons"
 },
 "details": [
  {
   "n": 1,
   "title": {
    "ar": "فواتير لا تستند إلى عقود",
    "en": "Invoices not based on contracts"
   },
   "items": [
    [
     "def",
     {
      "ar": "فواتير صادرة من أي أمانة أو جهة على حساب إيراد استثماري (مثل ريع الأراضي، وإيجار الأراضي، وبيع الأراضي، والاستثمار) دون وجود عقد مقابل لها في منصة فرص.",
      "en": "Invoices issued by any Amanah or entity on an investment revenue account (such as land revenue, land rent, land sale and investment) with no corresponding contract in Furas."
     }
    ],
    [
     "src",
     {
      "ar": "الأنظمة الداخلية للأمانات ومنصة فرص.",
      "en": "The Amanahs' internal systems and the Furas platform."
     }
    ],
    [
     "rule",
     {
      "ar": "تُستبعد الفاتورة متى كان حساب إيرادها استثمارياً ولم يُعثر لها على عقد في فرص.",
      "en": "An invoice is excluded when its revenue account is an investment account and no contract is found for it in Furas."
     }
    ],
    [
     "note",
     {
      "ar": "تُصنَّف فواتير شركة المياه الوطنية والشركات الخدمية حالياً تحت هذا السبب لعدم وجود مسمى بديل، وذلك بناءً على توجيه بإيقاف التنفيذ عليها إلى حين انتهاء اللجنة المشكّلة لدراسة الموضوع. وقد اتُّفق على فتح سبب استبعاد مستقل لها لاحقاً.",
      "en": "The invoices of the National Water Company and the service companies are currently classified under this reason because no alternative label exists, following a direction to stay execution on them until the committee formed to study the matter finishes. It was agreed to open a separate exclusion reason for them later."
     }
    ]
   ]
  },
  {
   "n": 2,
   "title": {
    "ar": "منفذ ضده في سند",
    "en": "Executed against in Sanad"
   },
   "items": [
    [
     "def",
     {
      "ar": "فواتير لها أمر تنفيذ مسجّل في منصة سند.",
      "en": "Invoices that have an enforcement order registered in Sanad."
     }
    ],
    [
     "src",
     {
      "ar": "منصة سند (أوامر التنفيذ والفواتير المرتبطة بها).",
      "en": "The Sanad platform (enforcement orders and the invoices linked to them)."
     }
    ],
    [
     "rule",
     {
      "ar": "تُستبعد أي فاتورة لها رقم تنفيذ، بغض النظر عن حالة أمر التنفيذ.",
      "en": "Any invoice that has an execution number is excluded, regardless of the status of the enforcement order."
     }
    ],
    [
     "link",
     {
      "ar": "رقم الفاتورة الوارد ضمن أمر التنفيذ. وفي حال تعذّر التكامل المباشر مع سند، يُرفع ملف أمر التنفيذ بصيغة PDF ليتولى وكيل OCR استخراج أرقام الفواتير وربطها برقم الإنفاذ.",
      "en": "The invoice number that appears in the enforcement order. If direct integration with Sanad is not possible, the enforcement-order file is uploaded as a PDF and an OCR agent extracts the invoice numbers and links them to the enforcement number."
     }
    ]
   ]
  },
  {
   "n": 3,
   "title": {
    "ar": "غير مكتمل في إيفاء",
    "en": "Incomplete in Efaa"
   },
   "items": [
    [
     "def",
     {
      "ar": "مخالفات تظهر حالتها «غير مكتمل» في منصة إيفاء.",
      "en": "Violations whose status shows as \"Incomplete\" in Efaa."
     }
    ],
    [
     "src",
     {
      "ar": "تقرير «إشعار المطالبة بالأداء» في منصة إيفاء، ويتضمن أرقام المخالفات وحالتها (مكتمل / غير مكتمل).",
      "en": "The \"payment-demand notice\" report in Efaa, which contains the violation numbers and their status (complete / incomplete)."
     }
    ],
    [
     "rule",
     {
      "ar": "تُؤخذ المخالفات ذات الحالة «غير مكتمل» فقط، ويُربط رقم كل مخالفة برقم الفاتورة المقابل، ثم تُستبعد الفاتورة.",
      "en": "Only violations with the status \"Incomplete\" are taken; each violation number is linked to the corresponding invoice number, and the invoice is then excluded."
     }
    ]
   ]
  },
  {
   "n": 4,
   "title": {
    "ar": "خارج إيفاء",
    "en": "Outside Efaa"
   },
   "items": [
    [
     "def",
     {
      "ar": "مديونيات جزاءات وغرامات غير محصلة لا تظهر في منصة إيفاء.",
      "en": "Uncollected penalty and fine debts that do not appear in Efaa."
     }
    ],
    [
     "src",
     {
      "ar": "المديونيات غير المحصلة، إذ تُستخرج من تحصيل (الداخلية والمركزية) مع حذف الفواتير الملغاة، ثم تُقارن بقائمة إيفاء.",
      "en": "The uncollected debts: they are extracted from Tahseel (internal and central), cancelled invoices are removed, and the result is then compared with the Efaa list."
     }
    ],
    [
     "rule",
     {
      "ar": "تُحصر مديونيات الجزاءات والغرامات من إجمالي غير المحصل، ويُستبعد كل ما لا يوجد منها في إيفاء.",
      "en": "Penalty and fine debts are isolated from total uncollected, and everything among them that does not exist in Efaa is excluded."
     }
    ],
    [
     "link",
     {
      "ar": "رقم إيفاء مقابل رقم الفاتورة.",
      "en": "The Efaa number against the invoice number."
     }
    ],
    [
     "note",
     {
      "ar": "أشار المالك الأعمالي إلى أن القاعدة تقتصر على الجزاءات، ويلزم تأكيد ما إذا كانت الغرامات مشمولة.",
      "en": "The business owner pointed out that the rule is limited to penalties, so it must be confirmed whether fines are included."
     }
    ]
   ]
  },
  {
   "n": 5,
   "title": {
    "ar": "التعديات واستغلال المواقع (محضر التعدي) وإفادات الأمانات",
    "en": "Encroachments and site exploitation (encroachment report) and Amanah statements"
   },
   "items": [
    [
     "def",
     {
      "ar": "فواتير استثمارية تُفيد الأمانة بأنها تعديات أو استغلال مواقع، أو تَرِد ضمن إفادات رسمية منها. وأوضح المالك الأعمالي أن السببين متقاربان إلى حد كبير.",
      "en": "Investment invoices that the Amanah reports as encroachments or site exploitation, or that appear in official statements from it. The business owner explained that the two reasons are very close."
     }
    ],
    [
     "src",
     {
      "ar": "ترسلها الأمانات عبر البريد الإلكتروني بملفات Excel تتضمن رقم الفاتورة وتاريخها ومبلغها، ولا يوجد عليها تكامل آلي حالياً. وقد تكون من فواتير فرص أو من الفواتير الداخلية للأمانة.",
      "en": "The Amanahs send them by email as Excel files containing the invoice number, date and amount, with no automatic integration today. They may be Furas invoices or the Amanah's own internal invoices."
     }
    ],
    [
     "freq",
     {
      "ar": "عند الحاجة، بمعدل مرة إلى مرتين شهرياً تقريباً، وقد يصل الملف الواحد إلى ما بين 100 و200 فاتورة.",
      "en": "When needed, about once or twice a month; one file can reach between 100 and 200 invoices."
     }
    ],
    [
     "req",
     {
      "ar": "نموذج موحّد (Form) تُعبّأ فيه البيانات ويُرفع إلى النظام، فتُطبَّق الاستبعادات مباشرة بعد اجتياز التحقق.",
      "en": "A unified form in which the data is entered and uploaded to the system, so that exclusions are applied directly after validation passes."
     }
    ]
   ]
  },
  {
   "n": 6,
   "title": {
    "ar": "منفذ ضده في إيفاء",
    "en": "Executed against in Efaa"
   },
   "items": [
    [
     "def",
     {
      "ar": "مخالفات صدر بشأنها تنفيذ ضمن منصة إيفاء.",
      "en": "Violations for which execution was issued in Efaa."
     }
    ],
    [
     "src",
     {
      "ar": "«تقرير المنفذ ضده» في منصة إيفاء، ويتضمن أرقام التنفيذ وأرقام المخالفات.",
      "en": "The \"executed-against report\" in Efaa, which contains execution numbers and violation numbers."
     }
    ],
    [
     "rule",
     {
      "ar": "تُؤخذ جميع المخالفات الواردة في التقرير دون استثناء، وتُربط بأرقام الفواتير، ثم تُستبعد.",
      "en": "All violations in the report are taken without exception, linked to invoice numbers, and then excluded."
     }
    ],
    [
     "note",
     {
      "ar": "يختلف هذا التقرير عن تقرير «إشعار المطالبة بالأداء» المعتمد في السبب رقم 3.",
      "en": "This report differs from the \"payment-demand notice\" report used for reason 3."
     }
    ]
   ]
  },
  {
   "n": 7,
   "title": {
    "ar": "اعتراضات قائمة",
    "en": "Open objections"
   },
   "items": [
    [
     "def",
     {
      "ar": "مخالفات مرفوع عليها اعتراض لم يُبتّ فيه، أو قُبل كلياً أو جزئياً.",
      "en": "Violations under an objection that has not been decided, or that was accepted fully or partly."
     }
    ],
    [
     "src",
     {
      "ar": "تقرير منصة ممتثل حالياً، ويعرض كل فاتورة مع حالة الاعتراض في عمود «حالة الاستئناف». ويُتوقع مستقبلاً أن تُستمد هذه البيانات من كشف إيفاء.",
      "en": "The Momtathel report today, which lists each invoice with its objection status in the \"appeal status\" column. In future this data is expected to come from the Efaa statement."
     }
    ],
    [
     "rule",
     {
      "ar": "وفق حالة الاعتراض كما في الجدول التالي.",
      "en": "According to the objection status, as in the following table."
     }
    ]
   ]
  },
  {
   "n": 8,
   "title": {
    "ar": "سجلات تجارية مشطوبة",
    "en": "Struck-off commercial registrations"
   },
   "items": [
    [
     "def",
     {
      "ar": "فواتير مرتبطة بسجلات تجارية مشطوبة أو ملغاة.",
      "en": "Invoices linked to commercial registrations that are struck off or cancelled."
     }
    ],
    [
     "src",
     {
      "ar": "بيانات تغيير السداد في منصة بلدي، مع بيانات السجل التجاري من CR View.",
      "en": "The payment-change data in Balady, with commercial-registration data from CR View."
     }
    ],
    [
     "rule",
     {
      "ar": "تُستبعد الفاتورة متى كانت حالة السجل Deleted أو Cancelled، ويُسجَّل سببها «سجل مشطوب».",
      "en": "An invoice is excluded when the registration status is Deleted or Cancelled, and its reason is recorded as \"struck-off registration\"."
     }
    ]
   ]
  },
  {
   "n": 9,
   "title": {
    "ar": "فواتير مكررة",
    "en": "Duplicate invoices"
   },
   "items": [
    [
     "def",
     {
      "ar": "فواتير بأرقام مختلفة صادرة على العميل نفسه، بالمبلغ والمنتج نفسيهما، وفي اليوم نفسه.",
      "en": "Invoices with different numbers issued to the same customer, for the same amount and product, on the same day."
     }
    ],
    [
     "src",
     {
      "ar": "غالباً فواتير الاستثمار في منصة فرص، إذ قد يُصدر النظام أكثر من فاتورة عن طريق الخطأ. ويُكشف التكرار عبر الذكاء الاصطناعي.",
      "en": "Mostly investment invoices in Furas, where the system may issue more than one invoice by mistake. Duplicates are detected by artificial intelligence."
     }
    ],
    [
     "rule",
     {
      "ar": "تُستبعد الفواتير الزائدة متى تطابقت بياناتها وتاريخ إصدارها مع اختلاف رقم الفاتورة فقط.",
      "en": "The surplus invoices are excluded when their data and issue date match and only the invoice number differs."
     }
    ],
    [
     "note",
     {
      "ar": "لا يُعد تكرار الفاتورة سنوياً على العميل ذاته (كما في الإيجارات الاستثمارية السنوية) تكراراً، إذ يقتصر التكرار على الفواتير الصادرة في الوقت نفسه. وأفاد المالك الأعمالي بأن هذه الحالات كانت أكثر شيوعاً في السابق.",
      "en": "An invoice repeated yearly to the same customer (as with annual investment rents) is not a duplicate; duplication is limited to invoices issued at the same time. The business owner said these cases were more common in the past."
     }
    ]
   ]
  },
  {
   "n": 10,
   "title": {
    "ar": "متوفى في السجل المدني (مؤجل)",
    "en": "Deceased in the civil registry (deferred)"
   },
   "items": [
    [
     "status",
     {
      "ar": "لا يُطبَّق هذا الاستبعاد حالياً، ولا يتوفر مصدر بيانات معتمد له.",
      "en": "This exclusion is not applied at present and no approved data source exists for it."
     }
    ],
    [
     "decision",
     {
      "ar": "يُزال من النموذج الحالي، ويُعاد النظر فيه في مرحلة لاحقة.",
      "en": "It is removed from the current model and will be reconsidered in a later phase."
     }
    ],
    [
     "tail",
     {
      "ar": "وتُستكمل البيانات من النظام المصدري بحسب نوع الفاتورة: من فرص للفواتير الاستثمارية، ومن إيفاء وممتثل للمخالفات، ومن السجل … (النص مقطوع في المستند المصدر).",
      "en": "Data is completed from the source system according to the invoice type: from Furas for investment invoices, from Efaa and Momtathel for violations, and from the registry … (the text is cut off in the source document)."
     }
    ]
   ]
  }
 ],
 "labels": {
  "def": {
   "ar": "التعريف",
   "en": "Definition"
  },
  "src": {
   "ar": "مصدر البيانات",
   "en": "Data source"
  },
  "rule": {
   "ar": "قاعدة الاستبعاد",
   "en": "Exclusion rule"
  },
  "link": {
   "ar": "آلية الربط",
   "en": "Linking mechanism"
  },
  "note": {
   "ar": "ملاحظة",
   "en": "Note"
  },
  "freq": {
   "ar": "التكرار والحجم",
   "en": "Frequency and size"
  },
  "req": {
   "ar": "المتطلب",
   "en": "Requirement"
  },
  "status": {
   "ar": "الوضع الحالي",
   "en": "Current position"
  },
  "decision": {
   "ar": "القرار",
   "en": "Decision"
  },
  "tail": {
   "ar": "تتمة",
   "en": "Continuation"
  }
 },
 "upload_title": {
  "ar": "حقول نموذج الرفع المقترحة (للسبب 5)",
  "en": "Proposed upload-form fields (for reason 5)"
 },
 "upload_head": {
  "ar": "الحقل|نوع الإدخال|الغرض",
  "en": "Field|Input type|Purpose"
 },
 "upload": [
  [
   {
    "ar": "الأمانة",
    "en": "Amanah"
   },
   {
    "ar": "قائمة منسدلة",
    "en": "Drop-down list"
   },
   {
    "ar": "توحيد أسماء الأمانات، والتمييز بين الفواتير التي قد تتطابق أرقامها في أكثر من أمانة",
    "en": "Standardise Amanah names and tell apart invoices whose numbers may coincide in more than one Amanah"
   }
  ],
  [
   {
    "ar": "رقم الفاتورة",
    "en": "Invoice number"
   },
   {
    "ar": "إدخال حر",
    "en": "Free entry"
   },
   {
    "ar": "مفتاح الربط الرئيسي",
    "en": "The main linking key"
   }
  ],
  [
   {
    "ar": "تاريخ الفاتورة",
    "en": "Invoice date"
   },
   {
    "ar": "تاريخ",
    "en": "Date"
   },
   {
    "ar": "التحقق من المطابقة",
    "en": "Match validation"
   }
  ],
  [
   {
    "ar": "مبلغ الفاتورة",
    "en": "Invoice amount"
   },
   {
    "ar": "رقم",
    "en": "Number"
   },
   {
    "ar": "التحقق من المطابقة",
    "en": "Match validation"
   }
  ],
  [
   {
    "ar": "حساب الإيراد",
    "en": "Revenue account"
   },
   {
    "ar": "إدخال حر (إن توفر)",
    "en": "Free entry (if available)"
   },
   {
    "ar": "التحقق من المطابقة",
    "en": "Match validation"
   }
  ],
  [
   {
    "ar": "سبب الاستبعاد",
    "en": "Exclusion reason"
   },
   {
    "ar": "قائمة منسدلة",
    "en": "Drop-down list"
   },
   {
    "ar": "تحديد السبب: تعديات واستغلال مواقع، أو إفادة أمانة",
    "en": "Choose the reason: encroachment and site exploitation, or an Amanah statement"
   }
  ]
 ],
 "validation": {
  "ar": "قاعدة التحقق: تُقبل الفاتورة متى تطابقت جميع الحقول الأساسية مع البيانات الموجودة في النظام، وتُعاد الفواتير غير المتطابقة مع بيان سبب الرفض.",
  "en": "Validation rule: an invoice is accepted when all the key fields match the data in the system; invoices that do not match are returned with the reason for rejection."
 },
 "objection_title": {
  "ar": "معاملة حالات الاعتراض (للسبب 7)",
  "en": "Treatment of objection statuses (for reason 7)"
 },
 "objection_head": {
  "ar": "حالة الاعتراض (حالة الاستئناف)|المعاملة",
  "en": "Objection status (appeal status)|Treatment"
 },
 "objection": [
  [
   {
    "ar": "بانتظار توجيه العضو",
    "en": "Awaiting the member's direction"
   },
   {
    "ar": "تُستبعد",
    "en": "Excluded"
   }
  ],
  [
   {
    "ar": "بانتظار مراجعة اللجنة",
    "en": "Awaiting committee review"
   },
   {
    "ar": "تُستبعد",
    "en": "Excluded"
   }
  ],
  [
   {
    "ar": "مقبول جزئياً",
    "en": "Partly accepted"
   },
   {
    "ar": "تُستبعد",
    "en": "Excluded"
   }
  ],
  [
   {
    "ar": "مكتمل مقبول",
    "en": "Complete – accepted"
   },
   {
    "ar": "تُستبعد",
    "en": "Excluded"
   }
  ],
  [
   {
    "ar": "مكتمل مرفوض",
    "en": "Complete – rejected"
   },
   {
    "ar": "لا تُستبعد",
    "en": "Not excluded"
   }
  ]
 ],
 "compare_title": {
  "ar": "مقارنة القائمة بسجل القواعد في العرض التجريبي (R1–R11)",
  "en": "How the list compares with the demo's rule register (R1–R11)"
 },
 "compare_head": {
  "ar": "الموضوع|ما تقوله القائمة|ما يفعله العرض التجريبي|التقييم",
  "en": "Topic|What the list says|What the demo does|Assessment"
 },
 "compare": [
  [
   {
    "ar": "شركة المياه الوطنية والشركات الخدمية",
    "en": "National Water Company and service companies"
   },
   {
    "ar": "تُصنَّف حالياً تحت «فواتير لا تستند إلى عقود» إلى حين فتح سبب مستقل.",
    "en": "Classified for now under \"Invoices not based on contracts\" until a separate reason is opened."
   },
   {
    "ar": "سبب مستقل R2 بتسمية مؤقتة «إيقاف التنفيذ – الشركات الخدمية»، يسبق R1.",
    "en": "A separate reason R2 with the working label \"Stay of execution – service companies\", ranked before R1."
   },
   {
    "ar": "اختلاف: العرض سبق القائمة. يُؤكَّد مع الأعمال.",
    "en": "Differs: the demo is ahead of the list. Confirm with the business."
   }
  ],
  [
   {
    "ar": "التعديات وإفادات الأمانات",
    "en": "Encroachments and Amanah statements"
   },
   {
    "ar": "سبب واحد (5) بقائمة منسدلة تحدد أحد السببين.",
    "en": "One reason (5) with a drop-down that selects one of the two causes."
   },
   {
    "ar": "سببان R8 وR9 يُحمَّلان بقالب الرفع نفسه.",
    "en": "Two reasons, R8 and R9, loaded through the same upload template."
   },
   {
    "ar": "متسق: القائمة المنسدلة تقابل السببين.",
    "en": "Consistent: the drop-down corresponds to the two reasons."
   }
  ],
  [
   {
    "ar": "صافي المفوتر",
    "en": "Net billed"
   },
   {
    "ar": "= إجمالي المفوتر − إجمالي الفواتير المستبعدة (دون ذكر الفواتير الملغاة).",
    "en": "= gross billed − total excluded invoices (cancelled invoices not mentioned)."
   },
   {
    "ar": "= إجمالي المفوتر − الاستبعادات − الفواتير الملغاة (DI-01).",
    "en": "= gross billed − exclusions − cancelled invoices (DI-01)."
   },
   {
    "ar": "اختلاف معروف: الملغاة خصم منفصل في العرض.",
    "en": "Known difference: cancelled invoices are a separate deduction in the demo."
   }
  ],
  [
   {
    "ar": "مفتاح الفاتورة",
    "en": "Invoice key"
   },
   {
    "ar": "البادئة 177 + رقم السداد.",
    "en": "The prefix 177 + the SADAD number."
   },
   {
    "ar": "معرّف المُفوتر + «-» + رقم السداد؛ 177 للوزارة، ولبعض الأمانات معرّفاتها الخاصة (انظر الملحق هـ).",
    "en": "Biller ID + \"-\" + SADAD number; 177 for the Ministry, and some Amanahs have biller IDs of their own (see Appendix E)."
   },
   {
    "ar": "متسق بعد توضيح الأعمال في 25 أكتوبر 2026؛ يبقى التحقق من النوع والطول والفرادة عند أول تحميل حقيقي (Q-B3).",
    "en": "Consistent after the business clarification of 25 October 2026; type, length and uniqueness are still to be verified on the first real load (Q-B3)."
   }
  ],
  [
   {
    "ar": "اعتراضات قائمة (السبب 7)",
    "en": "Open objections (reason 7)"
   },
   {
    "ar": "أربع حالات تُستبعد، و«مكتمل مرفوض» لا تُستبعد.",
    "en": "Four statuses are excluded; \"Complete – rejected\" is not."
   },
   {
    "ar": "R7 بالمعاملة نفسها.",
    "en": "R7 with the same treatment."
   },
   {
    "ar": "متسق. قائمة قيم الحالات في المصدر تحتاج تأكيداً.",
    "en": "Consistent. The list of status values in the source needs confirmation."
   }
  ],
  [
   {
    "ar": "متوفى في السجل المدني",
    "en": "Deceased in the civil registry"
   },
   {
    "ar": "مؤجل ومحذوف من النموذج الحالي.",
    "en": "Deferred and removed from the current model."
   },
   {
    "ar": "محذوف من القواعد ومن رادار المخاطر.",
    "en": "Removed from the rules and from the risk radar."
   },
   {
    "ar": "متسق.",
    "en": "Consistent."
   }
  ]
 ]
};
