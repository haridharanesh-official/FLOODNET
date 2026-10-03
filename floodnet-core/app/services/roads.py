from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.road import Road, RoadStatus, utcnow
from app.routing.road_state_filter import road_filter
from app.routing.route_manager import route_manager

SEED_NETWORK_ROADS = [
    # code, name, from_node, to_node, distance_m, travel_time_sec, status
    ("ROAD_AB", "Road AB (Market Road)", "NODE_A", "NODE_B", 1000.0, 120.0, RoadStatus.OPEN),
    ("ROAD_BD", "Road BD (East Link)", "NODE_B", "NODE_D", 1000.0, 120.0, RoadStatus.OPEN),
    ("ROAD_AC", "Road AC (River Side)", "NODE_A", "NODE_C", 1500.0, 180.0, RoadStatus.OPEN),
    ("ROAD_CD", "Road CD (Central Ave)", "NODE_C", "NODE_D", 1500.0, 180.0, RoadStatus.OPEN),
    ("ROAD_CE", "Road CE (South Bypass)", "NODE_C", "NODE_E", 800.0, 100.0, RoadStatus.OPEN),
    ("ROAD_ED", "Road ED (Express Link)", "NODE_E", "NODE_D", 800.0, 100.0, RoadStatus.OPEN),
]


async def seed_roads(db: AsyncSession) -> None:
    """Ensure seed roads exist in database and are mapped properly."""
    now = utcnow()
    for code, name, from_node, to_node, dist, tt, status in SEED_NETWORK_ROADS:
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
            # Backfill any missing node coordinates
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
    roads = await list_roads(db)
    route_manager.graph.load_from_roads(roads)
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
