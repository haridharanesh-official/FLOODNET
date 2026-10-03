from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.road import RoadStatus


class RoadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    road_code: str
    name: str
    from_node: str | None = None
    to_node: str | None = None
    distance_m: float = 1000.0
    travel_time_sec: float = 120.0
    status: RoadStatus
    confidence: float
    flood_coverage: float = 0.0
    source: str
    updated_at: datetime
    last_observed_at: datetime | None = None


class RoadStatusUpdate(BaseModel):
    status: RoadStatus
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    coverage: float = Field(default=0.0, ge=0.0, le=1.0)
    source: str = "MANUAL_SIMULATION"
    apply_filter: bool = False
