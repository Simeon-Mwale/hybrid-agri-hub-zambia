# prediction-service/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    # Model Configuration
    default_model: str = "arima"  # Options: arima, random_forest, fallback
    min_data_points: int = 10
    max_forecast_steps: int = 14
    
    # ARIMA Settings
    arima_order: tuple = (2, 1, 2)  # (p, d, q)
    arima_seasonal: bool = False
    
    # Random Forest Settings
    rf_n_estimators: int = 100
    rf_max_depth: int = 10
    
    # Caching
    cache_ttl_seconds: int = 3600  # 1 hour
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()