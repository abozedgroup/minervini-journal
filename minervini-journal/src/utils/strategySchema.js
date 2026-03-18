/** Default strategy structure and migration for strategies load */

export const defaultFundamental = () => ({
  eps: {
    quarterlyGrowth: { enabled: false, value: 25, timeframe: 'last' },
    annualGrowth: { enabled: false, value: 20 },
    acceleration: { enabled: false },
    beatEstimates: { enabled: false, value: 5 },
    newHigh: { enabled: false },
  },
  revenue: {
    quarterlyGrowth: { enabled: false, value: 20 },
    annualGrowth: { enabled: false, value: 15 },
    acceleration: { enabled: false },
    beatEstimates: { enabled: false },
  },
  margins: {
    netMargin: { enabled: false, value: 0 },
    grossMargin: { enabled: false, value: 0 },
    netMarginImproving: { enabled: false },
    operatingMargin: { enabled: false, value: 0 },
  },
  balance: {
    deRatio: { enabled: false, value: 1.5 },
    float: { enabled: false, value: 50 },
    currentRatio: { enabled: false, value: 1.5 },
    buyback: { enabled: false },
    roe: { enabled: false, value: 15 },
  },
  institutional: {
    ownership: { enabled: false, value: 30 },
    increasing: { enabled: false },
    newFunds: { enabled: false, value: 1 },
    aRated: { enabled: false },
  },
  earnings: {
    recentWeeks: { enabled: false, value: 8 },
    daysToNext: { enabled: false, value: 14 },
    guidancePositive: { enabled: false },
  },
  customRules: [],
});

export const defaultExitRules = () => ({
  stop: {
    underLastContraction: { enabled: false },
    breakEMA: { enabled: false, value: '21 EMA' },
    pctFromEntry: { enabled: false, value: 7 },
    peakDrop: { enabled: false, value: 10 },
    portfolioLossMonth: { enabled: false, value: 6 },
    custom: { enabled: false, text: '' },
  },
  profit: {
    partialExits: [
      { enabled: true, pct: 33, atR: 2 },
      { enabled: false, pct: 33, atR: 3 },
    ],
    fullExitAtR: { enabled: false, value: 5 },
    trailingStop: { enabled: true, afterR: 2, protectPct: 50 },
    maxDays: { enabled: false, value: 30 },
    closeBeforeEarnings: { enabled: true, value: 2 },
    reviewDays: { enabled: false, value: 5 },
    closeUnderEma: { enabled: true, value: '50 EMA' },
    peakDrawdown: { enabled: false, value: 10 },
    reversalPattern: { enabled: false, value: 'none' },
    custom: { enabled: false, text: '' },
  },
  freeText: '',
});

export const initialStrategyForm = () => ({
  name: '',
  description: '',
  type: 'mixed',
  timeframe: 'swing',
  inspiration: [],

  technical: {
    ma: [
      { enabled: false, label: 'السعر فوق', value: '200 EMA' },
      { enabled: false, label: 'السعر فوق', value: '50 EMA' },
      { enabled: false, label: 'EMA 50 فوق EMA', value: '200' },
      { enabled: false, label: 'EMA 10 فوق EMA', value: '21' },
      { enabled: false, label: '200 EMA صاعد منذ', value: '4 أسابيع' },
    ],
    rsi: { enabled: false, min: 50, max: 75 },
    volume: {
      breakout: { enabled: false, value: 40 },
      dryUp: { enabled: false },
      obv: { enabled: false },
    },
    patterns: [],
    rsRating: { enabled: false, value: 80 },
    customIndicators: [],
  },

  fundamental: defaultFundamental(),

  risk: {
    maxRiskPct: 2,
    minRR: 3,
    maxOpenTrades: 5,
    maxExposure: 50,
  },

  exitRules: defaultExitRules(),

  stats: { winRate: 0, avgR: 0, profitFactor: 0, trades: 0 },
});

/** Run on every strategies load */
export function migrateStrategy(s) {
  const hasNewExitFormat = s.exitRules && Array.isArray(s.exitRules.partialExits);
  return {
    ...s,
    fundamental: s.fundamental && typeof s.fundamental.eps === 'object' ? s.fundamental : defaultFundamental(),
    exitRules: hasNewExitFormat ? s.exitRules : (s.exitRules && typeof s.exitRules.stop === 'object' ? s.exitRules : defaultExitRules()),
  };
}

/**
 * Build the display format of exit rules for use in Watchlist/trade modals.
 * Strategy Builder still edits the full exitRules (stop, profit, freeText); this is derived on save.
 */
export function buildExitRulesForStrategy(formData) {
  const exit = formData?.exitRules || defaultExitRules();
  const risk = formData?.risk || {};
  const partialExits = (exit.profit?.partialExits || defaultExitRules().profit.partialExits).map((row, i) => ({
    id: i + 1,
    enabled: !!row.enabled,
    pct: row.pct ?? 33,
    atR: row.atR ?? 2,
  }));

  const behaviorExits = [];
  if (exit.profit?.closeUnderEma?.enabled && exit.profit.closeUnderEma.value) {
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: `إغلاق تحت ${exit.profit.closeUnderEma.value} بحجم مرتفع` });
  }
  if (exit.profit?.peakDrawdown?.enabled && exit.profit.peakDrawdown?.value != null) {
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: `تراجع ${exit.profit.peakDrawdown.value}% من أعلى سعر وصله السهم` });
  }
  if (exit.profit?.closeBeforeEarnings?.enabled && exit.profit.closeBeforeEarnings?.value != null) {
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: `أغلق قبل الإعلان الفصلي بيومين` });
  }
  if (exit.profit?.reversalPattern?.enabled && exit.profit.reversalPattern?.value !== 'none') {
    const v = exit.profit.reversalPattern.value;
    const label = v === 'reversal_candle' ? 'نموذج انعكاسي' : v === 'head_shoulders' ? 'رأس وكتفين' : 'نموذج انعكاسي';
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: `أغلق إذا ظهر ${label}` });
  }
  if (exit.stop?.custom?.enabled && exit.stop.custom?.text) {
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: exit.stop.custom.text });
  }
  if (exit.freeText && (exit.freeText || '').trim()) {
    behaviorExits.push({ id: behaviorExits.length + 1, enabled: true, text: (exit.freeText || '').trim() });
  }
  if (behaviorExits.length === 0) {
    behaviorExits.push({ id: 1, enabled: true, text: 'إغلاق تحت EMA 21 بحجم مرتفع' });
    behaviorExits.push({ id: 2, enabled: true, text: 'تراجع 10% من أعلى سعر وصله السهم' });
    behaviorExits.push({ id: 3, enabled: true, text: 'أغلق قبل الإعلان الفصلي بيومين' });
  }

  return {
    partialExits,
    behaviorExits,
    minRR: risk.minRR ?? 3,
    usePriceTarget: false,
  };
}

/** Build tags array from active rules */
export function buildTagsFromStrategy(form) {
  const tags = [];
  const t = form.technical || {};
  (t.patterns || []).forEach((p) => tags.push(p));
  (t.ma || []).filter((r) => r.enabled).forEach((r) => tags.push(`${r.label} ${r.value}`));
  if (t.rsRating?.enabled) tags.push(`RS≥${t.rsRating.value}`);
  const f = form.fundamental || {};
  if (f.eps?.quarterlyGrowth?.enabled) tags.push(`EPS+${f.eps.quarterlyGrowth.value}%`);
  if (f.eps?.annualGrowth?.enabled) tags.push(`EPS سنوي +${f.eps.annualGrowth.value}%`);
  if (f.revenue?.quarterlyGrowth?.enabled) tags.push(`Revenue+${f.revenue.quarterlyGrowth.value}%`);
  return tags;
}

/** Migrate legacy formData to new structure for loading in builder */
export function migrateFormToStrategy(legacy) {
  if (!legacy) return initialStrategyForm();
  const t = legacy.technical || {};
  const f = legacy.fundamental || {};
  const r = legacy.risk || {};
  const base = initialStrategyForm();
  return {
    ...base,
    name: legacy.name ?? '',
    description: legacy.description ?? '',
    type: legacy.type ?? 'mixed',
    timeframe: legacy.timeframe ?? 'swing',
    inspiration: legacy.inspired || legacy.inspiration || [],
    technical: {
      ...base.technical,
      ma: Array.isArray(legacy.technical?.ma) ? legacy.technical.ma : [
        { enabled: !!t.priceAbove1, label: 'السعر فوق', value: t.ma1 || '200 EMA' },
        { enabled: !!t.priceAbove2, label: 'السعر فوق', value: t.ma2 || '50 EMA' },
        { enabled: !!t.ema50Above, label: 'EMA 50 فوق EMA', value: t.ema50Ma || '200' },
        { enabled: !!t.ema10Above, label: 'EMA 10 فوق EMA', value: t.ema10Ma || '21' },
        { enabled: !!t.ema200Rising, label: '200 EMA صاعد منذ', value: t.ema200Weeks || '4 أسابيع' },
      ],
      rsi: legacy.technical?.rsi || { enabled: !!(t.rsiMin != null || t.rsiMax != null), min: t.rsiMin ?? 50, max: t.rsiMax ?? 75 },
      volume: legacy.technical?.volume || {
        breakout: { enabled: !!t.volumeBreakoutPct, value: Number(t.volumeBreakoutPct) || 40 },
        dryUp: { enabled: !!t.volumeDryUp },
        obv: { enabled: !!t.obvRising },
      },
      patterns: (legacy.technical?.patterns ?? t.patterns) || [],
      rsRating: legacy.technical?.rsRating || { enabled: !!t.rsToggle, value: t.rsValue ?? 80 },
      customIndicators: (legacy.technical?.customIndicators ?? t.customIndicators) || [],
    },
    fundamental: legacy.fundamental && typeof legacy.fundamental.eps === 'object' ? legacy.fundamental : defaultFundamental(),
    risk: {
      maxRiskPct: r.maxRiskPct ?? 2,
      minRR: r.minRR ?? 3,
      maxOpenTrades: r.maxOpenTrades ?? 5,
      maxExposure: r.maxExposurePct ?? r.maxExposure ?? 50,
    },
    exitRules: legacy.exitRules && typeof legacy.exitRules.stop === 'object' ? legacy.exitRules : defaultExitRules(),
  };
}
