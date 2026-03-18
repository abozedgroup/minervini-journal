/**
 * Portfolio intelligence engine — reads all data from localStorage
 * and returns a complete portfolio snapshot.
 */

import { getAllStocks } from './storage';
import { getTradeRemainingShares, getTradeAvgCost } from './portfolioUtils';

/**
 * @param {object} settings - { portfolioSize, maxPositionPct, ... }
 * @returns {object} portfolio snapshot for calcSmartPosition and UI
 */
export function getPortfolioIntelligence(settings) {
  let allStocks;
  try {
    allStocks = getAllStocks();
  } catch (e) {
    console.warn('getPortfolioIntelligence: getAllStocks failed', e);
    allStocks = [];
  }
  if (!Array.isArray(allStocks)) allStocks = [];
  const closedTrades = allStocks
    .filter((s) => s.status === 'closed')
    .sort((a, b) => new Date(b.close?.closeDate || 0) - new Date(a.close?.closeDate || 0));
  const openTrades = allStocks.filter((s) => s.status === 'open');

  const portfolioSize = settings?.portfolioSize || 0;

  // ── HISTORICAL STATS ──
  const totalClosed = closedTrades.length;
  const winners = closedTrades.filter((t) => (t.close?.finalR ?? 0) > 0);
  const losers = closedTrades.filter((t) => (t.close?.finalR ?? 0) <= 0);
  const winRate = totalClosed > 0 ? winners.length / totalClosed : 0;

  const avgWinR =
    winners.length > 0
      ? winners.reduce((s, t) => s + (t.close?.finalR ?? 0), 0) / winners.length
      : 0;
  const avgLossR =
    losers.length > 0
      ? Math.abs(losers.reduce((s, t) => s + (t.close?.finalR ?? 0), 0) / losers.length)
      : 1;

  // slice(0, N) لأن الترتيب تنازلي (الأحدث أولاً)
  const last20 = closedTrades.slice(0, 20);
  const avgRR =
    last20.length > 0
      ? last20.reduce((s, t) => s + (t.close?.finalR ?? 0), 0) / last20.length
      : 2;

  // pnlPct from closePrice vs entry
  const pnlPct = (t) => {
    const entry = t.trade?.entryPrice;
    const close = t.close?.closePrice;
    if (entry == null || !close || entry === 0) return 0;
    return ((close - entry) / entry) * 100;
  };
  const pnlUSD = (t) => {
    const entry = t.trade?.entryPrice;
    const close = t.close?.closePrice;
    const shares = t.trade?.sharesActual ?? t.trade?.shares ?? 0;
    if (entry == null || close == null || !shares) return 0;
    return (close - entry) * shares;
  };

  const avgGainPct =
    winners.length > 0
      ? winners.reduce((s, t) => s + (t.close?.pnlPct ?? pnlPct(t)), 0) / winners.length
      : 0;
  const avgLossPct =
    losers.length > 0
      ? Math.abs(
          losers.reduce((s, t) => s + (t.close?.pnlPct ?? pnlPct(t)), 0) / losers.length
        )
      : 1;

  // الترتيب تنازلي (index 0 = الأحدث) → نبدأ من 0
  let consecutiveLosses = 0;
  for (let i = 0; i < closedTrades.length; i++) {
    if ((closedTrades[i].close?.finalR ?? 0) <= 0) consecutiveLosses++;
    else break;
  }

  let consecutiveWins = 0;
  for (let i = 0; i < closedTrades.length; i++) {
    if ((closedTrades[i].close?.finalR ?? 0) > 0) consecutiveWins++;
    else break;
  }

  const last10 = closedTrades.slice(0, 10);
  const last10WinRate =
    last10.length > 0
      ? last10.filter((t) => (t.close?.finalR ?? 0) > 0).length / last10.length
      : 0.5;

  // ── PROGRESSIVE RISK % ──
  let baseRiskPct;
  let marketCondition;
  if (last10WinRate >= 0.6) {
    baseRiskPct = 0.02;
    marketCondition = 'easy';
  } else if (last10WinRate >= 0.4) {
    baseRiskPct = 0.015;
    marketCondition = 'normal';
  } else {
    baseRiskPct = 0.0075;
    marketCondition = 'hard';
  }

  let adjustedRiskPct = baseRiskPct;
  if (consecutiveLosses >= 5) adjustedRiskPct *= 0.5;
  else if (consecutiveLosses >= 3) adjustedRiskPct *= 0.75;

  // ── OPEN POSITIONS ──
  const openCount = openTrades.length;

  // totalInvested: رأس المال المستثمر الفعلي = الأسهم المتبقية × متوسط التكلفة
  // (يستثني الأسهم المباعة جزئياً حتى لا تُضاعَف القيمة)
  const totalInvested = openTrades.reduce((s, t) => {
    const remaining = getTradeRemainingShares(t.trade || {});
    const avgCost   = getTradeAvgCost(t.trade || {});
    return s + remaining * avgCost;
  }, 0);
  const exposurePct = portfolioSize > 0 ? totalInvested / portfolioSize : 0;

  // committedRisk: الخطر الفعلي المرتبط بالأسهم المتبقية فقط
  // يستخدم currentStop كمستوى وقف متحرك للحساب الديناميكي
  const committedRisk = openTrades.reduce((s, t) => {
    const remaining = getTradeRemainingShares(t.trade || {});
    const entry     = t.trade?.entryPrice ?? 0;
    const stop      = t.trade?.currentStop ?? t.plan?.stop ?? 0;
    const riskPerSh = Math.max(0, entry - stop);
    return s + riskPerSh * remaining;
  }, 0);
  const committedRiskPct = portfolioSize > 0 ? committedRisk / portfolioSize : 0;

  return {
    totalClosed,
    winRate,
    avgWinR,
    avgLossR,
    avgRR,
    avgGainPct,
    avgLossPct,
    consecutiveLosses,
    consecutiveWins,
    last10WinRate,
    marketCondition,
    baseRiskPct,
    adjustedRiskPct,
    openCount,
    totalInvested,
    exposurePct,
    committedRisk,
    committedRiskPct,
    openTrades,
    closedTrades,
    pnlUSD,
  };
}
