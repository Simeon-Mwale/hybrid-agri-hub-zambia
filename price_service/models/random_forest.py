# prediction-service/models/random_forest.py
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import warnings

from .base import BasePredictionModel, PredictionResult
from config import settings

warnings.filterwarnings("ignore")

class RandomForeModel(BasePredictionModel):
    """Random Forest regression model for price prediction"""
    
    def __init__(self):
        super().__init__("random_forest")
        self.model = None
        self.scaler = StandardScaler()
        self.feature_window = 7  # Use last 7 days as features
        self.last_prices = None
    
    def is_valid_data(self, prices: List[float], dates: List[str]) -> bool:
        """Need enough data for feature window + training"""
        min_required = self.feature_window + settings.min_data_points
        return len(prices) >= min_required and len(prices) == len(dates)
    
    def _create_features(self, prices: List[float]) -> np.ndarray:
        """Create lag features + rolling statistics"""
        features = []
        prices_array = np.array(prices)
        
        for i in range(self.feature_window, len(prices_array)):
            # Lag features
            lag_features = prices_array[i-self.feature_window:i]
            
            # Rolling statistics
            window = prices_array[max(0, i-14):i]
            rolling_features = [
                np.mean(window),
                np.std(window),
                np.min(window),
                np.max(window),
                prices_array[i-1] - prices_array[i-2] if i >= 2 else 0  # Daily change
            ]
            
            features.append(np.concatenate([lag_features, rolling_features]))
        
        return np.array(features)
    
    def train(self, prices: List[float], dates: List[str]) -> bool:
        try:
            if not self.is_valid_data(prices, dates):
                return False
            
            # Create features and targets
            X = self._create_features(prices)
            y = np.array(prices[self.feature_window:])
            
            if len(X) < 10:  # Need minimum samples for training
                return False
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Train Random Forest
            self.model = RandomForestRegressor(
                n_estimators=settings.rf_n_estimators,
                max_depth=settings.rf_max_depth,
                random_state=42,
                n_jobs=-1
            )
            self.model.fit(X_scaled, y)
            
            self.last_prices = prices[-self.feature_window:]
            self.is_trained = True
            
            return True
            
        except Exception as e:
            print(f"Random Forest training failed: {e}")
            return False
    
    def _predict_next(self, recent_prices: List[float]) -> float:
        """Predict single next value using recent prices"""
        if not self.is_trained or self.model is None:
            return recent_prices[-1]  # Fallback to last price
        
        # Create feature vector
        lag_features = np.array(recent_prices[-self.feature_window:])
        window = recent_prices[-14:] if len(recent_prices) >= 14 else recent_prices
        
        rolling_features = [
            np.mean(window),
            np.std(window),
            np.min(window),
            np.max(window),
            recent_prices[-1] - recent_prices[-2] if len(recent_prices) >= 2 else 0
        ]
        
        feature_vec = np.concatenate([lag_features, rolling_features]).reshape(1, -1)
        feature_scaled = self.scaler.transform(feature_vec)
        
        return self.model.predict(feature_scaled)[0]
    
    def predict(self, steps: int, start_date: Optional[str] = None) -> PredictionResult:
        if not self.is_trained:
            raise ValueError("Model not trained")
        
        predictions = []
        recent = self.last_prices.copy()
        
        # Iterative multi-step forecasting
        for _ in range(steps):
            next_pred = self._predict_next(recent)
            predictions.append(next_pred)
            recent.append(next_pred)  # Use prediction as input for next step
        
        # Generate dates
        if start_date:
            last_date = datetime.strptime(start_date, '%Y-%m-%d')
        else:
            last_date = datetime.now()
        
        prediction_dates = [
            (last_date + timedelta(days=i+1)).strftime('%Y-%m-%d')
            for i in range(steps)
        ]
        
        # Simple confidence interval based on prediction variance
        pred_std = np.std(predictions) if len(predictions) > 1 else 10.0
        confidence_intervals = {
            "lower": [round(p - 1.96 * pred_std, 2) for p in predictions],
            "upper": [round(p + 1.96 * pred_std, 2) for p in predictions]
        }
        
        return PredictionResult(
            predictions=[round(p, 2) for p in predictions],
            prediction_dates=prediction_dates,
            model_used=self.name,
            confidence_intervals=confidence_intervals,
            metrics={
                "feature_importance": self.model.feature_importances_.tolist() 
                    if hasattr(self.model, 'feature_importances_') else None
            }
        )