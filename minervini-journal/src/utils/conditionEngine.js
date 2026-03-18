/** Condition builder: factory, presets, and human-readable preview */

export const nanoid = () => 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

const MA_PERIODS = [5, 8, 10, 13, 21, 34, 50, 89, 150, 200];
const TIMEFRAMES = [
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: '4h', label: '4 ساعات' },
  { value: 'hourly', label: 'ساعي' },
];

export function createCondition(overrides = {}) {
  return {
    id: nanoid(),
    enabled: true,
    type: 'comparison',
    subject: {
      indicator: 'price',
      period: null,
      maOnIndicator: null,
    },
    operator: 'above',
    object: {
      indicator: 'ema',
      period: 200,
      value: null,
      value2: null,
    },
    timeframe: 'daily',
    note: '',
    ...overrides,
  };
}

export function getTimeframeLabel(value) {
  return TIMEFRAMES.find((t) => t.value === value)?.label || value || 'يومي';
}

/** Human-readable preview for one condition */
export function conditionPreview(c) {
  if (!c || !c.enabled) return '';
  const subj = subjectLabel(c.subject);
  const op = operatorLabel(c.operator);
  const obj = objectLabel(c.object);
  const tf = getTimeframeLabel(c.timeframe);
  if (!subj || !op) return '';
  const part = obj ? `${subj} ${op} ${obj}` : `${subj} ${op}`;
  return `${part} — ${tf}`;
}

function subjectLabel(s) {
  if (!s) return '';
  if (s.indicator === 'price') return 'السعر';
  if (s.indicator === 'ema' || s.indicator === 'sma' || s.indicator === 'wma' || s.indicator === 'vwma') {
    const name = s.indicator.toUpperCase();
    return `${name}(${s.period ?? '?'})`;
  }
  if (s.indicator === 'rsi') return `RSI(${s.period ?? 14})`;
  if (s.maOnIndicator) {
    const { type, period, on, onPeriod } = s.maOnIndicator;
    return `MA(${period ?? '?'}) على RSI(${onPeriod ?? 14})`;
  }
  if (s.indicator === 'volume') return 'الحجم';
  if (s.indicator === 'volume_ma') return `متوسط الحجم(${s.period ?? 20})`;
  if (s.indicator === 'obv') return 'OBV';
  if (s.indicator === 'rvol') return 'RVOL';
  if (s.indicator === 'macd') return 'MACD';
  if (s.indicator === 'macd_signal') return 'إشارة MACD';
  if (s.indicator === 'macd_histogram') return 'هيستوغرام MACD';
  if (s.indicator === 'custom') return s.customLabel || 'مخصص';
  return s.indicator || '';
}

function operatorLabel(op) {
  const map = {
    above: 'فوق',
    below: 'تحت',
    crosses_above: 'يتقاطع فوق',
    crosses_below: 'يتقاطع تحت',
    between: 'بين',
    rising: 'صاعد',
    falling: 'هابط',
    greater_than_avg_pct: 'أكبر من المتوسط بـ',
    volume_rising: 'في تصاعد',
    volume_falling: 'في تراجع',
    direction_up: 'في اتجاه صاعد',
    direction_down: 'في اتجاه هابط',
  };
  return map[op] || op || '';
}

function objectLabel(o) {
  if (!o) return '';
  if (o.value != null && o.value2 != null) return `${o.value} و ${o.value2}`;
  if (o.value != null) return String(o.value);
  if (o.indicator === 'ema' || o.indicator === 'sma') return `${o.indicator.toUpperCase()}(${o.period ?? '?'})`;
  if (o.indicator === 'rsi') return `RSI(${o.period ?? 14})`;
  if (o.indicator === 'value') return `قيمة ${o.value}`;
  return o.indicator ? `${o.indicator}(${o.period ?? ''})` : '';
}

/** Preset groups for the library dropdown */
export const PRESET_GROUPS = {
  ma: {
    title: 'متوسطات السعر',
    presets: [
      {
        id: 'sepa',
        name: 'SEPA Setup',
        count: 4,
        conditions: [
          { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
          { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 50 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 50 }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 200 }, operator: 'direction_up', object: {}, timeframe: 'weekly' },
        ].map((c) => createCondition(c)),
      },
      {
        id: 'minervini_trend',
        name: 'Minervini Trend Template',
        count: 5,
        conditions: [
          { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
          { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 50 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 50 }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 10 }, operator: 'above', object: { indicator: 'ema', period: 21 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 200 }, operator: 'direction_up', object: {}, timeframe: 'weekly' },
        ].map((c) => createCondition(c)),
      },
      {
        id: 'oneil_simple',
        name: "O'Neil Simple",
        count: 2,
        conditions: [
          { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
          { subject: { indicator: 'ema', period: 50 }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
        ].map((c) => createCondition(c)),
      },
      {
        id: 'golden_cross',
        name: 'Golden Cross فقط',
        count: 1,
        conditions: [{ subject: { indicator: 'ema', period: 50 }, operator: 'crosses_above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
    ],
  },
  rsi: {
    title: 'RSI',
    presets: [
      {
        id: 'rsi_momentum',
        name: 'RSI مومنتم (بين 50-70)',
        count: 1,
        conditions: [{ subject: { indicator: 'rsi', period: 14 }, operator: 'between', object: { value: 50, value2: 70 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
      {
        id: 'rsi_ma',
        name: 'RSI مع متوسط (MA9 على RSI فوق MA21)',
        count: 1,
        conditions: [{ subject: { indicator: 'rsi', period: 14, maOnIndicator: { type: 'ma', period: 9, on: 'rsi', onPeriod: 14 } }, operator: 'above', object: { indicator: 'value', value: 'MA21 على RSI' }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
      {
        id: 'rsi_range',
        name: 'RSI تذبذب (بين 40-60)',
        count: 1,
        conditions: [{ subject: { indicator: 'rsi', period: 14 }, operator: 'between', object: { value: 40, value2: 60 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
    ],
  },
  volume: {
    title: 'الحجم',
    presets: [
      {
        id: 'volume_breakout',
        name: 'حجم اختراق (+40% فوق المتوسط)',
        count: 1,
        conditions: [{ subject: { indicator: 'volume' }, operator: 'greater_than_avg_pct', object: { value: 40 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
      {
        id: 'dry_up_breakout',
        name: 'Dry-Up + اختراق',
        count: 2,
        conditions: [
          { subject: { indicator: 'volume' }, operator: 'volume_falling', object: {}, timeframe: 'daily' },
          { subject: { indicator: 'volume' }, operator: 'greater_than_avg_pct', object: { value: 40 }, timeframe: 'daily' },
        ].map((c) => createCondition(c)),
      },
      {
        id: 'obv_rising',
        name: 'OBV صاعد',
        count: 1,
        conditions: [{ subject: { indicator: 'obv' }, operator: 'rising', object: {}, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
    ],
  },
  macd: {
    title: 'MACD',
    presets: [
      {
        id: 'macd_cross',
        name: 'MACD Crossover',
        count: 1,
        conditions: [{ subject: { indicator: 'macd' }, operator: 'crosses_above', object: { indicator: 'macd_signal' }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
      {
        id: 'macd_above_zero',
        name: 'MACD فوق الصفر',
        count: 1,
        conditions: [{ subject: { indicator: 'macd' }, operator: 'above', object: { value: 0 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      },
    ],
  },
};

export const SUBJECT_GROUPS = [
  {
    label: 'السعر',
    options: [{ value: 'price', label: 'السعر (current price)' }],
  },
  {
    label: 'متوسطات',
    options: [
      { value: 'ema', label: 'EMA', hasPeriod: true },
      { value: 'sma', label: 'SMA', hasPeriod: true },
      { value: 'wma', label: 'WMA', hasPeriod: true },
      { value: 'vwma', label: 'VWMA', hasPeriod: true },
    ],
  },
  {
    label: 'مؤشرات',
    options: [
      { value: 'rsi', label: 'RSI', hasPeriod: true },
      { value: 'rsi_ma', label: 'MA على RSI', hasTwoPeriods: true },
      { value: 'macd', label: 'MACD Line' },
      { value: 'macd_signal', label: 'MACD Signal' },
      { value: 'macd_histogram', label: 'MACD Histogram' },
      { value: 'stochastic_k', label: 'Stochastic K' },
      { value: 'stochastic_d', label: 'Stochastic D' },
      { value: 'atr', label: 'ATR', hasPeriod: true },
      { value: 'adx', label: 'ADX', hasPeriod: true },
      { value: 'custom', label: 'مخصص', hasCustomLabel: true },
    ],
  },
  {
    label: 'الحجم',
    options: [
      { value: 'volume', label: 'Volume' },
      { value: 'volume_ma', label: 'Volume MA', hasPeriod: true },
      { value: 'obv', label: 'OBV' },
      { value: 'rvol', label: 'RVOL' },
    ],
  },
];

export const OPERATORS_BY_SUBJECT = {
  price: [
    { value: 'above', label: 'فوق' },
    { value: 'below', label: 'تحت' },
    { value: 'crosses_above', label: 'يتقاطع فوق' },
    { value: 'crosses_below', label: 'يتقاطع تحت' },
    { value: 'between', label: 'بين' },
  ],
  ema: [
    { value: 'above', label: 'فوق' },
    { value: 'below', label: 'تحت' },
    { value: 'crosses_above', label: 'يتقاطع فوق' },
    { value: 'crosses_below', label: 'يتقاطع تحت' },
    { value: 'direction_up', label: 'في اتجاه صاعد' },
    { value: 'direction_down', label: 'في اتجاه هابط' },
  ],
  rsi: [
    { value: 'above', label: 'أكبر من' },
    { value: 'below', label: 'أصغر من' },
    { value: 'between', label: 'بين' },
    { value: 'rising', label: 'صاعد' },
    { value: 'falling', label: 'هابط' },
    { value: 'crosses_above', label: 'يتقاطع فوق' },
    { value: 'crosses_below', label: 'يتقاطع تحت' },
  ],
  volume: [
    { value: 'greater_than_avg_pct', label: 'أكبر من المتوسط بـ X%' },
    { value: 'below', label: 'أصغر من' },
    { value: 'volume_rising', label: 'أعلى من أمس' },
    { value: 'volume_falling', label: 'في تراجع' },
    { value: 'volume_rising', label: 'في تصاعد' },
  ],
  default: [
    { value: 'above', label: 'فوق' },
    { value: 'below', label: 'تحت' },
    { value: 'crosses_above', label: 'يتقاطع فوق' },
    { value: 'crosses_below', label: 'يتقاطع تحت' },
  ],
};

export function getOperatorsForSubject(indicator) {
  if (['price'].includes(indicator)) return OPERATORS_BY_SUBJECT.price;
  if (['ema', 'sma', 'wma', 'vwma'].includes(indicator)) return OPERATORS_BY_SUBJECT.ema;
  if (['rsi', 'rsi_ma'].includes(indicator)) return OPERATORS_BY_SUBJECT.rsi;
  if (['volume', 'volume_ma', 'obv', 'rvol'].includes(indicator)) return OPERATORS_BY_SUBJECT.volume;
  return OPERATORS_BY_SUBJECT.default;
}

export { MA_PERIODS, TIMEFRAMES };
