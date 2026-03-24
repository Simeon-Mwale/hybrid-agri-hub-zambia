# prediction-service/models/fallback.py
from typing import List, Optional, Dict, Any
import numpy as np
from datetime import datetime, timedelta

from .base import BasePredictionModel, PredictionResult

class FallbackModel(BasePredictionModel):
    """Simple moving average + trend fallback model"""
    
    def __init__(self):
        super().__init__("fallback_moving_average")
    
    def is_valid_data(self, prices: List[float], dates: List[str]) -> bool:
        """Fallback works with minimal data"""
        return len(prices) >= 3 and len(prices) == len(dates)
    
    def train(self, prices: List[float], dates: List[str]) -> bool:
        """Fallback doesn't need training, just store data"""
        self.prices = prices
        self.dates = dates
        self.is_trained = True
        return True
    
    def predict(self, steps: int, start_date: Optional[str] = None) -> PredictionResult:
        if not self.is_trained or not self.prices:
            # Ultimate fallback: return last price for all steps
            last_price = self.prices[-1] if self.prices else 0
            return self._create_result([last_price] * steps, start_date, "fallback_constant")
        
        # Calculate moving average of last 7 prices (or all if < 7)
        window = min(7, len(self.prices))
        recent = self.prices[-window:]
        avg = np.mean(recent)
        
        # Calculate simple trend (linear regression slope)
        if len(self.prices) >= 2:
            x = np.arange(len(self.prices))
            slope = np.polyfit(x, self.prices, 1)[0]
        else:
            slope = 0
        
        # Generate predictions with trend + small noise
        predictions = []
        for i in range(1, steps + 1):
            trend_adjustment = slope * i * 0.5  # Conservative trend
            noise = np.random.normal(0, avg * 0.02)  # 2% noise
            pred = avg + trend_adjustment + noise
            predictions.append(max(0, round(pred, 2)))  # Ensure non-negative
        
        return self._create_result(predictions, start_date, self.name)
    
    def _create_result(self, predictions: List[float], 
                      start_date: Optional[str], model_name: str) -> PredictionResult:
        """Helper to create standardized result"""
        if start_date:
            last_date = datetime.strptime(start_date, '%Y-%m-%d')
        else:
            last_date = datetime.now()
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
            for i in range(len(predictions))
        ]
        
        # Simple confidence intervals
        avg = np.mean(predictions) if predictions else 0
        margin = avg * 0.1  # ±10%
        
        return PredictionResult(
            predictions=predictions,
            prediction_dates=prediction_dates,
            model_used=model_name,
            confidence_intervals={
                "lower": [round(p - margin, 2) for p in predictions],
                "upper": [round(p + margin, 2) for p in predictions]
            },
            metrics={"method": "moving_average_with_trend"}
        )