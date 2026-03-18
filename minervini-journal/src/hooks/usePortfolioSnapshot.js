import { useState, useEffect, useCallback } from 'react';
import { getPortfolioIntelligence } from '../utils/portfolioIntelligence';
import { api } from '../services/api';
import { getTradeAvgCost, getTradeRemainingShares } from '../utils/portfolioUtils';

// US market hours: Mon–Fri, 13:30–20:00 UTC
const isMarketHours = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return day >= 1 && day <= 5 && mins >= 810 && mins <= 1200;
};

const MARKET_INTERVAL = 5  * 60 * 1000; //  5 min during market hours
const CLOSED_INTERVAL = 15 * 60 * 1000; // 15 min outside market hours

/**
 * Live portfolio snapshot: intelligence + Yahoo Finance prices for open positions.
 * @param {object} settings - { portfolioSize, ... }
 * @returns { snapshot, loading, refresh, lastUpdated }
 */
export function usePortfolioSnapshot(settings) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const intel = getPortfolioIntelligence(settings || {});
      const openTrades = Array.isArray(intel.openTrades) ? intel.openTrades : [];

      const tickers = openTrades.map((t) => t.ticker).filter(Boolean);
      let livePrices = {};

      if (tickers.length > 0) {
        try {
          // batchR payload: stop يعتمد على originalStop (الوقف الأصلي لحساب 1R الصحيح)
          const payload = openTrades.map((t) => ({
            ticker: t.ticker,
            entry: t.trade?.entryPrice ?? 0,
            stop:
              t.trade?.originalStop ??
              t.trade?.stopLoss      ??
              t.plan?.stop           ??
              t.trade?.currentStop   ?? 0,
          }));
          const res = await api.batchR(payload);
          (res.results || []).forEach((r) => {
            if (r.ticker) {
              livePrices[r.ticker] = {
                price:      r.current ?? r.price,
                r:          r.r_multiple,
                change_pct: r.pnl_pct ?? r.changePct ?? 0,
              };
            }
          });
        } catch (e) {
          console.warn('Yahoo Finance unavailable, using last known prices');
        }
      }

      const openWithLive = openTrades.map((t) => {
        const live = livePrices[t.ticker] || {};

        // ── قيم الدخول الأصلية ──
        const entry      = t.trade?.entryPrice ?? 0;
        // originalStop: سلسلة الأولوية موحّدة مع portfolioUtils + useLivePositions
        const origStop   =
          t.trade?.originalStop ??
          t.trade?.stopLoss     ??
          t.plan?.stop          ?? 0;
        const currentStop = t.trade?.currentStop ?? origStop;

        // avgCost يعكس الهرم (pyramid entries)
        const avgCost    = getTradeAvgCost(t.trade || {});
        // remainingShares بعد أي خروج جزئي
        const remaining  = getTradeRemainingShares(t.trade || {});

        const currentPrice =
          live.price ?? t.trade?.lastKnownPrice ?? t.trade?.entryPrice ?? 0;

        // ربح/خسارة غير محقق: avgCost × remaining (التكلفة الفعلية للمركز الحالي)
        const unrealizedPnL    = (currentPrice - avgCost) * remaining;
        const unrealizedPnLPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

        // 1R = الخطر الأصلي وقت الدخول
        const riskPerShare = Math.max(0, entry - origStop);
        // R الحالي: دائماً بالنسبة لسعر الدخول الأصلي
        const currentR     = riskPerShare > 0 ? (currentPrice - entry) / riskPerShare : 0;

        // الخطر الحالي بالدولار: الوقف المتحرك × الأسهم المتبقية
        const currentRisk  = Math.max(0, (entry - currentStop) * remaining);

        return {
          ...t,
          live: {
            currentPrice,
            unrealizedPnL,
            unrealizedPnLPct,
            currentR: live.r ?? currentR,   // live.r من الباكند يُفضَّل (أدق)
            changePct: live.change_pct ?? 0,
            currentRisk,
          },
        };
      });

      const portfolioSize = settings?.portfolioSize ?? 0;

      const totalUnrealizedPnL = openWithLive.reduce(
        (s, t) => s + (t.live?.unrealizedPnL ?? 0), 0
      );
      const totalUnrealizedPnLPct =
        portfolioSize > 0 ? (totalUnrealizedPnL / portfolioSize) * 100 : 0;

      const totalCurrentRisk = openWithLive.reduce(
        (s, t) => s + (t.live?.currentRisk ?? 0), 0
      );
      const totalCurrentRiskPct =
        portfolioSize > 0 ? (totalCurrentRisk / portfolioSize) * 100 : 0;

      // totalInvested: رأس المال المنشور فعلاً = avgCost × remaining (لا يشمل الأسهم المباعة)
      const totalInvested = openWithLive.reduce((s, t) => {
        const remaining = getTradeRemainingShares(t.trade || {});
        const avgCost   = getTradeAvgCost(t.trade || {});
        return s + remaining * avgCost;
      }, 0);
      const exposurePct =
        portfolioSize > 0 ? (totalInvested / portfolioSize) * 100 : 0;

      const closedPnL = (intel.closedTrades || []).reduce(
        (s, t) => s + (intel.pnlUSD ? intel.pnlUSD(t) : 0), 0
      );
      const closedPnLPct =
        portfolioSize > 0 ? (closedPnL / portfolioSize) * 100 : 0;
      const currentPortfolioValue = portfolioSize + closedPnL + totalUnrealizedPnL;
      const totalReturnPct =
        portfolioSize > 0
          ? ((currentPortfolioValue - portfolioSize) / portfolioSize) * 100
          : 0;

      setSnapshot({
        ...intel,
        openWithLive,
        livePrices,
        totalUnrealizedPnL,
        totalUnrealizedPnLPct,
        totalCurrentRisk,
        totalCurrentRiskPct,
        totalInvested,
        exposurePct,
        closedPnL,
        closedPnLPct,
        currentPortfolioValue,
        totalReturnPct,
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('usePortfolioSnapshot:', err);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [settings?.portfolioSize]);

  useEffect(() => {
    refresh();
    const interval = isMarketHours() ? MARKET_INTERVAL : CLOSED_INTERVAL;
    const timer = setInterval(refresh, interval);
    return () => clearInterval(timer);
  }, [refresh]);

  return { snapshot, loading, refresh, lastUpdated };
}
