import pytest
from app.models.road import RoadStatus
from app.routing.astar import find_route
from app.routing.graph import RoadEdge, RoadGraph
from app.routing.road_state_filter import RoadStateFilter
from app.routing.route_manager import RouteManager
from app.routing.weights import (
    calculate_dynamic_weight,
    calculate_flood_risk,
    classify_flood_risk,
    get_risk_multiplier,
)


def build_seed_graph() -> RoadGraph:
    """Helper to construct the deterministic seed/test network."""
    graph = RoadGraph()
    # Initial Test Network:
    # NODE_A ---- ROAD_AB ---- NODE_B
    #    |                       |
    #  ROAD_AC                ROAD_BD
    #    |                       |
    #  NODE_C ---- ROAD_CD ---- NODE_D
    #    |
    #  ROAD_CE
    #    |
    #  NODE_E ---- ROAD_ED ---- NODE_D
    edges = [
        RoadEdge("ROAD_AB", "Road AB", "NODE_A", "NODE_B", 1000.0, 120.0, RoadStatus.OPEN),
        RoadEdge("ROAD_BD", "Road BD", "NODE_B", "NODE_D", 1000.0, 120.0, RoadStatus.OPEN),
        RoadEdge("ROAD_AC", "Road AC", "NODE_A", "NODE_C", 1500.0, 180.0, RoadStatus.OPEN),
        RoadEdge("ROAD_CD", "Road CD", "NODE_C", "NODE_D", 1500.0, 180.0, RoadStatus.OPEN),
        RoadEdge("ROAD_CE", "Road CE", "NODE_C", "NODE_E", 800.0, 100.0, RoadStatus.OPEN),
        RoadEdge("ROAD_ED", "Road ED", "NODE_E", "NODE_D", 800.0, 100.0, RoadStatus.OPEN),
    ]
    for edge in edges:
        graph.add_edge(edge)
    return graph


def test_1_all_roads_open():
    """TEST 1: All roads OPEN: A -> B -> D is selected (240s)."""
    graph = build_seed_graph()
    result = find_route(graph, "NODE_A", "NODE_D")

    assert result.success is True
    assert result.nodes == ["NODE_A", "NODE_B", "NODE_D"]
    assert result.roads == ["ROAD_AB", "ROAD_BD"]
    assert result.total_travel_time_sec == 240.0
    assert result.total_cost == 240.0


def test_2_road_bd_becomes_flooded():
    """TEST 2: ROAD_BD becomes FLOODED: A -> B -> D is rejected. Alternative path is returned."""
    graph = build_seed_graph()
    graph.update_edge_status("ROAD_BD", RoadStatus.FLOODED)

    result = find_route(graph, "NODE_A", "NODE_D")

    assert result.success is True
    assert "ROAD_BD" not in result.roads
    assert result.nodes == ["NODE_A", "NODE_C", "NODE_D"]
    assert result.roads == ["ROAD_AC", "ROAD_CD"]
    assert result.total_travel_time_sec == 360.0


def test_3_road_bd_becomes_caution():
    """TEST 3: ROAD_BD becomes CAUTION: The penalty is applied correctly and safer alternative preferred."""
    graph = build_seed_graph()
    graph.update_edge_status("ROAD_BD", RoadStatus.CAUTION)

    # Road BD penalty: 120s * 5.0 = 600s dynamic weight
    # Path A-B-D dynamic cost: 120 + 600 = 720
    # Path A-C-D cost: 180 + 180 = 360 (all OPEN)
    result = find_route(graph, "NODE_A", "NODE_D")

    assert result.success is True
    assert result.roads == ["ROAD_AC", "ROAD_CD"]
    assert result.total_cost == 360.0


def test_4_unknown_roads_penalty():
    """TEST 4: UNKNOWN roads: Remain routable but receive configured penalty."""
    graph = build_seed_graph()
    # Make ROAD_AC UNKNOWN
    graph.update_edge_status("ROAD_AC", RoadStatus.UNKNOWN)

    # Multiplier for UNKNOWN is 2.0 -> ROAD_AC dynamic weight is 180 * 2.0 = 360
    edge = graph.get_edge("ROAD_AC")
    assert edge.dynamic_weight == 360.0

    # Path A-C-D dynamic cost: 360 + 180 = 540
    # Path A-B-D dynamic cost: 120 + 120 = 240 (OPEN preferred)
    result = find_route(graph, "NODE_A", "NODE_D")
    assert result.roads == ["ROAD_AB", "ROAD_BD"]

    # When Path A-B-D is blocked, UNKNOWN road is still routable
    graph.update_edge_status("ROAD_BD", RoadStatus.FLOODED)
    alt_result = find_route(graph, "NODE_A", "NODE_D")
    assert alt_result.success is True
    assert alt_result.roads == ["ROAD_AC", "ROAD_CD"]
    assert alt_result.contains_unknown is True
    assert alt_result.total_cost == 540.0


def test_5_multiple_roads_flooded():
    """TEST 5: Multiple roads FLOODED: Router finds remaining route."""
    graph = build_seed_graph()
    # Block both Path 1 (ROAD_BD) and Path 2 (ROAD_CD)
    graph.update_edge_status("ROAD_BD", RoadStatus.FLOODED)
    graph.update_edge_status("ROAD_CD", RoadStatus.FLOODED)

    # Remaining path: A -> C -> E -> D (ROAD_AC: 180, ROAD_CE: 100, ROAD_ED: 100) = 380s
    result = find_route(graph, "NODE_A", "NODE_D")

    assert result.success is True
    assert result.nodes == ["NODE_A", "NODE_C", "NODE_E", "NODE_D"]
    assert result.roads == ["ROAD_AC", "ROAD_CE", "ROAD_ED"]
    assert result.total_travel_time_sec == 380.0


def test_6_every_possible_path_flooded():
    """TEST 6: Every possible path FLOODED: Return NO_VERIFIED_ROUTE. Never return a flooded path."""
    graph = build_seed_graph()
    # Flood all paths out of A
    graph.update_edge_status("ROAD_AB", RoadStatus.FLOODED)
    graph.update_edge_status("ROAD_AC", RoadStatus.FLOODED)

    result = find_route(graph, "NODE_A", "NODE_D")

    assert result.success is False
    assert result.reason == "All available paths contain confirmed flooded road segments."
    assert len(result.roads) == 0


def test_7_flood_event_not_in_active_route():
    """TEST 7: Flood event on road not in active route: Do not unnecessarily reroute."""
    graph = build_seed_graph()
    manager = RouteManager(graph)

    # Create active route A -> D (selects ROAD_AB, ROAD_BD)
    route, err = manager.create_route("NODE_A", "NODE_D")
    assert route is not None
    assert route.road_ids == ["ROAD_AB", "ROAD_BD"]

    # Flood ROAD_CE, which is NOT in active route
    events = manager.on_road_status_changed("ROAD_CE", RoadStatus.FLOODED)

    # No reroute events generated
    assert len(events) == 0
    assert route.road_ids == ["ROAD_AB", "ROAD_BD"]
    assert route.status == "ACTIVE"


def test_8_flood_event_on_active_route():
    """TEST 8: Flood event on active route: Immediately recalculate."""
    graph = build_seed_graph()
    manager = RouteManager(graph)

    route, err = manager.create_route("NODE_A", "NODE_D")
    assert route is not None
    assert route.road_ids == ["ROAD_AB", "ROAD_BD"]

    # Flood ROAD_BD, which IS on the active route
    events = manager.on_road_status_changed("ROAD_BD", RoadStatus.FLOODED)

    # Must recalculate immediately
    assert len(events) == 1
    assert events[0]["type"] == "route.recalculated"
    assert route.road_ids == ["ROAD_AC", "ROAD_CD"]
    assert route.estimated_time_sec == 360.0
    assert route.status == "ACTIVE"


def test_9_websocket_recalculated_event_payload():
    """TEST 9: WebSocket route.recalculated event contains correct old/new paths and ETAs."""
    graph = build_seed_graph()
    manager = RouteManager(graph)

    route, err = manager.create_route("NODE_A", "NODE_D")
    assert route is not None

    events = manager.on_road_status_changed("ROAD_BD", RoadStatus.FLOODED)
    assert len(events) == 1
    event = events[0]

    assert event["type"] == "route.recalculated"
    assert event["route_id"] == route.route_id
    assert event["reason"] == "FLOODED_ROAD"
    assert event["blocked_road"] == "ROAD_BD"
    assert event["old_path"] == ["ROAD_AB", "ROAD_BD"]
    assert event["new_path"] == ["ROAD_AC", "ROAD_CD"]
    assert event["old_eta_sec"] == 240.0
    assert event["new_eta_sec"] == 360.0


def test_10_anti_flapping_logic():
    """TEST 10: Anti-flapping logic prevents rapid OPEN/FLOODED switching."""
    # Filter with require 7 of 10 for FLOODED, and 20 consecutive clear for OPEN
    filter_engine = RoadStateFilter(
        open_to_flooded_positive_required=7,
        open_to_flooded_window_size=10,
        flooded_to_open_consecutive_clear_required=20,
    )
    filter_engine.initialize_road("TEST_ROAD", RoadStatus.OPEN)

    # 1. Sporadic/noisy flood observations should not trigger FLOODED
    status, changed = filter_engine.process_observation("TEST_ROAD", RoadStatus.FLOODED)
    assert status == RoadStatus.OPEN
    assert changed is False

    # Rapid alternating
    filter_engine.process_observation("TEST_ROAD", RoadStatus.OPEN)
    filter_engine.process_observation("TEST_ROAD", RoadStatus.FLOODED)
    filter_engine.process_observation("TEST_ROAD", RoadStatus.OPEN)
    assert filter_engine.get_confirmed_status("TEST_ROAD") == RoadStatus.OPEN

    # 2. Strong flood confirmation (7 out of 10 FLOODED) triggers FLOODED
    # Currently have 2 FLOODED in window. Add 4 more (total 6 FLOODED in window: not yet 7)
    for _ in range(4):
        s, ch = filter_engine.process_observation("TEST_ROAD", RoadStatus.FLOODED)
        assert s == RoadStatus.OPEN
        assert ch is False

    # The 7th FLOODED observation meets the threshold and triggers the transition
    status, changed = filter_engine.process_observation("TEST_ROAD", RoadStatus.FLOODED)
    assert status == RoadStatus.FLOODED
    assert changed is True

    # 3. Once FLOODED, road cannot reopen on sporadic clear signals
    for _ in range(5):
        filter_engine.process_observation("TEST_ROAD", RoadStatus.OPEN)
    assert filter_engine.get_confirmed_status("TEST_ROAD") == RoadStatus.FLOODED

    # Single flood noise resets clear sequence
    filter_engine.process_observation("TEST_ROAD", RoadStatus.FLOODED)

    # 4. Only after 20 consecutive clear observations does it reopen to OPEN
    for i in range(19):
        status, changed = filter_engine.process_observation("TEST_ROAD", RoadStatus.OPEN)
        assert status == RoadStatus.FLOODED
        assert changed is False

    status, changed = filter_engine.process_observation("TEST_ROAD", RoadStatus.OPEN)
    assert status == RoadStatus.OPEN
    assert changed is True


def test_risk_formula_and_classification():
    """Test the prototype risk formula: 0.55*confidence + 0.35*coverage + 0.10*freshness."""
    # Low risk (< 0.25) -> OPEN
    risk_low = calculate_flood_risk(confidence=0.1, coverage=0.0, freshness=0.0)
    assert risk_low < 0.25
    assert classify_flood_risk(risk_low) == RoadStatus.OPEN

    # Medium risk (0.25 <= risk < 0.60) -> CAUTION
    risk_med = calculate_flood_risk(confidence=0.4, coverage=0.3, freshness=0.1)
    assert 0.25 <= risk_med < 0.60
    assert classify_flood_risk(risk_med) == RoadStatus.CAUTION

    # High risk (>= 0.60) -> FLOODED
    risk_high = calculate_flood_risk(confidence=0.9, coverage=0.7, freshness=0.2)
    assert risk_high >= 0.60
    assert classify_flood_risk(risk_high) == RoadStatus.FLOODED
