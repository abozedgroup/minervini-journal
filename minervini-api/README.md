# Minervini Journal API

Backend for the Minervini Journal web app. Supports three data sources for **stock prices** (and thus R-multiples): Yahoo Finance (default), Alpha Vantage, Twelve Data.

## مصدر بيانات الأسعار (Data Source)

| المصدر | متغير البيئة | مفتاح API | حدود مجانية |
|--------|----------------|-----------|-------------|
| **Yahoo Finance** (افتراضي) | `DATA_SOURCE=yahoo` | لا يحتاج | عرضة لـ 429 عند الإكثار |
| **Alpha Vantage** | `DATA_SOURCE=alphavantage` | [احصل على مفتاح](https://www.alphavantage.co/support/#api-key) | 25 طلب/يوم، 5/دقيقة |
| **Twelve Data** | `DATA_SOURCE=twelvedata` | [احصل على مفتاح](https://twelvedata.com/apikey) | 8 نقاط/دقيقة، 800/يوم — مدفوع من ~$79/شهر |

1. انسخ `.env.example` إلى `.env` داخل مجلد `minervini-api`.
2. عدّل في `.env`:
   - `DATA_SOURCE=alphavantage` أو `twelvedata` لاستخدام API آخر.
   - `ALPHAVANTAGE_API_KEY=مفتاحك` أو `TWELVEDATA_API_KEY=مفتاحك`.
3. أعد تشغيل الخادم. `/health` يعيد اسم المصدر الحالي.

ملاحظة: **Indicators** و **Fundamentals** يبقيان على Yahoo حتى إضافة دعم لهما من المصادر الأخرى.

## Setup

```bash
cd minervini-api
python -m venv venv
```

**Windows:**
```bash
.\venv\Scripts\activate
pip install -r requirements.txt
```

**Linux / macOS:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: **http://localhost:8000**  
Docs: **http://localhost:8000/docs**

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (status, source, time) |
| GET | `/price/{ticker}` | Current price, change %, volume, 52w high/low, name, sector |
| GET | `/indicators/{ticker}` | EMAs, RSI, volume ratio, SEPA checks, 52w high/low |
| GET | `/fundamentals/{ticker}` | EPS/revenue growth, margins, ROE, institutional %, earnings date |
| GET | `/r/{ticker}?entry=&stop=` | Live R-multiple for a trade (entry, stop, current price) |
| POST | `/batch_r` | Body: `[{"ticker","entry","stop"}, ...]` → R-multiples for multiple open trades |

Responses are cached (price ~5 min, indicators ~15 min, fundamentals ~1 hr).
