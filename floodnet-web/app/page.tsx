"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GoogleMapView from "@/components/GoogleMapView";
import { calculateRoute, fetchNetwork, fetchNodes } from "@/lib/api";
import { getGoogleMapsApiKey, setGoogleMapsApiKey } from "@/lib/googleMapsLoader";
import type {
  CCTVCamera,
  NoRouteResponse,
  NodeInfo,
  Road,
  RoadStatusChangedEvent,
  RouteRecalculatedEvent,
  RouteResponse,
  RouteUnavailableEvent,
} from "@/types/road";

const DEFAULT_CAMERAS: CCTVCamera[] = [
  {
    id: "CAM-01",
    name: "Cooum River Bridge Camera",
    lat: 13.078,
    lng: 80.268,
    monitored_road_code: "ROAD_AC",
    monitored_road_name: "River Side Expressway",
    status: "ACTIVE",
    last_detection: "Just now",
    flood_level_cm: 4,
  },
  {
    id: "CAM-02",
    name: "EVR Salai Underpass Camera",
    lat: 13.079,
    lng: 80.262,
    monitored_road_code: "ROAD_AB",
    monitored_road_name: "EVR Periyar Salai",
    status: "ACTIVE",
    last_detection: "1 min ago",
    flood_level_cm: 2,
  },
  {
    id: "CAM-03",
    name: "Anna Salai Flyover Camera",
    lat: 13.065,
    lng: 80.255,
    monitored_road_code: "ROAD_BD",
    monitored_road_name: "East Link Avenue",
    status: "ACTIVE",
    last_detection: "2 min ago",
    flood_level_cm: 5,
  },
  {
    id: "CAM-04",
    name: "Central Bypass Subway Camera",
    lat: 13.062,
    lng: 80.261,
    monitored_road_code: "ROAD_CD",
    monitored_road_name: "Central Bypass Salai",
    status: "ACTIVE",
    last_detection: "30 sec ago",
    flood_level_cm: 0,
  },
  {
    id: "CAM-05",
    name: "Royapettah Crossing Camera",
    lat: 13.057,
    lng: 80.265,
    monitored_road_code: "ROAD_CE",
    monitored_road_name: "South Connector Road",
    status: "ACTIVE",
    last_detection: "Just now",
    flood_level_cm: 0,
  },
];

export default function NavigationPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [networkRoads, setNetworkRoads] = useState<Road[]>([]);
  const [cameras, setCameras] = useState<CCTVCamera[]>(DEFAULT_CAMERAS);

  // Origin & Destination state
  const [selectedOriginId, setSelectedOriginId] = useState<string>("NODE_A");
  const [selectedDestId, setSelectedDestId] = useState<string>("NODE_D");
  const [customDestination, setCustomDestination] = useState<{
    name: string;
    lat: number;
    lng: number;
  } | null>(null);

  // Active Route & Alerts
  const [currentRoute, setCurrentRoute] = useState<RouteResponse | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Realtime notification banners
  const [floodAlertNotice, setFloodAlertNotice] = useState<string | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const [noRouteReason, setNoRouteReason] = useState<string | null>(null);

  // API Key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [currentApiKey, setCurrentApiKey] = useState("");

  // Load initial nodes, network, and API Key
  useEffect(() => {
    const key = getGoogleMapsApiKey();
    setCurrentApiKey(key);
    setApiKeyInput(key);

    async function loadData() {
      try {
        const [nodeList, netList] = await Promise.all([
          fetchNodes(),
          fetchNetwork(),
        ]);
        setNodes(nodeList);
        setNetworkRoads(netList);

        if (nodeList.length >= 2) {
          setSelectedOriginId(nodeList[0].node_id);
          setSelectedDestId(nodeList[nodeList.length - 1].node_id);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }
    loadData();
  }, []);

  // Compute Origin Node
  const originNode = useMemo(() => {
    return nodes.find((n) => n.node_id === selectedOriginId) || null;
  }, [nodes, selectedOriginId]);

  // Compute Destination Node (or custom coordinate destination)
  const destNode = useMemo(() => {
    if (customDestination) {
      return {
        node_id: "CUSTOM",
        name: customDestination.name,
        lat: customDestination.lat,
        lng: customDestination.lng,
      };
    }
    return nodes.find((n) => n.node_id === selectedDestId) || null;
  }, [nodes, selectedDestId, customDestination]);

  // Calculate Route handler
  const handleCalculateRoute = useCallback(async () => {
    if (!originNode || !destNode) return;
    setIsRouting(true);
    setFloodAlertNotice(null);
    setRerouteNotice(null);
    setNoRouteReason(null);

    try {
      let res;
      if (customDestination) {
        res = await calculateRoute({
          origin_node: originNode.node_id,
          destination_lat: customDestination.lat,
          destination_lng: customDestination.lng,
        });
      } else {
        res = await calculateRoute({
          origin_node: originNode.node_id,
          destination_node: destNode.node_id,
        });
      }

      if (res.status === "ACTIVE") {
        setCurrentRoute(res as RouteResponse);
        setNoRouteReason(null);
      } else {
        setCurrentRoute(null);
        setNoRouteReason(
          (res as NoRouteResponse).reason ||
            "NO VERIFIED ROUTE AVAILABLE: All available paths contain confirmed flooded road segments."
        );
      }
    } catch (err) {
      setCurrentRoute(null);
      setNoRouteReason(
        err instanceof Error ? err.message : "Failed to calculate route"
      );
    } finally {
      setIsRouting(false);
    }
  }, [originNode, destNode, customDestination]);

  // Calculate initial route when nodes are ready
  useEffect(() => {
    if (nodes.length > 0 && !currentRoute && !noRouteReason) {
      handleCalculateRoute();
    }
  }, [nodes, handleCalculateRoute, currentRoute, noRouteReason]);

  // WebSocket Live Updates Connection
  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // 1. Road Status Changed (Flood event detection)
        if (message.type === "road.status.changed") {
          const event = message as RoadStatusChangedEvent;

          // Update network roads overlay
          setNetworkRoads((prev) =>
            prev.map((r) => {
              const code = r.road_code || r.road_id;
              if (code === event.road_id) {
                return {
                  ...r,
                  status: event.new_status,
                  confidence: event.confidence,
                  source: event.source,
                  updated_at: event.updated_at,
                  geometry: event.geometry || r.geometry,
                };
              }
              return r;
            })
          );

          // Update camera status if linked to this road
          setCameras((prev) =>
            prev.map((c) =>
              c.monitored_road_code === event.road_id
                ? {
                    ...c,
                    status: event.new_status === "FLOODED" ? "ALERT" : "ACTIVE",
                    flood_level_cm: event.new_status === "FLOODED" ? 18 : 2,
                    last_detection: "Just now",
                  }
                : c
            )
          );

          // If the newly flooded road is on the user's active route:
          if (event.new_status === "FLOODED" && currentRoute) {
            const roadName = event.road_name || event.road_id;
            const isOnRoute =
              currentRoute.roads.includes(event.road_id) ||
              (currentRoute.road_names &&
                currentRoute.road_names.includes(roadName));

            if (isOnRoute) {
              setFloodAlertNotice(
                `⚠️ Flood detected ahead on ${roadName}! Finding another route...`
              );
              setRerouteNotice(null);
            }
          }
        }

        // 2. Dynamic Route Recalculated (Core rerouted around flood)
        if (message.type === "route.recalculated") {
          const event = message as RouteRecalculatedEvent;
          const blockedName = event.blocked_road_name || event.blocked_road;

          setCurrentRoute((prev) => ({
            route_id: event.route_id,
            status: "ACTIVE",
            origin_name: prev?.origin_name || originNode?.name,
            destination_name: prev?.destination_name || destNode?.name,
            nodes: prev?.nodes || [],
            roads: event.new_path,
            road_names: event.new_path_names,
            distance_m: prev?.distance_m || 2500,
            estimated_time_sec: event.new_eta_sec,
            risk_cost: event.new_eta_sec,
            geometry: event.geometry,
            avoided_flooded_roads: event.avoided_flooded_roads.length > 0
              ? event.avoided_flooded_roads
              : [blockedName],
          }));

          setFloodAlertNotice(null);
          setNoRouteReason(null);
          setRerouteNotice(
            `Route recalculated! Avoided flooded ${blockedName}. New ETA: ${Math.round(
              event.new_eta_sec
            )}s`
          );
        }

        // 3. No Route Available (All paths flooded)
        if (message.type === "route.unavailable") {
          const event = message as RouteUnavailableEvent;
          const blockedName = event.blocked_road_name || event.blocked_road;

          setCurrentRoute(null);
          setFloodAlertNotice(null);
          setRerouteNotice(null);
          setNoRouteReason(
            `NO VERIFIED ROUTE AVAILABLE: All available paths contain confirmed flooded road segments (${blockedName}). Navigation halted for safety.`
          );
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };

    return () => ws.close();
  }, [currentRoute, originNode, destNode]);

  // Handle Google Places Autocomplete selection
  const handlePlaceSelect = (place: {
    name: string;
    lat: number;
    lng: number;
  }) => {
    setCustomDestination(place);
  };

  // Save API key handler
  const handleSaveApiKey = () => {
    setGoogleMapsApiKey(apiKeyInput);
    setCurrentApiKey(apiKeyInput);
    setShowKeyModal(false);
    window.location.reload();
  };

  // Format ETA to human string (e.g. "4 min")
  const formattedETA = useMemo(() => {
    if (!currentRoute) return "--";
    const minutes = Math.max(1, Math.round(currentRoute.estimated_time_sec / 60));
    return `${minutes} min`;
  }, [currentRoute]);

  // Format Distance to km
  const formattedDistance = useMemo(() => {
    if (!currentRoute) return "--";
    const km = (currentRoute.distance_m / 1000).toFixed(1);
    return `${km} km`;
  }, [currentRoute]);

  return (
    <div className="mapViewport">
      {/* 1. TOP FLOATING NAVIGATION BAR */}
      <header className="topNav">
        {/* Branding & Logo */}
        <div className="brandPill">
          <div className="brandLogo">
            <span>🌊</span>
            <span>FLOODNET</span>
          </div>
          <span className="brandTag">SAFE NAVIGATION</span>
        </div>

        {/* Destination & Origin Selection */}
        <div className="searchBarWrapper">
          <span className="searchIcon">📍</span>
          <select
            className="nodeSelectDropdown"
            value={selectedOriginId}
            onChange={(e) => {
              setSelectedOriginId(e.target.value);
            }}
            title="Select Origin Junction"
          >
            {nodes.map((n) => (
              <option key={`orig_${n.node_id}`} value={n.node_id}>
                Start: {n.name}
              </option>
            ))}
          </select>

          <span style={{ color: "#475569" }}>➔</span>

          <select
            className="nodeSelectDropdown"
            value={customDestination ? "CUSTOM" : selectedDestId}
            onChange={(e) => {
              if (e.target.value !== "CUSTOM") {
                setCustomDestination(null);
                setSelectedDestId(e.target.value);
              }
            }}
            title="Select Destination Junction"
          >
            {customDestination && (
              <option value="CUSTOM">Dest: {customDestination.name}</option>
            )}
            {nodes.map((n) => (
              <option key={`dest_${n.node_id}`} value={n.node_id}>
                Dest: {n.name}
              </option>
            ))}
          </select>

          <button
            className="navActionBtn"
            onClick={handleCalculateRoute}
            disabled={isRouting}
          >
            {isRouting ? "Routing..." : "Get Route"}
          </button>
        </div>

        {/* Right Menu & Status */}
        <div className="topMenu">
          <div className="liveStatusPill">
            <span className={`liveDot ${connected ? "online" : "offline"}`} />
            <span>{connected ? "LIVE MONITORING" : "OFFLINE"}</span>
          </div>

          <button
            className="topMenuBtn"
            onClick={() => setShowKeyModal(true)}
            title="Google Maps API Key Configuration"
          >
            🔑 <span>{currentApiKey ? "Map Key" : "Add Key"}</span>
          </button>

          <Link href="/admin" className="topMenuBtn" title="Road & Camera Simulator">
            ⚙️ <span>Admin</span>
          </Link>
        </div>
      </header>

      {/* 2. REALTIME FLOOD & REROUTING ALERT BANNERS */}
      <div className="alertBannerWrapper">
        {/* Flood Detected Ahead Warning */}
        {floodAlertNotice && (
          <div className="floodAheadAlert">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="spinner" />
              <strong style={{ fontSize: "0.95rem" }}>{floodAlertNotice}</strong>
            </div>
            <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
              FloodNet Core Rerouting...
            </span>
          </div>
        )}

        {/* Recalculated Safe Route Notice */}
        {rerouteNotice && (
          <div className="recalculatedAlert">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "1.2rem" }}>🛡️</span>
              <strong style={{ fontSize: "0.95rem" }}>{rerouteNotice}</strong>
            </div>
            <button
              onClick={() => setRerouteNotice(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* No Verified Route Alert */}
        {noRouteReason && (
          <div className="noRouteAlert">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "1.4rem" }}>🚨</span>
              <strong style={{ fontSize: "1.1rem", color: "#fca5a5" }}>
                NO VERIFIED ROUTE AVAILABLE
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#fecaca", lineHeight: 1.4 }}>
              {noRouteReason}
            </p>
          </div>
        )}
      </div>

      {/* 3. FULL REAL GOOGLE MAP VIEW */}
      <GoogleMapView
        apiKey={currentApiKey}
        originNode={originNode}
        destNode={destNode}
        activeRoute={currentRoute}
        networkRoads={networkRoads}
        onPlaceSelect={handlePlaceSelect}
        cameras={cameras}
      />

      {/* 4. FLOATING BOTTOM ROUTE PANEL */}
      <div className="bottomRoutePanel">
        {currentRoute ? (
          <div>
            <div className="routePanelHeader">
              <div>
                <h2 className="destTitle">
                  <span>📍</span>
                  <span>{destNode?.name || "Selected Destination"}</span>
                </h2>
                <p className="originSubtitle">
                  From: {originNode?.name || "Origin Junction"} · Safe Route Verified
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#34d399",
                  padding: "6px 12px",
                  borderRadius: "9999px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                }}
              >
                <span>🛡️</span>
                <span>FLOOD-SAFE ROUTE</span>
              </div>
            </div>

            {/* Metrics: ETA, Distance, Avoided Count */}
            <div className="routeMetricsRow">
              <div className="metricItem">
                <span className="metricValue">{formattedETA}</span>
                <span className="metricLabel">Estimated Time</span>
              </div>
              <div className="metricItem">
                <span className="metricValue">{formattedDistance}</span>
                <span className="metricLabel">Distance</span>
              </div>
              <div className="metricItem">
                <span
                  className="metricValue"
                  style={{
                    color:
                      currentRoute.avoided_flooded_roads.length > 0
                        ? "#f87171"
                        : "#34d399",
                  }}
                >
                  {currentRoute.avoided_flooded_roads.length}
                </span>
                <span className="metricLabel">Floods Avoided</span>
              </div>
            </div>

            {/* Avoided flooded roads indicator */}
            {currentRoute.avoided_flooded_roads.length > 0 && (
              <div className="avoidedPill">
                <span>⚠️</span>
                <span>
                  Avoided: {currentRoute.avoided_flooded_roads.join(", ")}
                </span>
              </div>
            )}

            {/* Real Road Names Breadcrumbs */}
            {currentRoute.road_names && currentRoute.road_names.length > 0 && (
              <div className="roadBreadcrumbs">
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700 }}>
                  VIA:
                </span>
                {currentRoute.road_names.map((roadName, idx) => (
                  <span key={`r_${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span className="roadBreadcrumbItem">{roadName}</span>
                    {idx < (currentRoute.road_names?.length || 0) - 1 && (
                      <span className="roadBreadcrumbSeparator">➔</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Start Route Button */}
            <button
              className={`startNavButton ${isNavigating ? "active" : ""}`}
              onClick={() => setIsNavigating(!isNavigating)}
            >
              <span>{isNavigating ? "🛑" : "🧭"}</span>
              <span>{isNavigating ? "Exit Navigation" : "Start Route"}</span>
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#f8fafc" }}>
              {noRouteReason ? "Route Unavailable" : "Ready to Navigate"}
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "0.9rem" }}>
              {noRouteReason
                ? "All corridors currently have confirmed flood blockages. Wait for floodwaters to recede."
                : "Select your destination to calculate a real-time flood-safe corridor."}
            </p>
            <button
              className="navActionBtn"
              style={{ padding: "10px 24px" }}
              onClick={handleCalculateRoute}
            >
              Find Safe Route
            </button>
          </div>
        )}
      </div>

      {/* 5. API KEY MODAL */}
      {showKeyModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", color: "#38bdf8" }}>
              🔑 Google Maps JavaScript API Key
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Enter your Google Maps JavaScript API key. It will be saved securely in your browser&apos;s localStorage and loaded immediately.
            </p>
            <input
              type="text"
              placeholder="AIzaSy..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{
                width: "100%",
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#ffffff",
                padding: "10px 14px",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                marginBottom: "16px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setShowKeyModal(false)}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#cbd5e1",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                style={{
                  background: "#0284c7",
                  border: "none",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
