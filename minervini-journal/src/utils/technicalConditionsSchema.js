/** Default data and presets for Trend, Entry, Execution conditions */

const nanoid = () => 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

const TIMEFRAMES = ['يومي', 'أسبوعي', '4 ساعات', 'ساعة', 'شهري'];

export const defaultTrendConditions = () => ({
  price: {
    enabled: true,
    rows: [
      { id: 'p1', enabled: true, period: 200, timeframe: 'يومي' },
      { id: 'p2', enabled: false, period: 150, timeframe: 'يومي' },
      { id: 'p3', enabled: true, period: 50, timeframe: 'يومي' },
      { id: 'p4', enabled: true, period1: 50, period2: 200, timeframe: 'يومي' },
      { id: 'p5', enabled: false, period1: 150, period2: 200, timeframe: 'يومي' },
      { id: 'p6', enabled: false, period: 200, weeks: 4, timeframe: 'يومي' },
    ],
    customRows: [],
  },
  rsi: {
    enabled: true,
    rows: [
      { id: 'r1', enabled: true, period: 14, min: 50, max: 80, timeframe: 'يومي' },
      { id: 'r2', enabled: false, period: 14, threshold: 50, timeframe: 'يومي' },
      { id: 'r3', enabled: false, ma1: 9, ma2: 21, timeframe: 'يومي' },
      { id: 'r4', enabled: false, candles: 3, timeframe: 'يومي' },
    ],
    customRows: [],
  },
  volume: {
    enabled: true,
    rows: [
      { id: 'v1', enabled: true, maPeriod: 20, pct: 40, timeframe: 'يومي' },
      { id: 'v2', enabled: false, days: 5, timeframe: 'يومي' },
      { id: 'v3', enabled: false, timeframe: 'يومي' },
      { id: 'v4', enabled: false, pct: 20, timeframe: 'يومي' },
    ],
    customRows: [],
  },
  rs: {
    enabled: true,
    rows: [
      { id: 'rs1', enabled: true, threshold: 80, timeframe: 'يومي' },
      { id: 'rs2', enabled: false, timeframe: 'يومي' },
      { id: 'rs3', enabled: false, pct: 20, timeframe: 'يومي' },
    ],
  },
  customText: '',
});

export const defaultEntryConditions = () => ({
  patterns: [],
  customPatterns: [],
  entryRules: [
    { id: 'er1', enabled: true, type: 'pivot_pct', value: 5 },
    { id: 'er2', enabled: false, type: 'pullback' },
    { id: 'er3', enabled: false, type: 'manual_price', value: '' },
  ],
  volumeAtEntry: { enabled: true, pct: 40 },
  volumeAboveDays: { enabled: false, days: 3 },
  freeText: '',
});

const EXEC_GROUPS = [
  { id: 'market', label: 'السوق العام' },
  { id: 'timing', label: 'التوقيت' },
  { id: 'confirm', label: 'تأكيد الدخول' },
  { id: 'manage', label: 'إدارة المركز' },
];

export const defaultExecutionConditions = () => ({
  groups: [
    {
      id: 'market',
      label: 'السوق العام',
      items: [
        { id: 'm1', enabled: true, text: 'NASDAQ إيجابي اليوم (فوق 0%)' },
        { id: 'm2', enabled: true, text: 'S&P 500 إيجابي اليوم' },
        { id: 'm3', enabled: false, text: 'VIX أقل من [25]', numValue: 25 },
      ],
    },
    {
      id: 'timing',
      label: 'التوقيت',
      items: [
        { id: 't1', enabled: true, text: 'الاختراق في أول [30] دقيقة من الجلسة', numValue: 30 },
        { id: 't2', enabled: false, text: 'تجنب آخر [30] دقيقة', numValue: 30 },
        { id: 't3', enabled: false, text: 'تجنب يوم الجمعة والخميس' },
        { id: 't4', enabled: false, text: 'تجنب الأسبوع الأول من الشهر' },
      ],
    },
    {
      id: 'confirm',
      label: 'تأكيد الدخول',
      items: [
        { id: 'c1', enabled: true, text: 'الحجم الآن ≥ [1.5]x المتوسط', numValue: 1.5 },
        { id: 'c2', enabled: true, text: 'السعر فوق Pivot بحد أقصى [5]%', numValue: 5 },
        { id: 'c3', enabled: false, text: 'لا فجوة gap كبيرة عند الفتح' },
        { id: 'c4', enabled: false, text: 'الشمعة الحالية إيجابية (خضراء)' },
      ],
    },
    {
      id: 'manage',
      label: 'إدارة المركز',
      items: [
        { id: 'g1', enabled: true, text: 'Stop Loss محدد ومحسوب' },
        { id: 'g2', enabled: true, text: 'R:R لا يقل عن [3]:1', numValue: 3 },
        { id: 'g3', enabled: true, text: 'حجم المركز لا يتجاوز [10]% من المحفظة', numValue: 10 },
        { id: 'g4', enabled: false, text: 'لم أتجاوز [2] خسارة متتالية هذا الأسبوع', numValue: 2 },
      ],
    },
  ],
});

export const TREND_PRESETS = {
  minervini: {
    price: {
      enabled: true,
      rows: [
        { id: 'p1', enabled: true, period: 200, timeframe: 'يومي' },
        { id: 'p2', enabled: false, period: 150, timeframe: 'يومي' },
        { id: 'p3', enabled: true, period: 50, timeframe: 'يومي' },
        { id: 'p4', enabled: true, period1: 50, period2: 200, timeframe: 'يومي' },
        { id: 'p5', enabled: false, period1: 150, period2: 200, timeframe: 'يومي' },
        { id: 'p6', enabled: false, period: 200, weeks: 4, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rsi: {
      enabled: true,
      rows: [
        { id: 'r1', enabled: true, period: 14, min: 50, max: 80, timeframe: 'يومي' },
        { id: 'r2', enabled: false, period: 14, threshold: 50, timeframe: 'يومي' },
        { id: 'r3', enabled: false, ma1: 9, ma2: 21, timeframe: 'يومي' },
        { id: 'r4', enabled: false, candles: 3, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    volume: {
      enabled: true,
      rows: [
        { id: 'v1', enabled: true, maPeriod: 20, pct: 40, timeframe: 'يومي' },
        { id: 'v2', enabled: false, days: 5, timeframe: 'يومي' },
        { id: 'v3', enabled: false, timeframe: 'يومي' },
        { id: 'v4', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rs: {
      enabled: true,
      rows: [
        { id: 'rs1', enabled: true, threshold: 85, timeframe: 'يومي' },
        { id: 'rs2', enabled: false, timeframe: 'يومي' },
        { id: 'rs3', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
    },
    customText: '',
  },
  oneil: {
    price: {
      enabled: true,
      rows: [
        { id: 'p1', enabled: true, period: 200, timeframe: 'يومي' },
        { id: 'p2', enabled: false, period: 150, timeframe: 'يومي' },
        { id: 'p3', enabled: true, period: 50, timeframe: 'يومي' },
        { id: 'p4', enabled: true, period1: 50, period2: 200, timeframe: 'يومي' },
        { id: 'p5', enabled: false, period1: 150, period2: 200, timeframe: 'يومي' },
        { id: 'p6', enabled: false, period: 200, weeks: 4, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rsi: { enabled: false, rows: defaultTrendConditions().rsi.rows, customRows: [] },
    volume: {
      enabled: true,
      rows: [
        { id: 'v1', enabled: true, maPeriod: 20, pct: 50, timeframe: 'يومي' },
        { id: 'v2', enabled: false, days: 5, timeframe: 'يومي' },
        { id: 'v3', enabled: false, timeframe: 'يومي' },
        { id: 'v4', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rs: {
      enabled: true,
      rows: [
        { id: 'rs1', enabled: true, threshold: 90, timeframe: 'يومي' },
        { id: 'rs2', enabled: false, timeframe: 'يومي' },
        { id: 'rs3', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
    },
    customText: '',
  },
  momentum: {
    price: {
      enabled: true,
      rows: [
        { id: 'p1', enabled: true, period: 200, timeframe: 'يومي' },
        { id: 'p2', enabled: false, period: 150, timeframe: 'يومي' },
        { id: 'p3', enabled: false, period: 50, timeframe: 'يومي' },
        { id: 'p4', enabled: false, period1: 50, period2: 200, timeframe: 'يومي' },
        { id: 'p5', enabled: false, period1: 150, period2: 200, timeframe: 'يومي' },
        { id: 'p6', enabled: false, period: 200, weeks: 4, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rsi: {
      enabled: true,
      rows: [
        { id: 'r1', enabled: true, period: 14, min: 50, max: 70, timeframe: 'يومي' },
        { id: 'r2', enabled: false, period: 14, threshold: 50, timeframe: 'يومي' },
        { id: 'r3', enabled: true, ma1: 9, ma2: 21, timeframe: 'يومي' },
        { id: 'r4', enabled: false, candles: 3, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    volume: {
      enabled: true,
      rows: [
        { id: 'v1', enabled: true, maPeriod: 20, pct: 30, timeframe: 'يومي' },
        { id: 'v2', enabled: false, days: 5, timeframe: 'يومي' },
        { id: 'v3', enabled: true, timeframe: 'يومي' },
        { id: 'v4', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
      customRows: [],
    },
    rs: {
      enabled: true,
      rows: [
        { id: 'rs1', enabled: true, threshold: 75, timeframe: 'يومي' },
        { id: 'rs2', enabled: false, timeframe: 'يومي' },
        { id: 'rs3', enabled: false, pct: 20, timeframe: 'يومي' },
      ],
    },
    customText: '',
  },
};

export const ENTRY_PRESETS = {
  minervini: { patterns: ['VCP', 'Pivot Breakout'], volumePct: 40 },
  oneil: { patterns: ['Cup & Handle', 'Flat Base'], volumePct: 50 },
  momentum: { patterns: ['RSI Bounce', 'EMA Pullback'], volumePct: 30 },
};

export const PRESET_LABELS = { minervini: 'مينيرفيني', oneil: 'وليام أونيل / CAN SLIM', momentum: 'مومنتم RSI' };

/** Flatten executionConditions.groups to executionChecklist for persistence / execution modal */
export function flattenExecutionToChecklist(executionConditions) {
  if (!executionConditions?.groups) return [];
  return executionConditions.groups.flatMap((g) =>
    (g.items || []).map((it) => ({ id: it.id, label: it.text || it.label || '', enabled: !!it.enabled }))
  );
}

/** Build executionConditions from legacy flat executionChecklist (e.g. when loading old strategy) */
export function inflateChecklistToExecution(executionChecklist) {
  const defaultExec = defaultExecutionConditions();
  if (!Array.isArray(executionChecklist) || executionChecklist.length === 0) return defaultExec;
  const byId = new Map(executionChecklist.map((it) => [it.id, it]));
  const defaultIds = (defaultExec.groups || []).flatMap((g) => (g.items || []).map((i) => i.id));
  const hasMatchingIds = executionChecklist.some((it) => defaultIds.includes(it.id));
  if (hasMatchingIds) {
    const groups = (defaultExec.groups || []).map((g) => ({
      ...g,
      items: (g.items || []).map((item) => {
        const legacy = byId.get(item.id);
        return legacy ? { ...item, text: legacy.label ?? item.text, enabled: legacy.enabled } : item;
      }),
    }));
    return { groups };
  }
  const legacyGroup = {
    id: 'legacy',
    label: 'قائمة التحقق',
    items: executionChecklist.map((it) => ({ id: it.id, enabled: !!it.enabled, text: it.label || '' })),
  };
  return { groups: [legacyGroup] };
}

export { TIMEFRAMES, nanoid };
