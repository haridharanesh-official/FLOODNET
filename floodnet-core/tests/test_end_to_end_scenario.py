import asyncio
import json
import httpx
import pytest
import websockets
from app.models.road import RoadStatus


@pytest.mark.asyncio
async def test_full_end_to_end_simulation():
    """
    Tests the complete end-to-end scenario against the live running service:
    1. Connect to WebSocket /ws/live.
    2. Reset ROAD_BD and ROAD_AC to OPEN.
    3. Request NODE_A -> NODE_D.
    4. Assert route is ROAD_AB -> ROAD_BD (240s).
    5. Manually simulate ROAD_BD -> FLOODED.
    6. Confirm Core excludes ROAD_BD, identifies affected active route, recalculates.
    7. Confirm WebSocket receives route.recalculated with old_path and new_path (ROAD_AC -> ROAD_CD, 360s).
    8. Query route endpoint to confirm persistent active route has new path.
    9. Confirm ROAD_BD is FLOODED.
    10. Simulate reopening logic / restore.
    """
    base_url = "http://localhost:8000"
    ws_url = "ws://localhost:8000/ws/live"

    async with httpx.AsyncClient(base_url=base_url) as client:
        # 1. Reset roads to OPEN
        await client.post("/api/v1/roads/ROAD_BD/status", json={"status": "OPEN", "confidence": 1.0, "source": "MANUAL_SIMULATION"})
        await client.post("/api/v1/roads/ROAD_AC/status", json={"status": "OPEN", "confidence": 1.0, "source": "MANUAL_SIMULATION"})

        async with websockets.connect(ws_url) as ws:
            # Drain connection messages
            while True:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=0.3)
                except asyncio.TimeoutError:
                    break

            # 2. Request route NODE_A -> NODE_D
            res = await client.post("/api/v1/routes", json={"origin_node": "NODE_A", "destination_node": "NODE_D"})
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "ACTIVE"
            assert data["roads"] == ["ROAD_AB", "ROAD_BD"]
            assert data["estimated_time_sec"] == 240.0
            route_id = data["route_id"]

            # 3. Simulate ROAD_BD -> FLOODED
            flood_res = await client.post("/api/v1/roads/ROAD_BD/status", json={
                "status": "FLOODED",
                "confidence": 0.96,
                "source": "MANUAL_SIMULATION"
            })
            assert flood_res.status_code == 200
            assert flood_res.json()["status"] == "FLOODED"

            # 4. Receive WebSocket events
            received_events = []
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    received_events.append(json.loads(raw))
                except asyncio.TimeoutError:
                    break

            # Verify road.status.changed event
            road_events = [e for e in received_events if e.get("type") == "road.status.changed"]
            assert len(road_events) >= 1
            assert road_events[0]["road_id"] == "ROAD_BD"
            assert road_events[0]["new_status"] == "FLOODED"

            # Verify route.recalculated event
            reroute_events = [e for e in received_events if e.get("type") == "route.recalculated" and e.get("route_id") == route_id]
            assert len(reroute_events) == 1
            rec = reroute_events[0]
            assert rec["reason"] == "FLOODED_ROAD"
            assert rec["blocked_road"] == "ROAD_BD"
            assert rec["old_path"] == ["ROAD_AB", "ROAD_BD"]
            assert rec["new_path"] == ["ROAD_AC", "ROAD_CD"]
            assert rec["old_eta_sec"] == 240.0
            assert rec["new_eta_sec"] == 360.0

            # 5. Verify Route query returns recalculated route
            get_res = await client.get(f"/api/v1/routes/{route_id}")
            assert get_res.status_code == 200
            get_data = get_res.json()
            assert get_data["roads"] == ["ROAD_AC", "ROAD_CD"]
            assert get_data["estimated_time_sec"] == 360.0

            # 6. Verify ROAD_BD remains visible as FLOODED in database and list
            roads_res = await client.get("/api/v1/roads")
            roads_list = roads_res.json()
            road_bd = next(r for r in roads_list if r["road_code"] == "ROAD_BD")
            assert road_bd["status"] == "FLOODED"

            # 7. Restore ROAD_BD to OPEN
            restore_res = await client.post("/api/v1/roads/ROAD_BD/status", json={
                "status": "OPEN",
                "confidence": 1.0,
                "source": "MANUAL_SIMULATION"
            })
            assert restore_res.status_code == 200
            assert restore_res.json()["status"] == "OPEN"
