import React, { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, TREND } from '../data/mock';
import { buildReportData, computeRecoveryTrend } from '../data/reportAnalytics';
import { exportReportToDocx, exportReportToXlsx, exportReportToPptx } from '../utils/exportReport';
import AgentThinking from '../components/ai/AgentThinking';
import { useTheme } from '../context/ThemeContext';
import { chartColor, chartLegend, chartTooltip, getChartTheme } from '../utils/chartTheme';
import AIContentLabel from '../components/ai/AIContentLabel';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend);

const FOCUS_OPTIONS = ['revenue', 'province', 'enforcement', 'investment'];

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

function provinceName(p, lang) {
  return lang === 'ar' ? p.nameAr : p.nameEn;
}

function gfsName(entry, lang) {
  if (!entry) return '';
  return lang === 'zh' ? entry.name : lang === 'ar' ? entry.nameAr : entry.nameEn;
}

// Builds the fully render-ready, localized report object consumed by both
// the on-screen view and the three export functions — one source of truth
// so the exported files can never drift from what's shown on screen.
function useSmartReport(t, lang, focus) {
  return useMemo(() => {
    const data = buildReportData();
    const { kpi, exclusions, byProvince, worklist, worstProvince, bestProvince, biggestGapProvince, sameProvince, flaggedNoContract, sanad } = data;
    const sanadUnlinkedPct = sanad.ordersIssued ? Math.round((sanad.ordersUnlinked / sanad.ordersIssued) * 100) : 0;

    const worstName = provinceName(worstProvince, lang);
    const bestName = provinceName(bestProvince, lang);
    const gapName = provinceName(biggestGapProvince, lang);

    // Overall dominant GFS revenue category across every province combined.
    const revenueTotals = new Map();
    for (const p of byProvince) {
      for (const r of p.revenue) {
        const e = revenueTotals.get(r.code) || { ...r, value: 0 };
        e.value += r.value;
        revenueTotals.set(r.code, e);
      }
    }
    const dominantOverall = [...revenueTotals.values()].sort((a, b) => b.value - a.value)[0];
    const dominantPct = dominantOverall ? Math.round((dominantOverall.value / kpi.gross) * 100) : 0;

    const biggestExclusionKey = Object.entries(exclusions).sort((a, b) => b[1].value - a[1].value)[0];
    const exclusionLabelMap = {
      duplicate: pick(lang, 'Duplicate invoices', 'الفواتير المكررة', '重复账单'),
      appeal: pick(lang, 'Invoices under appeal/dispute', 'الفواتير قيد الاعتراض/النزاع', '争议中的账单'),
      invalid_debtor: pick(lang, 'Struck-off registry / deceased debtor invoices', 'فواتير السجل الملغى أو المدين المتوفى', '注销登记/债务人已故账单'),
      enforcement: pick(lang, 'Invoices referred to enforcement', 'الفواتير المُحالة للتنفيذ', '已转执行的账单')
    };

    const trend = computeRecoveryTrend(TREND.recovery);

    const title = pick(lang, 'Smart Report', 'التقرير الذكي', '智能报告');
    const subtitleMap = {
      revenue: pick(lang, 'Revenue & Collection Performance', 'أداء الإيرادات والتحصيل', '收入与收缴绩效'),
      province: pick(lang, 'Province Comparison', 'مقارنة المناطق', '省份对比'),
      enforcement: pick(lang, 'Enforcement & Compliance', 'التنفيذ والامتثال', '执行与合规'),
      investment: pick(lang, 'Investment Contract Linkage', 'ربط العقود الاستثمارية', '投资合同关联')
    };
    const generatedOn = `${pick(lang, 'Generated', 'تاريخ الإنشاء', '生成时间')}: ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US')}`;

    const executiveSummary = pick(
      lang,
      `This report covers ${kpi.invoiceCount} invoices totaling ${fmtMoney(kpi.gross)} SAR gross invoiced, of which ${fmtMoney(kpi.netInvoiced)} SAR is net of exclusions. The overall collection rate is ${kpi.collectionRate}%, with ${fmtMoney(kpi.collectedValue)} SAR collected and ${fmtMoney(kpi.uncollectedValue)} SAR still outstanding. ${worstName} shows the weakest collection performance at ${worstProvince.rate}%, while ${bestName} leads at ${bestProvince.rate}%.`,
      `يغطي هذا التقرير ${kpi.invoiceCount} فاتورة بإجمالي ${fmtMoney(kpi.gross)} ريال، منها ${fmtMoney(kpi.netInvoiced)} ريال صافي بعد الاستبعادات. يبلغ معدل التحصيل الإجمالي ${kpi.collectionRate}%، حيث تم تحصيل ${fmtMoney(kpi.collectedValue)} ريال وما يزال ${fmtMoney(kpi.uncollectedValue)} ريال غير محصَّل. تُظهر ${worstName} أضعف أداء تحصيل بنسبة ${worstProvince.rate}%، بينما تتصدر ${bestName} بنسبة ${bestProvince.rate}%.`,
      `本报告涵盖 ${kpi.invoiceCount} 张发票，总开票额 ${fmtMoney(kpi.gross)} 里亚尔，其中净开票额（扣除排除项后）为 ${fmtMoney(kpi.netInvoiced)} 里亚尔。总体收缴率为 ${kpi.collectionRate}%，已收缴 ${fmtMoney(kpi.collectedValue)} 里亚尔，仍有 ${fmtMoney(kpi.uncollectedValue)} 里亚尔未收缴。${worstName} 的收缴表现最弱，收缴率仅 ${worstProvince.rate}%，而 ${bestName} 表现最佳，达到 ${bestProvince.rate}%。`
    );

    const keyMetrics = [
      {
        label: pick(lang, 'Net Invoiced', 'صافي الفوترة', '净开票额'),
        value: `${fmtMoney(kpi.netInvoiced)} SAR`,
        caption: pick(lang, 'Total invoiced value after removing duplicate, disputed, invalid-debtor, and enforcement-referred invoices.', 'إجمالي قيمة الفوترة بعد استبعاد الفواتير المكررة والمتنازع عليها وباطلة المدين والمُحالة للتنفيذ.', '扣除重复、争议、无效债务人及已转执行账单后的开票总额。')
      },
      {
        label: pick(lang, 'Collected', 'المحصَّل', '已收缴'),
        value: `${fmtMoney(kpi.collectedValue)} SAR`,
        caption: pick(lang, 'Amount successfully collected against net-invoiced value.', 'المبلغ المحصَّل فعليًا من صافي الفوترة.', '已从净开票额中实际收缴的金额。')
      },
      {
        label: pick(lang, 'Collection Rate', 'معدل التحصيل', '收缴率'),
        value: `${kpi.collectionRate}%`,
        caption: pick(lang, 'Collected ÷ Net Invoiced — the core efficiency measure for revenue collection.', 'المحصَّل ÷ صافي الفوترة — المقياس الأساسي لكفاءة التحصيل.', '已收缴 ÷ 净开票额——衡量收缴效率的核心指标。')
      },
      {
        label: pick(lang, 'Uncollected', 'غير محصَّل', '未收缴'),
        value: `${fmtMoney(kpi.uncollectedValue)} SAR`,
        caption: pick(lang, 'Still outstanding within net-invoiced scope; needs active follow-up.', 'ما يزال مستحقًا ضمن نطاق صافي الفوترة، ويتطلب متابعة فعلية.', '仍在净开票范围内未收缴，需要主动跟进。')
      },
      {
        label: pick(lang, 'Excluded', 'المبلغ المستبعد', '已排除金额'),
        value: `${fmtMoney(kpi.excludedValue)} SAR`,
        caption: pick(lang, 'Removed from the collection-rate denominator; tracked separately since it should never count as collectible.', 'مستبعد من مقام معدل التحصيل، ويُتابع بشكل منفصل لأنه لا يجب اعتباره قابلاً للتحصيل.', '已从收缴率分母中排除，单独跟踪，因其本不应被视为可收缴金额。')
      }
    ];

    const detailedAnalysisIntro = pick(
      lang,
      `Performance varies significantly by province. ${worstName} sits well below the 70% target, while ${bestName} exceeds it. The gap between best and worst is ${bestProvince.rate - worstProvince.rate} percentage points.`,
      `يتفاوت الأداء بشكل كبير بين المناطق. تقع ${worstName} دون المستهدف البالغ 70% بفارق كبير، بينما تتجاوزه ${bestName}. الفارق بين الأفضل والأسوأ ${bestProvince.rate - worstProvince.rate} نقطة مئوية.`,
      `各省份表现差异显著。${worstName} 远低于70%的目标，而 ${bestName} 已超过该目标。最佳与最差之间相差 ${bestProvince.rate - worstProvince.rate} 个百分点。`
    );

    const sortedProvinces = byProvince.slice().sort((a, b) => b.gross - a.gross);

    const analysisTable = {
      headers: [
        pick(lang, 'Province', 'المنطقة', '省份'),
        pick(lang, 'Invoices', 'الفواتير', '发票数'),
        pick(lang, 'Gross (SAR)', 'الإجمالي (ريال)', '总开票额（里亚尔）'),
        pick(lang, 'Collected (SAR)', 'المحصَّل (ريال)', '已收缴（里亚尔）'),
        pick(lang, 'Uncollected (SAR)', 'غير المحصَّل (ريال)', '未收缴（里亚尔）'),
        pick(lang, 'Rate', 'المعدل', '收缴率')
      ],
      rows: sortedProvinces.map((p) => [provinceName(p, lang), p.count, fmtMoney(p.gross), fmtMoney(p.collected), fmtMoney(p.uncollected), `${p.rate}%`]),
      rateByRow: sortedProvinces.map((p) => p.rate)
    };

    // Chart series — every number here is read straight from the same `data`
    // (buildReportData) used for the text sections above, so a chart can never
    // show a different figure than the sentence next to it.
    const revenueMixSorted = [...revenueTotals.values()].sort((a, b) => b.value - a.value);
    const trendLangIdx = lang === 'ar' ? 'labelsAr' : lang === 'zh' ? 'labels' : 'labelsEn';
    const investmentLinkedCount = data.investmentInvoices.length - flaggedNoContract.length;
    const sanadLinkedPct = sanad.ordersIssued ? Math.round(((sanad.ordersIssued - sanad.ordersUnlinked) / sanad.ordersIssued) * 100) : 0;

    const charts = {
      composition: {
        labels: [
          pick(lang, 'Collected', 'المحصَّل', '已收缴'),
          pick(lang, 'Uncollected', 'غير محصَّل', '未收缴'),
          pick(lang, 'Excluded', 'مستبعد', '已排除')
        ],
        values: [kpi.collectedValue, kpi.uncollectedValue, kpi.excludedValue],
        pct: [
          kpi.gross ? Math.round((kpi.collectedValue / kpi.gross) * 100) : 0,
          kpi.gross ? Math.round((kpi.uncollectedValue / kpi.gross) * 100) : 0,
          kpi.gross ? Math.round((kpi.excludedValue / kpi.gross) * 100) : 0
        ]
      },
      provinceBar: {
        labels: sortedProvinces.map((p) => provinceName(p, lang)),
        gross: sortedProvinces.map((p) => p.gross),
        collected: sortedProvinces.map((p) => p.collected),
        rate: sortedProvinces.map((p) => p.rate)
      },
      revenueMix: {
        labels: revenueMixSorted.map((r) => gfsName(r, lang)),
        values: revenueMixSorted.map((r) => r.value),
        pct: revenueMixSorted.map((r) => (kpi.gross ? Math.round((r.value / kpi.gross) * 100) : 0))
      },
      enforcementBar: {
        labels: sortedProvinces.map((p) => provinceName(p, lang)),
        violations: sortedProvinces.map((p) => p.violationCount),
        enforcement: sortedProvinces.map((p) => p.enforcementCount)
      },
      sanadLinkage: {
        linkedPct: sanadLinkedPct,
        unlinkedPct: 100 - sanadLinkedPct,
        ordersIssued: sanad.ordersIssued,
        ordersUnlinked: sanad.ordersUnlinked,
        unlinkedValue: sanad.ordersUnlinkedValue
      },
      investment: {
        labels: [
          pick(lang, 'Linked to Furas contract', 'مرتبطة بعقد فرص', '已关联Furas合同'),
          pick(lang, 'No linked contract', 'بلا عقد مرتبط', '未关联合同')
        ],
        values: [investmentLinkedCount, flaggedNoContract.length],
        total: data.investmentInvoices.length
      },
      trend: {
        labels: [...TREND[trendLangIdx], pick(lang, 'Next (est.)', 'القادم (تقديري)', '下期（预计）')],
        actual: [...TREND.recovery, null],
        forecast: [...TREND.recovery.map(() => null).slice(0, -1), TREND.recovery[TREND.recovery.length - 1], trend.nextValue]
      }
    };

    const discoveries = [
      sameProvince
        ? pick(
            lang,
            `${worstName} is simultaneously the biggest recovery opportunity and the worst-performing province — the risk is concentrated in one place, not spread across the map.`,
            `تُعد ${worstName} في آن واحد أكبر فرصة للتحصيل وأضعف منطقة أداءً — أي أن الخطر متركّز في مكان واحد وليس موزَّعًا.`,
            `${worstName} 同时是最大的追缴机会和表现最差的省份——风险集中在一处，而非分散各地。`
          )
        : pick(
            lang,
            `The biggest recovery opportunity (${gapName}) and the worst-performing province (${worstName}) are not the same place — they need different responses.`,
            `أكبر فرصة تحصيل (${gapName}) وأضعف منطقة أداءً (${worstName}) ليستا نفس المكان — وهو ما يتطلب استجابتين مختلفتين.`,
            `最大追缴机会所在地（${gapName}）与表现最差的省份（${worstName}）并非同一地点——需要采取不同的应对措施。`
          ),
      dominantOverall
        ? pick(
            lang,
            `${gfsName(dominantOverall, lang)} is the single largest revenue source, accounting for ${dominantPct}% of gross invoiced value across all provinces.`,
            `يُعد "${gfsName(dominantOverall, lang)}" أكبر مصدر إيراد منفرد، ويمثل ${dominantPct}% من إجمالي قيمة الفوترة عبر جميع المناطق.`,
            `"${gfsName(dominantOverall, lang)}" 是最大的单一收入来源，占所有省份开票总额的 ${dominantPct}%。`
          )
        : '',
      pick(
        lang,
        `Of the ${fmtMoney(sanad.ordersIssued)} enforcement orders in the sample dataset that were actually issued, ${sanadUnlinkedPct}% carry no linked invoice number (SAR ${fmtMoney(sanad.ordersUnlinkedValue)}) — illustrating a linkage gap that persists even after enforcement has already started.`,
        `من أصل ${fmtMoney(sanad.ordersIssued)} أمر تنفيذ صادر فعليًا في مجموعة البيانات النموذجية، ${sanadUnlinkedPct}% منها بلا رقم فاتورة مرتبط (${fmtMoney(sanad.ordersUnlinkedValue)} ريال) — ما يوضّح استمرار فجوة الربط حتى بعد بدء التنفيذ.`,
        `在示例数据集中已实际签发的 ${fmtMoney(sanad.ordersIssued)} 份执行令中，${sanadUnlinkedPct}% 未关联任何发票编号（合计 ${fmtMoney(sanad.ordersUnlinkedValue)} 里亚尔）——说明即使执行已经开始，关联缺口依然存在。`
      ),
      flaggedNoContract.length
        ? pick(
            lang,
            `${flaggedNoContract.length} investment invoice(s) totaling ${fmtMoney(flaggedNoContract.reduce((s, i) => s + i.amount, 0))} SAR have no linked Furas contract, creating an audit exposure.`,
            `توجد ${flaggedNoContract.length} فاتورة استثمارية بإجمالي ${fmtMoney(flaggedNoContract.reduce((s, i) => s + i.amount, 0))} ريال بلا عقد فرص مرتبط، مما يشكّل تعرّضًا رقابيًا.`,
            `有 ${flaggedNoContract.length} 张投资类发票（合计 ${fmtMoney(flaggedNoContract.reduce((s, i) => s + i.amount, 0))} 里亚尔）未关联任何 Furas 合同，存在审计风险。`
          )
        : '',
      biggestExclusionKey
        ? pick(
            lang,
            `"${exclusionLabelMap[biggestExclusionKey[0]]}" is the largest exclusion category by value (${fmtMoney(biggestExclusionKey[1].value)} SAR) — worth reviewing whether this category's growth is accelerating.`,
            `تُعد فئة "${exclusionLabelMap[biggestExclusionKey[0]]}" الأكبر قيمةً بين فئات الاستبعاد (${fmtMoney(biggestExclusionKey[1].value)} ريال) — ويستحق الأمر مراجعة ما إذا كانت هذه الفئة في تسارع.`,
            `"${exclusionLabelMap[biggestExclusionKey[0]]}" 是排除类别中金额最大的一项（${fmtMoney(biggestExclusionKey[1].value)} 里亚尔）——值得关注该类别是否正在加速增长。`
          )
        : ''
    ].filter(Boolean);

    const risks = [
      {
        priority: pick(lang, worstProvince.rate < 40 ? 'Critical' : 'High', worstProvince.rate < 40 ? 'حرجة' : 'عالية', worstProvince.rate < 40 ? '严重' : '高'),
        title: pick(lang, `${worstName} — collection rate at ${worstProvince.rate}%`, `${worstName} — معدل التحصيل ${worstProvince.rate}%`, `${worstName} — 收缴率仅 ${worstProvince.rate}%`),
        rationale: pick(
          lang,
          `The lowest collection rate among ${byProvince.length} provinces with data, with ${fmtMoney(worstProvince.uncollected)} SAR still outstanding.`,
          `أدنى معدل تحصيل بين ${byProvince.length} مناطق تملك بيانات، مع ${fmtMoney(worstProvince.uncollected)} ريال ما يزال غير محصَّل.`,
          `在 ${byProvince.length} 个有数据的省份中收缴率最低，仍有 ${fmtMoney(worstProvince.uncollected)} 里亚尔未收缴。`
        )
      },
      {
        priority: pick(lang, 'High', 'عالية', '高'),
        title: pick(lang, 'Sanad invoice-linkage gap', 'فجوة ربط فواتير سند', 'Sanad 发票关联缺口'),
        rationale: pick(
          lang,
          `SAR ${fmtMoney(sanad.ordersUnlinkedValue)} in issued enforcement orders cannot currently be traced to a source invoice.`,
          `${fmtMoney(sanad.ordersUnlinkedValue)} ريال من أوامر التنفيذ الصادرة لا يمكن حاليًا تتبعها لفاتورة أصلية.`,
          `已签发的执行令中有 ${fmtMoney(sanad.ordersUnlinkedValue)} 里亚尔目前无法追溯至原始发票。`
        )
      },
      ...(flaggedNoContract.length
        ? [{
            priority: pick(lang, 'Medium', 'متوسطة', '中'),
            title: pick(lang, `${flaggedNoContract[0].id} — unlinked investment contract`, `${flaggedNoContract[0].id} — عقد استثماري غير مرتبط`, `${flaggedNoContract[0].id} — 未关联投资合同`),
            rationale: pick(
              lang,
              `${fmtMoney(flaggedNoContract[0].amount)} SAR invoiced with no linked Furas contract on record.`,
              `فاتورة بقيمة ${fmtMoney(flaggedNoContract[0].amount)} ريال دون عقد فرص مسجَّل مرتبط بها.`,
              `已开票 ${fmtMoney(flaggedNoContract[0].amount)} 里亚尔，但没有登记关联的 Furas 合同。`
            )
          }]
        : [])
    ];

    const predictions = [
      {
        prediction: pick(
          lang,
          `If the ministry-wide recovery-rate trend of the last 8 months continues, next month's rate is estimated around ${trend.nextValue}% (currently ${trend.lastValue}%).`,
          `إذا استمر اتجاه معدل التحصيل على مستوى الوزارة خلال الأشهر الثمانية الماضية، يُقدَّر معدل الشهر القادم بنحو ${trend.nextValue}% (حاليًا ${trend.lastValue}%).`,
          `若过去8个月部级回收率趋势延续，下月收缴率预计约为 ${trend.nextValue}%（当前为 ${trend.lastValue}%）。`
        ),
        timeframe: pick(lang, 'Next 1 month', 'الشهر القادم', '未来1个月'),
        confidence: pick(lang, 'Low — simple linear trend on 8 data points, not a statistical model', 'منخفضة — اتجاه خطي بسيط على 8 نقاط بيانات، وليس نموذجًا إحصائيًا', '低——基于8个数据点的简单线性趋势，非统计模型'),
        supporting: pick(lang, 'Consistent month-over-month upward movement over the observed period.', 'استمرار الاتجاه التصاعدي شهريًا خلال الفترة المرصودة.', '观测期内月度持续上升。'),
        changing: pick(lang, 'New large invoices, enforcement actions, policy changes, or seasonal effects could shift this materially.', 'قد تُغيّر هذا التقدير بشكل جوهري فواتير كبيرة جديدة أو إجراءات تنفيذ أو تغييرات في السياسات أو تأثيرات موسمية.', '新增大额发票、执行行动、政策变化或季节性因素都可能显著改变该估算。')
      },
      {
        prediction: pick(
          lang,
          `If ${worstName}'s collection rate does not improve, its uncollected balance could grow beyond the current ${fmtMoney(worstProvince.uncollected)} SAR next period, assuming a similar invoicing volume.`,
          `إذا لم يتحسّن معدل التحصيل في ${worstName}، فقد يتجاوز رصيدها غير المحصَّل الحالي البالغ ${fmtMoney(worstProvince.uncollected)} ريال في الفترة القادمة، بافتراض حجم فوترة مماثل.`,
          `若 ${worstName} 的收缴率未见改善，假设开票量相近，其未收缴余额可能在下一周期超过当前的 ${fmtMoney(worstProvince.uncollected)} 里亚尔。`
        ),
        timeframe: pick(lang, 'Next filing period', 'الفترة القادمة', '下一周期'),
        confidence: pick(lang, 'Low — a directional projection based on the current rate holding steady, not a forecast model', 'منخفضة — إسقاط اتجاهي بافتراض ثبات المعدل الحالي، وليس نموذج تنبؤ', '低——基于当前收缴率保持不变的方向性推测，非预测模型'),
        supporting: pick(lang, `${worstName} has shown no improvement within the current filtered period.`, `لم تُظهر ${worstName} أي تحسّن ضمن الفترة الحالية المفلترة.`, `${worstName} 在当前筛选周期内未见改善。`),
        changing: pick(lang, 'Approving the collection follow-up recommended below would directly change this trajectory.', 'اعتماد متابعة التحصيل الموصى بها أدناه سيغيّر هذا المسار مباشرةً.', '采纳下方建议的催收跟进措施将直接改变这一走势。')
      }
    ];

    const additionalReports = [
      {
        title: pick(lang, 'Province Comparison Report', 'تقرير مقارنة المناطق', '省份对比报告'),
        description: pick(lang, 'Side-by-side collection performance across all provinces with data.', 'مقارنة جنبًا إلى جنب لأداء التحصيل عبر جميع المناطق التي تملك بيانات.', '对所有有数据省份的收缴表现进行并列对比。')
      },
      {
        title: pick(lang, 'Enforcement & Compliance Report', 'تقرير التنفيذ والامتثال', '执行与合规报告'),
        description: pick(lang, 'Sanad invoice-linkage gap, violation counts, and enforcement case load by province.', 'فجوة ربط فواتير سند، وعدد المخالفات، وحجم حالات التنفيذ حسب المنطقة.', 'Sanad 发票关联缺口、违规数量及各省份执行案件量。')
      },
      {
        title: pick(lang, 'Investment Contract Linkage Report', 'تقرير ربط العقود الاستثمارية', '投资合同关联报告'),
        description: pick(lang, 'Every investment invoice checked against its Furas contract record.', 'مراجعة كل فاتورة استثمارية مقابل سجل عقدها في فرص.', '逐一核对每张投资发票与其 Furas 合同记录。')
      },
      {
        title: pick(lang, 'Exclusion Category Deep-Dive', 'تحليل معمّق لفئات الاستبعاد', '排除类别深度分析'),
        description: pick(lang, 'Trend of duplicate, disputed, invalid-debtor, and enforcement-referred exclusions over time.', 'اتجاه استبعادات الفواتير المكررة والمتنازع عليها وباطلة المدين والمُحالة للتنفيذ عبر الزمن.', '重复、争议、无效债务人及已转执行等排除类别随时间的变化趋势。')
      }
    ];

    const recommendations = [
      {
        priority: pick(lang, worstProvince.rate < 40 ? 'Critical' : 'High', worstProvince.rate < 40 ? 'حرجة' : 'عالية', worstProvince.rate < 40 ? '严重' : '高'),
        text: pick(
          lang,
          `Approve a collection follow-up plan for ${worstName} — target raising its rate from ${worstProvince.rate}% toward the 70% benchmark.`,
          `اعتماد خطة متابعة تحصيل لـ${worstName} — بهدف رفع معدلها من ${worstProvince.rate}% نحو المستهدف 70%.`,
          `批准针对 ${worstName} 的催收跟进计划——目标是将其收缴率从 ${worstProvince.rate}% 提升至 70% 的基准水平。`
        )
      },
      {
        priority: pick(lang, 'High', 'عالية', '高'),
        text: pick(
          lang,
          'Require an invoice-number field to be captured at the point an enforcement order is issued, closing the Sanad linkage gap at the source.',
          'إلزام التقاط حقل رقم الفاتورة عند لحظة إصدار أمر التنفيذ، لسد فجوة الربط في سند من مصدرها.',
          '要求在签发执行令时同步录入发票编号字段，从源头上弥合 Sanad 关联缺口。'
        )
      },
      ...(flaggedNoContract.length
        ? [{
            priority: pick(lang, 'Medium', 'متوسطة', '中'),
            text: pick(
              lang,
              `Review and link ${flaggedNoContract[0].id} to its Furas contract before the next audit cycle.`,
              `مراجعة وربط ${flaggedNoContract[0].id} بعقدها في فرص قبل دورة التدقيق القادمة.`,
              `在下一轮审计前审查并关联 ${flaggedNoContract[0].id} 与其 Furas 合同。`
            )
          }]
        : []),
      {
        priority: pick(lang, 'Low', 'منخفضة', '低'),
        text: pick(
          lang,
          'Monitor the largest exclusion category monthly to confirm it is not growing faster than gross invoicing.',
          'مراقبة أكبر فئة استبعاد شهريًا للتأكد من أنها لا تنمو أسرع من إجمالي الفوترة.',
          '每月监测最大排除类别，确认其增速未超过总开票额。'
        )
      }
    ];

    const assumptions = [
      pick(lang, `Data source: this demo's fictional invoice dataset (${kpi.invoiceCount} records) — not connected to a production system.`, `مصدر البيانات: مجموعة بيانات فواتير افتراضية لهذا العرض التوضيحي (${kpi.invoiceCount} سجلًا) — غير متصلة بنظام إنتاجي.`, `数据来源：本演示的虚构发票数据集（共 ${kpi.invoiceCount} 条记录）——未连接生产系统。`),
      pick(lang, 'Sanad enforcement figures are illustrative/sample data for demo purposes, not a real dataset.', 'أرقام تنفيذ سند بيانات توضيحية/نموذجية لأغراض العرض، وليست بيانات حقيقية.', 'Sanad 执行数据为演示用途的示例性数据，并非真实数据集。'),
      pick(lang, `Only ${byProvince.length} of Saudi Arabia's 13 real provinces have invoices in this demo dataset; the rest show no data by design.`, `${byProvince.length} فقط من مناطق المملكة الـ13 الحقيقية تملك فواتير في مجموعة البيانات هذه؛ البقية بلا بيانات عن قصد.`, `本演示数据集中仅有 ${byProvince.length} 个（共13个）真实省份存在发票数据，其余省份按设计无数据。`),
      pick(lang, 'Uncollected excludes duplicate, disputed, invalid-debtor, and enforcement-referred invoices by definition — they are never counted as collectible.', 'يستبعد "غير المحصَّل" بحكم التعريف الفواتير المكررة والمتنازع عليها وباطلة المدين والمُحالة للتنفيذ — فهي لا تُحتسب أبدًا كقابلة للتحصيل.', '"未收缴"按定义排除重复、争议、无效债务人及已转执行的账单——这些从不计入可收缴范围。'),
      pick(lang, 'The forecast above is a simple linear trend on a short series, not a statistical or machine-learning model — treat it as directional, not precise.', 'التنبؤ أعلاه اتجاه خطي بسيط على سلسلة قصيرة، وليس نموذجًا إحصائيًا أو تعلّم آلي — يُعامَل كإشارة اتجاه لا كقيمة دقيقة.', '上述预测是基于短序列的简单线性趋势，并非统计或机器学习模型——请将其视为方向性参考，而非精确数值。')
    ];

    const labels = {
      executiveSummary: pick(lang, 'Executive Summary', 'الملخص التنفيذي', '执行摘要'),
      keyMetrics: pick(lang, 'Key Metrics', 'المؤشرات الرئيسية', '关键指标'),
      detailedAnalysis: pick(lang, 'Detailed Analysis', 'التحليل التفصيلي', '详细分析'),
      aiDiscoveries: pick(lang, 'AI Discoveries', 'اكتشافات الذكاء الاصطناعي', 'AI 洞察发现'),
      risksAlerts: pick(lang, 'Risks & Alerts', 'المخاطر والتنبيهات', '风险与预警'),
      predictions: pick(lang, 'Predictions & Forecasts', 'التوقعات والتنبؤات', '预测与展望'),
      additionalReports: pick(lang, 'Additional Recommended Reports', 'تقارير إضافية موصى بها', '推荐的其他报告'),
      recommendations: pick(lang, 'Recommendations', 'التوصيات', '建议'),
      dataAssumptions: pick(lang, 'Data & Assumptions', 'البيانات والافتراضات', '数据与假设'),
      metric: pick(lang, 'Metric', 'المؤشر', '指标'),
      value: pick(lang, 'Value', 'القيمة', '数值'),
      note: pick(lang, 'What it means', 'ماذا يعني', '含义说明'),
      priority: pick(lang, 'Priority', 'الأولوية', '优先级'),
      title: pick(lang, 'Title', 'العنوان', '标题'),
      rationale: pick(lang, 'Rationale', 'المبرر', '依据'),
      timeframe: pick(lang, 'Timeframe', 'الإطار الزمني', '时间范围'),
      confidence: pick(lang, 'Confidence', 'مستوى الثقة', '置信度'),
      supportingFactors: pick(lang, 'Supporting Factors', 'العوامل الداعمة', '支持因素'),
      changingFactors: pick(lang, 'Factors That Could Change This', 'عوامل قد تُغيّر هذا التقدير', '可能改变该预测的因素')
    };

    return {
      title,
      subtitle: subtitleMap[focus] || subtitleMap.revenue,
      generatedOn,
      executiveSummary,
      keyMetrics,
      detailedAnalysis: { intro: detailedAnalysisIntro, table: analysisTable },
      discoveries,
      risks,
      predictions,
      additionalReports,
      recommendations,
      assumptions,
      labels,
      charts,
      meta: {
        invoiceCount: kpi.invoiceCount,
        provinceCount: byProvince.length,
        gross: fmtMoney(kpi.gross)
      }
    };
  }, [t, lang, focus]);
}

export default function SmartReports() {
  const { t, lang, isRtl } = useI18n();
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartTheme(theme), [theme]);
  const [focus, setFocus] = useState('revenue');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | analyzing | done
  const [tick, setTick] = useState(0);
  const report = useSmartReport(t, lang, focus);

  // Chart.js configs — every dataset reads straight from `report.charts`, the
  // same numbers driving the text sections above, so a chart can never
  // contradict the sentence next to it.
  const legendOpts = useMemo(() => chartLegend(theme, { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }), [isRtl, theme]);
  const tooltipBase = useMemo(() => chartTooltip(theme, isRtl), [isRtl, theme]);

  const compositionChartData = useMemo(() => ({
    labels: report.charts.composition.labels,
    datasets: [{ data: report.charts.composition.values, backgroundColor: [chartColor('success', 0.85), chartColor('orange', 0.85), chartColor('neutral', 0.55)], borderWidth: 0 }]
  }), [report]);
  const compositionOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legendOpts,
      tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)} SAR (${report.charts.composition.pct[ctx.dataIndex]}%)` } }
    }
  }), [legendOpts, tooltipBase, report]);

  const provinceBarData = useMemo(() => ({
    labels: report.charts.provinceBar.labels,
    datasets: [
      { label: pick(lang, 'Gross', 'الإجمالي', '总额'), data: report.charts.provinceBar.gross, backgroundColor: chartColor('info', 0.75), borderRadius: 4 },
      { label: pick(lang, 'Collected', 'المحصَّل', '已收缴'), data: report.charts.provinceBar.collected, backgroundColor: chartColor('success', 0.75), borderRadius: 4 }
    ]
  }), [report, lang]);
  const provinceBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: legendOpts, tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)} SAR` } } },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartColors.text, callback: (v) => fmtMoney(v) }, grid: { color: chartColors.grid } }
    }
  }), [chartColors, legendOpts, tooltipBase, isRtl]);

  const revenueMixData = useMemo(() => ({
    labels: report.charts.revenueMix.labels,
    datasets: [{ data: report.charts.revenueMix.values, backgroundColor: [chartColor('info', 0.85), chartColor('primary', 0.85), chartColor('orange', 0.85), chartColor('danger', 0.85)], borderWidth: 0 }]
  }), [report]);
  const revenueMixOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: legendOpts, tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)} SAR (${report.charts.revenueMix.pct[ctx.dataIndex]}%)` } } }
  }), [legendOpts, tooltipBase, report]);

  const enforcementBarData = useMemo(() => ({
    labels: report.charts.enforcementBar.labels,
    datasets: [
      { label: pick(lang, 'Violations', 'المخالفات', '违规数'), data: report.charts.enforcementBar.violations, backgroundColor: chartColor('danger', 0.75), borderRadius: 4 },
      { label: pick(lang, 'Enforcement Cases', 'حالات التنفيذ', '执行案件数'), data: report.charts.enforcementBar.enforcement, backgroundColor: chartColor('info', 0.75), borderRadius: 4 }
    ]
  }), [report, lang]);
  const enforcementBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: legendOpts, tooltip: tooltipBase },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 11 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartColors.text, precision: 0 }, grid: { color: chartColors.grid } }
    }
  }), [chartColors, legendOpts, tooltipBase, isRtl]);

  const investmentData = useMemo(() => ({
    labels: report.charts.investment.labels,
    datasets: [{ data: report.charts.investment.values, backgroundColor: [chartColor('success', 0.85), chartColor('danger', 0.85)], borderWidth: 0 }]
  }), [report]);
  const investmentOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legendOpts,
      tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} (${report.charts.investment.total ? Math.round((ctx.parsed / report.charts.investment.total) * 100) : 0}%)` } }
    }
  }), [legendOpts, tooltipBase, report]);

  const trendLineData = useMemo(() => ({
    labels: report.charts.trend.labels,
    datasets: [
      { label: pick(lang, 'Actual recovery rate', 'معدل التحصيل الفعلي', '实际回收率'), data: report.charts.trend.actual, borderColor: chartColor('success', 0.9), backgroundColor: chartColor('success', 0.15), pointRadius: 3, tension: 0.3 },
      { label: pick(lang, 'Forecast', 'تقديري', '预测'), data: report.charts.trend.forecast, borderColor: chartColor('info', 0.9), borderDash: [6, 4], pointRadius: 3, tension: 0.3 }
    ]
  }), [report, lang]);
  const trendLineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: legendOpts, tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: chartColors.text, callback: (v) => `${v}%` }, grid: { color: chartColors.grid } }
    }
  }), [chartColors, legendOpts, tooltipBase, isRtl]);

  const focusLabels = {
    revenue: pick(lang, 'Revenue & Collection Performance', 'أداء الإيرادات والتحصيل', '收入与收缴绩效'),
    province: pick(lang, 'Province Comparison', 'مقارنة المناطق', '省份对比'),
    enforcement: pick(lang, 'Enforcement & Compliance', 'التنفيذ والامتثال', '执行与合规'),
    investment: pick(lang, 'Investment Contract Linkage', 'ربط العقود الاستثمارية', '投资合同关联')
  };

  function matchFocusFromQuery(text) {
    const lower = text.toLowerCase();
    if (/enforc|compliance|تنفيذ|امتثال|执行|合规/.test(lower)) return 'enforcement';
    if (/invest|contract|استثمار|عقد|投资|合同/.test(lower)) return 'investment';
    if (/province|region|city|منطقة|省份|城市/.test(lower)) return 'province';
    return 'revenue';
  }

  // The visible "how the AI analyzed this" timeline. Every step's detail is a
  // real value pulled from the SAME `report` object rendered below once the
  // sequence finishes — including the forecast step, which previews the exact
  // prediction text that appears in the final report, so the two can never
  // drift apart or feel unrelated.
  const analysisSteps = useMemo(() => ([
    {
      title: pick(lang, 'Understanding your request', 'فهم طلبك', '理解您的请求'),
      detail: pick(lang, `Focus: ${report.subtitle}`, `التركيز: ${report.subtitle}`, `分析重点：${report.subtitle}`)
    },
    {
      title: pick(lang, 'Analyzing invoice and province data', 'تحليل بيانات الفواتير والمناطق', '分析发票与省份数据'),
      detail: pick(
        lang,
        `Scanned ${report.meta.invoiceCount} invoices across ${report.meta.provinceCount} provinces with data — ${report.meta.gross} SAR gross invoiced.`,
        `تم فحص ${report.meta.invoiceCount} فاتورة عبر ${report.meta.provinceCount} مناطق تملك بيانات — بإجمالي فوترة ${report.meta.gross} ريال.`,
        `已扫描 ${report.meta.invoiceCount} 张发票，涵盖 ${report.meta.provinceCount} 个有数据的省份——总开票额 ${report.meta.gross} 里亚尔。`
      )
    },
    {
      title: pick(lang, 'Detecting patterns and discoveries', 'اكتشاف الأنماط والاكتشافات', '识别模式与发现'),
      detail: report.discoveries[0]
    },
    {
      title: pick(lang, 'Running the collection-rate forecast', 'تشغيل نموذج تنبؤ معدل التحصيل', '运行收缴率预测模型'),
      detail: report.predictions[0]?.prediction
    },
    {
      title: pick(lang, 'Compiling risks, recommendations, and report', 'تجميع المخاطر والتوصيات والتقرير', '汇总风险、建议与报告'),
      detail: pick(
        lang,
        `Identified ${report.risks.length} risk item(s) and ${report.recommendations.length} recommendation(s).`,
        `تم تحديد ${report.risks.length} بند(بنود) خطر و${report.recommendations.length} توصية(توصيات).`,
        `已识别 ${report.risks.length} 项风险和 ${report.recommendations.length} 条建议。`
      )
    }
  ]), [lang, report]);

  const activeStepIndex = Math.min(Math.floor(tick / 2), analysisSteps.length - 1);
  const activeRevealed = tick % 2 === 1;

  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const totalTicks = analysisSteps.length * 2;
    if (tick >= totalTicks) {
      const id = window.setTimeout(() => setPhase('done'), 300);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setTick((n) => n + 1), 550);
    return () => window.clearTimeout(id);
  }, [phase, tick, analysisSteps.length]);

  function runGeneration(nextFocus) {
    if (nextFocus) setFocus(nextFocus);
    setTick(0);
    setPhase('analyzing');
  }

  async function handleExport(kind) {
    setBusy(kind);
    try {
      if (kind === 'docx') await exportReportToDocx(report, 'smart-report.docx');
      if (kind === 'xlsx') exportReportToXlsx(report, 'smart-report.xlsx');
      if (kind === 'pptx') await exportReportToPptx(report, 'smart-report.pptx');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('smart_reports_title')}</h1>
          <div className="page-sub">{t('smart_reports_sub')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            aria-label={t('smart_reports_placeholder')}
            placeholder={t('smart_reports_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) runGeneration(matchFocusFromQuery(query)); }}
          />
          <button className="btn btn-primary" type="button" onClick={() => runGeneration(query.trim() ? matchFocusFromQuery(query) : focus)}>
            {t('smart_reports_generate')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
          {FOCUS_OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${focus === key && phase !== 'idle' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => runGeneration(key)}
            >
              {focusLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {phase === 'idle' && (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 'var(--spacing-5xl) var(--spacing-2xl)' }}>
          <div className="page-title" style={{ fontSize: 'var(--text-sm)' }}>{t('smart_reports_idle_title')}</div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)' }}>{t('smart_reports_idle_sub')}</div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="card card-pad">
          <AIContentLabel state="refining" />
          <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-xs)' }}>{t('smart_reports_analyzing_title')}</div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-lg)' }}>{report.subtitle}</div>
          <div className="ai-timeline">
            {analysisSteps.slice(0, activeStepIndex + 1).map((step, i) => {
              const isActive = i === activeStepIndex;
              const revealed = !isActive || activeRevealed;
              let cls = 'ai-step';
              if (isActive) cls += revealed ? ' ai-step--done' : ' ai-step--running';
              else cls += ' ai-step--done';
              return (
                <div className={cls} key={i}>
                  <div className="ai-step__tag">{i + 1}</div>
                  <div className="ai-step__title">{step.title}</div>
                  <div className="ai-step__detail">
                    {revealed ? <span>{step.detail}</span> : <AgentThinking />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'done' && (
      <div className="card card-pad">
        <div className="ai-conclusion" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div className="ai-conclusion__label"><AIContentLabel /> {t('ai_conclusion')}</div>
          <div className="ai-conclusion__text">{t('smart_reports_ready')}</div>
        </div>
        <div className="page-head" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{report.title}</div>
            <div className="page-sub">{report.subtitle} · {report.generatedOn}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
            <button className="btn btn-sm" type="button" disabled={busy === 'docx'} onClick={() => handleExport('docx')}>
              {busy === 'docx' ? t('smart_reports_exporting') : t('smart_reports_export_word')}
            </button>
            <button className="btn btn-sm" type="button" disabled={busy === 'xlsx'} onClick={() => handleExport('xlsx')}>
              {busy === 'xlsx' ? t('smart_reports_exporting') : t('smart_reports_export_excel')}
            </button>
            <button className="btn btn-sm" type="button" disabled={busy === 'pptx'} onClick={() => handleExport('pptx')}>
              {busy === 'pptx' ? t('smart_reports_exporting') : t('smart_reports_export_ppt')}
            </button>
          </div>
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)' }}>{report.labels.executiveSummary}</div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.8, marginTop: 'var(--spacing-xs)' }}>{report.executiveSummary}</p>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.keyMetrics}</div>
        <div className="grid grid-5">
          {report.keyMetrics.map((m) => (
            <div key={m.label} className="card card-pad" data-tooltip={m.caption} aria-label={`${m.label}: ${m.caption}`} tabIndex={0}>
              <div className="kpi__value" style={{ fontSize: 'var(--text-lg)' }}>{m.value}</div>
              <div className="kpi__label">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          {report.keyMetrics.map((m) => (
            <div key={m.label} className="muted" style={{ fontSize: 'var(--text-xs)' }}><strong>{m.label}:</strong> {m.caption}</div>
          ))}
        </div>
        <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)', alignItems: 'center' }}>
          <div style={{ height: 220 }}>
            <Doughnut data={compositionChartData} options={compositionOptions} />
          </div>
          <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
              {pick(lang, 'Gross invoicing split by outcome', 'توزيع إجمالي الفوترة حسب النتيجة', '按结果划分的总开票额分布')}
            </div>
            {report.charts.composition.labels.map((label, i) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-xs)' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 700 }} dir="ltr">{report.charts.composition.pct[i]}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                  <div style={{ width: `${report.charts.composition.pct[i]}%`, height: '100%', background: ['var(--success)', 'var(--warning)', 'var(--low)'][i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)' }}>{report.labels.detailedAnalysis}</div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.8, marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>{report.detailedAnalysis.intro}</p>
        <div style={{ height: 240, marginBottom: 'var(--spacing-lg)' }}>
          <Bar data={provinceBarData} options={provinceBarOptions} />
        </div>
        <div className="table-wrap" tabIndex={0}>
          <table className="table" aria-label={t('a11y_province_analysis')}>
            <thead>
              <tr>{report.detailedAnalysis.table.headers.map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {report.detailedAnalysis.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((c, j) => {
                    if (j !== row.length - 1) return <td key={j} dir={j > 0 ? 'ltr' : undefined}>{c}</td>;
                    const rate = report.detailedAnalysis.table.rateByRow[i];
                    return (
                      <td key={j} dir="ltr">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', minWidth: 120 }}>
                          <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', background: rate >= 70 ? 'var(--green)' : rate >= 40 ? 'var(--gold)' : 'var(--red)' }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-xs)' }}>{focusLabels[focus]}</div>
        <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-md)' }}>
          {pick(lang, 'Chart focused on this report’s selected business area.', 'رسم بياني مرتبط بمجال العمل المحدد لهذا التقرير.', '与本报告所选业务领域相关的图表。')}
        </div>
        {focus === 'revenue' && (
          <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)', alignItems: 'center' }}>
            <div style={{ height: 220 }}><Doughnut data={revenueMixData} options={revenueMixOptions} /></div>
            <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
              {report.charts.revenueMix.labels.map((label, i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 700 }} dir="ltr">{fmtMoney(report.charts.revenueMix.values[i])} SAR · {report.charts.revenueMix.pct[i]}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {focus === 'province' && (
          <div style={{ height: 240 }}>
            <Bar
              data={{ labels: report.charts.provinceBar.labels, datasets: [{ label: pick(lang, 'Collection Rate %', 'معدل التحصيل %', '收缴率 %'), data: report.charts.provinceBar.rate, backgroundColor: report.charts.provinceBar.rate.map((r) => chartColor(r >= 70 ? 'success' : r >= 40 ? 'warning' : 'danger', 0.75)), borderRadius: 4 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: legendOpts, tooltip: { ...tooltipBase, callbacks: { label: (ctx) => `${ctx.parsed.y}%` } } }, scales: { x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 11 } }, grid: { display: false } }, y: { beginAtZero: true, max: 100, ticks: { color: chartColors.text, callback: (v) => `${v}%` }, grid: { color: chartColors.grid } } } }}
            />
          </div>
        )}
        {focus === 'enforcement' && (
          <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
            <div style={{ height: 220 }}><Bar data={enforcementBarData} options={enforcementBarOptions} /></div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-xs)' }}>
                <span>{pick(lang, 'Sanad enforcement orders linked to a source invoice', 'أوامر تنفيذ سند المرتبطة بفاتورة مصدر', '已关联原始发票的 Sanad 执行令')}</span>
                <span style={{ fontWeight: 700 }} dir="ltr">{report.charts.sanadLinkage.linkedPct}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--danger-soft)', overflow: 'hidden' }}>
                <div style={{ width: `${report.charts.sanadLinkage.linkedPct}%`, height: '100%', background: 'var(--green)' }} />
              </div>
              <div className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-xs)' }} dir="ltr">
                {report.charts.sanadLinkage.ordersUnlinked} / {report.charts.sanadLinkage.ordersIssued} {pick(lang, 'orders unlinked', 'أمر غير مرتبط', '份执行令未关联')} · {fmtMoney(report.charts.sanadLinkage.unlinkedValue)} SAR
              </div>
            </div>
          </div>
        )}
        {focus === 'investment' && (
          <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)', alignItems: 'center' }}>
            <div style={{ height: 220 }}><Doughnut data={investmentData} options={investmentOptions} /></div>
            <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
              {report.charts.investment.labels.map((label, i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                  <span>{label}</span>
                  <span style={{ fontWeight: 700 }} dir="ltr">
                    {report.charts.investment.values[i]} · {report.charts.investment.total ? Math.round((report.charts.investment.values[i] / report.charts.investment.total) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.aiDiscoveries}</div>
        <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
          {report.discoveries.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-start' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)', marginTop: 'var(--spacing-xs)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-xs)', lineHeight: 1.7 }}>{d}</span>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.risksAlerts}</div>
        <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
          {report.risks.map((r, i) => (
            <div key={i} className="card card-pad" style={{ borderInlineStart: `4px solid var(--red)` }}>
              <span className="badge badge--red">{r.priority}</span>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)' }}>{r.title}</div>
              <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)', lineHeight: 1.6 }}>{r.rationale}</div>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.predictions}</div>
        <div style={{ height: 220, marginBottom: 'var(--spacing-lg)' }}>
          <Line data={trendLineData} options={trendLineOptions} />
        </div>
        <div className="grid" style={{ gap: 'var(--spacing-md)' }}>
          {report.predictions.map((p, i) => (
            <div key={i} className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{p.prediction}</div>
              <div className="grid grid-2" style={{ gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-md)' }}>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}><strong>{report.labels.timeframe}:</strong> {p.timeframe}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}><strong>{report.labels.confidence}:</strong> {p.confidence}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}><strong>{report.labels.supportingFactors}:</strong> {p.supporting}</div>
                <div className="muted" style={{ fontSize: 'var(--text-xs)' }}><strong>{report.labels.changingFactors}:</strong> {p.changing}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.additionalReports}</div>
        <div className="grid grid-2" style={{ gap: 'var(--spacing-md)' }}>
          {report.additionalReports.map((a, i) => (
            <div key={i} className="card card-pad">
              <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{a.title}</div>
              <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-xs)' }}>{a.description}</div>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.recommendations}</div>
        <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
          {report.recommendations.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <span className={`badge ${r.priority === (lang === 'ar' ? 'حرجة' : lang === 'zh' ? '严重' : 'Critical') ? 'badge--red' : r.priority === (lang === 'ar' ? 'عالية' : lang === 'zh' ? '高' : 'High') ? 'badge--orange' : r.priority === (lang === 'ar' ? 'متوسطة' : lang === 'zh' ? '中' : 'Medium') ? 'badge--gold' : 'badge--teal'}`}>
                {r.priority}
              </span>
              <span style={{ fontSize: 'var(--text-xs)' }}>{r.text}</span>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="page-title" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--spacing-md)' }}>{report.labels.dataAssumptions}</div>
        <div className="grid" style={{ gap: 'var(--spacing-xs)' }}>
          {report.assumptions.map((a, i) => (
            <div key={i} className="muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>• {a}</div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
