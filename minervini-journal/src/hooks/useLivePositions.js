import { useState, useEffect, useCallback, useRef } from 'react';
import { generateHints } from '../utils/hintsEngine';
import { getTradeAvgCost, getTradeRemainingShares } from '../utils/portfolioUtils';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:8000';

// US market hours: Mon–Fri, 13:30–20:00 UTC
const isMarketHours = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return day >= 1 && day <= 5 && mins >= 810 && mins <= 1200;
};

const MARKET_INTERVAL = 5  * 60 * 1000; //  5 min during market hours
const CLOSED_INTERVAL = 15 * 60 * 1000; // 15 min outside market hours

function calcDaysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

async function checkBackend() {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchPrice(ticker) {
  const sanitized = (ticker || '').trim().toUpperCase();
  if (!sanitized) return null;
  try {
    const res = await fetch(`${BASE}/price/${sanitized}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error(`Failed to fetch ${sanitized}:`, e.message);
    return null;
  }
}

/**
 * Fetches live prices for open trades and enriches each with
 * unrealized P&L, current R, targets, and smart hints.
 * @param {Array} openTrades - list of stocks with status === 'open'
 * @param {object} settings - optional, for future use
 * @returns { positions, loading, lastUpdated, error, refresh }
 */
export function useLivePositions(openTrades, settings = {}) {
  const [positions,   setPositions]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error,       setError]       = useState(null);

  // Stable ref so the callback never goes stale
  const tradesRef = useRef(openTrades);
  useEffect(() => { tradesRef.current = openTrades; }, [openTrades]);

  const fetchLivePrices = useCallback(async () => {
    const openTrades = tradesRef.current;
    const open = Array.isArray(openTrades) ? openTrades : [];
    if (open.length === 0) {
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const backendAlive = await checkBackend();
    if (!backendAlive) {
      setError('backend_offline');
      setPositions(open.map((s) => ({ ...s, live: null, liveError: true })));
      setLoading(false);
      return;
    }

    const results = await Promise.allSettled(
      open.map(async (stock) => {
        const data = await fetchPrice(stock.ticker);
        if (!data) return { ...stock, live: null, liveError: true };
        try {
          const price = data.price ?? data.currentPrice ?? 0;
          const changePct = data.changePct ?? data.change_pct ?? 0;
          const volumeRatio = data.volume_ratio ?? (data.avgVolume && data.volume ? data.volume / data.avgVolume : null);

          // ── قيم الصفقة الأساسية ──
          const entry       = stock.trade?.entryPrice ?? 0;
          // originalStop: سلسلة الأولوية موحّدة مع portfolioUtils
          const originalStop =
            stock.trade?.originalStop ??
            stock.trade?.stopLoss    ??   // ← توافق البيانات القديمة
            stock.plan?.stop         ??
            stock.trade?.currentStop ?? 0;
          const currentStop  = stock.trade?.currentStop ?? originalStop;

          // avgCost يحسب المتوسط الموزون عند الهرم (pyramid)
          const avgCost      = getTradeAvgCost(stock.trade || {});
          // remainingShares = الأسهم بعد طرح أي خروج جزئي
          const remaining    = getTradeRemainingShares(stock.trade || {});

          // 1R = الخطر الأصلي وقت الدخول (لا يتغير بتحريك الوقف)
          const riskPerShare = entry - originalStop;

          // ربح/خسارة غير محقق: يعتمد على متوسط التكلفة × الأسهم المتبقية
          const unrealizedPnL    = (price - avgCost) * remaining;
          const unrealizedPnLPct = avgCost > 0 ? (price - avgCost) / avgCost : 0;
          // R الحالي: دائماً بالنسبة لسعر الدخول الأصلي و 1R الأصلي
          const currentR         = riskPerShare > 0 ? (price - entry) / riskPerShare : 0;
          // الخطر الحالي بالدولار: يستخدم الوقف المتحرك × الأسهم المتبقية
          const currentRisk      = Math.max(0, (entry - currentStop) * remaining);
          const isProtected      = currentStop >= entry;

          const target2R = entry + 2 * riskPerShare;
          const target3R = entry + 3 * riskPerShare;
          const targetAvg = stock.plan?.target ?? entry + 2.5 * riskPerShare;
          const userTarget = stock.plan?.userTarget ?? targetAvg;

          const distToTarget = userTarget > 0 && price > 0 ? ((userTarget - price) / price) * 100 : null;
          const distToStop = price > 0 ? ((price - currentStop) / price) * 100 : null;
          const pctFromEntry = entry > 0 ? ((price - entry) / entry) * 100 : null;

          const hints = generateHints({
            currentR,
            currentPrice: price,
            entry,
            currentStop,
            originalStop,
            target2R,
            target3R,
            userTarget,
            shares: remaining,        // ← الأسهم الفعلية المتبقية
            unrealizedPnL,
            isProtected,
            daysSinceEntry: calcDaysSince(stock.trade?.entryDate),
            changePct,
            volume_ratio: volumeRatio,
          });

          return {
            ...stock,
            live: {
              currentPrice: price,
              change: data.change ?? 0,
              changePct: changePct,
              unrealizedPnL,
              unrealizedPnLPct,
              currentR,
              currentRisk,
              isProtected,
              distToTarget,
              distToStop,
              pctFromEntry,
              target2R,
              target3R,
              userTarget,
              hints,
              fetchedAt: new Date(),
            },
          };
        } catch (e) {
          return { ...stock, live: null, liveError: true };
        }
      })
    );

    const enriched = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...open[i], live: null, liveError: true }
    );
    setPositions(enriched);
    setLastUpdated(new Date());
    setError(null);
    setLoading(false);
  }, []); // ← intentionally empty: reads latest trades via ref

  // Re-fetch immediately when the list of open trades changes,
  // then poll on a 5-min (market hours) / 15-min (off-hours) schedule.
  const tradeCount = (openTrades || []).length;
  useEffect(() => {
    fetchLivePrices();
    const interval = isMarketHours() ? MARKET_INTERVAL : CLOSED_INTERVAL;
    const timer = setInterval(fetchLivePrices, interval);
    return () => clearInterval(timer);
  }, [fetchLivePrices, tradeCount]);

  return { positions, loading, lastUpdated, error, refresh: fetchLivePrices };
}
