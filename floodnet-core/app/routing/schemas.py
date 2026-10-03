from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class RouteRequest(BaseModel):
    origin_node: str = Field(..., description="Origin node identifier (e.g., NODE_A)")
    destination_node: str = Field(..., description="Destination node identifier (e.g., NODE_D)")


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: str
    status: str
    nodes: list[str] = Field(default_factory=list)
    roads: list[str] = Field(default_factory=list)
    distance_m: float
    estimated_time_sec: float
    risk_cost: float


class NoRouteResponse(BaseModel):
    status: str = "NO_VERIFIED_ROUTE"
    reason: str = "All available paths contain confirmed flooded road segments."


class ActiveRoute(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: str
    origin_node: str
    destination_node: str
    road_ids: list[str]
    node_ids: list[str]
    total_distance_m: float
    estimated_time_sec: float
    risk_cost: float
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_response(self) -> RouteResponse:
        return RouteResponse(
            route_id=self.route_id,
            status=self.status,
            nodes=self.node_ids,
            roads=self.road_ids,
            distance_m=self.total_distance_m,
            estimated_time_sec=self.estimated_time_sec,
            risk_cost=self.risk_cost,
        )


class RouteRecalculatedEvent(BaseModel):
    type: str = "route.recalculated"
    route_id: str
    reason: str
    blocked_road: str
    old_path: list[str]
    new_path: list[str]
    old_eta_sec: float
    new_eta_sec: float


class RouteUnavailableEvent(BaseModel):
    type: str = "route.unavailable"
    route_id: str
    reason: str = "NO_VERIFIED_ROUTE"
    blocked_road: str
