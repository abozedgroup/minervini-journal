"""
مصادر جلب أسعار الأسهم: Yahoo Finance (افتراضي)، Alpha Vantage، Twelve Data.
التبديل عبر متغير البيئة DATA_SOURCE مع المفتاح المناسب.
"""
import os
import requests

DATA_SOURCE = os.environ.get("DATA_SOURCE", "yahoo").lower().strip()
ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY", "").strip()
TWELVEDATA_API_KEY = os.environ.get("TWELVEDATA_API_KEY", "").strip()

# ─── Yahoo (yfinance) ─────────────────────────────────────────────────────
def fetch_price_yahoo(ticker: str) -> dict:
    """
    Uses history() for price (no rate-limit issues) and optionally
    fetches .info for supplementary fields (52w high/low, name, sector).
    """
    import yfinance as yf
    stock = yf.Ticker(ticker)

    # history() is reliable and not rate-limited like .info
    hist = stock.history(period="5d")
    if hist.empty:
        raise ValueError(f"No data for {ticker}")

    price = float(hist["Close"].iloc[-1])
    prev  = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
    vol   = int(hist["Volume"].iloc[-1])

    chg     = price - prev
    chg_pct = (chg / prev * 100) if prev else 0

    # 52-week range from 1-year history (avoids .info rate limits)
    try:
        hist_1y = stock.history(period="1y")
        high52w = float(hist_1y["High"].max())  if not hist_1y.empty else None
        low52w  = float(hist_1y["Low"].min())   if not hist_1y.empty else None
        avg_vol = int(hist_1y["Volume"].mean()) if not hist_1y.empty else 1
    except Exception:
        high52w = None
        low52w  = None
        avg_vol = 1

    # Try .info only for name/sector (non-critical — silently skip on failure)
    name = sector = ""
    try:
        info   = stock.fast_info          # faster, less likely to 429
        name   = getattr(info, "name",   "") or ""
        sector = ""                        # fast_info has no sector
    except Exception:
        pass
    # fallback: try slow info if fast_info unavailable
    if not name:
        try:
            slow  = stock.info
            name  = slow.get("longName", "") or slow.get("shortName", "") or ""
            sector = slow.get("sector", "") or ""
        except Exception:
            pass

    vol_ratio = round(vol / avg_vol, 2) if avg_vol else None

    return {
        "ticker":      ticker,
        "price":       round(price, 2),
        "prevClose":   round(prev, 2),
        "change":      round(chg, 2),
        "changePct":   round(chg_pct, 2),
        "change_pct":  round(chg_pct, 2),
        "volume":      vol,
        "avgVolume":   avg_vol,
        "volume_ratio": vol_ratio,
        "high52w":     round(high52w, 2) if high52w else None,
        "low52w":      round(low52w, 2)  if low52w  else None,
        "name":        name,
        "sector":      sector,
        "source":      "yahoo",
    }


# ─── Alpha Vantage ───────────────────────────────────────────────────────
def fetch_price_alphavantage(ticker: str) -> dict:
    if not ALPHAVANTAGE_API_KEY:
        raise ValueError("ALPHAVANTAGE_API_KEY not set")
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": ticker,
        "apikey": ALPHAVANTAGE_API_KEY,
    }
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    q = data.get("Global Quote")
    if not q or not isinstance(q, dict):
        msg = data.get("Note") or data.get("Error Message") or "No quote data"
        raise ValueError(msg)
    # Keys: "01. symbol", "05. price", "09. change", "10. change percent", "06. volume", "08. previous close"
    price = float(q.get("05. price") or q.get("08. previous close") or 0)
    prev = float(q.get("08. previous close") or price)
    chg = float(q.get("09. change") or 0)
    chg_pct_str = (q.get("10. change percent") or "0").strip("%")
    chg_pct = float(chg_pct_str) if chg_pct_str else (chg / prev * 100 if prev else 0)
    vol = int(float(q.get("06. volume") or 0))
    return {
        "ticker": ticker,
        "price": round(price, 2),
        "prevClose": round(prev, 2),
        "change": round(chg, 2),
        "changePct": round(chg_pct, 2),
        "change_pct": round(chg_pct, 2),
        "volume": vol,
        "avgVolume": None,
        "volume_ratio": None,
        "high52w": None,
        "low52w": None,
        "name": "",
        "sector": "",
        "source": "alphavantage",
    }


# ─── Twelve Data ─────────────────────────────────────────────────────────
def fetch_price_twelvedata(ticker: str) -> dict:
    if not TWELVEDATA_API_KEY:
        raise ValueError("TWELVEDATA_API_KEY not set")
    url = "https://api.twelvedata.com/quote"
    params = {"symbol": ticker, "apikey": TWELVEDATA_API_KEY}
    r = requests.get(url, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict) or "close" not in data:
        msg = data.get("message") or data.get("code") or "No quote data"
        raise ValueError(str(msg))
    close = float(data.get("close") or 0)
    open_ = float(data.get("open") or close)
    chg = close - open_
    chg_pct = (chg / open_ * 100) if open_ else 0
    vol = int(float(data.get("volume") or 0))
    return {
        "ticker": ticker,
        "price": round(close, 2),
        "prevClose": round(open_, 2),
        "change": round(chg, 2),
        "changePct": round(chg_pct, 2),
        "change_pct": round(chg_pct, 2),
        "volume": vol,
        "avgVolume": None,
        "volume_ratio": None,
        "high52w": None,
        "low52w": None,
        "name": data.get("name", ""),
        "sector": "",
        "source": "twelvedata",
    }


def fetch_price(ticker: str) -> dict:
    """استدعاء مصدر الأسعار الحالي وإرجاع نفس شكل الاستجابة."""
    ticker = (ticker or "").upper().strip()
    if not ticker:
        raise ValueError("Ticker required")
    if DATA_SOURCE == "alphavantage":
        out = fetch_price_alphavantage(ticker)
    elif DATA_SOURCE == "twelvedata":
        out = fetch_price_twelvedata(ticker)
    else:
        out = fetch_price_yahoo(ticker)
    return out


def get_current_source() -> str:
    """اسم المصدر الحالي للعرض في /health."""
    if DATA_SOURCE == "alphavantage":
        return "Alpha Vantage"
    if DATA_SOURCE == "twelvedata":
        return "Twelve Data"
    return "Yahoo Finance"
