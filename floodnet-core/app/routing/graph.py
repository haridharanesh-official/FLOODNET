from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from app.models.road import Road, RoadStatus
from app.routing.weights import calculate_dynamic_weight


@dataclass
class RoadNode:
    node_id: str
    name: str | None = None
    x: float | None = None  # Geographic longitude or X coordinate
    y: float | None = None  # Geographic latitude or Y coordinate


@dataclass
class RoadEdge:
    road_id: str
    name: str
    from_node: str
    to_node: str
    distance_m: float
    travel_time_sec: float
    status: RoadStatus = RoadStatus.OPEN
    flood_confidence: float = 0.0
    flood_coverage: float = 0.0
    source: str = "SYSTEM"
    last_observed_at: datetime | None = None
    bidirectional: bool = True

    @property
    def base_weight(self) -> float:
        return self.travel_time_sec

    @property
    def dynamic_weight(self) -> float:
        return calculate_dynamic_weight(self.travel_time_sec, self.status)

    def to_dict(self) -> dict[str, Any]:
        return {
            "road_id": self.road_id,
            "name": self.name,
            "from_node": self.from_node,
            "to_node": self.to_node,
            "distance_m": self.distance_m,
            "travel_time_sec": self.travel_time_sec,
            "status": self.status.value,
            "base_weight": self.base_weight,
            "dynamic_weight": self.dynamic_weight,
            "flood_confidence": self.flood_confidence,
            "flood_coverage": self.flood_coverage,
            "last_observed_at": self.last_observed_at.isoformat() if self.last_observed_at else None,
            "source": self.source,
        }


class RoadGraph:
    def __init__(self) -> None:
        self.nodes: dict[str, RoadNode] = {}
        self.edges: dict[str, RoadEdge] = {}
        # adjacency: node_id -> list of (neighbor_node_id, RoadEdge)
        self.adjacency: dict[str, list[tuple[str, RoadEdge]]] = {}

    def clear(self) -> None:
        self.nodes.clear()
        self.edges.clear()
        self.adjacency.clear()

    def add_node(
        self,
        node_id: str,
        name: str | None = None,
        x: float | None = None,
        y: float | None = None,
    ) -> RoadNode:
        if node_id not in self.nodes:
            self.nodes[node_id] = RoadNode(node_id=node_id, name=name, x=x, y=y)
            self.adjacency[node_id] = []
        return self.nodes[node_id]

    def add_edge(self, edge: RoadEdge) -> None:
        self.edges[edge.road_id] = edge
        self.add_node(edge.from_node)
        self.add_node(edge.to_node)

        # Forward direction
        self.adjacency[edge.from_node].append((edge.to_node, edge))

        # Reverse direction if bidirectional
        if edge.bidirectional:
            self.adjacency[edge.to_node].append((edge.from_node, edge))

    def get_edge(self, road_id: str) -> RoadEdge | None:
        return self.edges.get(road_id)

    def get_node(self, node_id: str) -> RoadNode | None:
        return self.nodes.get(node_id)

    def get_outgoing_edges(self, node_id: str) -> list[tuple[str, RoadEdge]]:
        """Return list of (target_node_id, edge) for a given node."""
        return self.adjacency.get(node_id, [])

    def update_edge_status(
        self,
        road_id: str,
        status: RoadStatus,
        confidence: float | None = None,
        coverage: float | None = None,
        source: str | None = None,
        last_observed_at: datetime | None = None,
    ) -> RoadEdge | None:
        edge = self.edges.get(road_id)
        if edge is None:
            return None

        edge.status = status
        if confidence is not None:
            edge.flood_confidence = confidence
        if coverage is not None:
            edge.flood_coverage = coverage
        if source is not None:
            edge.source = source
        if last_observed_at is not None:
            edge.last_observed_at = last_observed_at
        else:
            edge.last_observed_at = datetime.now(timezone.utc)

        return edge

    def load_from_roads(self, roads: list[Road]) -> None:
        """Populate or update graph from database Road models."""
        for r in roads:
            if not r.from_node or not r.to_node:
                continue

            edge = RoadEdge(
                road_id=r.road_code,
                name=r.name,
                from_node=r.from_node,
                to_node=r.to_node,
                distance_m=r.distance_m or 1000.0,
                travel_time_sec=r.travel_time_sec or 120.0,
                status=r.status,
                flood_confidence=r.flood_confidence,
                flood_coverage=r.flood_coverage,
                source=r.source,
                last_observed_at=r.last_observed_at,
                bidirectional=True,
            )
            # If already exists, update properties; else add
            if r.road_code in self.edges:
                existing = self.edges[r.road_code]
                existing.status = r.status
                existing.flood_confidence = r.flood_confidence
                existing.flood_coverage = r.flood_coverage
                existing.distance_m = r.distance_m
                existing.travel_time_sec = r.travel_time_sec
                existing.source = r.source
                existing.last_observed_at = r.last_observed_at
            else:
                self.add_edge(edge)
