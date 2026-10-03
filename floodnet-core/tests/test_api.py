import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.road import RoadStatus
from app.routing.graph import RoadEdge
from app.routing.route_manager import route_manager


@pytest.fixture(autouse=True)
def setup_test_graph():
    """Ensure the route manager graph has the seed network."""
    route_manager.graph.clear()
    route_manager.active_routes.clear()
    edges = [
        RoadEdge("ROAD_AB", "Road AB", "NODE_A", "NODE_B", 1000.0, 120.0, RoadStatus.OPEN),
        RoadEdge("ROAD_BD", "Road BD", "NODE_B", "NODE_D", 1000.0, 120.0, RoadStatus.OPEN),
        RoadEdge("ROAD_AC", "Road AC", "NODE_A", "NODE_C", 1500.0, 180.0, RoadStatus.OPEN),
        RoadEdge("ROAD_CD", "Road CD", "NODE_C", "NODE_D", 1500.0, 180.0, RoadStatus.OPEN),
        RoadEdge("ROAD_CE", "Road CE", "NODE_C", "NODE_E", 800.0, 100.0, RoadStatus.OPEN),
        RoadEdge("ROAD_ED", "Road ED", "NODE_E", "NODE_D", 800.0, 100.0, RoadStatus.OPEN),
    ]
    for e in edges:
        route_manager.graph.add_edge(e)


@pytest.mark.asyncio
async def test_api_create_and_get_route():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Request route from NODE_A to NODE_D
        response = await client.post(
            "/api/v1/routes",
            json={"origin_node": "NODE_A", "destination_node": "NODE_D"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ACTIVE"
        assert data["nodes"] == ["NODE_A", "NODE_B", "NODE_D"]
        assert data["roads"] == ["ROAD_AB", "ROAD_BD"]
        assert data["estimated_time_sec"] == 240.0
        route_id = data["route_id"]

        # 2. Get route by ID
        get_res = await client.get(f"/api/v1/routes/{route_id}")
        assert get_res.status_code == 200
        assert get_res.json()["route_id"] == route_id

        # 3. List active routes
        active_res = await client.get("/api/v1/routes/active")
        assert active_res.status_code == 200
        routes = active_res.json()
        assert any(r["route_id"] == route_id for r in routes)


@pytest.mark.asyncio
async def test_api_no_verified_route():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Block all exits from NODE_A
        route_manager.graph.update_edge_status("ROAD_AB", RoadStatus.FLOODED)
        route_manager.graph.update_edge_status("ROAD_AC", RoadStatus.FLOODED)

        response = await client.post(
            "/api/v1/routes",
            json={"origin_node": "NODE_A", "destination_node": "NODE_D"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "NO_VERIFIED_ROUTE"
        assert "All available paths contain confirmed flooded road segments." in data["reason"]
