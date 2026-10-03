from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.road import RoadResponse, RoadStatusUpdate
from app.services.roads import list_roads, update_road_status
from app.websocket.manager import manager

router = APIRouter(prefix="/api/v1/roads", tags=["roads"])


@router.get("", response_model=list[RoadResponse])
async def get_roads(db: AsyncSession = Depends(get_db)):
    return await list_roads(db)


@router.post("/{road_code}/status", response_model=RoadResponse)
async def set_road_status(
    road_code: str,
    payload: RoadStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    road, old_status, reroute_events = await update_road_status(
        db=db,
        road_code=road_code,
        status=payload.status,
        confidence=payload.confidence,
        source=payload.source,
        coverage=payload.coverage,
        apply_filter=payload.apply_filter,
    )

    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")

    # 1. Broadcast road state change
    await manager.broadcast({
        "type": "road.status.changed",
        "road_id": road.road_code,
        "previous_status": old_status.value if old_status else None,
        "new_status": road.status.value,
        "confidence": road.confidence,
        "source": road.source,
        "updated_at": road.updated_at.isoformat(),
    })

    # 2. Broadcast any reroute events (route.recalculated or route.unavailable)
    for event in reroute_events:
        await manager.broadcast(event)

    return road
