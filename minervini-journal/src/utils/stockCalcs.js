/**
 * Pure calculation functions for Minervini journal.
 * No side effects, no setState. Used by Watchlist, Dashboard, PlanCalculator.
 */

const round2 = (n) => (n != null && !Number.isNaN(n) ? Math.round(n * 100) / 100 : null);

export const calcPlan = (pivot, stop, settings, overrides = {}) => {
  if (!pivot || !stop || pivot <= stop) return null;
  const portfolio = settings.portfolioSize || 0;
  const riskPct = overrides.riskPct ?? settings.defaultRiskPct ?? 1.5;
  const riskAmount = portfolio * (riskPct / 100);
  const riskPerShare = pivot - stop;
  const shares = Math.floor(riskAmount / riskPerShare);
  const positionVal = shares * pivot;
  const positionPct = portfolio > 0 ? (positionVal / portfolio) * 100 : 0;
  return {
    riskAmount: round2(riskAmount),
    riskPerShare: round2(riskPerShare),
    shares,
    positionValue: round2(positionVal),
    positionPct: round2(positionPct),
    riskPct,
  };
};

export const calcRR = (pivot, stop, resistance = null, rrManual = null) => {
  if (!pivot || !stop) return null;
  const rps = pivot - stop;
  if (rps <= 0) return null;
  if (resistance != null && resistance > pivot) {
    const rr = (resistance - pivot) / rps;
    return {
      rr: round2(rr),
      targetRef: round2(resistance),
      mode: 'resistance',
    };
  }
  if (rrManual != null && rrManual > 0) {
    return {
      rr: round2(rrManual),
      targetRef: round2(pivot + rrManual * rps),
      mode: 'manual',
    };
  }
  return null;
};

export const calcSlippage = (entryPrice, pivot) => {
  if (entryPrice == null || !pivot) return null;
  const diff = entryPrice - pivot;
  const pct = (diff / pivot) * 100;
  const quality =
    pct <= 1 ? 'excellent' : pct <= 3 ? 'acceptable' : 'late';
  return {
    amount: round2(diff),
    pct: round2(pct),
    quality,
  };
};

export const calcCurrentR = (currentPrice, entry, currentStop) => {
  if (currentPrice == null || !entry || currentStop == null) return null;
  const rps = entry - currentStop;
  if (rps <= 0) return null;
  return round2((currentPrice - entry) / rps);
};

export const calcFinalR = (closePrice, entry, originalStop) => {
  if (closePrice == null || entry == null || originalStop == null) return null;
  const rps = entry - originalStop;
  if (!rps || rps <= 0) return null;
  return round2((closePrice - entry) / rps);
};

export const calcPortfolioRisk = (openTrades, portfolioSize) => {
  if (!portfolioSize || portfolioSize <= 0) return null;
  const trades = openTrades
    .map((stock) => {
      const entry = stock.trade?.entryPrice;
      const stop = stock.trade?.currentStop ?? stock.plan?.stop;
      const shares =
        stock.trade?.remainingShares ?? stock.trade?.sharesActual ?? 0;
      if (entry == null || stop == null || !shares) return null;
      const riskAmt = Math.max(0, (entry - stop) * shares);
      const riskPct = (riskAmt / portfolioSize) * 100;
      const isProtected = stop >= entry;
      return {
        ticker: stock.ticker,
        riskAmount: round2(riskAmt),
        riskPct: round2(riskPct),
        isProtected,
      };
    })
    .filter(Boolean);
  const totalRisk = trades.reduce((s, t) => s + t.riskAmount, 0);
  const totalRiskPct = (totalRisk / portfolioSize) * 100;
  const level =
    totalRiskPct <= 3 ? 'low' : totalRiskPct <= 6 ? 'medium' : 'high';
  return {
    trades,
    totalRisk: round2(totalRisk),
    totalRiskPct: round2(totalRiskPct),
    level,
  };
};

export const calcProgressiveExposure = (closedStocks) => {
  const last10 = closedStocks
    .filter((s) => s.status === 'closed')
    .sort(
      (a, b) =>
        new Date(b.close?.closeDate || 0) - new Date(a.close?.closeDate || 0)
    )
    .slice(0, 10);
  if (last10.length < 3) return null;
  const winners = last10.filter((s) => (s.close?.finalR ?? 0) > 0);
  const winRate = (winners.length / last10.length) * 100;
  const suggested = winRate >= 60 ? 2.0 : winRate >= 40 ? 1.5 : 0.75;
  const phase =
    winRate >= 60 ? 'easy' : winRate >= 40 ? 'normal' : 'hard';
  return {
    winRate: round2(winRate),
    suggested,
    phase,
    count: last10.length,
  };
};

export { round2 };
