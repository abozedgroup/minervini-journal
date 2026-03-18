/**
 * R-based performance engine — Van Tharp, Minervini, Ed Seykota style.
 * Every trade and metric expressed in R-multiples.
 */

// ─── HELPERS ─────────────────────────────────────────────

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return 0;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.max(0, Math.abs(Math.round((b - a) / 86400000)));
}

// ─── BASIC R CALCULATIONS ────────────────────────────────

/** R value (initial risk in $) */
export const calcR = (entry, stop, shares) =>
  (entry - stop) * shares;

/** R-multiple for a closed trade */
export const calcRMultiple = (exitPrice, entry, stop) => {
  const risk = entry - stop;
  if (!risk || risk <= 0) return 0;
  return (exitPrice - entry) / risk;
};

/** Current R-multiple for an open trade (live price) */
export const calcCurrentR = (currentPrice, entry, originalStop) => {
  const risk = entry - originalStop;
  if (!risk || risk <= 0) return 0;
  return (currentPrice - entry) / risk;
};

// ─── SYSTEM METRICS ──────────────────────────────────────

export function calcSystemMetrics(closedTrades) {
  if (!closedTrades || closedTrades.length === 0) return null;

  const rMultiples = closedTrades
    .map((t) => t.close?.finalR ?? t.finalR ?? t.rMultiple)
    .filter((r) => r !== undefined && r !== null);

  if (rMultiples.length === 0) return null;

  const n = rMultiples.length;
  const winners = rMultiples.filter((r) => r > 0);
  const losers = rMultiples.filter((r) => r <= 0);

  const winRate = winners.length / n;

  const avgWinR =
    winners.length > 0 ? winners.reduce((s, r) => s + r, 0) / winners.length : 0;
  const avgLossR =
    losers.length > 0 ? losers.reduce((s, r) => s + r, 0) / losers.length : -1;

  const expectancy = winRate * avgWinR + (1 - winRate) * avgLossR;

  const totalWins = winners.reduce((s, r) => s + r, 0);
  const totalLosses = Math.abs(losers.reduce((s, r) => s + r, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const payoffRatio = Math.abs(avgLossR) > 0 ? avgWinR / Math.abs(avgLossR) : 0;

  const mean = expectancy;
  const variance =
    rMultiples.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const sqn = stdDev > 0 ? (expectancy / stdDev) * Math.sqrt(n) : 0;

  const sqnLabel =
    sqn >= 3 ? 'ممتاز 🔥' :
    sqn >= 2 ? 'جيد جداً ✅' :
    sqn >= 1.6 ? 'مقبول 🟡' : 'ضعيف ⚠️';

  const breakevenWinRate = (rr) => 1 / (1 + rr);

  const largestWin = winners.length > 0 ? Math.max(...winners, 0) : 0;
  const largestLoss = losers.length > 0 ? Math.min(...losers, 0) : 0;

  let consecutiveLosses = 0;
  let consecutiveWins = 0;
  for (let i = rMultiples.length - 1; i >= 0; i--) {
    if (rMultiples[i] <= 0) {
      if (consecutiveWins > 0) break;
      consecutiveLosses++;
    } else {
      if (consecutiveLosses > 0) break;
      consecutiveWins++;
    }
  }

  let maxDrawdownR = 0;
  let currentDrawdown = 0;
  rMultiples.forEach((r) => {
    if (r < 0) {
      currentDrawdown += r;
      maxDrawdownR = Math.min(maxDrawdownR, currentDrawdown);
    } else {
      currentDrawdown = 0;
    }
  });

  let cumR = 0;
  const cumulativeR = rMultiples.map((r) => {
    cumR += r;
    return cumR;
  });

  const sortedClosed = [...(closedTrades || [])].sort(
    (a, b) =>
      new Date(a.close?.closeDate ?? a.closeDate ?? 0) -
      new Date(b.close?.closeDate ?? b.closeDate ?? 0)
  );
  const firstDate = sortedClosed[0]?.close?.closeDate ?? sortedClosed[0]?.closeDate;
  const lastDate = sortedClosed[sortedClosed.length - 1]?.close?.closeDate ?? sortedClosed[sortedClosed.length - 1]?.closeDate;
  const days = daysBetween(firstDate, lastDate);
  const months = Math.max(1, days / 30);
  const tradesPerYear = n >= 1 ? (n / months) * 12 : n;
  const annualRProjection = expectancy * tradesPerYear;

  return {
    n,
    winRate,
    avgWinR,
    avgLossR,
    expectancy,
    profitFactor,
    payoffRatio,
    sqn,
    sqnLabel,
    largestWin,
    largestLoss,
    consecutiveLosses,
    consecutiveWins,
    maxDrawdownR,
    cumulativeR,
    rMultiples,
    annualRProjection,
    tradesPerYear,
    breakevenAt2R: breakevenWinRate(2),
    breakevenAt3R: breakevenWinRate(3),
    last10WinRate:
      rMultiples.length >= 10
        ? rMultiples.slice(-10).filter((r) => r > 0).length / 10
        : winRate,
  };
}

// ─── DYNAMIC POSITION SIZING ─────────────────────────────

export function calcDynamicRisk(metrics, settings = {}) {
  const {
    winRate = 0.5,
    payoffRatio = 2,
    expectancy = 0,
    consecutiveLosses = 0,
  } = metrics || {};

  const fullKelly = winRate - (1 - winRate) / Math.max(payoffRatio, 0.01);
  const halfKelly = Math.max(0.005, Math.min(0.5, fullKelly / 2));

  const maxRisk = settings.maxRiskPct ?? 0.02;
  let riskPct = Math.min(halfKelly, maxRisk);

  const last10WinRate = metrics?.last10WinRate ?? winRate;
  let marketCondition;
  let marketLabel;
  if (last10WinRate >= 0.6) {
    marketCondition = 'easy';
    marketLabel = 'سوق سهل 🟢';
    riskPct = Math.min(riskPct * 1.0, maxRisk);
  } else if (last10WinRate >= 0.4) {
    marketCondition = 'normal';
    marketLabel = 'طبيعي 🟡';
    riskPct = Math.min(riskPct * 0.75, maxRisk * 0.75);
  } else {
    marketCondition = 'hard';
    marketLabel = 'سوق صعب 🔴';
    riskPct = Math.min(riskPct * 0.5, maxRisk * 0.5);
  }

  let penaltyLabel = '';
  if (consecutiveLosses >= 5) {
    riskPct *= 0.5;
    penaltyLabel = '⚠️ 5 خسائر متتالية — نصف الحجم';
  } else if (consecutiveLosses >= 3) {
    riskPct *= 0.75;
    penaltyLabel = '⚠️ 3 خسائر متتالية — تخفيض 25%';
  }

  if ((metrics?.sqn || 0) > 2 && consecutiveLosses === 0) {
    riskPct = Math.min(riskPct * 1.1, maxRisk);
  }

  return {
    riskPct: Math.max(0.005, riskPct),
    fullKelly,
    halfKelly,
    marketCondition,
    marketLabel,
    penaltyLabel,
    reasoning: `${marketLabel}${penaltyLabel ? ' + ' + penaltyLabel : ''}`,
  };
}

// ─── POSITION CALCULATOR ─────────────────────────────────

export function calcPosition({
  pivot,
  stop,
  portfolioSize,
  riskPct,
  maxPositionPct = 0.25,
}) {
  if (!pivot || !stop || pivot <= stop || !portfolioSize) return null;

  const riskAmount = portfolioSize * riskPct;
  const riskPerShare = pivot - stop;
  const sharesRaw = riskAmount / riskPerShare;
  const shares = Math.floor(sharesRaw);
  const positionValue = shares * pivot;
  const positionPct = positionValue / portfolioSize;

  const capped = positionPct > maxPositionPct;
  const finalShares = capped
    ? Math.floor((portfolioSize * maxPositionPct) / pivot)
    : shares;
  const finalValue = finalShares * pivot;
  const finalPct = finalValue / portfolioSize;
  const actualRiskUSD = finalShares * riskPerShare;
  const actualRiskPct = actualRiskUSD / portfolioSize;

  return {
    shares: finalShares,
    positionValue: finalValue,
    positionPct: finalPct,
    riskAmount: actualRiskUSD,
    riskPct: actualRiskPct,
    riskPerShare,
    wasCapped: capped,
  };
}

// ─── TARGET CALCULATOR ───────────────────────────────────

export function calcTargets(entry, stop, metrics = {}) {
  if (!entry || !stop || entry <= stop) return null;
  const riskPerShare = entry - stop;
  const avgRR = metrics?.avgWinR ?? 2;

  return {
    target1R: entry + 1 * riskPerShare,
    target2R: entry + 2 * riskPerShare,
    target3R: entry + 3 * riskPerShare,
    targetAvg: entry + avgRR * riskPerShare,
    riskPerShare,
    breakevenStop: entry,
  };
}

// ─── PORTFOLIO HEAT ──────────────────────────────────────

export function calcPortfolioHeat(openTrades, portfolioSize) {
  if (!portfolioSize || portfolioSize <= 0)
    return { totalRiskUSD: 0, heatPct: 0, heatLabel: '—', openCount: 0 };

  const totalRiskUSD = (openTrades || []).reduce((sum, trade) => {
    const t = trade.trade || trade;
    const shares = t.sharesActual ?? t.shares ?? 0;
    const entry = t.entryPrice ?? 0;
    const stop = t.currentStop ?? t.stopLoss ?? 0;
    const risk = Math.max(0, entry - stop) * shares;
    return sum + risk;
  }, 0);

  const heatPct = totalRiskUSD / portfolioSize;
  const heatLabel =
    heatPct <= 0.03 ? 'آمن 🟢' :
    heatPct <= 0.06 ? 'متوسط 🟡' : 'عالٍ 🔴';

  return {
    totalRiskUSD,
    heatPct,
    heatLabel,
    openCount: (openTrades || []).length,
  };
}
