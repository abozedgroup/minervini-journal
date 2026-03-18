try:
    from dotenv import load_dotenv
    from pathlib import Path
    _env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(_env_path)
except ImportError:
    pass

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import sqlite3
import hashlib
import secrets
import os

from price_providers import fetch_price, get_current_source

app = FastAPI(title="Minervini Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database setup ──
# On Render, use /data mount for persistence; locally use current dir
_data_dir = "/data" if os.path.isdir("/data") else os.path.dirname(__file__)
DB_PATH = os.path.join(_data_dir, "users.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            portfolio_size REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tokens (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{h}", salt

def verify_password(password: str, stored_hash: str) -> bool:
    parts = stored_hash.split(":")
    if len(parts) != 2:
        # Legacy: plain sha256 (old hashes without salt)
        return hashlib.sha256(password.encode()).hexdigest() == stored_hash
    salt, _ = parts
    computed, _ = hash_password(password, salt)
    return computed == stored_hash

def create_token(username: str) -> str:
    token = secrets.token_hex(32)
    expires = (datetime.now() + timedelta(days=30)).isoformat()
    conn = get_db()
    conn.execute("INSERT INTO tokens VALUES (?, ?, ?)", (token, username, expires))
    conn.commit()
    conn.close()
    return token

def get_user_from_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    conn = get_db()
    row = conn.execute(
        "SELECT username, expires_at FROM tokens WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    if datetime.fromisoformat(row["expires_at"]) < datetime.now():
        return None
    return row["username"]

# ── Auth endpoints ──
@app.post("/auth/register")
def register(body: dict):
    username = (body.get("username") or "").strip().lower()
    password = body.get("password") or ""
    portfolio_size = body.get("portfolioSize") or 0

    if not username or len(username) < 3:
        raise HTTPException(400, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
    if not password or len(password) < 6:
        raise HTTPException(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")

    conn = get_db()
    existing = conn.execute("SELECT username FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(409, "اسم المستخدم موجود بالفعل، اختر اسماً آخر")

    pw_hash, _ = hash_password(password)
    conn.execute(
        "INSERT INTO users (username, password_hash, portfolio_size) VALUES (?, ?, ?)",
        (username, pw_hash, float(portfolio_size))
    )
    conn.commit()
    conn.close()

    token = create_token(username)
    return {"token": token, "username": username, "portfolioSize": float(portfolio_size)}

@app.post("/auth/login")
def login(body: dict):
    username = (body.get("username") or "").strip().lower()
    password = body.get("password") or ""

    if not username or not password:
        raise HTTPException(400, "أدخل اسم المستخدم وكلمة المرور")

    conn = get_db()
    row = conn.execute(
        "SELECT username, password_hash, portfolio_size FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()

    if not row or not verify_password(password, row["password_hash"]):
        raise HTTPException(401, "اسم المستخدم أو كلمة المرور غير صحيحة")

    token = create_token(username)
    return {"token": token, "username": username, "portfolioSize": row["portfolio_size"]}

@app.get("/auth/me")
def me(authorization: str = Header(None)):
    username = get_user_from_token(authorization)
    if not username:
        raise HTTPException(401, "غير مصرح — الرجاء تسجيل الدخول")
    conn = get_db()
    row = conn.execute("SELECT username, portfolio_size FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "المستخدم غير موجود")
    return {"username": row["username"], "portfolioSize": row["portfolio_size"]}

@app.post("/auth/logout")
def logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        conn = get_db()
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"status": "logged out"}

@app.put("/auth/portfolio")
def update_portfolio(body: dict, authorization: str = Header(None)):
    username = get_user_from_token(authorization)
    if not username:
        raise HTTPException(401, "غير مصرح")
    portfolio_size = body.get("portfolioSize", 0)
    conn = get_db()
    conn.execute("UPDATE users SET portfolio_size = ? WHERE username = ?", (float(portfolio_size), username))
    conn.commit()
    conn.close()
    return {"status": "updated", "portfolioSize": float(portfolio_size)}

# ── Simple in-memory cache ──
cache = {}
def get_cached(key, fetch_fn, ttl=900):
    now = datetime.now().timestamp()
    if key in cache:
        data, ts = cache[key]
        if now - ts < ttl:
            return data
    data = fetch_fn()
    cache[key] = (data, now)
    return data

# ── Helpers ──
def calc_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def calc_sma(series, period):
    return series.rolling(window=period).mean()

def calc_rsi(series, period=14):
    delta = series.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    avgG  = gain.ewm(alpha=1/period, adjust=False).mean()
    avgL  = loss.ewm(alpha=1/period, adjust=False).mean()
    rs    = avgG / avgL
    return 100 - (100 / (1 + rs))

# ─────────────────────────────────────
# GET /health
# ─────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "source": get_current_source(),
        "time":   datetime.now().isoformat(),
    }

# ─────────────────────────────────────
# GET /price/{ticker}
# ─────────────────────────────────────
@app.get("/price/{ticker}")
def get_price(ticker: str):
    ticker = ticker.upper()

    def fetch():
        try:
            out = fetch_price(ticker)
            out["updated"] = datetime.now().isoformat()
            return out
        except ValueError as e:
            raise HTTPException(404, str(e))
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "too many requests" in err:
                raise HTTPException(429, "Too many requests — try again later or set DATA_SOURCE to alphavantage/twelvedata with API key")
            raise HTTPException(502, f"Price fetch failed: {e}")

    return get_cached(f"price_{ticker}", fetch, ttl=300)

# ─────────────────────────────────────
# GET /indicators/{ticker}
# ─────────────────────────────────────
@app.get("/indicators/{ticker}")
def get_indicators(ticker: str, days: int = 300):
    ticker = ticker.upper()

    def fetch():
        stock = yf.Ticker(ticker)
        df    = stock.history(period="1y" if days<=365 else "2y")

        if df.empty:
            raise HTTPException(404, f"No data for {ticker}")

        close  = df["Close"]
        volume = df["Volume"]
        high   = df["High"]
        low    = df["Low"]

        # Moving averages
        df["ema10"]  = calc_ema(close, 10)
        df["ema21"]  = calc_ema(close, 21)
        df["ema50"]  = calc_ema(close, 50)
        df["ema150"] = calc_ema(close, 150)
        df["ema200"] = calc_ema(close, 200)
        df["sma200"] = calc_sma(close, 200)

        # Volume MA
        df["volMa20"] = calc_sma(volume, 20)

        # RSI
        df["rsi14"]  = calc_rsi(close, 14)
        df["rsiMa9"] = calc_ema(df["rsi14"], 9)
        df["rsiMa21"]= calc_ema(df["rsi14"], 21)

        # 52w high/low — use max/min of full 1-year history to avoid NaN from rolling
        import math
        _h52 = float(high.max())
        _l52 = float(low.min())
        high52 = _h52 if not math.isnan(_h52) else None
        low52  = _l52 if not math.isnan(_l52) else None

        last  = df.iloc[-1]
        prev  = df.iloc[-2] if len(df) > 1 else last
        ago20 = df["ema200"].iloc[-20] if len(df)>=20 else df["ema200"].iloc[0]

        price     = float(last["Close"])
        vol_today = float(last["Volume"])
        vol_ma20  = float(last["volMa20"])
        vol_ratio = round(vol_today / vol_ma20, 2) if vol_ma20 else 0

        # Dry-up: last 5 days volume below MA
        dry_up = all(
            df["Volume"].iloc[-i] < vol_ma20 * 0.8
            for i in range(1, 6)
        ) if len(df) >= 5 else False

        return {
            "ticker": ticker,
            "price":  round(price, 2),
            "date":   str(df.index[-1].date()),

            "moving_averages": {
                "ema10":  round(float(last["ema10"]),  2),
                "ema21":  round(float(last["ema21"]),  2),
                "ema50":  round(float(last["ema50"]),  2),
                "ema150": round(float(last["ema150"]), 2),
                "ema200": round(float(last["ema200"]), 2),
                "sma200": round(float(last["sma200"]), 2),
            },

            "rsi": {
                "rsi14":          round(float(last["rsi14"]),   1),
                "ma9":            round(float(last["rsiMa9"]),  1),
                "ma21":           round(float(last["rsiMa21"]), 1),
                "ma9_above_ma21": bool(last["rsiMa9"] > last["rsiMa21"]),
            },

            "volume": {
                "today":      int(vol_today),
                "ma20":       int(vol_ma20),
                "ratio":      vol_ratio,
                "increasing": bool(vol_today > float(prev["Volume"])),
                "dry_up":     dry_up,
            },

            "high52w": round(high52, 2) if high52 is not None else None,
            "low52w":  round(low52,  2) if low52  is not None else None,

            "sepa": {
                "price_above_ema200":
                    bool(price > float(last["ema200"])),
                "price_above_ema150":
                    bool(price > float(last["ema150"])),
                "price_above_ema50":
                    bool(price > float(last["ema50"])),
                "ema50_above_ema200":
                    bool(float(last["ema50"]) > float(last["ema200"])),
                "ema150_above_ema200":
                    bool(float(last["ema150"]) > float(last["ema200"])),
                "ema200_trending_up":
                    bool(float(last["ema200"]) > float(ago20)),
                "near_52w_high":
                    bool(high52 is not None and price >= high52 * 0.70),
                "volume_dry_up": dry_up,
            },
        }

    return get_cached(f"indicators_{ticker}", fetch, ttl=900)

# ─────────────────────────────────────
# GET /fundamentals/{ticker}
# ─────────────────────────────────────
@app.get("/fundamentals/{ticker}")
def get_fundamentals(ticker: str):
    ticker = ticker.upper()

    def fetch():
        stock = yf.Ticker(ticker)
        info  = stock.info

        # EPS growth from quarterly earnings
        eps_growth = None
        try:
            q = stock.quarterly_earnings
            if q is not None and len(q) >= 2:
                e0 = q["Earnings"].iloc[0]
                e1 = q["Earnings"].iloc[1]
                if e1 and e1 != 0:
                    eps_growth = round((e0 - e1) / abs(e1) * 100, 1)
        except Exception:
            pass

        # Revenue growth
        rev_growth = None
        try:
            q2 = stock.quarterly_financials
            if q2 is not None and "Total Revenue" in q2.index:
                rev = q2.loc["Total Revenue"]
                if len(rev) >= 2 and rev.iloc[1] != 0:
                    rev_growth = round(
                        (rev.iloc[0] - rev.iloc[1]) / abs(rev.iloc[1]) * 100, 1
                    )
        except Exception:
            pass

        gross = info.get("grossMargins")
        net = info.get("profitMargins")
        roe = info.get("returnOnEquity")
        inst = info.get("heldPercentInstitutions")
        ed_raw = info.get("earningsDate")
        ed = str(ed_raw) if ed_raw else "غير محدد"

        return {
            "ticker":           ticker,
            "name":             info.get("longName",""),
            "sector":           info.get("sector",""),
            "industry":         info.get("industry",""),
            "eps_growth_q":     eps_growth,
            "revenue_growth_q": rev_growth,
            "gross_margin":     round(gross * 100, 1) if gross else None,
            "net_margin":       round(net * 100, 1) if net else None,
            "roe":              round(roe * 100, 1) if roe else None,
            "debt_to_equity":   info.get("debtToEquity"),
            "float_shares":     info.get("floatShares"),
            "institutional_pct": round(inst * 100, 1) if inst else None,
            "earnings_date":    ed,
            "market_cap":       info.get("marketCap"),
        }

    return get_cached(f"fundamentals_{ticker}", fetch, ttl=3600)

# ─────────────────────────────────────
# GET /r/{ticker}?entry=495&stop=468
# ─────────────────────────────────────
@app.get("/r/{ticker}")
def get_r_multiple(ticker: str,
                   entry: float,
                   stop:  float):
    ticker     = ticker.upper()
    price_data = get_price(ticker)
    current    = price_data.get("price")

    if not current:
        raise HTTPException(404, "Price not available")

    r_risk     = entry - stop
    r_multiple = round((current - entry) / r_risk, 2) \
                 if r_risk > 0 else 0

    return {
        "ticker":      ticker,
        "current":     current,
        "entry":       entry,
        "stop":        stop,
        "r_risk":      round(r_risk, 2),
        "r_multiple":  r_multiple,
        "pnl_pct":     round((current - entry) / entry * 100, 2),
        "above_stop":  bool(current > stop),
        "status": (
            "profit"  if r_multiple >  0.5 else
            "scratch" if r_multiple > -0.5 else
            "loss"
        ),
        "updated": datetime.now().isoformat(),
    }

# ─────────────────────────────────────
# POST /batch_r
# Body: [{"ticker":"NVDA","entry":495,"stop":468}]
# ─────────────────────────────────────
@app.post("/batch_r")
def get_batch_r(trades: list[dict]):
    results = []
    for t in trades:
        try:
            r = get_r_multiple(
                t["ticker"],
                float(t["entry"]),
                float(t["stop"])
            )
            results.append(r)
        except Exception as e:
            results.append({
                "ticker":     t.get("ticker","?"),
                "r_multiple": None,
                "error":      str(e),
            })
    return {
        "results": results,
        "updated": datetime.now().isoformat(),
    }
