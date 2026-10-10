# مرجعية إعادة هيكلة النظام: لوحات وتقارير + تخطيط مالي واستراتيجي (ملحق Delta)

- تاريخ البحث: 2026-10-09. المنهج: مصادر رسمية/أولية فقط. ما لم أتحقق منه من صفحة جرى فتحها مُوسَم "غير مؤكد".
- هذا الملف **ملحق** لا يكرر الملفين السابقين؛ يُرجع إليهما بدل إعادة سرد مصادرهما:
  - `docs/ai-dashboard-benchmark-ar.md` (Power BI Copilot وTableau Pulse وThoughtSpot وLooker وPigment Analyst Agent: القدرات الستة).
  - `docs/strategic-dashboard-benchmark-ar.md` (تقرير MoF الربعي Q4 2025 وسدايا وAdaa home وPower BI Goals وAnaplan Versions وOracle Target Variance).
- المجالان المستهدفان: (1) اللوحات والتقارير (متابعة، تقارير ثابتة، توليد تقارير حواري). (2) التخطيط المالي والاستراتيجي (خطط إيرادات ومصروفات، تنفيذ الميزانية، مستهدفات، تنبؤات، سيناريوهات، مبادرات وإجراءات).

## 1. المصادر التي وُصل إليها فعلاً وما لم يُوصل إليه

**سعودية وصلت (fetched):**
- MoF: Budget Statement FY2026 (PDF حُمّل نصه واستُخرج)، التقرير الربعي Q4 2025 (استُخرج نصه)، خبر IPSAS (2025-06-19)، خبر خدمات ميزانية اعتماد (2020-07-14).
- MoMAH: صفحة الميزانية والمصروفات على Balady (محدّثة 2026-10-08)، صفحة about-balady، صفحة جائزة تميّز الأداء البلدي (node/16309، node/15736)، منصة مؤشرات القطاع البلدي bi.momah.gov.sa (صفحة الدخول فقط)، المرصد الحضري hadary.momah.gov.sa (واجهة بلا بيانات، "تجريبي").
- Vision 2030: خطة تسليم برنامج الإسكان 2021-2025 (PDF رسمي 58 صفحة، نص كامل).
- Adaa الرئيسية (محتوى عام فقط).

**سعودية لم تصل أو جزئية:**
- Etimad: portal.etimad.sa يحوّل إلى تسجيل دخول، فلا وثائق منتج عامة؛ اعتمدت خبر MoF فقط. وثائق الدليل/الوحدات: غير مؤكد.
- مؤشر موحد باسم "مؤشر أداء البلديات": **لم أجد** صفحة رسمية تنشره. "مركز قياس الأداء البلدي" ورد في نتائج بحث من وسائل إعلام (ليست رسمية) فلا يُعتمد عليه. التقرير السنوي 2021 لمركز مراقبة المدن: مقتطف بحث فقط.
- دليل الحسابات الموحد (Unified Chart of Accounts) أو سياسة محاسبية رسمية بنصها: **غير مؤكد** (لم أجد صفحة رسمية منشورة).
- vision2030.gov.sa صفحات البرامج وKPI: 403 عبر الجلب المباشر؛ الـPDF جُلب بأداة أخرى.
- Adaa: لا منهجية KPI تفصيلية على الصفحة الرئيسية؛ ما ورد عن التقارير الربعية ومنصة إدخال القيم من مقتطفات صحفية فاستُبعد.

**دولية/منتجات:**
- وصلت: IMF Fiscal Transparency Code 2019 (PDF)، OECD Good Practices for Performance Budgeting (PDF)، World Bank BOOST Data Lab، Anaplan (Versions وVariance)، Pigment (Versions and Scenarios)، Oracle (Driver-Based Planning)، Power BI Copilot (create reports).
- لم تصل: oecd.org صفحات HTML (403)، legalinstruments.oecd.org (محتوى فارغ)، pefa.org (403، مقتطف بحث فقط)، IMF Fiscal Transparency Handbook وTNM 14/01 (مقتطفات بحث فقط).

## 2. مرجعيات التصميم والمنتج (ممارسة ← مصدر ← التطبيق على الوزارة/الأمانات)

### أ) الإدارة المالية العامة السعودية ومتابعة المصروفات

| الممارسة | المصدر والدليل | كيف تنطبق |
|---|---|---|
| الميزانية تُعد على الأساس النقدي وتُصنَّف وفق GFSM 2014 (IMF)؛ مصروفات حسب النوع الاقتصادي: تعويضات العاملين، استخدام السلع والخدمات، مصروفات التمويل، الإعانات، المنح، المنافع الاجتماعية، مصروفات أخرى، أصول غير مالية (CAPEX) | MoF Q4 2025 Report (القسم 01 والملحق 09 للتعريفات)؛ MoF Budget Statement FY2026 (المقدمة وجداول الإنفاق) | تصنيف المصروفات في النظام بأبواب اقتصادية بهذه المسميات الرسمية مع تعريف قابل للفتح، لا بتصنيف داخلي مبتكر. بقاء "باب" بمعنى chapter كمسمى عربي: **غير مؤكد** من النصوص الإنجليزية التي قرأتها |
| الفصل بين الاعتماد المعتمد (Appropriation) والمنصرف الفعلي في صفحة الوزارة نفسها: «الاعتماد بعد التعديل» مقابل «المنصرف» لكل سنة وبند | Balady: balady.gov.sa/ar/about-balady/budget-statistics (الصفحة لا تعرّف المصطلحين، وجدول الإنفاق فيه أخطاء تنسيق ظاهرة فتُراجع الأرقام قبل أي استخدام) | عمودان منفصلان دائماً: معتمد (بعد التعديل) ومنصرف. التسمية الرسمية متاحة للاستعارة |
| الالتزامات (Commitments) كطبقة بين الاعتماد والمنصرف | **غير مؤكد** في أي مصدر سعودي قرأته (تقرير MoF نقدي ولا يعرض الالتزامات). IMF 2019 يعرّف المتأخرات (Arrears) بأنها "unpaid and past the due date" | تُعرض طبقة الالتزام في النظام كحقل مُدخل/مستورد "مصدره غير محدد" حتى يؤكد مالك البيانات (اعتماد/نظام مالي). لا تُحسب من فواتير الإيراد |
| أساس الاستحقاق (Accrual) انتقال جارٍ بمعايير IPSAS؛ الميزانية نفسها نقدية | MoF news (2025-06-19): المملكة اعتمدت معايير IPSASB أساساً لقوائم مالية حكومية على أساس الاستحقاق؛ Q4 Report: الميزانية نقدية | ثلاث طبقات منفصلة بوسم واضح: معتمد، التزام/استحقاق، منصرف نقدي. لا خلط بينها ولا يُسمى أحدها "فعلي" مطلقاً |
| تقرير الأداء الربعي: ملخص (إيرادات/مصروفات/عجز) ثم السنة مقابل الميزانية، ثم الربع مقابل نفس الربع، ثم القطاعات كنسبة من الميزانية المعتمدة | MoF Q4 2025 Report (جداول "Budget approval of sectors and actual expenditure" بعمود "As % of total budget") | قالب تقرير ثابت للمصروفات: ميزانية، فعلي حتى الربع، نسبة الاستهلاك، تغير عن العام السابق |
| ثلاثة سيناريوهات إيراد للميزانية (مرتفع، أساس، منخفض) تُعرض ضمن قسم المخاطر المالية، والأساس هو المعتمد في الميزانية | MoF Budget Statement FY2026، "Key Fiscal Risks / Fiscal Risks and Management Mechanisms" | السيناريو يظل منفصلاً عن الخطة المعتمدة؛ يظهر في قسم مخاطر لا في أرقام الفعلي |
| نظام اعتماد: خدمات تخطيط وتنفيذ الميزانية بين الجهات والوزارة وتحويلات بين البنود والاستعلام | MoF news 2020-07-14 (Etimad Budget Services) | فصل "تحويل بين بنود" كإجراء له سجل وموافقة في وحدة التخطيط. تفاصيل الوحدات الأخرى: غير مؤكد |

### ب) لوحات القطاع البلدي

| الممارسة | الدليل | التطبيق |
|---|---|---|
| منصة مؤشرات القطاع البلدي: لوحات أداء وتحليلات مقارنة، بتسجيل دخول | bi.momah.gov.sa (وصف الصفحة فقط؛ لا مؤشرات ولا أوزان ظاهرة) | وجود منصة رسمية قائمة: النظام لا يدّعي أنه مصدر مؤشراتها؛ يبقى ربط محتمل مستقبلاً: غير مؤكد |
| المرصد الحضري الوطني: 15 قطاعاً، أكثر من 100 مؤشر، جدول "آخر فترة / الفترة السابقة / التغير / نسبة التغير"، تبويبات مؤشر/بيانات وصفية/بيانات إحصائية، مشاركة وتضمين | hadary.momah.gov.sa/AnalyticalIndicators (علامة "تجريبي"، لا بيانات محمّلة) | نمط جدول مؤشرات بأربعة أعمدة تغير + تبويب بيانات وصفية لكل مؤشر |
| جائزة تميّز الأداء البلدي للأمانات 2025: محاور مذكورة (كفاءة الخدمات، جودة البنية التحتية، الرقابة والامتثال، **الاستدامة المالية**، المشاركة المجتمعية، التحول الرقمي، إدارة الأزمات، التشوه البصري)؛ أوزان وطريقة التسجيل غير منشورة | momah.gov.sa/en/node/16309 | محور "الاستدامة المالية" مرجع لوجود بُعد مالي في تقييم الأمانات؛ لا نستورد ترتيباً ولا أوزاناً |
| وجود بوابة بيانات مفتوحة وإحصاءات في بلدي | balady.gov.sa/ar/about-balady (روابط فقط) | الأعمدة الرسمية المنشورة هي نقطة الربط المحتملة لأي بيانات تاريخية، بعد فحصها |

### ج) التخطيط الاستراتيجي والأداء

| الممارسة | الدليل | التطبيق |
|---|---|---|
| هرمية: هدف رؤية (مستوى 3) ← أهداف برنامج ← ركائز ← مبادرات؛ لكل مبادرة مالك، الأثر المتوقع، المخرجات النهائية، الربط بأهداف البرنامج؛ جداول مؤشرات بخط أساس ومستهدف للفترة | خطة تسليم برنامج الإسكان 2021-2025 (PDF رسمي): هدف 2.6.2، ركيزة "Beneficiary Affordability" فيها 6 مبادرات، خمس منها مملوكة لـMoMAH | سلسلة هدف ← مؤشر ← مبادرة ← مالك ← مخرجات، وتُربط المبادرة بمؤشر واحد على الأقل |
| الخطة نفسها تُظهر خط أساس (2019) ومستهدف 2021-2025 في جدول مستقل عن الفعلي | نفس الوثيقة، قسم 4.5 | خط أساس ومستهدف حقلان مخزَّنان ومعتمدان لا يُحسبان تلقائياً |
| جودة الحياة ضمن ميزانية 2026: برامج تحقيق الرؤية مذكورة ضمن سرد الميزانية (برنامج الإسكان، جودة الحياة) | MoF Budget Statement FY2026 | ربط المبادرة بالبرنامج كوسم، لا بميزانية افتراضية |
| Adaa: صفحة رسمية تقول إنها تقيس برامج تحقيق الرؤية والاستراتيجيات الوطنية وتصدر تقارير دورية للجهات | adaa.gov.sa | لا تفاصيل منهجية على الصفحة؛ مواعيد التقارير الربعية وحالات التقدم **غير مؤكدة** رسمياً |

### د) الممارسة الدولية الرسمية

| الممارسة | المصدر | التطبيق |
|---|---|---|
| أداء مع التنفيذ: معلومات الأداء تُقدَّم للمديرين مع بيانات تنفيذ الميزانية؛ تقارير التنفيذ تتضمن سرداً يشرح أسباب الانحراف؛ التقرير الختامي = النتيجة المالية + تقرير الأداء | OECD Good Practices for Performance Budgeting (PDF) | كل انحراف يحمل شرحاً مكتوباً من المسؤول، والتقرير الختامي يجمع المالي والمؤشرات |
| عدد محدود من المؤشرات لكل برنامج، واضحة، وقابلة للتتبع مقابل المستهدف | نفس الوثيقة (فقرة "small number") | حد أعلى معقول للمؤشرات لكل مبادرة |
| Budget deviation: الفرق بين المنفّذ والمعتمد، ونسبته من المعتمد؛ الاعتماد مقابل المنفّذ مع تصنيفات اقتصادية ووظيفية | World Bank BOOST Data Lab | انحراف مطلق + نسبي دائماً معاً |
| تقارير تنفيذ داخل السنة (شهرية/ربعية) وتعريف المتأخرات (غير مدفوع ومستحق) واحتياطيات الطوارئ بمعايير وصول وتقارير استخدام، وملخص دوري للمخاطر المالية المحددة | IMF Fiscal Transparency Code 2019: 1.2.1، 3.1.2، 3.2.1، وتعريف Expenditure arrears وIn-year fiscal reports | تقرير تنفيذ دوري، ومؤشر متأخرات منفصل، واحتياطي مع سجل استخدام |
| تتبع الالتزامات والمدفوعات والمتأخرات في نظام المحاسبة | IMF Code 2007 وPEFA PI-22/25/28 | مقتطفات بحث فقط؛ لم يُفتح النص، فلا اقتباس |

### هـ) المنتجات (إضافات جديدة فقط؛ القدرات الستة سبق تقريرها)

| الممارسة | المصدر (موثق) | ملاحظة |
|---|---|---|
| إنشاء صفحات تقرير من وصف نصي (Create/edit report pages) مع "Suggest content"، وإضافة/تغيير/حذف مرئيات، وتراجع/إعادة؛ لا تدعم المرئيات المخصصة ولا التنسيق؛ تتطلب تفعيل Q&A على النموذج الدلالي؛ لا تعمل على بث آني | Power BI Copilot create reports (learn.microsoft.com، محدّثة 2026-07-06) | توليد تقرير حواري يعمل فوق نموذج دلالي، ولا يبني تقريراً خارجه. تقريرنا يولّد من قوالب ويحتاج مراجعة بشرية |
| نسخ (Versions) للميزانيات والتوقعات والتقارير المتكررة؛ سيناريوهات (Scenarios) لمقارنات سريعة مختلفة؛ ويمكن الجمع (نسخة + سيناريو متفائل/متشائم) | Pigment: kb.pigment.com/docs/versions-scenarios | فصل النسخة المعتمدة عن السيناريو |
| Actual وForecast افتراضيان، وswitchover date لتوقع متجدد؛ تقرير تباين Variance وVariance % (Actual - Budget؛ والنسبة على Budget) | Anaplan Versions وVariance reports with versions | تعريف معادلة التباين وإشارتها صراحة في النظام |
| تخطيط مدفوع بالمحركات (Driver-based): فرضيات (نسب، أحجام، عدد موظفين)، أرقام الحسابات تُشتق منها، وتعديل يدوي، وفرضيات عامة تُتجاوز على مستوى الكيان | Oracle Driver-Based Planning (tutorial رسمي، بيانات عينة) | تعويضات العاملين = عدد × متوسط؛ فرضيات مكتوبة ومملوكة |
| Scenario/Version (Working/What If/Target) وPrepare Forecast | Oracle Planning (مقتطف بحث من docs.oracle.com؛ صفحة المقارنة جُلبت سابقاً) | مقتطف فقط لهذه الجزئية |

## 3. مرجعيات الأداء المالي

- **لم يُستخدم أي مرجع معتمد لأداء الوزارة أو الأمانات ولا أي مقارنة بين نظراء، ولم يُعتمد أي مستهدف إيراد أو مصروف.** أي مستهدف في النظام يبقى "مُدخلاً من صاحب القرار".
- أرقام رسمية شاهدتها (حقيقة خارجية، **لم تُعتمد**، ولا تُشتق منها مستهدفات):
  - ميزانية FY2026 (Budget Statement): إجمالي المصروفات 1,313 والإيرادات 1,147 مليار ريال؛ تعويضات العاملين 584، السلع والخدمات 247، الأصول غير المالية 162.
  - قطاع الخدمات البلدية في ميزانية FY2026: 72 مليار ريال، و308 جهات حكومية تابعة (نفس الوثيقة).
  - Q4 2025: ميزانية قطاع الخدمات البلدية 64,846 وفعلي 92,329 مليون (142% من الميزانية). الوثيقة نفسها تعزو الانخفاض عن 2024 إلى تعويضات نزع ملكية ذُكرت في العام السابق؛ هذه نسبة وطنية قطاعية لا تُقارن بالأمانات.
  - مستهدف برنامج الإسكان الرسمي: تملك 70% بحلول 2030 (خطة التسليم)، هدف برنامج وطني لا يخص تحصيل الأمانات.
  - تقليل المشاريع المتعثرة من 11% إلى 4.5% (Budget Statement، قطاع البلديات والإسكان): نتيجة ذكرتها الوثيقة، لا تُستخدم هدفاً.
- لم أفتح ملفات البيانات المفتوحة للإيرادات البلدية؛ فلا توجد هنا أي مقارنة تاريخية.

## 4. ممارسات مقترح اعتمادها

| الممارسة | الدليل |
|---|---|
| فصل الاعتماد (Appropriation) عن الالتزام عن الاستحقاق عن المنصرف النقدي؛ والالتزام يبقى "غير مؤكد المصدر" | Balady (الاعتماد بعد التعديل / المنصرف)؛ MoF Q4 (الأساس النقدي)؛ MoF news IPSAS؛ IMF Code 2019 (تعريف المتأخرات) |
| نسخ الخطة بمالكين وحالة وتاريخ: نسخة معتمدة مقفلة، مسودة، توقع متجدد، ونسخة عمل منفصلة عن "ماذا لو" | Pigment Versions and Scenarios؛ Anaplan Versions |
| سلسلة هدف ← مؤشر ← مبادرة ← مالك ← مخرج، مع خط أساس ومستهدف مخزَّنين | خطة تسليم برنامج الإسكان (vision2030.gov.sa/media/lfcfdvl0/2021-2025-housing-program-delivery-plan-en.pdf) |
| تحليل الانحراف مطلقاً ونسبياً مع شرح مكتوب من المسؤول، ومعادلة وإشارة معلنة | OECD Good Practices for Performance Budgeting؛ World Bank BOOST Data Lab؛ Anaplan Variance reports |
| فصل السيناريو عن الخطة المعتمدة؛ والسيناريوهات الثلاثة (مرتفع/أساس/منخفض) في قسم مخاطر | MoF Budget Statement FY2026 (Fiscal Risks)؛ Pigment Versions and Scenarios |
| التقرير الربعي الثابت: ملخص ثم ميزانية مقابل فعلي ثم نسبة الاستهلاك ثم المقارنة بالعام السابق | MoF Q4 2025 Report |
| تقارير بوسم "مُولَّد آلياً" ومراجعة بشرية قبل الاعتماد، والتوليد الحواري يعمل فوق نموذج دلالي معرَّف | Power BI Copilot create reports؛ سدايا (انظر الملف السابق) |
| مؤشر متأخرات/تجاوز اعتماد منفصل وسجل لتحويلات البنود | IMF Fiscal Transparency Code 2019؛ MoF news 2020-07-14 (تحويلات بين البنود) |

## 5. جدول المصادر

| المصدر | URL | تاريخ الوصول | الحالة |
|---|---|---|---|
| MoF Budget Statement FY2026 | https://www.mof.gov.sa/en/budget/2026/BudgetStatementDocs/Eng_2026.pdf | 2026-10-09 | fetched (PDF، نص مستخرج) |
| MoF Q4 2025 Performance Report | https://www.mof.gov.sa/en/financialreport/2025/Documents/Q4%202025-%20En.pdf | 2026-10-09 | fetched (PDF، نص مستخرج) |
| MoF IPSASB news (2025-06-19) | https://www.mof.gov.sa/en/MediaCenter/news/Pages/News_190620251.aspx | 2026-10-09 | fetched |
| MoF Etimad Budget Services (2020-07-14) | https://mof.gov.sa/en/MediaCenter/news/Pages/News_14072020_1.aspx | 2026-10-09 | fetched |
| Etimad portal | https://portal.etimad.sa/ | 2026-10-09 | not reachable (تحويل لتسجيل دخول) |
| MoMAH Balady budget & spending | https://balady.gov.sa/ar/about-balady/budget-statistics | 2026-10-09 | fetched |
| Balady about | https://www.balady.gov.sa/ar/about-balady | 2026-10-09 | fetched (روابط فقط) |
| منصة مؤشرات القطاع البلدي | https://bi.momah.gov.sa/ | 2026-10-09 | fetched (صفحة الدخول فقط) |
| المرصد الحضري (تجريبي) | https://hadary.momah.gov.sa/AnalyticalIndicators | 2026-10-09 | fetched (بلا بيانات) |
| جائزة تميّز الأداء البلدي 2025 | https://momah.gov.sa/en/node/16309 | 2026-10-09 | fetched |
| جائزة تميّز الأداء البلدي (الدورة الثانية) | https://momah.gov.sa/en/node/15736 | 2026-10-09 | fetched (لا محاور) |
| Housing Program Delivery Plan 2021-2025 | https://www.vision2030.gov.sa/media/lfcfdvl0/2021-2025-housing-program-delivery-plan-en.pdf | 2026-10-09 | fetched (PDF، نص مستخرج) |
| Vision 2030 Housing Program page | https://www.vision2030.gov.sa/en/explore/programs/housing-program | 2026-10-09 | not reachable (403)؛ search-excerpt-only |
| Adaa | https://www.adaa.gov.sa | 2026-10-09 | fetched (عام) |
| "مؤشر أداء البلديات" / مركز قياس الأداء البلدي | لا صفحة رسمية | 2026-10-09 | not reachable / غير مؤكد |
| IMF Fiscal Transparency Code 2019 | https://www.imf.org/external/np/fad/trans/Code2019.pdf | 2026-10-09 | fetched (PDF) |
| IMF Code 2007 / TNM 14/01 arrears | https://www.imf.org/external/pubs/ft/tnm/2014/tnm1403.pdf | 2026-10-09 | search-excerpt-only |
| OECD Good Practices for Performance Budgeting | https://www.oecd.org/content/dam/oecd/en/publications/reports/2019/05/oecd-good-practices-for-performance-budgeting_0a446f98/c90b0305-en.pdf | 2026-10-09 | fetched (PDF) |
| OECD Recommendation on Budgetary Governance | https://legalinstruments.oecd.org/en/instruments/OECD-LEGAL-0410 | 2026-10-09 | not reachable (محتوى غير مقروء)؛ search-excerpt-only |
| World Bank BOOST Data Lab | https://www.worldbank.org/en/programs/boost-portal/boost-data-lab | 2026-10-09 | fetched |
| PEFA 2016 Framework | https://www.pefa.org/sites/pefa/files/resources/downloads/PEFA_2016_Framework_Final_WEB_0.pdf | 2026-10-09 | not reachable (403)؛ search-excerpt-only |
| Power BI Copilot create reports | https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-reports | 2026-10-09 | fetched |
| Pigment Versions and Scenarios | https://kb.pigment.com/docs/versions-scenarios | 2026-10-09 | fetched |
| Anaplan Versions | https://help.anaplan.com/versions-19b4391f-5257-40ee-8dfb-36f0ab426c8f | 2026-10-09 | fetched |
| Anaplan Variance reports with versions | https://help.anaplan.com/variance-reports-with-versions-bd3ad610-2ea4-4bb2-aa87-d0fb0b73a475 | 2026-10-09 | fetched |
| Oracle Driver-Based Planning tutorial | https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/planning-tutorial-performing-driver-based/index.html | 2026-10-09 | fetched |
| Oracle Planning Financials tutorial (versions/scenarios, Prepare Forecast) | https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/planning-tutorials-calculating-actuals-and-preparing-plans-and-forecasts/index.html | 2026-10-09 | search-excerpt-only |
