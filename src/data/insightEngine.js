// ---------- Input-driven insight engine ----------
// Deliberately NOT a script. Every function below is a "detector": it looks
// at the live data and independently decides whether it has anything worth
// surfacing. Nothing here is a fixed narrative — the SET of insights that
// comes out (how many, which ones, how severe) is entirely a function of
// the numbers computed from INVOICES right now. Change the underlying data
// and a different mix of detectors fires, exactly like the "auto-insight"
// layer in real BI tools (Power BI Quick Insights / Explain Data, Amazon
// QuickSight ML Insights, ThoughtSpot SpotIQ): a battery of statistical
// checks — outliers, concentration, trend inflection, forecast shortfall —
// each producing natural-language findings only when its own condition is
// actually met, then ranked by severity rather than shown in a fixed order.
import {
  baselineState, simulate, leverImpacts, historicalSeries, forecastSeries,
  byProvince, exclusionBreakdown, ZERO_LEVERS, FORECAST_MONTHS
} from './whatIfModel';

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

export function buildStrategicContext() {
  const base = baselineState();
  const provinces = byProvince();
  const excl = exclusionBreakdown();
  const history = historicalSeries(base);
  const { forecast, avgGrowth, band } = forecastSeries(history);
  const coverageForecast = forecast.map((v) => Math.round((v / base.opex) * 1000) / 10);
  const coverageBand = band.map((v) => Math.round((v / base.opex) * 1000) / 10);
  const impacts = leverImpacts(base);
  return { base, provinces, excl, history, forecast, avgGrowth, band, coverageForecast, coverageBand, impacts };
}

// ---------- Strategic (Level 1) detectors — react only to live data ----------

function detCoverageGap(ctx) {
  const gap = 100 - ctx.base.opexCoveragePct;
  if (gap <= 0) {
    return mk('positive', Math.min(40, -gap + 15), {
      en: `Operational-expenditure coverage already exceeds 100% by ${Math.abs(gap).toFixed(1)} points — the surplus could fund unbudgeted priorities.`,
      ar: `تغطية المصروفات التشغيلية تتجاوز بالفعل 100% بمقدار ${Math.abs(gap).toFixed(1)} نقطة — يمكن توجيه الفائض لأولويات غير مُدرجة بالميزانية.`,
      zh: `运营支出覆盖率已超过100%，超出 ${Math.abs(gap).toFixed(1)} 个百分点——盈余可用于资助预算外的优先事项。`
    }, { en: 'Coverage surplus', ar: 'فائض التغطية', zh: '覆盖率盈余' });
  }
  return mk('risk', Math.min(95, gap * 2.2), {
    en: `Operational expenditure is only ${ctx.base.opexCoveragePct}% covered by current collections — a ${fmt(gap)}-point gap against full coverage, worth ${fmtMoney(Math.round(ctx.base.opex * gap / 100))} SAR.`,
    ar: `تُغطّي التحصيلات الحالية ${ctx.base.opexCoveragePct}% فقط من المصروفات التشغيلية — أي فجوة قدرها ${fmt(gap)} نقطة عن التغطية الكاملة، بما يعادل ${fmtMoney(Math.round(ctx.base.opex * gap / 100))} ريال.`,
    zh: `当前收缴额仅覆盖运营支出的 ${ctx.base.opexCoveragePct}%——距离全额覆盖还有 ${fmt(gap)} 个百分点的差距，相当于 ${fmtMoney(Math.round(ctx.base.opex * gap / 100))} 里亚尔。`
  }, { en: 'Opex coverage gap', ar: 'فجوة تغطية المصروفات', zh: '运营支出覆盖缺口' });
}

function detOutlierProvinces(ctx) {
  const rates = ctx.provinces.map((p) => p.rate);
  const m = mean(rates);
  const sd = stddev(rates);
  const materialityFloor = mean(ctx.provinces.map((p) => p.gross)) * 0.25;
  if (sd === 0) return null;
  const outliers = ctx.provinces
    .filter((p) => p.rate < m - sd && p.gross >= materialityFloor)
    .sort((a, b) => a.rate - b.rate);
  if (!outliers.length) {
    return mk('positive', 20, {
      en: `Collection performance is statistically consistent across Amanahs — no region falls more than one standard deviation below the ${Math.round(m)}% average.`,
      ar: `أداء التحصيل متسق إحصائيًا عبر الأمانات — لا توجد منطقة تقل عن المعدل العام (${Math.round(m)}%) بأكثر من انحراف معياري واحد.`,
      zh: `各阿马纳的收缴表现在统计上保持一致——没有地区低于 ${Math.round(m)}% 平均水平超过一个标准差。`
    }, { en: 'Consistent regional performance', ar: 'أداء إقليمي متسق', zh: '区域表现一致' });
  }
  return outliers.slice(0, 3).map((p, i) => mk('risk', Math.min(90, (m - p.rate) / (sd || 1) * 30 + 25), {
    en: `${enName(p)} collects at ${p.rate}% — statistically below the ${Math.round(m)}% Amanah average (more than 1σ), on a materially large base of ${fmtMoney(p.gross)} SAR.`,
    ar: `تحصّل ${arName(p)} بمعدل ${p.rate}% — أقل إحصائيًا من متوسط الأمانات (${Math.round(m)}%) بأكثر من انحراف معياري واحد، على قاعدة فوترة كبيرة قدرها ${fmtMoney(p.gross)} ريال.`,
    zh: `${p.nameEn} 的收缴率为 ${p.rate}%——在统计上低于阿马纳平均水平（${Math.round(m)}%）超过一个标准差，且开票基数达 ${fmtMoney(p.gross)} 里亚尔，具有重要性。`
  }, { en: `Outlier: ${enName(p)}`, ar: `حالة شاذة: ${arName(p)}`, zh: `异常值：${p.nameEn}` }, p));
}

function detConcentrationRisk(ctx) {
  const totalUncollected = ctx.provinces.reduce((s, p) => s + p.uncollected, 0);
  if (!totalUncollected) return null;
  const sorted = [...ctx.provinces].sort((a, b) => b.uncollected - a.uncollected);
  const top = sorted[0];
  const share = (top.uncollected / totalUncollected) * 100;
  if (share < 30) return null;
  return mk('risk', Math.min(90, share), {
    en: `${enName(top)} alone accounts for ${Math.round(share)}% of all uncollected value (${fmtMoney(top.uncollected)} SAR of ${fmtMoney(totalUncollected)} SAR) — a concentrated, not distributed, collection gap.`,
    ar: `تمثّل ${arName(top)} وحدها ${Math.round(share)}% من إجمالي القيمة غير المحصَّلة (${fmtMoney(top.uncollected)} ريال من ${fmtMoney(totalUncollected)} ريال) — فجوة تحصيل مركّزة وليست موزّعة.`,
    zh: `${top.nameEn} 一地就占全部未收缴金额的 ${Math.round(share)}%（${fmtMoney(top.uncollected)} 里亚尔，占总额 ${fmtMoney(totalUncollected)} 里亚尔）——收缴缺口高度集中，而非分散。`
  }, { en: 'Concentrated collection gap', ar: 'فجوة تحصيل مركّزة', zh: '收缴缺口高度集中' }, top);
}

function detExclusionDriver(ctx) {
  const keys = Object.keys(ctx.excl);
  const total = keys.reduce((s, k) => s + ctx.excl[k].value, 0);
  if (!total) return null;
  const sorted = keys.sort((a, b) => ctx.excl[b].value - ctx.excl[a].value);
  const top = sorted[0];
  const share = (ctx.excl[top].value / total) * 100;
  const grossShare = (total / ctx.base.gross) * 100;
  if (share >= 40) {
    return mk('warning', Math.min(85, share), {
      en: `${EXCL_EN[top]} drives ${Math.round(share)}% of all excluded value (${fmtMoney(ctx.excl[top].value)} SAR) — the single largest structural drag on net invoicing.`,
      ar: `تشكّل فئة "${EXCL_AR[top]}" ${Math.round(share)}% من إجمالي القيمة المستبعدة (${fmtMoney(ctx.excl[top].value)} ريال) — أكبر عامل هيكلي يحدّ من صافي الفوترة.`,
      zh: `"${EXCL_ZH[top]}" 占全部排除金额的 ${Math.round(share)}%（${fmtMoney(ctx.excl[top].value)} 里亚尔）——是拖累净开票额的最大结构性因素。`
    }, { en: 'Dominant exclusion driver', ar: 'العامل المهيمن على الاستبعادات', zh: '排除项的主导因素' });
  }
  if (grossShare < 5) {
    return mk('positive', 15, {
      en: `Exclusions total only ${grossShare.toFixed(1)}% of gross invoicing and are spread across categories — not a material drag on collections.`,
      ar: `تمثّل الاستبعادات ${grossShare.toFixed(1)}% فقط من إجمالي الفوترة وموزّعة عبر الفئات — وليست عاملًا جوهريًا مؤثرًا في التحصيل.`,
      zh: `排除金额仅占总开票额的 ${grossShare.toFixed(1)}%，且分布在各类别中——对收缴而言影响不大。`
    }, { en: 'Exclusions immaterial', ar: 'استبعادات غير جوهرية', zh: '排除项影响不大' });
  }
  return null;
}

function detLeverDominance(ctx) {
  const [first, second] = ctx.impacts;
  if (!second || !second.impact) {
    return mk('opportunity', 50, {
      en: `${leverEn(first.key)} is the only lever with a measurable impact (+${fmtMoney(Math.round(first.impact))} SAR) — the clear single priority.`,
      ar: `${leverAr(first.key)} هو المتغيّر الوحيد ذو الأثر القابل للقياس (+${fmtMoney(Math.round(first.impact))} ريال) — الأولوية الواضحة الوحيدة.`,
      zh: `${leverZh(first.key)} 是唯一具有可衡量影响的变量（+${fmtMoney(Math.round(first.impact))} 里亚尔）——是明确的唯一优先项。`
    }, { en: 'Single dominant lever', ar: 'متغيّر واحد مهيمن', zh: '单一主导变量' });
  }
  const ratio = first.impact / second.impact;
  if (ratio >= 1.5) {
    return mk('opportunity', Math.min(80, ratio * 25), {
      en: `${leverEn(first.key)} outweighs the next-best lever by ${ratio.toFixed(1)}× (+${fmtMoney(Math.round(first.impact))} SAR vs +${fmtMoney(Math.round(second.impact))} SAR) — a clear single priority rather than a spread of equal bets.`,
      ar: `يفوق أثر ${leverAr(first.key)} المتغيّر التالي بمقدار ${ratio.toFixed(1)} مرة (+${fmtMoney(Math.round(first.impact))} ريال مقابل +${fmtMoney(Math.round(second.impact))} ريال) — أولوية واضحة ومنفردة وليست توزيعًا متساويًا للجهد.`,
      zh: `${leverZh(first.key)} 的影响是次优变量的 ${ratio.toFixed(1)} 倍（+${fmtMoney(Math.round(first.impact))} 里亚尔 对比 +${fmtMoney(Math.round(second.impact))} 里亚尔）——是明确的单一优先项，而非平均分散投入。`
    }, { en: 'Clear priority lever', ar: 'متغيّر ذو أولوية واضحة', zh: '明确的优先变量' });
  }
  return mk('neutral', 40, {
    en: `No single lever dominates — the top two (${leverEn(first.key)}, ${leverEn(second.key)}) sit within ${((ratio - 1) * 100).toFixed(0)}% of each other, so a combined approach outperforms betting on one alone.`,
    ar: `لا يوجد متغيّر واحد مهيمن — المتغيّران الأعلى (${leverAr(first.key)}، ${leverAr(second.key)}) متقاربان بفارق ${((ratio - 1) * 100).toFixed(0)}%، لذا فإن نهجًا مركّبًا يتفوّق على الرهان على متغيّر واحد فقط.`,
    zh: `没有单一变量占主导——排名前两位的变量（${leverZh(first.key)}、${leverZh(second.key)}）差距仅为 ${((ratio - 1) * 100).toFixed(0)}%，因此组合推进优于只押注单一变量。`
  }, { en: 'Balanced lever set', ar: 'مجموعة متغيرات متوازنة', zh: '变量组合均衡' });
}

function detForecastTrajectory(ctx) {
  const last = ctx.coverageForecast[FORECAST_MONTHS - 1];
  const bandLast = ctx.coverageBand[FORECAST_MONTHS - 1];
  const wide = bandLast >= 8;
  if (last >= 100) {
    return mk('positive', 55, {
      en: `At the current trailing growth rate, opex coverage is projected to fully close within ${FORECAST_MONTHS} periods (~${last}%) with no new intervention${wide ? `, though the ±${bandLast.toFixed(1)}-point projection band means this isn't guaranteed` : ''}.`,
      ar: `عند معدل النمو الحالي، من المتوقع أن تصل تغطية المصروفات التشغيلية للاكتمال خلال ${FORECAST_MONTHS} فترات (~${last}%) دون أي تدخل جديد${wide ? `، مع أن نطاق التوقع ±${bandLast.toFixed(1)} نقطة يعني أن هذا غير مضمون` : ''}.`,
      zh: `按当前趋势增长率，预计运营支出覆盖率将在 ${FORECAST_MONTHS} 期内（约 ${last}%）自行补齐，无需新的干预${wide ? `，不过 ±${bandLast.toFixed(1)} 个百分点的预测区间意味着这并非确定` : ''}。`
    }, { en: 'Trend alone closes the gap', ar: 'الاتجاه وحده يسد الفجوة', zh: '仅靠趋势即可补齐差距' });
  }
  const shortfall = 100 - last;
  return mk('risk', Math.min(90, shortfall * 1.8), {
    en: `Projected forward ${FORECAST_MONTHS} periods at the current growth rate, opex coverage still falls ${fmt(shortfall)} points short of full coverage (~${last}%) — the trend alone is not enough; a lever needs to move.`,
    ar: `عند إسقاط الاتجاه الحالي ${FORECAST_MONTHS} فترات للأمام، تظل تغطية المصروفات التشغيلية أقل من التغطية الكاملة بمقدار ${fmt(shortfall)} نقطة (~${last}%) — الاتجاه وحده غير كافٍ، ويلزم تحريك أحد المتغيرات.`,
    zh: `按当前增长率向前预测 ${FORECAST_MONTHS} 期后，运营支出覆盖率仍比全额覆盖低 ${fmt(shortfall)} 个百分点（约 ${last}%）——仅靠趋势不够，需要推动某个变量。`
  }, { en: 'Trend falls short', ar: 'الاتجاه غير كافٍ', zh: '趋势不足以补齐' });
}

function detGrowthTrajectory(ctx) {
  const ratios = [];
  for (let i = 1; i < ctx.history.length; i++) ratios.push(ctx.history[i] / ctx.history[i - 1]);
  const early = mean(ratios.slice(0, Math.ceil(ratios.length / 2)));
  const late = mean(ratios.slice(Math.ceil(ratios.length / 2)));
  if (late > early * 1.02) {
    return mk('positive', 35, {
      en: `Collection growth is accelerating — the most recent periods grew faster than the earlier ones in this window.`,
      ar: `نمو التحصيل يتسارع — سجّلت الفترات الأحدث نموًا أسرع من الفترات الأولى ضمن هذه النافذة.`,
      zh: `收缴增长正在加速——本时段内近期的增速快于早期。`
    }, { en: 'Accelerating trend', ar: 'اتجاه متسارع', zh: '增长加速' });
  }
  if (late < early * 0.98) {
    return mk('warning', 45, {
      en: `Collection growth is decelerating — the most recent periods grew slower than earlier ones, a leading signal worth watching before it shows up in the headline rate.`,
      ar: `نمو التحصيل يتباطأ — سجّلت الفترات الأحدث نموًا أبطأ من الفترات الأولى، وهو مؤشر مبكر يستحق المتابعة قبل أن ينعكس على المعدل الإجمالي.`,
      zh: `收缴增长正在放缓——近期增速慢于早期，这是一个值得关注的领先信号，可能尚未反映在总体比率中。`
    }, { en: 'Decelerating trend', ar: 'اتجاه متباطئ', zh: '增长放缓' });
  }
  return mk('neutral', 20, {
    en: `Collection growth has been steady period-over-period, with no material acceleration or deceleration.`,
    ar: `نمو التحصيل ثابت نسبيًا بين الفترات، دون تسارع أو تباطؤ جوهري.`,
    zh: `各期间收缴增长保持稳定，没有明显的加速或放缓。`
  }, { en: 'Steady trend', ar: 'اتجاه مستقر', zh: '增长平稳' });
}

function detVolatility(ctx) {
  const changes = [];
  for (let i = 1; i < ctx.history.length; i++) changes.push(Math.abs(ctx.history[i] - ctx.history[i - 1]) / ctx.history[i - 1] * 100);
  const maxSwing = Math.max(...changes);
  if (maxSwing < 8) return null;
  return mk('warning', Math.min(70, maxSwing * 2), {
    en: `Period-over-period swings of up to ${maxSwing.toFixed(1)}% appear in the collection trend — high enough to warrant checking for one-off items before relying on the trend line alone.`,
    ar: `تظهر تقلبات تصل إلى ${maxSwing.toFixed(1)}% بين الفترات في اتجاه التحصيل — وهي نسبة كافية لتستدعي التحقق من وجود بنود استثنائية قبل الاعتماد على خط الاتجاه وحده.`,
    zh: `收缴趋势中出现高达 ${maxSwing.toFixed(1)}% 的期间波动——幅度足以在仅依赖趋势线之前，先核查是否存在一次性项目。`
  }, { en: 'Volatility flag', ar: 'إشارة تذبذب', zh: '波动提示' });
}

const DETECTORS = [detCoverageGap, detOutlierProvinces, detConcentrationRisk, detExclusionDriver, detLeverDominance, detForecastTrajectory, detGrowthTrajectory, detVolatility];

export function runInsightEngine(ctx) {
  return DETECTORS.flatMap((fn) => fn(ctx) || []).filter(Boolean).sort((a, b) => b.severity - a.severity);
}

// ---------- Scenario (Level 2) detectors — react to the user's live lever/target state ----------

export function runScenarioInsights(base, levers, sim, evalResult, targetType, targetValue, impacts) {
  const out = [];
  const anyMoved = Object.values(levers).some((v) => v > 0);

  if (!anyMoved) {
    out.push(mk('neutral', 60, {
      en: `No levers engaged yet — every point of gap you see is the untouched baseline. Start with ${leverEn(impacts[0].key)}, the highest-impact lever in this model.`,
      ar: `لم يتم تفعيل أي متغيّر بعد — كل فجوة تظهر أمامك هي الأساس الحالي دون تغيير. ابدأ بـ ${leverAr(impacts[0].key)}، المتغيّر الأعلى أثرًا في هذا النموذج.`,
      zh: `尚未启用任何变量——目前看到的差距均为未经调整的基线。建议先从本模型中影响最大的变量 ${leverZh(impacts[0].key)} 开始。`
    }, { en: 'No levers engaged', ar: 'لا يوجد متغيّر مفعّل', zh: '尚未启用任何变量' }));
  } else {
    const moved = Object.entries(levers).filter(([, v]) => v > 0);
    const efficiencies = moved.map(([key, v]) => {
      const solo = simulate(base, { ...ZERO_LEVERS, [key]: v });
      return { key, perUnit: (solo.collectedValue - base.collectedValue) / v };
    }).sort((a, b) => b.perUnit - a.perUnit);
    if (efficiencies.length > 1) {
      const best = efficiencies[0];
      out.push(mk('opportunity', 55, {
        en: `Per unit moved, ${leverEn(best.key)} is currently your most efficient engaged lever (+${fmtMoney(Math.round(best.perUnit))} SAR per point) — worth pushing further before the others.`,
        ar: `لكل وحدة تم تحريكها، يُعد ${leverAr(best.key)} حاليًا المتغيّر الأكثر كفاءة من بين ما فعّلته (+${fmtMoney(Math.round(best.perUnit))} ريال لكل نقطة) — يستحق مزيدًا من الدفع قبل غيره.`,
        zh: `按每单位移动计算，${leverZh(best.key)} 是你当前启用的变量中效率最高的（每点 +${fmtMoney(Math.round(best.perUnit))} 里亚尔）——值得在其他变量之前进一步推动。`
      }, { en: 'Most efficient engaged lever', ar: 'أكفأ متغيّر مُفعّل', zh: '效率最高的已启用变量' }));
    }
  }

  const gapLabel = targetType === 'opex' ? `${Math.abs(evalResult.gap).toFixed(1)} pts` : `${fmtMoney(Math.round(Math.abs(evalResult.gap)))} SAR`;
  if (evalResult.achievableNow) {
    out.push(mk('positive', 70, {
      en: `Current lever settings already clear the target with ${gapLabel} to spare.`,
      ar: `تتجاوز الإعدادات الحالية للمتغيرات الهدف بفارق ${gapLabel}.`,
      zh: `当前变量设置已超出目标，富余 ${gapLabel}。`
    }, { en: 'Target cleared', ar: 'تم تجاوز الهدف', zh: '目标已达成' }));
  } else if (evalResult.achievableAtMax) {
    out.push(mk('warning', 75, {
      en: `Target is ${gapLabel} away at current settings, but is reachable within this model if levers are pushed further.`,
      ar: `الهدف يبعد ${gapLabel} عند الإعدادات الحالية، لكنه قابل للتحقيق ضمن هذا النموذج عند دفع المتغيرات أكثر.`,
      zh: `按当前设置，距目标还差 ${gapLabel}，但在推动变量进一步提升后，本模型下可以达成。`
    }, { en: 'Reachable with more effort', ar: 'قابل للتحقيق بجهد إضافي', zh: '加大力度即可达成' }));
  } else {
    out.push(mk('risk', 90, {
      en: `Even at maximum modeled lever settings, the target remains ${gapLabel} out of reach — it likely needs a lever outside this model, or the target/baseline should be revisited.`,
      ar: `حتى عند أقصى إعدادات للمتغيرات في هذا النموذج، يظل الهدف بعيدًا بمقدار ${gapLabel} — على الأرجح يحتاج إلى متغيّر خارج هذا النموذج، أو ينبغي مراجعة الهدف أو الأساس المعتمد.`,
      zh: `即使将变量推至本模型的最大设置，距离目标仍差 ${gapLabel}——可能需要本模型之外的手段，或应重新审视目标/基准。`
    }, { en: 'Target out of reach here', ar: 'الهدف غير قابل للتحقيق هنا', zh: '本模型下目标无法达成'  }));
  }

  return out.sort((a, b) => b.severity - a.severity);
}

// ---------- shared label maps + helpers ----------
const LEVER_NAMES = {
  invoicingGrowthPct: { en: 'invoicing growth', ar: 'نمو الفوترة', zh: '开票增长' },
  collectionRateDeltaPts: { en: 'collection-rate improvement', ar: 'تحسين معدل التحصيل', zh: '收缴率提升' },
  exclusionsRecoveredPct: { en: 'exclusions recovered', ar: 'استرداد المستبعدات', zh: '已恢复的排除金额' }
};
export const leverEn = (k) => LEVER_NAMES[k].en;
export const leverAr = (k) => LEVER_NAMES[k].ar;
export const leverZh = (k) => LEVER_NAMES[k].zh;
export const leverLabel = (k, lang) => (lang === 'ar' ? leverAr(k) : lang === 'zh' ? leverZh(k) : leverEn(k));

const EXCL_EN = { duplicate: 'Duplicate invoices', appeal: 'Under-appeal / disputed invoices', invalid_debtor: 'Struck-off registry / deceased-debtor invoices', enforcement: 'Enforcement-referred invoices' };
const EXCL_AR = { duplicate: 'الفواتير المكررة', appeal: 'الفواتير تحت الاعتراض', invalid_debtor: 'فواتير السجل المشطوب / المدين المتوفى', enforcement: 'الفواتير المحالة للتنفيذ' };
const EXCL_ZH = { duplicate: '重复发票', appeal: '申诉/争议中的发票', invalid_debtor: '注销登记/债务人已故的发票', enforcement: '已移交强制执行的发票' };

function enName(p) { return p.nameEn; }
function arName(p) { return p.nameAr; }
function fmt(n) { return Math.round(n * 10) / 10; }
function fmtMoney(n) { return n.toLocaleString('en-US'); }

let seq = 0;
function mk(category, severity, text, title, province) {
  seq += 1;
  return { id: `insight-${seq}`, category, severity: Math.round(severity), text, title, province: province || null };
}

export function insightText(insight, lang) {
  return lang === 'ar' ? insight.text.ar : lang === 'zh' ? insight.text.zh : insight.text.en;
}
export function insightTitle(insight, lang) {
  return lang === 'ar' ? insight.title.ar : lang === 'zh' ? insight.title.zh : insight.title.en;
}

export const CATEGORY_COLOR = {
  risk: 'red', warning: 'gold', opportunity: 'blue', positive: 'green', neutral: 'gray'
};
