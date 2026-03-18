/** Default presets when user selects an inspiration (Minervini, O'Neil, CAN SLIM, RSI) */

import { createCondition } from './conditionEngine';
import { defaultFundamental, defaultExitRules } from './strategySchema';

function mergeConditions(existing, toAdd) {
  const byKey = (c) => `${c.subject?.indicator}-${c.operator}-${c.object?.period ?? c.object?.value ?? ''}`;
  const seen = new Set((existing || []).map(byKey));
  const merged = [...(existing || [])];
  (toAdd || []).forEach((c) => {
    const key = byKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(typeof c.id !== 'undefined' ? c : createCondition(c));
    }
  });
  return merged;
}

export function getInspirationPreset(inspirationId) {
  if (inspirationId === 'minervini') {
    return {
      trendConditions: [
        { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 50 }, timeframe: 'daily' },
        { subject: { indicator: 'ema', period: 50 }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'ema', period: 150 }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'ema', period: 200 }, operator: 'direction_up', object: {}, timeframe: 'daily' },
      ].map((c) => createCondition(c)),
      trendRsiConditions: [],
      trendMacdConditions: [],
      trendVolumeConditions: [],
      rsRating: { enabled: true, value: 85 },
      entryPatterns: ['VCP'],
      entryVolumeConditions: [{ subject: { indicator: 'volume' }, operator: 'greater_than_avg_pct', object: { value: 40 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      executionChecklist: [
        { id: 'exec_1', label: 'الاختراق في أول 30 دقيقة', enabled: true },
        { id: 'exec_5', label: 'NASDAQ إيجابي اليوم', enabled: true },
        { id: 'exec_9', label: 'Stop Loss محسوب ومحدد', enabled: true },
        { id: 'exec_10', label: 'R:R لا يقل عن 3:1', enabled: true },
      ],
      fundamental: {
        ...defaultFundamental(),
        eps: {
          quarterlyGrowth: { enabled: true, value: 25, timeframe: 'last' },
          annualGrowth: { enabled: true, value: 20 },
          acceleration: { enabled: false },
          beatEstimates: { enabled: false, value: 5 },
          newHigh: { enabled: false },
        },
        revenue: {
          quarterlyGrowth: { enabled: true, value: 20 },
          annualGrowth: { enabled: false, value: 15 },
          acceleration: { enabled: false },
          beatEstimates: { enabled: false },
        },
        institutional: { ...defaultFundamental().institutional, increasing: { enabled: true } },
        earnings: {
          recentWeeks: { enabled: true, value: 8 },
          daysToNext: { enabled: true, value: 14 },
          guidancePositive: { enabled: false },
        },
      },
      risk: { maxRiskPct: 2, minRR: 3, maxOpenTrades: 5, maxExposure: 50 },
      exitRules: {
        ...defaultExitRules(),
        stop: {
          underLastContraction: { enabled: true },
          breakEMA: { enabled: true, value: '21 EMA' },
          pctFromEntry: { enabled: true, value: 7 },
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
          closeBeforeEarnings: { enabled: true, value: 2 },
          closeUnderEma: { enabled: true, value: '50 EMA' },
        },
      },
    };
  }

  if (inspirationId === 'oneil' || inspirationId === 'canslim') {
    return {
      trendConditions: [
        { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'sma', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'sma', period: 50 }, operator: 'above', object: { indicator: 'sma', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'ema', period: 10 }, operator: 'above', object: { indicator: 'ema', period: 21 }, timeframe: 'daily' },
        { subject: { indicator: 'ema', period: 21 }, operator: 'above', object: { indicator: 'ema', period: 50 }, timeframe: 'daily' },
      ].map((c) => createCondition(c)),
      trendRsiConditions: [],
      trendMacdConditions: [],
      trendVolumeConditions: [],
      rsRating: { enabled: true, value: 90 },
      entryPatterns: inspirationId === 'canslim' ? ['Cup & Handle', 'Flat Base'] : ['Cup & Handle'],
      entryVolumeConditions: [{ subject: { indicator: 'volume' }, operator: 'greater_than_avg_pct', object: { value: 50 }, timeframe: 'daily' }].map((c) => createCondition(c)),
      executionChecklist: [],
      fundamental: {
        ...defaultFundamental(),
        eps: {
          quarterlyGrowth: { enabled: true, value: 25, timeframe: 'last' },
          annualGrowth: { enabled: true, value: 25 },
          acceleration: { enabled: false },
          beatEstimates: { enabled: false, value: 5 },
          newHigh: { enabled: true },
        },
        revenue: {
          quarterlyGrowth: { enabled: true, value: 25 },
          annualGrowth: { enabled: false, value: 15 },
          acceleration: { enabled: false },
          beatEstimates: { enabled: false },
        },
        institutional: {
          ...defaultFundamental().institutional,
          increasing: { enabled: true },
          newFunds: { enabled: true, value: 3 },
        },
      },
      risk: { maxRiskPct: 2, minRR: 2.5, maxOpenTrades: 6, maxExposure: 50 },
      exitRules: {
        ...defaultExitRules(),
        stop: {
          underLastContraction: { enabled: false },
          breakEMA: { enabled: false, value: '21 EMA' },
          pctFromEntry: { enabled: true, value: 7 },
          peakDrop: { enabled: false, value: 10 },
          portfolioLossMonth: { enabled: false, value: 6 },
          custom: { enabled: false, text: '' },
        },
      },
    };
  }

  if (inspirationId === 'rsi') {
    return {
      trendConditions: [
        { subject: { indicator: 'price' }, operator: 'above', object: { indicator: 'ema', period: 200 }, timeframe: 'daily' },
        { subject: { indicator: 'rsi', period: 14 }, operator: 'between', object: { value: 50, value2: 70 }, timeframe: 'daily' },
        { subject: { indicator: 'volume' }, operator: 'volume_rising', object: {}, timeframe: 'daily' },
      ].map((c) => createCondition(c)),
      trendRsiConditions: [
        {
          subject: { indicator: 'rsi', period: 14, maOnIndicator: { type: 'ma', period: 9, on: 'rsi', onPeriod: 14 } },
          operator: 'above',
          object: { indicator: 'value', value: 0 },
          timeframe: 'daily',
        },
      ].map((c) => createCondition(c)),
      trendMacdConditions: [],
      trendVolumeConditions: [],
      rsRating: { enabled: false, value: 80 },
      entryPatterns: [],
      entryVolumeConditions: [],
      executionChecklist: [],
      fundamental: {
        ...defaultFundamental(),
        eps: { quarterlyGrowth: { enabled: true, value: 15, timeframe: 'last' }, annualGrowth: { enabled: false, value: 20 }, acceleration: { enabled: false }, beatEstimates: { enabled: false, value: 5 }, newHigh: { enabled: false } },
        revenue: { quarterlyGrowth: { enabled: true, value: 15 }, annualGrowth: { enabled: false, value: 15 }, acceleration: { enabled: false }, beatEstimates: { enabled: false } },
      },
      risk: { maxRiskPct: 1.5, minRR: 2, maxOpenTrades: 8, maxExposure: 50 },
      exitRules: defaultExitRules(),
    };
  }

  return null;
}

/** Apply one or more inspiration presets (merge conditions) */
export function applyInspirationPresets(formData, inspirationIds) {
  if (!inspirationIds?.length) return formData;
  let merged = { ...formData };
  const names = [];
  const baseExecutionList = merged.executionChecklist || [];
  const enabledExecutionIds = new Set();
  inspirationIds.forEach((id) => {
    const preset = getInspirationPreset(id);
    if (!preset) return;
    if (id === 'minervini') names.push('مينيرفيني');
    else if (id === 'oneil') names.push('وليام أونيل');
    else if (id === 'canslim') names.push('CAN SLIM');
    else if (id === 'rsi') names.push('مومنتم RSI');
    if (preset.executionChecklist?.length) {
      preset.executionChecklist.filter((e) => e.enabled).forEach((e) => enabledExecutionIds.add(e.id));
    }
    merged = {
      ...merged,
      ...preset,
      trendConditions: mergeConditions(merged.trendConditions, preset.trendConditions),
      trendRsiConditions: mergeConditions(merged.trendRsiConditions, preset.trendRsiConditions),
      trendMacdConditions: mergeConditions(merged.trendMacdConditions, preset.trendMacdConditions),
      trendVolumeConditions: mergeConditions(merged.trendVolumeConditions, preset.trendVolumeConditions),
      entryVolumeConditions: mergeConditions(merged.entryVolumeConditions, preset.entryVolumeConditions),
    };
  });
  if (enabledExecutionIds.size && baseExecutionList.length) {
    merged.executionChecklist = baseExecutionList.map((item) => ({ ...item, enabled: enabledExecutionIds.has(item.id) || item.enabled }));
  }
  return { ...merged, _presetBannerNames: names };
}
