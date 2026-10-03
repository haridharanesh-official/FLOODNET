import heapq
import itertools
import math
from dataclasses import dataclass, field
from typing import Callable
from app.models.road import RoadStatus
from app.routing.graph import RoadEdge, RoadGraph, RoadNode


@dataclass
class RouteSearchResult:
    success: bool
    nodes: list[str] = field(default_factory=list)
    roads: list[str] = field(default_factory=list)
    edges: list[RoadEdge] = field(default_factory=list)
    total_distance_m: float = 0.0
    total_travel_time_sec: float = 0.0
    total_cost: float = 0.0
    contains_caution: bool = False
    contains_unknown: bool = False
    reason: str | None = None


def zero_heuristic(current_node: RoadNode, target_node: RoadNode) -> float:
    """Fallback heuristic yielding standard Dijkstra behavior."""
    return 0.0


def euclidean_heuristic(current_node: RoadNode, target_node: RoadNode, max_speed_mps: float = 25.0) -> float:
    """
    Admissible A* heuristic based on Euclidean distance divided by max speed (m/s).
    Falls back cleanly to 0.0 if coordinates are absent.
    """
    if (
        current_node.x is None
        or current_node.y is None
        or target_node.x is None
        or target_node.y is None
    ):
        return 0.0

    dx = current_node.x - target_node.x
    dy = current_node.y - target_node.y
    distance = math.hypot(dx, dy)
    return distance / max_speed_mps


def find_route(
    graph: RoadGraph,
    origin_node: str,
    destination_node: str,
    heuristic: Callable[[RoadNode, RoadNode], float] | None = None,
) -> RouteSearchResult:
    """
    Find optimal route between origin and destination using A* with dynamic flood weights.
    Flooded edges are completely excluded from search.
    """
    if origin_node not in graph.nodes or destination_node not in graph.nodes:
        return RouteSearchResult(
            success=False,
            reason=f"Origin '{origin_node}' or Destination '{destination_node}' not found in road graph.",
        )

    if origin_node == destination_node:
        return RouteSearchResult(
            success=True,
            nodes=[origin_node],
            roads=[],
            edges=[],
            total_distance_m=0.0,
            total_travel_time_sec=0.0,
            total_cost=0.0,
        )

    h_func = heuristic or zero_heuristic
    dest_node_obj = graph.nodes[destination_node]

    # Priority queue item: (f_score, counter, current_node_id, g_score, path_nodes, path_edges)
    counter = itertools.count()
    pq: list[tuple[float, int, str, float, list[str], list[RoadEdge]]] = []

    start_h = h_func(graph.nodes[origin_node], dest_node_obj)
    heapq.heappush(pq, (start_h, next(counter), origin_node, 0.0, [origin_node], []))

    # Track best g_score seen for each node to prune suboptimal branches
    best_g: dict[str, float] = {origin_node: 0.0}

    while pq:
        f, _, current_node, g, path_nodes, path_edges = heapq.heappop(pq)

        # If arrived at destination
        if current_node == destination_node:
            total_distance = sum(e.distance_m for e in path_edges)
            total_travel_time = sum(e.travel_time_sec for e in path_edges)
            has_caution = any(e.status == RoadStatus.CAUTION for e in path_edges)
            has_unknown = any(e.status == RoadStatus.UNKNOWN for e in path_edges)

            return RouteSearchResult(
                success=True,
                nodes=path_nodes,
                roads=[e.road_id for e in path_edges],
                edges=path_edges,
                total_distance_m=total_distance,
                total_travel_time_sec=total_travel_time,
                total_cost=g,
                contains_caution=has_caution,
                contains_unknown=has_unknown,
            )

        # If we already found a strictly better path to current_node, skip
        if g > best_g.get(current_node, float("inf")):
            continue

        for neighbor_node, edge in graph.get_outgoing_edges(current_node):
            # RULE: Completely exclude FLOODED edges from route search
            if edge.status == RoadStatus.FLOODED:
                continue

            dynamic_weight = edge.dynamic_weight
            if math.isinf(dynamic_weight):
                continue

            tentative_g = g + dynamic_weight

            if tentative_g < best_g.get(neighbor_node, float("inf")):
                best_g[neighbor_node] = tentative_g
                h = h_func(graph.nodes[neighbor_node], dest_node_obj)
                tentative_f = tentative_g + h

                new_nodes = list(path_nodes)
                new_nodes.append(neighbor_node)

                new_edges = list(path_edges)
                new_edges.append(edge)

                heapq.heappush(
                    pq,
                    (tentative_f, next(counter), neighbor_node, tentative_g, new_nodes, new_edges),
                )

    return RouteSearchResult(
        success=False,
        reason="All available paths contain confirmed flooded road segments.",
    )
