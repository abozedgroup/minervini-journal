/**
 * Single stock record — flows through watching | ready | open | closed.
 * One source of truth; no separate trades array.
 */

import { defaultPhases, defaultNotes } from './storage';

export const STATUS = {
  WATCHING: 'watching',
  READY: 'ready',
  OPEN: 'open',
  CLOSED: 'closed',
};

/** Default plan (Phase 2 — ready) */
export function defaultPlan() {
  return {
    pivot: 0,
    stop: 0,
    resistance: null,
    rr: null,
    riskAmount: 0,
    shares: 0,
    positionValue: 0,
    positionPct: 0,
    riskPct: 1.5,
  };
}

/** Default close (Phase 4) */
export function defaultClose() {
  return {
    closePrice: null,
    closeDate: null,
    closeReason: null,
    finalR: null,
    grade: null,
    notes: '',
  };
}

/** Default trade (Phase 3 — open, filled on execute) */
export function defaultTrade() {
  return {
    entryPrice: 0,
    entryDate: '',
    shares: 0,
    slippage: 0,
    slippagePct: 0,
    actualRisk: 0,
    actualRiskPct: 0,
    currentStop: 0,
    stopHistory: [],
    partialExits: [],
    remainingShares: 0,
    currentPrice: null,
    currentR: null,
    closePrice: null,
    closeDate: null,
    closeReason: null,
    finalR: null,
    grade: null,
  };
}

/** Migrate legacy watchlist item to phase model */
export function migrateStockToPhaseModel(stock) {
  const status = stock.status || (stock.trigger > 0 && stock.stop > 0 ? STATUS.READY : STATUS.WATCHING);
  const plan = stock.plan || defaultPlan();
  if (stock.trigger != null && plan.pivot === 0) plan.pivot = stock.trigger;
  if (stock.stop != null && plan.stop === 0) plan.stop = stock.stop;
  if (stock.resistancePrice != null) plan.resistance = stock.resistancePrice;
  if (stock.rrManual != null) plan.rr = stock.rrManual;
  if (stock.riskPct != null) plan.riskPct = stock.riskPct;

  const phases = stock.phases?.trend ? stock.phases : JSON.parse(JSON.stringify(defaultPhases));
  const notes = stock.notes && typeof stock.notes === 'object'
    ? { chart: stock.notes?.chart ?? null, financial: stock.notes?.financial ?? null, daily: stock.notes?.daily ?? null, sources: stock.notes?.sources ?? null }
    : defaultNotes();

  const close = stock.close
    ? { ...defaultClose(), ...stock.close }
    : defaultClose();
  return {
    id: stock.id,
    ticker: stock.ticker,
    company: stock.company || '',
    sector: stock.sector || '',
    addedDate: stock.addedDate || stock.entryDate || new Date().toISOString(),
    status,
    notes,
    phases: typeof phases.trend?.checks !== 'undefined' ? phases : JSON.parse(JSON.stringify(defaultPhases)),
    strategies: stock.strategies || [stock.strategy].filter(Boolean),
    readiness: stock.readiness ?? 0,
    sentiment: stock.sentiment ?? null,
    discoveredFrom: stock.discoveredFrom ?? null,
    attachments: stock.attachments ?? [],
    diary: Array.isArray(stock.diary) ? stock.diary : [],
    plan: { ...defaultPlan(), ...plan },
    trade: stock.trade ? { ...defaultTrade(), ...stock.trade } : (status === STATUS.OPEN || status === STATUS.CLOSED ? stock.trade : undefined),
    close,
  };
}

/** Convert legacy trade object to stock record (for merging) */
export function tradeToStock(trade) {
  const plan = defaultPlan();
  plan.pivot = trade.entryPrice;
  plan.stop = trade.stopLoss ?? trade.originalStop ?? trade.entryPrice;
  plan.riskPct = 1.5;

  const t = {
    ...defaultTrade(),
    entryPrice: trade.entryPrice,
    entryDate: trade.entryDate,
    sharesActual: trade.shares ?? trade.sharesActual,
    currentStop: trade.stopLoss ?? trade.originalStop ?? trade.currentStop,
    stopHistory: trade.stopHistory || [],
    partialExits: trade.partialExits || [],
    remainingShares: trade.status === 'closed' ? 0 : (trade.remainingShares ?? trade.shares ?? 0),
  };
  if (trade.status !== 'closed') {
    t.slippage = trade.slippage;
    t.slippagePct = trade.slippagePct;
    t.actualRisk = (trade.entryPrice - (trade.stopLoss ?? trade.originalStop)) * (trade.shares || 0);
  }

  const close = trade.status === 'closed' ? {
    closePrice: trade.closePrice,
    closeDate: trade.closeDate,
    closeReason: trade.closeReason,
    finalR: trade.rMultiple ?? trade.finalR,
    grade: trade.grade,
    notes: trade.closeNote ?? '',
  } : undefined;

  return migrateStockToPhaseModel({
    id: trade.id,
    ticker: trade.ticker,
    company: trade.company || '',
    sector: trade.sector || '',
    addedDate: trade.entryDate,
    status: trade.status === 'closed' ? STATUS.CLOSED : STATUS.OPEN,
    notes: defaultNotes(),
    phases: JSON.parse(JSON.stringify(defaultPhases)),
    strategies: trade.strategyId ? [trade.strategyId] : [],
    readiness: 0,
    plan,
    trade: t,
    close,
  });
}

/** Merge legacy trades array into watchlist (run once to migrate) */
export function mergeTradesIntoWatchlist(watchlist, trades) {
  if (!trades || trades.length === 0) return watchlist;
  const existingIds = new Set((watchlist || []).map((s) => String(s.id)));
  const fromTrades = trades.map(tradeToStock).filter((s) => !existingIds.has(String(s.id)));
  return [...(watchlist || []), ...fromTrades];
}
