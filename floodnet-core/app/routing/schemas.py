from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class RouteRequest(BaseModel):
    origin_node: str | None = Field(default=None, description="Origin node identifier (e.g., NODE_A)")
    destination_node: str | None = Field(default=None, description="Destination node identifier (e.g., NODE_D)")
    origin_lat: float | None = Field(default=None, description="Origin latitude")
    origin_lng: float | None = Field(default=None, description="Origin longitude")
    destination_lat: float | None = Field(default=None, description="Destination latitude")
    destination_lng: float | None = Field(default=None, description="Destination longitude")


class RouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: str
    status: str
    origin_name: str | None = None
    destination_name: str | None = None
    nodes: list[str] = Field(default_factory=list)
    roads: list[str] = Field(default_factory=list)
    road_names: list[str] = Field(default_factory=list)
    distance_m: float
    estimated_time_sec: float
    risk_cost: float
    geometry: list[list[float]] = Field(default_factory=list)
    avoided_flooded_roads: list[str] = Field(default_factory=list)


class NoRouteResponse(BaseModel):
    status: str = "NO_VERIFIED_ROUTE"
    reason: str = "All available paths contain confirmed flooded road segments."
    avoided_flooded_roads: list[str] = Field(default_factory=list)


class ActiveRoute(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    route_id: str
    origin_node: str
    destination_node: str
    origin_name: str | None = None
    destination_name: str | None = None
    road_ids: list[str]
    road_names: list[str] = Field(default_factory=list)
    node_ids: list[str]
    total_distance_m: float
    estimated_time_sec: float
    risk_cost: float
    status: str = "ACTIVE"
    geometry: list[list[float]] = Field(default_factory=list)
    avoided_flooded_roads: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_response(self) -> RouteResponse:
        return RouteResponse(
            route_id=self.route_id,
            status=self.status,
            origin_name=self.origin_name,
            destination_name=self.destination_name,
            nodes=self.node_ids,
            roads=self.road_ids,
            road_names=self.road_names,
            distance_m=self.total_distance_m,
            estimated_time_sec=self.estimated_time_sec,
            risk_cost=self.risk_cost,
            geometry=self.geometry,
            avoided_flooded_roads=self.avoided_flooded_roads,
        )


class RouteRecalculatedEvent(BaseModel):
    type: str = "route.recalculated"
    route_id: str
    reason: str
    blocked_road: str
    blocked_road_name: str | None = None
    old_path: list[str]
    new_path: list[str]
    new_path_names: list[str] = Field(default_factory=list)
    old_eta_sec: float
    new_eta_sec: float
    geometry: list[list[float]] = Field(default_factory=list)
    avoided_flooded_roads: list[str] = Field(default_factory=list)


class RouteUnavailableEvent(BaseModel):
    type: str = "route.unavailable"
    route_id: str
    reason: str = "NO_VERIFIED_ROUTE"
    blocked_road: str
    blocked_road_name: str | None = None


class NodeInfo(BaseModel):
    node_id: str
    name: str
    lat: float
    lng: float
