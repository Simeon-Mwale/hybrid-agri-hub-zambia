# prediction-service/models/arima_model.py
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller
from datetime import datetime, timedelta
import warnings

from .base import BasePredictionModel, PredictionResult
from config import settings

warnings.filterwarnings("ignore")

class ARIMAModel(BasePredictionModel):
    """ARIMA time series forecasting model"""
    
    def __init__(self):
        super().__init__("arima")
        self.model = None
        self.results = None
        self.last_price = None
        self.residuals_std = None
    
    def is_valid_data(self, prices: List[float], dates: List[str]) -> bool:
        """ARIMA needs at least min_data_points and no NaN values"""
        if len(prices) < settings.min_data_points:
            return False
        if any(np.isnan(p) for p in prices):
            return False
        if len(prices) != len(dates):
            return False
        return True
    
    def _check_stationarity(self, series: np.ndarray) -> bool:
        """Augmented Dickey-Fuller test for stationarity"""
        try:
            result = adfuller(series.dropna(), autolag='AIC')
            return result[1] < 0.05  # p-value < 0.05 = stationary
        except:
            return False
    
    def train(self, prices: List[float], dates: List[str]) -> bool:
        try:
            if not self.is_valid_data(prices, dates):
                return False
            
            # Convert to pandas Series with datetime index
            date_index = pd.to_datetime(dates)
            series = pd.Series(prices, index=date_index).sort_index()
            
            # Handle non-stationary data with differencing
            if not self._check_stationarity(series):
                series = series.diff().dropna()
            
            # Fit ARIMA model
            self.model = ARIMA(
                series, 
                order=settings.arima_order,
                enforce_stationarity=False,
                enforce_invertibility=False
            )
            self.results = self.model.fit()
            
            self.last_price = prices[-1]
            self.residuals_std = np.std(self.results.resid)
            self.is_trained = True
            
            return True
            
        except Exception as e:
            print(f"ARIMA training failed: {e}")
            return False
    
    def predict(self, steps: int, start_date: Optional[str] = None) -> PredictionResult:
        if not self.is_trained or self.results is None:
            raise ValueError("Model not trained")
        
        # Generate forecasts
        forecast = self.results.get_forecast(steps=steps)
        predictions = forecast.predicted_mean.tolist()
        
        # Confidence intervals (95%)
        conf_int = forecast.conf_int(alpha=0.05)
        
        # Convert predictions back to price scale if we differenced
        if self.last_price is not None:
            # Cumulative sum to reverse differencing
            predictions = [self.last_price + sum(predictions[:i+1]) 
                          for i in range(len(predictions))]
            conf_int = conf_int + self.last_price
        
        # Generate prediction dates
        if start_date:
            last_date = pd.to_datetime(start_date)
        else:
            last_date = pd.to_datetime(self.results.data.index[-1])
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
            for i in range(steps)
        ]
        
        # Calculate simple metrics
        metrics = {
            "aic": self.results.aic if hasattr(self.results, 'aic') else None,
            "residual_std": float(self.residuals_std) if self.residuals_std else None
        }
        
        return PredictionResult(
            predictions=[round(p, 2) for p in predictions],
            prediction_dates=prediction_dates,
            model_used=self.name,
            confidence_intervals={
                "lower": [round(c[0], 2) for c in conf_int.values],
                "upper": [round(c[1], 2) for c in conf_int.values]
            },
            metrics=metrics
        )