/** Hierarchical trend conditions: IndicatorBlock, Condition, MACondition, CustomCondition */

export const nanoid = () => 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

export const defaultTrendState = () => ({
  indicators: [],
});

const INDICATOR_META = {
  price: { type: 'price', label: 'السعر', icon: '📈', color: '#06d6a0' },
  rsi: { type: 'rsi', label: 'RSI', icon: '📊', color: '#118ab2' },
  macd: { type: 'macd', label: 'MACD', icon: '📉', color: '#9b5de5' },
  volume: { type: 'volume', label: 'الحجم', icon: '📦', color: '#f0b429' },
  rs: { type: 'rs', label: 'RS Rating', icon: '⭐', color: '#ff9500' },
  custom: { type: 'custom', label: '', icon: '✏️', color: '#4a5578' },
  stochastic: { type: 'stochastic', label: 'Stochastic', icon: '〰', color: '#118ab2' },
  bollinger: { type: 'bollinger', label: 'Bollinger Bands', icon: '📐', color: '#4a5578' },
  atr: { type: 'atr', label: 'ATR', icon: '📏', color: '#4a5578' },
  adx: { type: 'adx', label: 'ADX', icon: '🔷', color: '#4a5578' },
  williams: { type: 'williams', label: "Williams %R", icon: '⚪', color: '#4a5578' },
  cci: { type: 'cci', label: 'CCI', icon: '⚪', color: '#4a5578' },
};

export function getIndicatorMeta(type) {
  return INDICATOR_META[type] || { type, label: type, icon: '●', color: '#4a5578' };
}

export function createIndicatorBlock(type, overrides = {}) {
  const meta = getIndicatorMeta(type);
  const firstCondition = type === 'price' ? createCondition({ value1: 'EMA(200)' }) : type === 'volume' ? createCondition({ operator: 'greater_than_avg_pct', value1: '40' }) : type === 'rs' ? createCondition({ operator: 'above', value1: '80' }) : createCondition();
  return {
    id: nanoid(),
    type: meta.type,
    label: overrides.label ?? meta.label,
    enabled: true,
    collapsed: false,
    conditions: [firstCondition],
    maConditions: [],
    customConditions: [],
    ...overrides,
  };
}

export function createCondition(overrides = {}) {
  return {
    id: nanoid(),
    enabled: true,
    operator: 'above',
    value1: '',
    value2: '',
    timeframe: 'يومي',
    ...overrides,
  };
}

export function createMACondition(indicatorLabel, overrides = {}) {
  return {
    id: nanoid(),
    enabled: true,
    ma1: { type: 'EMA', period: 9 },
    operator: 'above',
    ma2: { type: 'EMA', period: 21 },
    appliedOn: indicatorLabel,
    timeframe: 'يومي',
    ...overrides,
  };
}

export function createCustomCondition(overrides = {}) {
  return {
    id: nanoid(),
    enabled: true,
    text: '',
    timeframe: 'يومي',
    ...overrides,
  };
}


export const TIMEFRAMES = [
  { value: 'يومي', label: 'يومي' },
  { value: 'أسبوعي', label: 'أسبوعي' },
  { value: '4 ساعات', label: '4 ساعات' },
  { value: 'ساعة', label: 'ساعة' },
  { value: 'شهري', label: 'شهري' },
];

export const OPERATORS_PRICE = [
  { value: 'above', label: 'فوق' },
  { value: 'below', label: 'تحت' },
  { value: 'between', label: 'بين' },
  { value: 'crosses_above', label: 'يتقاطع فوق' },
  { value: 'crosses_below', label: 'يتقاطع تحت' },
];

export const OPERATORS_RSI = [
  { value: 'above', label: 'أكبر من' },
  { value: 'below', label: 'أصغر من' },
  { value: 'between', label: 'بين' },
  { value: 'rising', label: 'صاعد' },
  { value: 'falling', label: 'هابط' },
  { value: 'crosses_above_zero', label: 'يتقاطع فوق الصفر' },
  { value: 'crosses_below_zero', label: 'يتقاطع تحت الصفر' },
];

export const OPERATORS_VOLUME = [
  { value: 'greater_than_avg_pct', label: 'أكبر من المتوسط بـ %' },
  { value: 'below', label: 'أصغر من' },
  { value: 'above_yesterday', label: 'أعلى من أمس' },
  { value: 'rising', label: 'في تصاعد' },
  { value: 'falling', label: 'في تراجع' },
];

export const OPERATORS_RS = [
  { value: 'above', label: 'أكبر من' },
  { value: 'below', label: 'أصغر من' },
  { value: 'between', label: 'بين' },
];

export const OPERATORS_MA = [
  { value: 'above', label: 'فوق' },
  { value: 'below', label: 'تحت' },
  { value: 'crosses_above', label: 'يتقاطع فوق' },
  { value: 'crosses_below', label: 'يتقاطع تحت' },
];

export function getOperatorsForIndicatorType(indicatorType) {
  if (indicatorType === 'price') return OPERATORS_PRICE;
  if (['rsi', 'stochastic', 'macd'].includes(indicatorType)) return OPERATORS_RSI;
  if (indicatorType === 'volume') return OPERATORS_VOLUME;
  if (indicatorType === 'rs') return OPERATORS_RS;
  return OPERATORS_PRICE;
}

export const MA_TYPES = [
  { value: 'EMA', label: 'EMA' },
  { value: 'SMA', label: 'SMA' },
  { value: 'WMA', label: 'WMA' },
];

export const MA_PERIODS = [5, 8, 9, 10, 13, 21, 34, 50, 89, 150, 200];

export function conditionPreview(condition, indicatorType, indicatorLabel) {
  if (!condition || !condition.enabled) return '';
  const op = condition.operator;
  const v1 = condition.value1 || '—';
  const v2 = condition.value2 || '—';
  const tf = condition.timeframe || 'يومي';
  const opLabels = { above: 'فوق', below: 'تحت', between: 'بين', crosses_above: 'يتقاطع فوق', crosses_below: 'يتقاطع تحت', greater_than_avg_pct: 'أكبر من المتوسط بـ' };
  const opLabel = opLabels[op] || op;
  if (op === 'between') return `${indicatorLabel} ${opLabel} ${v1} و ${v2} — ${tf}`;
  if (op === 'greater_than_avg_pct') return `الحجم ${opLabel} ${v1}% — ${tf}`;
  return `${indicatorLabel} ${opLabel} ${v1} — ${tf}`;
}

export function maConditionPreview(maCond, indicatorLabel) {
  if (!maCond || !maCond.enabled) return '';
  const m1 = `${maCond.ma1?.type || 'EMA'}(${maCond.ma1?.period ?? 9})`;
  const m2 = `${maCond.ma2?.type || 'EMA'}(${maCond.ma2?.period ?? 21})`;
  const opLabels = { above: 'فوق', below: 'تحت', crosses_above: 'يتقاطع فوق', crosses_below: 'يتقاطع تحت' };
  const op = opLabels[maCond.operator] || maCond.operator;
  return `MA(${maCond.ma1?.period ?? 9}) على ${indicatorLabel} ${op} MA(${maCond.ma2?.period ?? 21}) على ${indicatorLabel} — ${maCond.timeframe || 'يومي'}`;
}

/** Full list (for reference); panel uses TREND_PANEL_OPTIONS only */
export const ADD_INDICATOR_OPTIONS = [
  { group: 'مؤشرات رئيسية', items: [
    { type: 'price', label: 'السعر', icon: '📈' },
    { type: 'rsi', label: 'RSI', icon: '📊' },
    { type: 'macd', label: 'MACD', icon: '📉' },
    { type: 'volume', label: 'الحجم', icon: '📦' },
    { type: 'rs', label: 'RS Rating', icon: '⭐' },
  ]},
  { group: 'مؤشرات إضافية', items: [
    { type: 'stochastic', label: 'Stochastic', icon: '〰' },
    { type: 'bollinger', label: 'Bollinger Bands', icon: '📐' },
    { type: 'atr', label: 'ATR', icon: '📏' },
    { type: 'adx', label: 'ADX', icon: '🔷' },
    { type: 'williams', label: "Williams %R", icon: '⚪' },
    { type: 'cci', label: 'CCI', icon: '⚪' },
  ]},
  { group: 'مخصص', items: [
    { type: 'custom', label: 'مؤشر مخصص', icon: '✏️' },
  ]},
];

/** Simplified panel: 5 indicators + custom, no scroll needed */
export const TREND_PANEL_OPTIONS = [
  { group: 'المؤشرات الأساسية', items: [
    { type: 'price', label: 'السعر', icon: '📈' },
    { type: 'rsi', label: 'RSI', icon: '📊' },
    { type: 'volume', label: 'الحجم', icon: '📦' },
    { type: 'rs', label: 'RS Rating', icon: '⭐' },
  ]},
  { group: 'مخصص', items: [
    { type: 'custom', label: 'مؤشر مخصص', icon: '✏️' },
  ]},
];

/** Returns indicator blocks for a named preset (minervini, oneil, rsi_momentum) */
export function getTrendPreset(name) {
  const priceLabel = 'السعر';
  if (name === 'minervini') {
    return [
      {
        id: nanoid(),
        type: 'price',
        label: priceLabel,
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: 'EMA(200)', timeframe: 'يومي' }),
          createCondition({ enabled: true, operator: 'above', value1: 'EMA(150)', timeframe: 'يومي' }),
          createCondition({ enabled: true, operator: 'above', value1: 'EMA(50)', timeframe: 'يومي' }),
        ],
        maConditions: [
          createMACondition(priceLabel, { ma1: { type: 'EMA', period: 50 }, operator: 'above', ma2: { type: 'EMA', period: 200 }, timeframe: 'يومي' }),
          createMACondition(priceLabel, { ma1: { type: 'EMA', period: 150 }, operator: 'above', ma2: { type: 'EMA', period: 200 }, timeframe: 'يومي' }),
        ],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'rsi',
        label: 'RSI',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'between', value1: '50', value2: '80', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'volume',
        label: 'الحجم',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'greater_than_avg_pct', value1: '40', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [
          createCustomCondition({ enabled: true, text: 'Volume Dry-Up في آخر 3-5 أيام قبل الاختراق', timeframe: 'يومي' }),
        ],
      },
      {
        id: nanoid(),
        type: 'rs',
        label: 'RS Rating',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: '85', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
    ];
  }
  if (name === 'oneil') {
    return [
      {
        id: nanoid(),
        type: 'price',
        label: priceLabel,
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: 'SMA(200)', timeframe: 'يومي' }),
          createCondition({ enabled: true, operator: 'above', value1: 'SMA(50)', timeframe: 'يومي' }),
        ],
        maConditions: [
          createMACondition(priceLabel, { ma1: { type: 'EMA', period: 10 }, operator: 'above', ma2: { type: 'EMA', period: 21 }, timeframe: 'يومي' }),
          createMACondition(priceLabel, { ma1: { type: 'EMA', period: 21 }, operator: 'above', ma2: { type: 'EMA', period: 50 }, timeframe: 'يومي' }),
        ],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'rs',
        label: 'RS Rating',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: '90', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'volume',
        label: 'الحجم',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'greater_than_avg_pct', value1: '50', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
    ];
  }
  if (name === 'rsi_momentum') {
    return [
      {
        id: nanoid(),
        type: 'price',
        label: priceLabel,
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: 'EMA(200)', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'rsi',
        label: 'RSI',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'between', value1: '50', value2: '70', timeframe: 'يومي' }),
        ],
        maConditions: [
          createMACondition('RSI', { ma1: { type: 'EMA', period: 9 }, operator: 'above', ma2: { type: 'EMA', period: 21 }, timeframe: 'يومي' }),
        ],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'volume',
        label: 'الحجم',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'rising', value1: '', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
      {
        id: nanoid(),
        type: 'rs',
        label: 'RS Rating',
        enabled: true,
        collapsed: false,
        conditions: [
          createCondition({ enabled: true, operator: 'above', value1: '75', timeframe: 'يومي' }),
        ],
        maConditions: [],
        customConditions: [],
      },
    ];
  }
  return null;
}

export const TREND_PRESET_LABELS = { minervini: 'مينيرفيني', oneil: 'وليام أونيل / CAN SLIM', rsi_momentum: 'مومنتم RSI' };
