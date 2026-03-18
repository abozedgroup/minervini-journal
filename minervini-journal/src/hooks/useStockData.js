import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const useStockData = (ticker) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);

    Promise.all([api.indicators(ticker), api.price(ticker)])
      .then(([ind, price]) => {
        setData({
          ...ind,
          currentPrice: price.price,
          changePct: price.changePct,
          name: price.name,
          high52w: price.high52w,
          low52w: price.low52w,
        });
        setLastUpdated(new Date());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  useEffect(() => {
    if (!ticker) return;
    setData(null);
    fetchData();
    const timer = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [ticker, fetchData]);

  return { data, loading, error, lastUpdated, refresh: fetchData };
};
