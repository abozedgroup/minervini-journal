import { defaultPhases } from './storage';
import { defaultTrendConditions, defaultEntryConditions, defaultExecutionConditions } from './technicalConditionsSchema';

const DEFAULT_EXIT_ITEMS = defaultPhases.exit.items;

// ─── New-schema helpers ────────────────────────────────────────────────────────

function trendToItems(tc) {
  const items = [];
  const p = tc?.price;
  if (p?.rows) {
    const [p1, p2, p3, p4, p5, p6] = p.rows;
    if (p1?.enabled) items.push(`السعر فوق ${p1.period} EMA`);
    if (p2?.enabled) items.push(`السعر فوق ${p2.period} SMA`);
    if (p3?.enabled) items.push(`السعر فوق ${p3.period} EMA`);
    if (p4?.enabled) items.push(`EMA ${p4.period1} فوق EMA ${p4.period2}`);
    if (p5?.enabled) items.push(`EMA ${p5.period1} فوق EMA ${p5.period2}`);
    if (p6?.enabled) items.push(`EMA ${p6.period} صاعد منذ ${p6.weeks} أسابيع`);
    (p.customRows || []).filter((r) => r.enabled).forEach((r) => items.push(r.text || 'شرط سعر مخصص'));
  }
  const rsi = tc?.rsi;
  if (rsi?.rows) {
    const [r1, r2, r3, r4] = rsi.rows;
    if (r1?.enabled) items.push(`RSI(${r1.period}) بين ${r1.min} و ${r1.max}`);
    if (r2?.enabled) items.push(`RSI(${r2.period}) فوق ${r2.threshold}`);
    if (r3?.enabled) items.push(`RSI MA ${r3.ma1} فوق MA ${r3.ma2}`);
    if (r4?.enabled) items.push(`RSI صاعد ${r4.candles} شمعة متتالية`);
    (rsi.customRows || []).filter((r) => r.enabled).forEach((r) => items.push(r.text || 'شرط RSI مخصص'));
  }
  const rs = tc?.rs;
  if (rs?.rows) {
    const [rs1, rs2, rs3] = rs.rows;
    if (rs1?.enabled) items.push(`RS Rating ≥ ${rs1.threshold}`);
    if (rs2?.enabled) items.push('RS Rating في اتجاه صاعد');
    if (rs3?.enabled) items.push(`RS Rating قرب أعلى ${rs3.pct}%`);
  }
  return items;
}

function volumeToPatternItems(tc) {
  const items = [];
  const v = tc?.volume;
  if (v?.rows) {
    const [v1, v2, v3, v4] = v.rows;
    if (v1?.enabled) items.push(`الحجم فوق MA${v1.maPeriod} بنسبة ${v1.pct}%`);
    if (v2?.enabled) items.push(`Volume Dry-Up — ${v2.days} أيام متناقصة`);
    if (v3?.enabled) items.push('OBV في اتجاه صاعد');
    if (v4?.enabled) items.push(`الحجم تحت المتوسط بـ ${v4.pct}%`);
    (v.customRows || []).filter((r) => r.enabled).forEach((r) => items.push(r.text || 'شرط حجم مخصص'));
  }
  return items;
}

function entryToPatternItems(ec) {
  const items = [];
  (ec?.patterns || []).forEach((p) => items.push(`نموذج ${p} مكتمل`));
  if (ec?.volumeAtEntry?.enabled) items.push(`حجم الدخول +${ec.volumeAtEntry.pct}% فوق المتوسط`);
  return items;
}

function executionToEntryItems(exec) {
  if (!exec?.groups?.length) return null;
  const items = exec.groups.flatMap((g) =>
    (g.items || []).filter((it) => it.enabled).map((it) => it.text || it.label || '').filter(Boolean)
  );
  return items.length ? items : null;
}

// ─── Legacy-schema helper ──────────────────────────────────────────────────────

function getTechnical(strategy) {
  if (strategy.technical && Array.isArray(strategy.technical.ma)) return strategy.technical;
  const t = strategy.formData?.technical || {};
  const ma = strategy.technical?.ma || [
    { enabled: !!t.priceAbove1, label: 'السعر فوق', value: t.ma1 || '200 EMA' },
    { enabled: !!t.priceAbove2, label: 'السعر فوق', value: t.ma2 || '50 EMA' },
    { enabled: !!t.ema50Above, label: 'EMA 50 فوق EMA', value: t.ema50Ma || '200' },
    { enabled: !!t.ema10Above, label: 'EMA 10 فوق EMA', value: t.ema10Ma || '21' },
    { enabled: !!t.ema200Rising, label: '200 EMA صاعد منذ', value: t.ema200Weeks || '4 أسابيع' },
  ];
  return {
    ma: Array.isArray(ma) ? ma : [],
    rsi: strategy.technical?.rsi || { enabled: !!(t.rsiMin != null || t.rsiMax != null), min: t.rsiMin ?? 50, max: t.rsiMax ?? 75 },
    volume: strategy.technical?.volume || {
      breakout: { enabled: !!t.volumeBreakoutPct, value: Number(t.volumeBreakoutPct) || 40 },
      dryUp: { enabled: !!t.volumeDryUp },
      obv: { enabled: !!t.obvRising },
    },
    patterns: (strategy.technical?.patterns ?? t.patterns) || [],
    rsRating: strategy.technical?.rsRating || { enabled: !!t.rsToggle, value: t.rsValue ?? 80 },
    customIndicators: (strategy.technical?.customIndicators ?? t.customIndicators) || [],
  };
}

function legacyTechToItems(tech) {
  const trend = [];
  (tech.ma || []).forEach((r) => { if (r.enabled) trend.push(`${r.label} ${r.value}`); });
  if (tech.rsi?.enabled) trend.push(`RSI بين ${tech.rsi.min} و ${tech.rsi.max}`);
  if (tech.rsRating?.enabled) trend.push(`RS Rating ≥ ${tech.rsRating.value}`);
  const pattern = [];
  (tech.patterns || []).forEach((p) => pattern.push(`نموذج ${p} مكتمل`));
  if (tech.volume?.breakout?.enabled) pattern.push(`حجم الاختراق +${tech.volume.breakout.value}% فوق المتوسط`);
  if (tech.volume?.dryUp?.enabled) pattern.push('Volume Dry-Up مكتمل');
  (tech.customIndicators || []).filter((i) => i.enabled).forEach((i) => {
    const name = (i.customName || i.indicator || '').trim() || 'مؤشر مخصص';
    pattern.push(`${name} ${(i.condition || '')} ${(i.value || '')}`.trim());
  });
  return { trend, pattern };
}

function matchCheck(phase, label) {
  if (!phase?.items || !phase?.checks) return false;
  const i = phase.items.indexOf(label);
  return i >= 0 ? !!phase.checks[i] : false;
}

// ─── Exit rules → checklist items ──────────────────────────────────────────────

function exitRulesToItems(strategy) {
  const exit = strategy.exitRules;
  const items = [];

  // New format: partialExits array at top level
  if (exit && Array.isArray(exit.partialExits)) {
    exit.partialExits.filter((p) => p.enabled).forEach((p) => {
      items.push(`خروج جزئي ${p.pct}% عند +${p.atR}R`);
    });
    (exit.behaviorExits || []).filter((b) => b.enabled).forEach((b) => {
      items.push(b.text);
    });
    if (exit.minRR) items.push(`نسبة R:R لا تقل عن ${exit.minRR}:1`);
    return items.length ? items : null;
  }

  // Legacy format: stop + profit sub-objects
  if (!exit || (typeof exit.stop !== 'object' && typeof exit.profit !== 'object')) return null;

  const stop = exit.stop || {};
  const profit = exit.profit || {};
  const risk = strategy.risk || {};

  if (stop.underLastContraction?.enabled) items.push('Stop تحت آخر تضيق في النموذج');
  if (stop.breakEMA?.enabled) items.push(`Stop عند كسر ${stop.breakEMA.value}`);
  if (stop.pctFromEntry?.enabled) items.push(`Stop عند هبوط ${stop.pctFromEntry.value}% من الدخول`);
  if (stop.peakDrop?.enabled) items.push(`تراجع ${stop.peakDrop.value}% من القمة`);
  if (stop.portfolioLossMonth?.enabled) items.push(`لا تتجاوز خسارة ${stop.portfolioLossMonth.value}% هذا الشهر`);

  (profit.partialExits || []).filter((p) => p.enabled).forEach((p) => {
    items.push(`خروج جزئي ${p.pct}% عند +${p.atR}R`);
  });
  if (profit.fullExitAtR?.enabled) items.push(`خروج كامل عند +${profit.fullExitAtR.value}R`);
  if (profit.trailingStop?.enabled) items.push(`Trailing Stop بعد +${profit.trailingStop.afterR}R — احمِ ${profit.trailingStop.protectPct}%`);
  if (profit.closeBeforeEarnings?.enabled) items.push(`أغلق قبل الإعلان بـ ${profit.closeBeforeEarnings.value} يوم`);
  if (profit.closeUnderEma?.enabled) items.push(`أغلق تحت ${profit.closeUnderEma.value} بحجم مرتفع`);
  if (profit.peakDrawdown?.enabled) items.push(`تراجع ${profit.peakDrawdown.value}% من أعلى سعر`);
  if (profit.maxDays?.enabled) items.push(`أغلق إذا لم يتحرك بعد ${profit.maxDays.value} يوم`);
  if (profit.reversalPattern?.enabled && profit.reversalPattern.value !== 'none') {
    const v = profit.reversalPattern.value;
    const label = v === 'reversal_candle' ? 'نموذج انعكاسي' : v === 'head_shoulders' ? 'رأس وكتفين' : 'نموذج انعكاسي';
    items.push(`أغلق إذا ظهر ${label}`);
  }
  if (stop.custom?.enabled && stop.custom?.text) items.push(stop.custom.text);
  if (exit.freeText?.trim()) items.push(exit.freeText.trim());

  const minRR = risk.minRR ?? exit.minRR;
  if (minRR) items.push(`نسبة R:R لا تقل عن ${minRR}:1`);

  return items.length ? items : null;
}

// ─── Grouped checklist (sub-groups per phase) ─────────────────────────────────

/**
 * Returns phases with sub-groups mirroring the strategy builder structure.
 * Each phase: { key, label, color, groups: [{ label, items }] }
 * Items across groups are ordered the same as buildChecklistFromStrategy → flat indices match.
 */
export function buildGroupedChecklist(strategy) {
  const phases = [];

  if (strategy.trendConditions && typeof strategy.trendConditions.price === 'object') {
    const tc = strategy.trendConditions;
    const ec = strategy.entryConditions || defaultEntryConditions();

    // ── Trend: السعر / RSI / RS ──────────────────────────────────────────────
    const trendGroups = [];

    const priceItems = [];
    const p = tc.price;
    if (p?.rows) {
      const [p1, p2, p3, p4, p5, p6] = p.rows;
      if (p1?.enabled) priceItems.push(`السعر فوق ${p1.period} EMA`);
      if (p2?.enabled) priceItems.push(`السعر فوق ${p2.period} SMA`);
      if (p3?.enabled) priceItems.push(`السعر فوق ${p3.period} EMA`);
      if (p4?.enabled) priceItems.push(`EMA ${p4.period1} فوق EMA ${p4.period2}`);
      if (p5?.enabled) priceItems.push(`EMA ${p5.period1} فوق EMA ${p5.period2}`);
      if (p6?.enabled) priceItems.push(`EMA ${p6.period} صاعد منذ ${p6.weeks} أسابيع`);
      (p.customRows || []).filter((r) => r.enabled).forEach((r) => priceItems.push(r.text || 'شرط سعر مخصص'));
    }
    if (priceItems.length) trendGroups.push({ label: 'السعر والمتوسطات', items: priceItems });

    const rsiItems = [];
    const rsi = tc.rsi;
    if (rsi?.rows) {
      const [r1, r2, r3, r4] = rsi.rows;
      if (r1?.enabled) rsiItems.push(`RSI(${r1.period}) بين ${r1.min} و ${r1.max}`);
      if (r2?.enabled) rsiItems.push(`RSI(${r2.period}) فوق ${r2.threshold}`);
      if (r3?.enabled) rsiItems.push(`RSI MA ${r3.ma1} فوق MA ${r3.ma2}`);
      if (r4?.enabled) rsiItems.push(`RSI صاعد ${r4.candles} شمعة متتالية`);
      (rsi.customRows || []).filter((r) => r.enabled).forEach((r) => rsiItems.push(r.text || 'شرط RSI مخصص'));
    }
    if (rsiItems.length) trendGroups.push({ label: 'RSI', items: rsiItems });

    const rsItems = [];
    const rs = tc.rs;
    if (rs?.rows) {
      const [rs1, rs2, rs3] = rs.rows;
      if (rs1?.enabled) rsItems.push(`RS Rating ≥ ${rs1.threshold}`);
      if (rs2?.enabled) rsItems.push('RS Rating في اتجاه صاعد');
      if (rs3?.enabled) rsItems.push(`RS Rating قرب أعلى ${rs3.pct}%`);
    }
    if (rsItems.length) trendGroups.push({ label: 'القوة النسبية RS', items: rsItems });

    // ── Volume → added to Trend phase ────────────────────────────────────────
    const volItems = [];
    const v = tc.volume;
    if (v?.rows) {
      const [v1, v2, v3, v4] = v.rows;
      if (v1?.enabled) volItems.push(`الحجم فوق MA${v1.maPeriod} بنسبة ${v1.pct}%`);
      if (v2?.enabled) volItems.push(`Volume Dry-Up — ${v2.days} أيام متناقصة`);
      if (v3?.enabled) volItems.push('OBV في اتجاه صاعد');
      if (v4?.enabled) volItems.push(`الحجم تحت المتوسط بـ ${v4.pct}%`);
      (v.customRows || []).filter((r) => r.enabled).forEach((r) => volItems.push(r.text || 'شرط حجم مخصص'));
    }
    if (volItems.length) trendGroups.push({ label: 'الحجم', items: volItems });

    // Push trend phase (now includes volume)
    if (trendGroups.length) phases.push({ key: 'trend', label: '📈 الاتجاه', color: 'text-teal', groups: trendGroups });

    // ── Pattern: chart patterns ONLY (always included, even if empty) ──────────
    const patternItems = [
      ...(ec.patterns || []).map((pat) => `${pat}`),
      ...(ec.customPatterns || []).map((pat) => `${pat}`),
    ];
    // Always push pattern phase so checklist always shows it
    phases.push({ key: 'pattern', label: '🔷 النموذج', color: 'text-blue-400', groups: [{ label: '', items: patternItems }], empty: patternItems.length === 0 });

    // ── Entry: execution groups + volume at entry ─────────────────────────────
    const entryGroups = [];
    if (strategy.executionConditions?.groups?.length) {
      const execGroups = strategy.executionConditions.groups
        .filter((g) => (g.items || []).some((it) => it.enabled))
        .map((g) => ({
          label: g.label || g.name || '',
          items: (g.items || []).filter((it) => it.enabled).map((it) => it.text || it.label || '').filter(Boolean),
        }))
        .filter((g) => g.items.length > 0);
      entryGroups.push(...execGroups);
    } else {
      entryGroups.push({ label: '', items: DEFAULT_ENTRY_ITEMS });
    }
    // Volume at entry belongs to entry phase, not pattern
    const volAtEntryItems = [];
    if (ec.volumeAtEntry?.enabled) volAtEntryItems.push(`حجم يوم الدخول ≥ المتوسط بـ ${ec.volumeAtEntry.pct}%`);
    if (ec.volumeAboveDays?.enabled) volAtEntryItems.push(`حجم الاختراق أعلى من ${ec.volumeAboveDays.days} أيام الماضية`);
    if (volAtEntryItems.length) entryGroups.push({ label: 'الحجم عند الدخول', items: volAtEntryItems });
    if (entryGroups.length) phases.push({ key: 'entry', label: '🟢 الدخول', color: 'text-gold', groups: entryGroups });

  } else {
    // Legacy / fallback — flat items, separate volume from patterns
    const cl = buildChecklistFromStrategy(strategy);
    const isVol = (s) => /حجم|volume/i.test(s);
    const legacyVolItems = (cl.pattern?.items || []).filter(isVol);
    const legacyPatItems = (cl.pattern?.items || []).filter((s) => !isVol(s));
    const trendAllItems  = [...(cl.trend?.items || []), ...legacyVolItems];
    if (trendAllItems.length) phases.push({ key: 'trend', label: '📈 الاتجاه', color: 'text-teal', groups: [{ label: '', items: trendAllItems }] });
    // Always include pattern phase
    phases.push({ key: 'pattern', label: '🔷 النموذج', color: 'text-blue-400', groups: [{ label: '', items: legacyPatItems }], empty: legacyPatItems.length === 0 });
    phases.push({ key: 'entry', label: '🟢 الدخول', color: 'text-gold', groups: [{ label: '', items: cl.entry?.items?.length ? cl.entry.items : DEFAULT_ENTRY_ITEMS }] });
  }

  // ── Exit ─────────────────────────────────────────────────────────────────────
  const exitItems = exitRulesToItems(strategy) || DEFAULT_EXIT_ITEMS;
  if (exitItems.length) phases.push({ key: 'exit', label: '🔴 الخروج', color: 'text-rose-400', groups: [{ label: '', items: exitItems }] });

  return phases;
}

// ─── Main export ───────────────────────────────────────────────────────────────

const DEFAULT_ENTRY_ITEMS = [
  'الاختراق بحجم 2x فوق المتوسط',
  'السوق العام (NASDAQ/SP500) إيجابي',
  'الوقت مناسب (أول 30 دقيقة)',
  'لا إعلانات أرباح خلال أسبوعين',
  'حجم المركز محسوب',
];

/** Build trend + pattern + entry phases from strategy. Preserve existing checks where item labels match. */
export function buildChecklistFromStrategy(strategy, existingPhases = null) {
  let trendItems = [];
  let patternItems = [];
  let entryItems = DEFAULT_ENTRY_ITEMS;

  // ── New schema: trendConditions + entryConditions + executionConditions ──
  if (strategy.trendConditions && typeof strategy.trendConditions.price === 'object') {
    trendItems = trendToItems(strategy.trendConditions);
    patternItems = [
      ...volumeToPatternItems(strategy.trendConditions),
      ...entryToPatternItems(strategy.entryConditions || defaultEntryConditions()),
    ];
    const execItems = executionToEntryItems(strategy.executionConditions);
    if (execItems) entryItems = execItems;

  // ── Legacy schema: strategy.technical ──
  } else {
    const tech = getTechnical(strategy);
    const hasEnabled = (tech.ma || []).some((r) => r.enabled) || tech.rsi?.enabled || tech.rsRating?.enabled;
    if (hasEnabled) {
      const { trend, pattern } = legacyTechToItems(tech);
      trendItems = trend;
      patternItems = pattern;
    } else {
      // ── Fallback: use defaultTrendConditions (covers DEFAULT_STRATEGIES with no technical data) ──
      const defaults = defaultTrendConditions();
      trendItems = trendToItems(defaults);
      patternItems = [
        ...volumeToPatternItems(defaults),
        ...(strategy.entryPatterns || []).map((p) => `نموذج ${p} مكتمل`),
      ];
    }
  }

  const trendChecks = trendItems.map((label) => matchCheck(existingPhases?.trend, label));
  const patternChecks = patternItems.map((label) => matchCheck(existingPhases?.pattern, label));
  const entryChecks = entryItems.map((_, i) => existingPhases?.entry?.checks?.[i] ?? false);

  // Build exit phase
  const exitItems = exitRulesToItems(strategy) || DEFAULT_EXIT_ITEMS;
  const exitChecks = exitItems.map((label) => matchCheck(existingPhases?.exit, label));

  return {
    trend: { label: 'الاتجاه', items: trendItems, checks: trendChecks, fromStrategy: true },
    pattern: { label: 'النموذج', items: patternItems, checks: patternChecks, fromStrategy: true },
    entry: { label: 'الدخول', items: entryItems, checks: entryChecks, fromStrategy: false },
    exit: { label: 'الخروج', items: exitItems, checks: exitChecks, fromStrategy: true },
  };
}

/** Get summary for quick reference: technical, fundamental, exit (for display in StockDetail) */
export function getStrategySummary(strategy) {
  let technical = [];

  if (strategy.trendConditions && typeof strategy.trendConditions.price === 'object') {
    technical = [
      ...trendToItems(strategy.trendConditions),
      ...volumeToPatternItems(strategy.trendConditions),
      ...entryToPatternItems(strategy.entryConditions || defaultEntryConditions()),
    ].map((l) => `✓ ${l}`);
  } else {
    const tech = getTechnical(strategy);
    (tech.ma || []).filter((r) => r.enabled).forEach((r) => technical.push(`✓ ${r.label} ${r.value}`));
    if (tech.rsRating?.enabled) technical.push(`✓ RS Rating ≥ ${tech.rsRating.value}`);
    if (tech.rsi?.enabled) technical.push(`✓ RSI ${tech.rsi.min}-${tech.rsi.max}`);
    (tech.patterns || []).forEach((p) => technical.push(`✓ ${p}`));
    if (tech.volume?.breakout?.enabled) technical.push(`✓ حجم اختراق +${tech.volume.breakout.value}%`);
    if (tech.volume?.dryUp?.enabled) technical.push('✓ Volume Dry-Up');
  }

  const fund = strategy.fundamental || strategy.formData?.fundamental || {};
  const risk = strategy.risk || strategy.formData?.risk || {};
  const exit = strategy.exitRules || {};

  const fundamental = [];
  if (fund.eps?.quarterlyGrowth?.enabled) fundamental.push(`✓ نمو EPS فصلي ≥ ${fund.eps.quarterlyGrowth.value}%`);
  if (fund.eps?.annualGrowth?.enabled) fundamental.push(`✓ نمو EPS سنوي ≥ ${fund.eps.annualGrowth.value}%`);
  if (fund.eps?.acceleration?.enabled) fundamental.push('✓ تسارع نمو EPS');
  if (fund.eps?.beatEstimates?.enabled) fundamental.push(`✓ EPS فاق التوقعات ≥ ${fund.eps.beatEstimates.value}%`);
  if (fund.revenue?.quarterlyGrowth?.enabled) fundamental.push(`✓ نمو إيرادات فصلي ≥ ${fund.revenue.quarterlyGrowth.value}%`);
  if (fund.revenue?.annualGrowth?.enabled) fundamental.push(`✓ نمو إيرادات سنوي ≥ ${fund.revenue.annualGrowth.value}%`);
  if (fund.revenue?.acceleration?.enabled) fundamental.push('✓ تسارع نمو الإيرادات');
  if (fund.margins?.netMargin?.enabled) fundamental.push(`✓ هامش صافي ≥ ${fund.margins.netMargin.value}%`);
  if (fund.margins?.grossMargin?.enabled) fundamental.push(`✓ هامش إجمالي ≥ ${fund.margins.grossMargin.value}%`);
  if (fund.balance?.deRatio?.enabled) fundamental.push(`✓ D/E ≤ ${fund.balance.deRatio.value}`);
  if (fund.balance?.float?.enabled) fundamental.push(`✓ Float ≤ ${fund.balance.float.value} مليون`);
  if (fund.institutional?.ownership?.enabled) fundamental.push(`✓ ملكية مؤسسيين ≥ ${fund.institutional.ownership.value}%`);
  if (fund.institutional?.increasing?.enabled) fundamental.push('✓ المؤسسيون يزيدون ملكيتهم');
  if (fund.earnings?.daysToNext?.enabled) fundamental.push(`✓ موعد النتائج بعد ≥ ${fund.earnings.daysToNext.value} يوم`);
  (fund.customRules || []).filter((r) => r.enabled).forEach((r) => fundamental.push(`✓ ${r.name || 'قاعدة مخصصة'}`));

  const exitLines = [];
  if (Array.isArray(exit.partialExits)) {
    exit.partialExits.filter((p) => p.enabled).forEach((p) => exitLines.push(`✓ خروج ${p.pct}% عند +${p.atR}R`));
    (exit.behaviorExits || []).filter((b) => b.enabled).forEach((b) => exitLines.push(`✓ ${b.text}`));
    exitLines.push(`Min R:R ${exit.minRR ?? risk?.minRR ?? 3}:1`);
  } else {
    const stop = exit.stop || {};
    if (stop.underLastContraction?.enabled) exitLines.push('✓ Stop تحت آخر تضيق');
    if (stop.breakEMA?.enabled) exitLines.push(`✓ Stop عند كسر ${stop.breakEMA.value}`);
    if (stop.pctFromEntry?.enabled) exitLines.push(`✓ Stop عند هبوط ${stop.pctFromEntry.value}% من الدخول`);
    if (stop.peakDrop?.enabled) exitLines.push(`✓ Stop عند هبوط ${stop.peakDrop.value}% من القمة`);
    const profit = exit.profit || {};
    (profit.partialExits || []).filter((p) => p.enabled).forEach((p) => exitLines.push(`✓ خروج ${p.pct}% عند ${p.atR}R`));
    if (profit.fullExitAtR?.enabled) exitLines.push(`✓ خروج كامل عند ${profit.fullExitAtR.value}R`);
    if (profit.trailingStop?.enabled) exitLines.push(`✓ Trailing بعد ${profit.trailingStop.afterR}R احمِ ${profit.trailingStop.protectPct}%`);
    if (profit.closeBeforeEarnings?.enabled) exitLines.push(`✓ أغلق قبل الإعلان بـ ${profit.closeBeforeEarnings.value} يوم`);
    if (profit.closeUnderEma?.enabled) exitLines.push(`✓ أغلق تحت ${profit.closeUnderEma.value} بحجم مرتفع`);
    exitLines.push(`Min R:R ${risk.minRR ?? 2}:1`);
  }

  return { technical, fundamental, exit: exitLines };
}
