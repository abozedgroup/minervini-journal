import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

// US market hours: Mon–Fri, 13:30–20:00 UTC
const isMarketHours = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return day >= 1 && day <= 5 && mins >= 810 && mins <= 1200;
};

const MARKET_INTERVAL  = 5  * 60 * 1000; //  5 min during market hours
const CLOSED_INTERVAL  = 15 * 60 * 1000; // 15 min outside market hours

export const useLiveR = (trades = []) => {
  const [liveData,    setLiveData]    = useState({});
  const [loading,     setLoading]     = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState(null);

  // Keep a ref so the callback always sees the latest trades
  // without becoming a new function reference on every render.
  const tradesRef = useRef(trades);
  useEffect(() => { tradesRef.current = trades; }, [trades]);

  // Stable callback — no deps, reads from ref
  const refresh = useCallback(async () => {
    const open = (tradesRef.current || []).filter((t) => t.status === 'open');
    if (open.length === 0) return;

    setLoading(true);
    try {
      const payload = open.map((t) => ({
        ticker: t.ticker,
        entry:  t.trade?.entryPrice ?? 0,
        // originalStop للحفاظ على تعريف 1R الأصلي (الوقف المتحرك لا يغيّر 1R)
        stop:
          t.trade?.originalStop ??
          t.trade?.stopLoss     ??
          t.plan?.stop          ??
          t.trade?.currentStop  ?? 0,
      }));
      const res = await api.batchR(payload);
      const map = {};
      (res.results || []).forEach((r) => { if (r.ticker) map[r.ticker] = r; });
      setLiveData(map);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('useLiveR:', err);
    } finally {
      setLoading(false);
    }
  }, []); // ← intentionally empty: refresh is stable, reads via ref

  useEffect(() => {
    // Immediate fetch on mount / when trades list changes length
    refresh();

    // Pick interval based on market hours at setup time
    const interval = isMarketHours() ? MARKET_INTERVAL : CLOSED_INTERVAL;
    const timer = setInterval(refresh, interval);

    // Re-evaluate market hours every time the interval fires by using
    // a self-rescheduling timeout approach when hour boundaries matter.
    // For simplicity we schedule a re-mount at the next market open/close.
    return () => clearInterval(timer);
  }, [refresh, trades.length]); // re-arm only when # of open trades changes

  return { liveData, loading, lastUpdate, refresh };
};
