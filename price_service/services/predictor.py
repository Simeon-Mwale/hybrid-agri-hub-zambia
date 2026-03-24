# prediction-service/services/predictor.py
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from models.base import BasePredictionModel, PredictionResult
from models.arima_model import ARIMAModel
from models.random_forest import RandomForeModel
from models.fallback import FallbackModel
from config import settings

logger = logging.getLogger(__name__)

class PredictionService:
    """Orchestrates model selection and prediction generation"""
    
    def __init__(self):
        self.models: Dict[str, BasePredictionModel] = {
            "arima": ARIMAModel(),
            "random_forest": RandomForeModel(),
            "fallback": FallbackModel()
        }
        self.default_model_name = settings.default_model
    
    def get_model(self, model_name: Optional[str] = None) -> BasePredictionModel:
        """Get model by name, fallback to default then to fallback model"""
        name = model_name or self.default_model_name
        
        if name in self.models:
            return self.models[name]
        
        logger.warning(f"Model '{name}' not found, using default")
        if self.default_model_name in self.models:
            return self.models[self.default_model_name]
        
        logger.warning("Default model not available, using fallback")
        return self.models["fallback"]
    
    def predict_batch(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple prediction requests"""
        results = []
        
        for req in requests:
            try:
                result = self.predict_single(
                    crop_name=req.get("crop_name"),
                    market_name=req.get("market_name"),
                    prices=req.get("prices", []),
                    dates=req.get("dates", []),
                    steps=req.get("steps", 7),
                    model_name=req.get("model")
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Prediction failed for {req.get('crop_name')}: {e}")
                # Return fallback result on error
                results.append(self._error_result(
                    req.get("crop_name"), 
                    req.get("market_name"),
                    str(e)
                ))
        
        return results
    
    def predict_single(
        self,
        crop_name: str,
        market_name: str,
        prices: List[float],
        dates: List[str],
        steps: int = 7,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate predictions for a single crop-market pair"""
        
        # Validate input
        if not prices or not dates or len(prices) != len(dates):
            raise ValueError("Invalid input: prices and dates required and must match")
        
        steps = min(steps, settings.max_forecast_steps)
        
        # Try preferred model first, then fallback chain
        model = self.get_model(model_name)
        
        if model.is_valid_data(prices, dates) and model.train(prices, dates):
            result = model.predict(steps, dates[-1] if dates else None)
        else:
            # Try fallback model
            logger.info(f"{model.get_name()} failed, trying fallback")
            fallback = self.models["fallback"]
            fallback.train(prices, dates)
            result = fallback.predict(steps, dates[-1] if dates else None)
        
        # Build response
        response = result.to_dict()
        response["crop_name"] = crop_name
        response["market_name"] = market_name
        response["timestamp"] = datetime.utcnow().isoformat()
        
        return response
    
    def _error_result(self, crop_name: str, market_name: str, error: str) -> Dict[str, Any]:
        """Return standardized error response"""
        from models.fallback import FallbackModel
        fallback = FallbackModel()
        fallback.train([0], ["2024-01-01"])
        result = fallback.predict(7)
        
        response = result.to_dict()
        response.update({
            "crop_name": crop_name,
            "market_name": market_name,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        })
        return response

# Singleton instance
prediction_service = PredictionService()