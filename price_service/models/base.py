# prediction-service/models/base.py
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import numpy as np
from datetime import datetime

class PredictionResult:
    """Standardized prediction output"""
    def __init__(
        self,
        predictions: List[float],
        prediction_dates: List[str],
        model_used: str,
        confidence_intervals: Optional[Dict[str, List[float]]] = None,
        metrics: Optional[Dict[str, float]] = None
    ):
        self.predictions = predictions
        self.prediction_dates = prediction_dates
        self.model_used = model_used
        self.confidence_intervals = confidence_intervals or {}
        self.metrics = metrics or {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "predictions": self.predictions,
            "prediction_dates": self.prediction_dates,
            "model_used": self.model_used,
            "confidence_intervals": self.confidence_intervals,
            "metrics": self.metrics
        }

class BasePredictionModel(ABC):
    """Abstract base class for all prediction models"""
    
    def __init__(self, name: str):
        self.name = name
        self.is_trained = False
    
    @abstractmethod
    def train(self, prices: List[float], dates: List[str]) -> bool:
        """Train the model on historical data. Returns True if successful."""
        pass
    
    @abstractmethod
    def predict(self, steps: int, start_date: Optional[str] = None) -> PredictionResult:
        """Generate predictions for the next N steps."""
        pass
    
    @abstractmethod
    def is_valid_data(self, prices: List[float], dates: List[str]) -> bool:
        """Check if input data meets model requirements."""
        pass
    
    def get_name(self) -> str:
        return self.name