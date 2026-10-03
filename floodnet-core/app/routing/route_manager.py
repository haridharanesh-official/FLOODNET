import itertools
from datetime import datetime, timezone
from typing import Any
from app.models.road import RoadStatus
from app.routing.astar import find_route
from app.routing.graph import RoadGraph
from app.routing.schemas import ActiveRoute


class RouteManager:
    """
    Manages active routes and handles dynamic recalculation when road states change.
    Designed for in-memory tracking with easy PostgreSQL persistence backing later.
    """

    def __init__(self, graph: RoadGraph | None = None) -> None:
        self.graph = graph or RoadGraph()
        self.active_routes: dict[str, ActiveRoute] = {}
        self._route_counter = itertools.count(1)

    def next_route_id(self) -> str:
        return f"ROUTE_{next(self._route_counter):03d}"

    def create_route(
        self,
        origin_node: str,
        destination_node: str,
    ) -> tuple[ActiveRoute | None, str | None]:
        """
        Compute an optimal route and register it as an active route.
        Returns (ActiveRoute, None) on success, or (None, failure_reason).
        """
        result = find_route(self.graph, origin_node, destination_node)
        if not result.success:
            return None, result.reason

        route_id = self.next_route_id()
        now = datetime.now(timezone.utc)
        active_route = ActiveRoute(
            route_id=route_id,
            origin_node=origin_node,
            destination_node=destination_node,
            road_ids=result.roads,
            node_ids=result.nodes,
            total_distance_m=result.total_distance_m,
            estimated_time_sec=result.total_travel_time_sec,
            risk_cost=result.total_cost,
            status="ACTIVE",
            created_at=now,
            updated_at=now,
        )
        self.active_routes[route_id] = active_route
        return active_route, None

    def get_route(self, route_id: str) -> ActiveRoute | None:
        return self.active_routes.get(route_id)

    def list_active_routes(self) -> list[ActiveRoute]:
        return list(self.active_routes.values())

    def calculate_path_dynamic_cost(self, road_ids: list[str]) -> float:
        """Calculate dynamic cost of a specific road sequence based on current graph edge states."""
        total = 0.0
        for rid in road_ids:
            edge = self.graph.get_edge(rid)
            if edge is None or edge.status == RoadStatus.FLOODED:
                return float("inf")
            total += edge.dynamic_weight
        return total

    def on_road_status_changed(
        self,
        road_id: str,
        new_status: RoadStatus,
        previous_status: RoadStatus | None = None,
    ) -> list[dict[str, Any]]:
        """
        Process a road status update against the graph and active routes.
        Returns a list of WebSocket event payloads (e.g. route.recalculated, route.unavailable).
        """
        # 1. Update graph edge
        self.graph.update_edge_status(road_id=road_id, status=new_status)

        events: list[dict[str, Any]] = []

        # 2. Check all active routes
        for route in list(self.active_routes.values()):
            is_road_in_route = road_id in route.road_ids

            if is_road_in_route:
                if new_status == RoadStatus.FLOODED:
                    # Immediately calculate a new route excluding the FLOODED road
                    old_path = list(route.road_ids)
                    old_eta = route.estimated_time_sec

                    alt_result = find_route(
                        self.graph, route.origin_node, route.destination_node
                    )

                    if alt_result.success:
                        # Alternative route found! Replace active route
                        route.road_ids = alt_result.roads
                        route.node_ids = alt_result.nodes
                        route.total_distance_m = alt_result.total_distance_m
                        route.estimated_time_sec = alt_result.total_travel_time_sec
                        route.risk_cost = alt_result.total_cost
                        route.status = "ACTIVE"
                        route.updated_at = datetime.now(timezone.utc)

                        events.append({
                            "type": "route.recalculated",
                            "route_id": route.route_id,
                            "reason": "FLOODED_ROAD",
                            "blocked_road": road_id,
                            "old_path": old_path,
                            "new_path": route.road_ids,
                            "old_eta_sec": old_eta,
                            "new_eta_sec": route.estimated_time_sec,
                        })
                    else:
                        # No valid route available
                        route.status = "NO_VERIFIED_ROUTE"
                        route.updated_at = datetime.now(timezone.utc)

                        events.append({
                            "type": "route.unavailable",
                            "route_id": route.route_id,
                            "reason": "NO_VERIFIED_ROUTE",
                            "blocked_road": road_id,
                        })

                elif new_status in (RoadStatus.CAUTION, RoadStatus.UNKNOWN):
                    # Road in route became CAUTION or UNKNOWN.
                    # Compare current route's updated dynamic cost vs alternative route.
                    current_cost = self.calculate_path_dynamic_cost(route.road_ids)
                    alt_result = find_route(
                        self.graph, route.origin_node, route.destination_node
                    )

                    if (
                        alt_result.success
                        and alt_result.roads != route.road_ids
                        and alt_result.total_cost < current_cost
                    ):
                        old_path = list(route.road_ids)
                        old_eta = route.estimated_time_sec

                        route.road_ids = alt_result.roads
                        route.node_ids = alt_result.nodes
                        route.total_distance_m = alt_result.total_distance_m
                        route.estimated_time_sec = alt_result.total_travel_time_sec
                        route.risk_cost = alt_result.total_cost
                        route.status = "ACTIVE"
                        route.updated_at = datetime.now(timezone.utc)

                        events.append({
                            "type": "route.recalculated",
                            "route_id": route.route_id,
                            "reason": f"{new_status.value}_ROAD_PENALTY",
                            "blocked_road": road_id,
                            "old_path": old_path,
                            "new_path": route.road_ids,
                            "old_eta_sec": old_eta,
                            "new_eta_sec": route.estimated_time_sec,
                        })
            else:
                # Road is NOT part of current active route.
                # If a route was previously marked NO_VERIFIED_ROUTE and road became OPEN,
                # check if it can now be restored.
                if route.status == "NO_VERIFIED_ROUTE" and new_status == RoadStatus.OPEN:
                    recovered = find_route(
                        self.graph, route.origin_node, route.destination_node
                    )
                    if recovered.success:
                        old_path = list(route.road_ids)
                        old_eta = route.estimated_time_sec

                        route.road_ids = recovered.roads
                        route.node_ids = recovered.nodes
                        route.total_distance_m = recovered.total_distance_m
                        route.estimated_time_sec = recovered.total_travel_time_sec
                        route.risk_cost = recovered.total_cost
                        route.status = "ACTIVE"
                        route.updated_at = datetime.now(timezone.utc)

                        events.append({
                            "type": "route.recalculated",
                            "route_id": route.route_id,
                            "reason": "ROAD_REOPENED",
                            "blocked_road": road_id,
                            "old_path": old_path,
                            "new_path": route.road_ids,
                            "old_eta_sec": old_eta,
                            "new_eta_sec": route.estimated_time_sec,
                        })

        return events


# Singleton route manager instance
route_manager = RouteManager()
