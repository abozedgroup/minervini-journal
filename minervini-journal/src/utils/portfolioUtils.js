/**
 * Minervini-style portfolio & position management helpers.
 */

import { defaultSettings as storageDefaultSettings } from './storage';

export const defaultSettings = () => ({
  ...storageDefaultSettings(),
  maxExposurePct: 70,
  minRR: 3,
});

/** Position size as % of portfolio */
export const calcPositionPct = (positionValue, portfolioSize) => {
  if (!portfolioSize || portfolioSize <= 0) return 0;
  return (positionValue / portfolioSize) * 100;
};

/** Consecutive losses: sort closed by closeDate desc, count while rMultiple < 0 */
export const getConsecutiveLosses = (trades) => {
  const closed = trades
    .filter((t) => t.status === 'closed' && t.closeDate)
    .sort((a, b) => new Date(b.closeDate) - new Date(a.closeDate));
  let count = 0;
  for (const t of closed) {
    const r = t.rMultiple;
    if (r == null || r >= 0) break;
    count += 1;
  }
  return count;
};

/** Total exposure % = sum(open position values) / portfolioSize * 100 */
export const getExposure = (openTrades, portfolioSize) => {
  if (!portfolioSize || portfolioSize <= 0) return 0;
  const total = openTrades.reduce((s, t) => s + (getTradePositionValue(t) || 0), 0);
  return (total / portfolioSize) * 100;
};

/**
 * Single trade position value: avgCost × remainingShares (الأسهم المحتفظ بها فعلاً).
 * استخدام remainingShares بدل totalShares لأن الأسهم المباعة جزئياً لم تعد في المحفظة.
 */
export const getTradePositionValue = (trade) => {
  const remaining = getTradeRemainingShares(trade);
  const avg = getTradeAvgCost(trade);
  if (remaining > 0 && avg > 0) return remaining * avg;
  return (trade.entryPrice || 0) * (trade.shares || trade.sharesActual || 0);
};

/** Total shares = initial + pyramid adds (supports shares or sharesActual) */
export const getTradeTotalShares = (trade) => {
  const initial = trade.shares ?? trade.sharesActual ?? 0;
  const adds = (trade.pyramidEntries || []).reduce((s, e) => s + (e.shares || 0), 0);
  return initial + adds;
};

/** Weighted average cost: (entry*initial + sum(price*shares for adds)) / totalShares */
export const getTradeAvgCost = (trade) => {
  const initial = trade.shares ?? trade.sharesActual ?? 0;
  const entry = trade.entryPrice || 0;
  const adds = trade.pyramidEntries || [];
  if (initial <= 0 && adds.length === 0) return entry;
  let cost = entry * initial;
  let total = initial;
  adds.forEach((e) => {
    cost += (e.price || 0) * (e.shares || 0);
    total += e.shares || 0;
  });
  return total > 0 ? cost / total : entry;
};

/** Remaining shares after partial exits — always computed (لا نثق بـ remainingShares المخزّن لأنه قديم) */
export const getTradeRemainingShares = (trade) => {
  const total = getTradeTotalShares(trade);
  const sold = (trade.partialExits || []).reduce((s, e) => s + (e.shares || 0), 0);
  return Math.max(0, total - sold);
};

/** Sector concentration: { sectorName: totalValue } then as % of portfolio */
export const getSectorConcentration = (openTrades, portfolioSize) => {
  if (!portfolioSize || portfolioSize <= 0) return [];
  const bySector = {};
  openTrades.forEach((t) => {
    const sector = t.sector || 'أخرى';
    bySector[sector] = (bySector[sector] || 0) + getTradePositionValue(t);
  });
  return Object.entries(bySector).map(([name, value]) => ({
    sector: name,
    value,
    pct: (value / portfolioSize) * 100,
  }));
};

/** Suggested risk % when 2 consecutive losses (half size) */
export const getSuggestedRiskPctForLosses = (consecutiveLosses, defaultRiskPct = 1.5) => {
  if (consecutiveLosses >= 2) return defaultRiskPct * 0.5;
  return defaultRiskPct;
};

/** Open trade risk: originalStop never changes, current stop = stopLoss or currentStop */
export const getTradeRiskMetrics = (trade, portfolioSize) => {
  const entry = trade.entryPrice || 0;
  const originalStop = trade.originalStop ?? trade.stopLoss ?? trade.currentStop;
  const currentStop = parseFloat(trade.currentStop ?? trade.stopLoss) || originalStop;
  const shares = getTradeRemainingShares(trade) || getTradeTotalShares(trade);
  const originalRisk = entry > 0 && originalStop < entry ? (entry - originalStop) * shares : 0;
  let currentRisk = entry > 0 && currentStop < entry ? (entry - currentStop) * shares : 0;
  if (currentStop >= entry) currentRisk = 0;
  const lockedProfit = currentStop >= entry ? (currentStop - entry) * shares : 0;
  const riskReduction = originalRisk - currentRisk;
  const riskPctNow = portfolioSize > 0 ? (currentRisk / portfolioSize) * 100 : 0;
  return {
    originalStop,
    currentStop,
    originalRisk,
    currentRisk,
    riskReduction,
    riskPctNow,
    lockedProfit,
    isProtected: currentStop >= entry,
    stopRaised: currentStop > originalStop,
  };
};

/** Aggregate risk across open trades for dashboard */
export const getPortfolioRiskBreakdown = (openTrades, portfolioSize) => {
  if (!portfolioSize || portfolioSize <= 0) return { totalRisk: 0, totalRiskPct: 0, freedCapital: 0, trades: [] };
  let totalOriginal = 0;
  let totalCurrent = 0;
  const trades = openTrades.map((t) => {
    const m = getTradeRiskMetrics(t, portfolioSize);
    totalOriginal += m.originalRisk;
    totalCurrent += m.currentRisk;
    return { trade: t, ...m };
  });
  const totalRisk = totalCurrent;
  const totalRiskPct = (totalRisk / portfolioSize) * 100;
  const freedCapital = totalOriginal - totalCurrent;
  return { totalRisk, totalRiskPct, freedCapital, trades };
};
