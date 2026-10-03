from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.road import Road, RoadStatus, utcnow
from app.routing.road_state_filter import road_filter
from app.routing.route_manager import route_manager

SEED_NODES = {
    "NODE_A": ("Central Station Junction", 13.0827, 80.2755),
    "NODE_B": ("EVR Salai Junction", 13.0780, 80.2600),
    "NODE_C": ("Cooum River Road", 13.0720, 80.2720),
    "NODE_D": ("Anna Salai Crossing", 13.0520, 80.2510),
    "NODE_E": ("Royapettah Junction", 13.0570, 80.2650),
}

SEED_NETWORK_ROADS = [
    # code, name, from_node, to_node, distance_m, travel_time_sec, status, geometry
    (
        "ROAD_AB",
        "EVR Periyar Salai",
        "NODE_A",
        "NODE_B",
        1000.0,
        120.0,
        RoadStatus.OPEN,
        [[13.0827, 80.2755], [13.0805, 80.2680], [13.0780, 80.2600]],
    ),
    (
        "ROAD_BD",
        "East Link Avenue",
        "NODE_B",
        "NODE_D",
        1000.0,
        120.0,
        RoadStatus.OPEN,
        [[13.0780, 80.2600], [13.0650, 80.2550], [13.0520, 80.2510]],
    ),
    (
        "ROAD_AC",
        "River Side Expressway",
        "NODE_A",
        "NODE_C",
        1500.0,
        180.0,
        RoadStatus.OPEN,
        [[13.0827, 80.2755], [13.0770, 80.2740], [13.0720, 80.2720]],
    ),
    (
        "ROAD_CD",
        "Central Bypass Salai",
        "NODE_C",
        "NODE_D",
        1500.0,
        180.0,
        RoadStatus.OPEN,
        [[13.0720, 80.2720], [13.0620, 80.2610], [13.0520, 80.2510]],
    ),
    (
        "ROAD_CE",
        "South Connector Road",
        "NODE_C",
        "NODE_E",
        800.0,
        100.0,
        RoadStatus.OPEN,
        [[13.0720, 80.2720], [13.0640, 80.2680], [13.0570, 80.2650]],
    ),
    (
        "ROAD_ED",
        "Cathedral Link Road",
        "NODE_E",
        "NODE_D",
        800.0,
        100.0,
        RoadStatus.OPEN,
        [[13.0570, 80.2650], [13.0545, 80.2580], [13.0520, 80.2510]],
    ),
]

ROAD_GEOMETRIES = {r[0]: r[7] for r in SEED_NETWORK_ROADS}


async def seed_roads(db: AsyncSession) -> None:
    """Ensure seed roads exist in database and are mapped properly."""
    now = utcnow()
    for code, name, from_node, to_node, dist, tt, status, geom in SEED_NETWORK_ROADS:
        result = await db.execute(select(Road).where(Road.road_code == code))
        existing = result.scalar_one_or_none()
        conf_val = 0.0 if status == RoadStatus.OPEN else 1.0
        if existing is None:
            road = Road(
                road_code=code,
                name=name,
                from_node=from_node,
                to_node=to_node,
                distance_m=dist,
                travel_time_sec=tt,
                status=status,
                flood_confidence=conf_val,
                confidence=conf_val,
                flood_coverage=0.0,
                source="SEED",
                last_observed_at=now,
                updated_at=now,
            )
            db.add(road)
        else:
            # Update name to real-world clean name if needed
            existing.name = name
            if not existing.from_node:
                existing.from_node = from_node
            if not existing.to_node:
                existing.to_node = to_node
            if not existing.travel_time_sec or existing.travel_time_sec <= 0:
                existing.travel_time_sec = tt
            if not existing.distance_m or existing.distance_m <= 0:
                existing.distance_m = dist

    await db.commit()


async def sync_graph_from_db(db: AsyncSession) -> None:
    """Load roads from database into the route manager graph and road filter."""
    # Seed node locations
    for node_id, (name, lat, lng) in SEED_NODES.items():
        route_manager.graph.add_node(
            node_id=node_id,
            name=name,
            lat=lat,
            lng=lng,
        )

    roads = await list_roads(db)
    route_manager.graph.load_from_roads(roads)

    # Attach geometries
    for code, geom in ROAD_GEOMETRIES.items():
        edge = route_manager.graph.get_edge(code)
        if edge:
            edge.geometry = geom

    for r in roads:
        road_filter.initialize_road(r.road_code, r.status)


async def list_roads(db: AsyncSession) -> list[Road]:
    result = await db.execute(select(Road).order_by(Road.road_code))
    return list(result.scalars().all())


async def update_road_status(
    db: AsyncSession,
    road_code: str,
    status: RoadStatus,
    confidence: float,
    source: str,
    coverage: float = 0.0,
    apply_filter: bool = False,
) -> tuple[Road | None, RoadStatus | None, list[dict]]:
    result = await db.execute(select(Road).where(Road.road_code == road_code))
    road = result.scalar_one_or_none()
    if road is None:
        return None, None, []

    old_status = road.status

    if apply_filter:
        confirmed_status, _ = road_filter.process_observation(
            road_id=road_code,
            observed_status=status,
            confidence=confidence,
            coverage=coverage,
        )
    else:
        confirmed_status = status
        road_filter.force_set_status(road_code, status)

    now = utcnow()
    road.status = confirmed_status
    road.flood_confidence = confidence
    road.confidence = confidence
    road.flood_coverage = coverage
    road.source = source
    road.last_observed_at = now
    road.updated_at = now

    await db.commit()
    await db.refresh(road)

    # Trigger reroute checks in route manager
    reroute_events = route_manager.on_road_status_changed(
        road_id=road_code,
        new_status=confirmed_status,
        previous_status=old_status,
    )

    return road, old_status, reroute_events
