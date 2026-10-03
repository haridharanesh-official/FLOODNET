from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FLOODNET Core"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://floodnet:floodnet_dev_password@localhost:5432/floodnet"
    cors_origins: str = "http://localhost:3000"

    # Routing Multipliers
    routing_open_multiplier: float = 1.0
    routing_unknown_multiplier: float = 2.0
    routing_caution_multiplier: float = 5.0

    # Observation Freshness & Timeout
    road_observation_timeout_seconds: float = 60.0

    # Flood Risk Calculation Weights (Prototype Formula)
    # risk = (confidence_weight * confidence) + (coverage_weight * coverage) + (freshness_weight * freshness)
    risk_confidence_weight: float = 0.55
    risk_coverage_weight: float = 0.35
    risk_freshness_weight: float = 0.10

    # Flood Risk Classification Thresholds
    risk_open_threshold: float = 0.25       # risk < 0.25 -> OPEN
    risk_caution_threshold: float = 0.60    # 0.25 <= risk < 0.60 -> CAUTION; risk >= 0.60 -> FLOODED

    # Anti-Flapping / Hysteresis Settings
    # To transition OPEN -> FLOODED: require X positive observations in window of Y
    anti_flapping_open_to_flooded_positive_required: int = 7
    anti_flapping_window_size: int = 10
    # To transition FLOODED -> OPEN: require N consecutive clear observations
    anti_flapping_flooded_to_open_consecutive_clear_required: int = 20

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()
