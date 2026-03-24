# price_service/main.py
# Run with: uvicorn main:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import numpy as np
import os
from typing import Optional
from datetime import datetime, timedelta

# Try to import statsmodels — fall back to simple model if not installed
try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False

app = FastAPI(title="AgriPrice Prediction Service")

CRON_SECRET = os.environ.get("CRON_SECRET", "dev-secret")

# ─── Request / Response models ────────────────────────────────────────────────

class PredictRequest(BaseModel):
    crop_name: str
    market_name: str
    prices: list[float]          # historical prices, oldest first
    dates: list[str]             # ISO date strings matching prices
    steps: int = 5               # how many days to forecast
    month: Optional[int] = None  # current month (1-12) for seasonal adjustment

class PredictResponse(BaseModel):
    crop_name: str
    market_name: str
    predictions: list[float]
    prediction_dates: list[str]
    model_used: str
    confidence: str              # "high" | "medium" | "low"
    trend: str                   # "up" | "down" | "stable"

# ─── Zambian seasonal factors ────────────────────────────────────────────────
# Derived from typical Zambian crop price patterns:
# - Harvest season (Apr-Jun): prices lowest
# - Lean season (Jan-Mar): prices highest
# These are multipliers relative to the annual average.
SEASONAL_FACTORS = {
    1:  1.15,   # January  — lean season, stocks low
    2:  1.20,   # February — lean season peak
    3:  1.18,   # March    — lean season ending
    4:  0.95,   # April    — early harvest
    5:  0.85,   # May      — peak harvest, prices drop
    6:  0.80,   # June     — harvest surplus
    7:  0.82,   # July     — post-harvest storage
    8:  0.88,   # August   — storage depletion begins
    9:  0.92,   # September
    10: 1.00,   # October  — baseline
    11: 1.08,   # November — pre-lean season
    12: 1.12,   # December — lean season starts
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def zambian_seasonal_factor(date: datetime) -> float:
    return SEASONAL_FACTORS.get(date.month, 1.0)

def moving_average(prices: list[float], window: int = 7) -> float:
    if len(prices) == 0:
        return 0.0
    window = min(window, len(prices))
    return float(np.mean(prices[-window:]))

def detect_trend(prices: list[float]) -> str:
    if len(prices) < 3:
        return "stable"
    recent = np.mean(prices[-3:])
    older = np.mean(prices[-7:-3]) if len(prices) >= 7 else np.mean(prices[:-3])
    change_pct = (recent - older) / (older + 1e-9) * 100
    if change_pct > 2:
        return "up"
    elif change_pct < -2:
        return "down"
    return "stable"

# ─── Prediction models ────────────────────────────────────────────────────────

def predict_sarima(prices: list[float], steps: int, start_date: datetime) -> tuple[list[float], str]:
    """
    SARIMA(1,1,1)(1,1,0,7) — best for weekly-seasonal crop price data.
    Requires at least 14 data points.
    """
    import warnings
    warnings.filterwarnings("ignore")

    try:
        # Use weekly seasonality (period=7) since we have daily data
        model = SARIMAX(
            prices,
            order=(1, 1, 1),
            seasonal_order=(1, 1, 0, 7),
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        result = model.fit(disp=False, maxiter=200)
        raw_forecast = result.forecast(steps=steps).tolist()

        # Apply Zambian seasonal adjustment on top of SARIMA output
        adjusted = []
        for i, pred in enumerate(raw_forecast):
            future_date = start_date + timedelta(days=i + 1)
            seasonal = zambian_seasonal_factor(future_date)
            # Blend SARIMA with seasonal (70% SARIMA, 30% seasonal nudge)
            current_seasonal = zambian_seasonal_factor(start_date)
            seasonal_delta = seasonal / current_seasonal
            adjusted_pred = pred * (0.7 + 0.3 * seasonal_delta)
            adjusted.append(round(max(adjusted_pred, 0), 2))

        return adjusted, "SARIMA"
    except Exception as e:
        raise RuntimeError(f"SARIMA failed: {e}")


def predict_exponential_smoothing(prices: list[float], steps: int, start_date: datetime) -> tuple[list[float], str]:
    """
    Holt-Winters Exponential Smoothing — good fallback with less data (7+ points).
    """
    try:
        model = ExponentialSmoothing(
            prices,
            trend="add",
            seasonal=None,  # we handle seasonality manually
            initialization_method="estimated",
        )
        result = model.fit(optimized=True)
        raw_forecast = result.forecast(steps).tolist()

        adjusted = []
        current_seasonal = zambian_seasonal_factor(start_date)
        for i, pred in enumerate(raw_forecast):
            future_date = start_date + timedelta(days=i + 1)
            seasonal = zambian_seasonal_factor(future_date)
            seasonal_delta = seasonal / current_seasonal
            adjusted_pred = pred * (0.6 + 0.4 * seasonal_delta)
            adjusted.append(round(max(adjusted_pred, 0), 2))

        return adjusted, "Exponential Smoothing"
    except Exception as e:
        raise RuntimeError(f"Exponential Smoothing failed: {e}")


def predict_moving_average_seasonal(prices: list[float], steps: int, start_date: datetime) -> tuple[list[float], str]:
    """
    Simple seasonal moving average — always works, even with very little data.
    Used as final fallback.
    """
    base = moving_average(prices, window=min(7, len(prices)))
    trend_factor = 1.0
    if len(prices) >= 5:
        recent = np.mean(prices[-3:])
        older = np.mean(prices[-5:-2])
        if older > 0:
            trend_factor = (recent / older) ** (1 / 3)  # daily trend rate

    current_seasonal = zambian_seasonal_factor(start_date)
    predictions = []
    for i in range(steps):
        future_date = start_date + timedelta(days=i + 1)
        seasonal = zambian_seasonal_factor(future_date)
        seasonal_adj = seasonal / current_seasonal
        # Compound trend + seasonal adjustment
        pred = base * (trend_factor ** (i + 1)) * seasonal_adj
        # Add small random variation (±1.5%) to avoid flat predictions
        noise = 1 + np.random.uniform(-0.015, 0.015)
        predictions.append(round(max(pred * noise, 0), 2))

    return predictions, "Seasonal Moving Average"


def assess_confidence(prices: list[float], model: str) -> str:
    n = len(prices)
    # Calculate coefficient of variation (volatility)
    if n >= 3:
        cv = np.std(prices[-min(14, n):]) / (np.mean(prices[-min(14, n):]) + 1e-9)
    else:
        cv = 1.0

    if model == "SARIMA" and n >= 30 and cv < 0.15:
        return "high"
    elif model in ("SARIMA", "Exponential Smoothing") and n >= 14:
        return "medium"
    return "low"

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "statsmodels_available": HAS_STATSMODELS,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(
    body: PredictRequest,
    x_cron_secret: Optional[str] = Header(default=None),
):
    # Auth check
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    prices = body.prices
    steps = max(1, min(body.steps, 30))  # cap at 30 days

    if len(prices) < 3:
        raise HTTPException(
            status_code=422,
            detail=f"Need at least 3 price data points, got {len(prices)}"
        )

    # Parse start date
    try:
        start_date = datetime.fromisoformat(body.dates[-1]) if body.dates else datetime.utcnow()
    except Exception:
        start_date = datetime.utcnow()

    trend = detect_trend(prices)

    # Choose model based on data availability
    predictions, model_used = None, None

    if HAS_STATSMODELS and len(prices) >= 21:
        # Enough data for SARIMA
        try:
            predictions, model_used = predict_sarima(prices, steps, start_date)
        except Exception:
            pass  # fall through

    if predictions is None and HAS_STATSMODELS and len(prices) >= 7:
        # Try Holt-Winters
        try:
            predictions, model_used = predict_exponential_smoothing(prices, steps, start_date)
        except Exception:
            pass

    if predictions is None:
        # Always-works fallback
        predictions, model_used = predict_moving_average_seasonal(prices, steps, start_date)

    # Build prediction dates
    prediction_dates = [
        (start_date + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        for i in range(steps)
    ]

    confidence = assess_confidence(prices, model_used)

    return PredictResponse(
        crop_name=body.crop_name,
        market_name=body.market_name,
        predictions=predictions,
        prediction_dates=prediction_dates,
        model_used=model_used,
        confidence=confidence,
        trend=trend,
    )


@app.post("/predict/batch")
def predict_batch(
    bodies: list[PredictRequest],
    x_cron_secret: Optional[str] = Header(default=None),
):
    """Predict for multiple crop+market pairs in one call."""
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    results = []
    for body in bodies:
        try:
            result = predict(body, x_cron_secret=x_cron_secret)
            results.append(result)
        except HTTPException as e:
            results.append({
                "crop_name": body.crop_name,
                "market_name": body.market_name,
                "error": e.detail,
            })

    return {"results": results, "total": len(results)}