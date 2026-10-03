from typing import Any
from fastapi import APIRouter, HTTPException, status
from app.routing.route_manager import route_manager
from app.routing.schemas import NodeInfo, NoRouteResponse, RouteRequest, RouteResponse

router = APIRouter(prefix="/api/v1/routes", tags=["routes"])


@router.get("/nodes", response_model=list[NodeInfo])
async def get_nodes() -> Any:
    """Return all geographical navigation nodes with real-world names and coordinates."""
    nodes = []
    for n in route_manager.graph.nodes.values():
        if n.lat is not None and n.lng is not None:
            nodes.append(
                NodeInfo(
                    node_id=n.node_id,
                    name=n.name or n.node_id,
                    lat=n.lat,
                    lng=n.lng,
                )
            )
    return nodes


@router.get("/network")
async def get_network() -> Any:
    """Return all monitored road segments with geometries and real-time status for Google Maps overlays."""
    edges = []
    for edge in route_manager.graph.edges.values():
        edges.append(edge.to_dict())
    return edges


@router.post("", response_model=RouteResponse | NoRouteResponse, status_code=status.HTTP_200_OK)
async def create_route(payload: RouteRequest) -> Any:
    """Calculate and store a new active route between origin and destination nodes or coordinates."""
    origin_node = payload.origin_node
    dest_node = payload.destination_node

    # If coordinates provided, find closest graph nodes
    if not origin_node and payload.origin_lat is not None and payload.origin_lng is not None:
        closest = route_manager.graph.get_closest_node(payload.origin_lat, payload.origin_lng)
        if closest:
            origin_node = closest.node_id

    if not dest_node and payload.destination_lat is not None and payload.destination_lng is not None:
        closest = route_manager.graph.get_closest_node(payload.destination_lat, payload.destination_lng)
        if closest:
            dest_node = closest.node_id

    if not origin_node or not dest_node:
        raise HTTPException(
            status_code=400,
            detail="Both origin and destination must be specified by node ID or coordinates.",
        )

    route, reason = route_manager.create_route(
        origin_node=origin_node,
        destination_node=dest_node,
    )

    if route is None:
        flooded_names = [
            e.name for e in route_manager.graph.edges.values() if e.status.value == "FLOODED"
        ]
        return NoRouteResponse(
            status="NO_VERIFIED_ROUTE",
            reason=reason or "All available paths contain confirmed flooded road segments.",
            avoided_flooded_roads=flooded_names,
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
        flooded_names = [
            e.name for e in route_manager.graph.edges.values() if e.status.value == "FLOODED"
        ]
        return NoRouteResponse(
            status="NO_VERIFIED_ROUTE",
            reason="All available paths contain confirmed flooded road segments.",
            avoided_flooded_roads=flooded_names,
        )

    return route.to_response()
