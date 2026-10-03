from typing import Any
from fastapi import APIRouter, HTTPException, status
from app.routing.route_manager import route_manager
from app.routing.schemas import NoRouteResponse, RouteRequest, RouteResponse

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


@router.post("", response_model=RouteResponse | NoRouteResponse, status_code=status.HTTP_200_OK)
async def create_route(payload: RouteRequest) -> Any:
    """Calculate and store a new active route between origin and destination nodes."""
    route, reason = route_manager.create_route(
        origin_node=payload.origin_node,
        destination_node=payload.destination_node,
    )

    if route is None:
        return NoRouteResponse(
            status="NO_VERIFIED_ROUTE",
            reason=reason or "All available paths contain confirmed flooded road segments.",
        )

    return route.to_response()


@router.get("/active", response_model=list[RouteResponse])
async def get_active_routes() -> Any:
    """Return all active routes."""
    routes = route_manager.list_active_routes()
    return [r.to_response() for r in routes if r.status == "ACTIVE"]


@router.get("/{route_id}", response_model=RouteResponse | NoRouteResponse)
async def get_route(route_id: str) -> Any:
    """Get active route by ID."""
    route = route_manager.get_route(route_id)
    if route is None:
        raise HTTPException(status_code=404, detail="Route not found")

    if route.status == "NO_VERIFIED_ROUTE":
        return NoRouteResponse(
            status="NO_VERIFIED_ROUTE",
            reason="All available paths contain confirmed flooded road segments.",
        )

    return route.to_response()
