# مقارنة معيارية (Benchmark) للوحات المالية وتحصيل الإيرادات المدعومة بالذكاء الاصطناعي

- تاريخ البحث: 2026-10-09
- المنهجية: المصادر الرسمية للموردين فقط (صفحات المنتجات، التوثيق الرسمي، ملاحظات الإصدار). لم تُستخدم مدونات أو ملخصات طرف ثالث.
- قاعدة التوثيق: كل قدرة تُسجَّل "confirmed" فقط إذا ذُكرت صراحة في صفحة رسمية جرى فتحها. غير ذلك يُسجَّل "not confirmed in the sources I read".
- تنبيه: عدة صفحات رسمية (Oracle وSAP وTableau وThoughtSpot الرئيسية) أعادت 403/404 عند الجلب المباشر؛ حيث اعتُمد على مقتطفات نتائج البحث من النطاق الرسمي نفسه ذُكر ذلك صراحة.

## 1. المنتجات التي جرى التحقق منها

### Microsoft Power BI Copilot
- المصادر: learn.microsoft.com (Copilot overview، Anomaly detection). تاريخ الوصول: 2026-10-09. آخر تحديث للصفحة: 2026-08.
- (1) أسئلة بلغة طبيعية: confirmed ("Chat with your data"، وتجيب من النموذج الدلالي semantic model).
- (2) ملخصات سردية: confirmed (تلخيص تقرير أو موضوع، وإضافة narrative visual، وملخصات ضمن الاشتراكات).
- (3) الشذوذ: confirmed في ميزة منفصلة (Anomaly detection على line chart فقط، مع تفسير بلغة طبيعية وعوامل مرتبطة).
- (4) التنبؤ: not confirmed (التوثيق يذكر فقط أن خطوط forecast لا تعمل مع الشذوذ).
- (5) الانتقال لسجلات: not confirmed (وثيقة الشذوذ تقول إن drill down في الهرمية غير مدعوم معها).
- (6) إجراءات موصى بها: not confirmed.
- قيود رسمية: يتطلب سعة Fabric مدفوعة F2 أو Premium P1؛ بعض التجارب (standalone, apps) في preview؛ السحابات السيادية غير مدعومة؛ اللغات غير الإنجليزية "غير مدعومة رسميا".

### Tableau Pulse (Tableau Agent)
- المصدر: help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm. الوصول: 2026-10-09. (صفحة المنتج tableau.com أعادت 403).
- (1) confirmed (Tableau Agent in Pulse: أسئلة بكلماتك وإجابات بلغة طبيعية).
- (2) confirmed (Insight Summaries بنموذج لغوي كبير LLM).
- (3) confirmed (Unexpected Values، Record-level Outliers، Trend Change Alert).
- (4) confirmed (Forecast و Pace to Goal، وكلاهما ضمن Tableau+).
- (5) not confirmed (الصفحة تذكر breakdown وTop Drivers/Detractors وليس الانتقال لسجلات).
- (6) not confirmed.
- أنواع insight مفيدة: Period Over Period Change، Concentrated Contribution Alert (عندما يشكل عدد قليل 50% فأكثر)، Goal and Threshold Breakdown.

### ThoughtSpot (Spotter, Liveboards, SpotIQ)
- المصادر: thoughtspot.com/product/spotter؛ docs.thoughtspot.com/cloud/26.9.0.cl/liveboard-ai-highlights و /spotiq-forecasting. الوصول: 2026-10-09.
- (1) confirmed (Spotter يترجم الأسئلة إلى search tokens فوق semantic layer محكوم، وليس text-to-SQL مباشرا).
- (2) confirmed (AI Highlights: ملخص بلغة طبيعية لتغير KPI مع change contributors).
- (3) confirmed (حدود توقع مبنية على anomaly detection؛ السلاسل الزمنية KPI فقط).
- (4) confirmed (تتطلب 15 نقطة على الأقل؛ و24 شهرا لالتقاط الموسمية السنوية).
- (5) confirmed بشكل جزئي: وثيقة التنبؤ تنص أنه لا drill-down على القيم المتنبأ بها؛ أما drill-down عموما فمن مقتطف بحث رسمي ولم تُجلب صفحته مباشرة.
- (6) confirmed (Spotter يوصي بإجراءات ويحولها لتذاكر Jira أو تحديث Salesforce أو رسائل Slack).

### Google Looker (Gemini / Conversational Analytics)
- المصدر: docs.cloud.google.com/looker/docs/conversational-analytics-overview. الوصول: 2026-10-09.
- (1) confirmed ("Query Explores in natural language"، data agents).
- (2) confirmed (Gemini "interpret and summarize results").
- (3) not confirmed، بل الصفحة تُدرج الكشف عن الشذوذ ضمن التحليل الإحصائي المتقدم غير المدعوم.
- (4) not confirmed، بل "Prediction and forecasting" مدرجة ضمن أنواع الأسئلة غير المدعومة.
- (5) not confirmed.
- (6) not confirmed (يوجد تنبيهات metric-based بلغة طبيعية ضمن agentic workflows، في preview).

### Microsoft Dynamics 365 Finance (Customer payment predictions)
- المصدر: learn.microsoft.com/dynamics365/finance/finance-insights/payment-insights-overview (محدّث 2026-06). الوصول: 2026-10-09.
- (1) not confirmed. (2) not confirmed في هذه الصفحة. (3) not confirmed.
- (4) confirmed جزئيا: نموذج تعلم آلي يتنبأ بموعد سداد كل فاتورة مفتوحة، مع عرض مجمّع للمدفوعات المتوقعة.
- (5) not confirmed (تعرض "top factors" وتاريخ سلوك العميل كسياق للتنبؤ).
- (6) confirmed: ثلاث احتمالات لكل فاتورة (في الوقت / متأخر / متأخر جدا)؛ ما دون 50% احتمال سداد في الوقت يوسم بدائرة حمراء لتدخل محصّل؛ التحصيل الاستباقي.
- متطلب: بيانات تاريخية للفواتير والمدفوعات والعملاء، ويُبنى فوق AI Builder.

### HighRadius (Collections Management)
- المصدر: highradius.com/product/collections-management-software/. الوصول: 2026-10-09.
- (1) confirmed جزئيا (مساعد FreedaGPT يولد تقارير ولوحات من "simple prompts").
- (2) not confirmed. (3) not confirmed. (5) not confirmed.
- (4) not confirmed كتنبؤ؛ الصفحة تذكر توقع التعثر المستقبلي (future delinquencies) ودرجة تحصيل Collections score لكل عميل.
- (6) confirmed (AI Prioritized Worklist يوزع العملاء على المحصّلين؛ Predict Late Payments).

### Oracle Fusion Cloud (EPM Predictive Cash Forecasting + Collectors Workspace)
- المصادر: docs.oracle.com/en/cloud/saas/readiness/epm/2026/epm-apr26/26apr-epm-wn-f44233.htm؛ docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/caerp/cash_ml_based_forecasting_methods.html؛ مقتطفات بحث من oracle.com (صفحات oracle.com أعادت 403). الوصول: 2026-10-09.
- (4) confirmed: تكامل التنبؤ بالنقد مع Cloud ERP متاح عموما (GA) وفق ملاحظة أبريل 2026. لكن دليل الإدارة يقول إن ML "will be supported in a future update"، فحالة ML متضاربة بين المصدرين.
- (5) confirmed: drill-through من التنبؤ إلى Analytical Views ثم الحركات التفصيلية للذمم.
- (6) مقتطفات بحث فقط (غير مؤكد بجلب مباشر): Collectors Workspace يرتب الحسابات المتأخرة ويقترح next-best actions.
- (1) و(2) و(3): not confirmed.
- متطلب منشور: 18 شهرا على الأقل من حركات الذمم لتدريب النموذج.

### SAP S/4HANA Cloud Receivables / Collections and Dispute Automation (+ Joule)
- المصادر: help.sap.com و learning.sap.com و sap.com/use-cases/joule-assistant/accounts-receivable-ai. الوصول: 2026-10-09. تعذّر جلب الصفحات مباشرة (404/403/صفحة فارغة)؛ المعلومات من مقتطفات بحث فقط.
- من المقتطفات: قائمة عمل التحصيل (Collections Worklist) تُرتب أكثر العملاء إلحاحا حسب استراتيجية التحصيل؛ Joule يستطيع طلب worklist لمحصّل محدد؛ بطاقات تحليلية للنزاعات المفتوحة.
- كل القدرات الست: not confirmed في المصادر التي قرأتها كاملة (التحقق غير مكتمل).

## 2. لم يُتحقق منه
- Anaplan: لم يُبحث ولم يُجلب أي مصدر رسمي.
- Pigment: صفحة pigment.com/ai/analyst-agent جُلبت: تؤكد أسئلة بلغة طبيعية، وسرد تفسيرات الانحراف (variance)، وتنبيهات الشذوذ، وdrill-downs آلية؛ التنبؤ وإجراءات التحصيل not confirmed. المنتج مخصص لتخطيط FP&A وليس للتحصيل.

## 3. مصفوفة المقارنة

| المنتج | 1 أسئلة بلغة طبيعية | 2 ملخصات سردية | 3 شذوذ | 4 تنبؤ | 5 drill-down | 6 إجراءات/أولويات |
|---|---|---|---|---|---|---|
| Power BI Copilot | confirmed | confirmed | confirmed (ميزة منفصلة) | not confirmed | not confirmed | not confirmed |
| Tableau Pulse | confirmed | confirmed | confirmed | confirmed (Tableau+) | not confirmed | not confirmed |
| ThoughtSpot | confirmed | confirmed | confirmed | confirmed | confirmed (جزئي، ليس على التنبؤ) | confirmed |
| Looker | confirmed | confirmed | not confirmed (مدرج كغير مدعوم) | not confirmed (غير مدعوم) | not confirmed | not confirmed |
| Dynamics 365 Finance | not confirmed | not confirmed | not confirmed | confirmed (موعد السداد) | not confirmed | confirmed |
| HighRadius | confirmed (جزئي) | not confirmed | not confirmed | not confirmed | not confirmed | confirmed |
| Oracle Fusion | not confirmed | not confirmed | not confirmed | confirmed (حالة ML متضاربة) | confirmed | مقتطفات بحث فقط |
| SAP Receivables | not confirmed | not confirmed | not confirmed | not confirmed | not confirmed | not confirmed (مقتطفات فقط) |
| Pigment | confirmed | confirmed | confirmed | not confirmed | confirmed | not confirmed |

## 4. الميزات المختارة لنظامنا
السياق: لوحة ذكاء فواتير وتحصيل إيرادات بلدية لوزارة؛ بيانات تجريبية synthetic؛ تحليلات قائمة على قواعد؛ لا يتوفر نموذج لغوي LLM.

### قابلة للتنفيذ الآن بالبيانات الحالية
- قائمة عمل تحصيل مُرتَّبة بدرجة أولوية (قاعدية): مبلغ × عمر الدين × علامات خطر/نزاع. القيمة: يعرف المحصّل بمن يبدأ (مماثل لـ AI Prioritized Worklist وقائمة SAP وتحصيل D365).
- إنذار مبكر قبل الاستحقاق: وسم الفواتير ذات المؤشرات الخطرة كبديل قاعدي عن احتمال السداد، مع عرض "العوامل الرئيسية" للدرجة كما تفعل D365 (top factors).
- كشف الشذوذ الإحصائي: نطاق متوقع بالوسيط المتحرك أو z-score على السلاسل الزمنية، وقيم متطرفة على مستوى السجل (Unexpected Values وRecord-level Outliers في Pulse). القيمة: التقاط قفزات أو هبوط غير معتاد.
- ملخصات سردية مولدة بقوالب: "ماذا تغير" مع أكبر المساهمين والمعاكسين (Top Drivers/Detractors) وتنبيه تركّز الإسهام عند 50% فأكثر.
- التغير مقارنة بالفترة السابقة وتقدم نحو الهدف (Period over Period, Goal and Threshold) مع إسقاط خطي بسيط لـ "pace to goal" وبدون ادعاء تنبؤ إحصائي.
- الانتقال من المؤشر أو الشذوذ إلى الفواتير المكوّنة (drill-through كما في Oracle وThoughtSpot). القيمة: كل رقم قابل للتتبع إلى سجلاته.
- بحث/أسئلة موجّهة بقوالب ومحوّل نوايا (intent router) فوق طبقة مقاييس موحدة، على غرار فكرة ThoughtSpot بالأسئلة المترجمة إلى tokens فوق semantic layer، بلا نموذج لغوي.

### تحتاج بيانات مستقبلية أو تكاملات
- التنبؤ باحتمال السداد بالتعلم الآلي: يحتاج تاريخ فواتير ومدفوعات لكل مكلّف (D365 يعتمد على بيانات تاريخية؛ Oracle يوصي بـ18 شهرا).
- التنبؤ بالتدفق النقدي: يحتاج سجلا طويلا (ThoughtSpot: 15 نقطة كحد أدنى و24 شهرا للموسمية؛ Oracle: 18 شهرا).
- أسئلة حرة بلغة طبيعية وملخصات يكتبها نموذج لغوي (Power BI Copilot، Tableau Agent، Looker): تحتاج خدمة نموذج لغوي وحوكمة بيانات.
- تنبيهات بلغة طبيعية وإجراءات مؤتمتة (Jira/Slack في Spotter؛ agentic workflows في Looker): تحتاج تكاملات وصلاحيات.
- ربط مباشر بمصادر حية (مثل مطابقة Makin وTahseel) لتحويل التوصيات إلى مهام فعلية.

## 5. جدول المصادر

| المنتج | الرابط | تاريخ الوصول |
|---|---|---|
| Power BI Copilot | https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-introduction | 2026-10-09 |
| Power BI Anomaly detection | https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-anomaly-detection | 2026-10-09 |
| Tableau Pulse insight types | https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm | 2026-10-09 |
| ThoughtSpot Spotter | https://www.thoughtspot.com/product/spotter | 2026-10-09 |
| ThoughtSpot AI Highlights | https://docs.thoughtspot.com/cloud/26.9.0.cl/liveboard-ai-highlights | 2026-10-09 |
| ThoughtSpot Forecasting | https://docs.thoughtspot.com/cloud/26.9.0.cl/spotiq-forecasting | 2026-10-09 |
| Looker Conversational Analytics | https://docs.cloud.google.com/looker/docs/conversational-analytics-overview | 2026-10-09 |
| Dynamics 365 Finance payment predictions | https://learn.microsoft.com/en-us/dynamics365/finance/finance-insights/payment-insights-overview | 2026-10-09 |
| HighRadius Collections | https://www.highradius.com/product/collections-management-software/ | 2026-10-09 |
| Oracle EPM Predictive Cash Forecasting (GA) | https://docs.oracle.com/en/cloud/saas/readiness/epm/2026/epm-apr26/26apr-epm-wn-f44233.htm | 2026-10-09 |
| Oracle ML forecasting methods | https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/caerp/cash_ml_based_forecasting_methods.html | 2026-10-09 |
| Oracle Financial Management (403، مقتطف بحث فقط) | https://www.oracle.com/erp/financial-management/ | 2026-10-09 |
| SAP AR AI assistants (403، مقتطف بحث فقط) | https://www.sap.com/use-cases/joule-assistant/accounts-receivable-ai | 2026-10-09 |
| Pigment Analyst Agent | https://www.pigment.com/ai/analyst-agent | 2026-10-09 |

## 6. ما نُفِّذ فعلاً في النظام (مقابل ما يحتاج بيانات أو تكاملات)

| الميزة المقتبسة | الحالة | أين |
|---|---|---|
| ملخص سردي مبني على القواعد لتغير المؤشر مع الأرقام الداعمة وأساس المقارنة | **منفَّذ** | مركز التقارير ← الملخص التنفيذي (`src/data/insightsEngine.js`) |
| تغير فترة مقابل فترة مكافئة (Period Over Period) | **منفَّذ** | رؤية «نسبة التحصيل مقابل العام السابق»؛ تقيس كل فترة عند نهايتها |
| رصد القيم الشاذة إحصائياً (z-score مرجَّح بالصافي) | **منفَّذ** | رؤية «نسبة تحصيل منخفضة بشكل غير معتاد» |
| تنبيه التركّز (Concentrated Contribution) | **منفَّذ جزئياً** | رؤية تقادم الرصيد وجدول أكبر الأرصدة |
| الانتقال من الرؤية إلى السجلات (Drill-through) | **منفَّذ** | كل رؤية تحمل رابطاً إلى الفواتير بالمرشحات نفسها |
| قائمة متابعة مرتبة بالأولوية وفرص التحصيل | **منفَّذ** | تقرير فجوات التحصيل + قائمة التحصيل |
| أسئلة بلغة طبيعية على طبقة المقاييس المشتركة | **منفَّذ (موجّه قواعد وليس نموذجاً لغوياً)** | المساعد؛ أسئلة مقترحة من مركز التقارير تفتحه مباشرة |
| تنبؤ (Forecast) | **منفَّذ بشرط كفاية التاريخ** | يظهر فقط عند نجاح اختبار الاستقرار؛ موسوم «تقدير» مع افتراضاته |
| توقع احتمال السداد لكل دافع (Payment predictions) | **يحتاج بيانات** | تاريخ سداد الدافع غير متوفر |
| تنبؤ تدفق نقدي طويل (≥ 18–24 شهراً) | **يحتاج بيانات** | تاريخ الديمو أقصر |
| أسئلة حرة وسرد بنموذج لغوي، تنبيهات بلغة طبيعية | **يحتاج خدمة نموذج لغوي** | غير متاح؛ لا يُدّعى |
| تذاكر/رسائل تلقائية (Jira/Slack) وربط حي بتحصيل ومكين | **يحتاج تكاملات** | غير متاح |
