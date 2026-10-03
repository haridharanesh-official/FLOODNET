"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateRoute, fetchRoads, updateRoadStatus } from "@/lib/api";
import type { NoRouteResponse, Road, RoadStatus, RouteResponse } from "@/types/road";

const statuses: RoadStatus[] = ["OPEN", "CAUTION", "FLOODED", "UNKNOWN"];

export default function Home() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Routing Test State
  const [origin, setOrigin] = useState("NODE_A");
  const [destination, setDestination] = useState("NODE_D");
  const [currentRoute, setCurrentRoute] = useState<RouteResponse | null>(null);
  const [noRouteReason, setNoRouteReason] = useState<string | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRoads(await fetchRoads());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  const handleCalculateRoute = useCallback(async () => {
    setIsRouting(true);
    setError(null);
    setRerouteNotice(null);
    try {
      const res = await calculateRoute(origin, destination);
      if (res.status === "ACTIVE") {
        setCurrentRoute(res as RouteResponse);
        setNoRouteReason(null);
      } else {
        setCurrentRoute(null);
        setNoRouteReason(
          (res as NoRouteResponse).reason || "NO VERIFIED ROUTE AVAILABLE"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate route");
    } finally {
      setIsRouting(false);
    }
  }, [origin, destination]);

  useEffect(() => {
    load();

    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // 1. Road state changes
        if (message.type === "road.status.changed") {
          setRoads((current) =>
            current.map((road) =>
              road.road_code === message.road_id
                ? {
                    ...road,
                    status: message.new_status,
                    confidence: message.confidence,
                    source: message.source,
                    updated_at: message.updated_at,
                  }
                : road
            )
          );
        }

        // 2. Dynamic route recalculations without page reload
        if (message.type === "route.recalculated") {
          setCurrentRoute((prev) => {
            return {
              route_id: message.route_id,
              status: "ACTIVE",
              nodes: prev?.nodes ?? [],
              roads: message.new_path,
              distance_m: prev?.distance_m ?? 0,
              estimated_time_sec: message.new_eta_sec,
              risk_cost: message.new_eta_sec,
            };
          });
          setNoRouteReason(null);
          setRerouteNotice(
            `Route recalculated! Avoided flooded ${message.blocked_road}. New ETA: ${message.new_eta_sec}s`
          );
        }

        // 3. No route available
        if (message.type === "route.unavailable") {
          setCurrentRoute(null);
          setNoRouteReason(
            `NO VERIFIED ROUTE AVAILABLE: All available paths contain confirmed flooded road segments (${message.blocked_road}).`
          );
          setRerouteNotice(null);
        }
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    return () => ws.close();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      OPEN: 0,
      CAUTION: 0,
      FLOODED: 0,
      UNKNOWN: 0,
    };
    for (const r of roads) {
      const s = r.status === "SAFE" ? "OPEN" : r.status === "BLOCKED" ? "FLOODED" : r.status;
      if (s in map) {
        map[s]++;
      }
    }
    return map;
  }, [roads]);

  async function setStatus(roadCode: string, status: RoadStatus) {
    try {
      await updateRoadStatus(roadCode, status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  // Node options for test routing
  const availableNodes = ["NODE_A", "NODE_B", "NODE_C", "NODE_D", "NODE_E"];

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">FLOODNET</p>
          <h1>Road Intelligence Control</h1>
          <p className="subtitle">
            Laptop-only development mode. Flood-aware dynamic routing active.
          </p>
        </div>
        <span className={`pill ${connected ? "online" : "offline"}`}>
          {connected ? "LIVE" : "DISCONNECTED"}
        </span>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats">
        <article><strong>{counts.OPEN}</strong><span>Open</span></article>
        <article><strong>{counts.CAUTION}</strong><span>Caution</span></article>
        <article><strong>{counts.FLOODED}</strong><span>Flooded</span></article>
        <article><strong>{counts.UNKNOWN}</strong><span>Unknown</span></article>
      </section>

      {/* Dynamic Routing Test Interface */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="panelHeading">
          <div>
            <p className="eyebrow">DYNAMIC ROUTING</p>
            <h2>Flood-Aware Route Engine</h2>
          </div>
        </div>

        <div className="routeBox">
          <div className="routeInputs">
            <div>
              <label style={{ fontSize: "0.8rem", color: "#88a8bb", display: "block", marginBottom: "4px" }}>
                Origin:
              </label>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {availableNodes.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", color: "#88a8bb", display: "block", marginBottom: "4px" }}>
                Destination:
              </label>
              <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                {availableNodes.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div style={{ alignSelf: "flex-end" }}>
              <button
                onClick={handleCalculateRoute}
                disabled={isRouting}
                style={{
                  background: "#0284c7",
                  borderColor: "#38bdf8",
                  fontWeight: 700,
                  padding: "9px 18px",
                }}
              >
                {isRouting ? "Calculating..." : "CALCULATE ROUTE"}
              </button>
            </div>
          </div>

          {rerouteNotice && (
            <div className="routeAlert">
              ⚡ {rerouteNotice}
            </div>
          )}

          {currentRoute && (
            <div className="routeCard">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span className="code">{currentRoute.route_id}</span>
                <span className="pill online">ACTIVE</span>
              </div>
              <div className="routePath">
                {currentRoute.roads.join(" → ")}
              </div>
              <div className="routeMeta">
                <span><strong>ETA:</strong> {Math.round(currentRoute.estimated_time_sec)} sec</span>
                <span><strong>Distance:</strong> {Math.round(currentRoute.distance_m)} m</span>
                <span><strong>Risk Cost:</strong> {Math.round(currentRoute.risk_cost)}</span>
              </div>
            </div>
          )}

          {noRouteReason && (
            <div className="routeCard" style={{ borderColor: "#ef4444" }}>
              <p className="routeUnavailable">NO VERIFIED ROUTE AVAILABLE</p>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
                {noRouteReason}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Manual Road State Simulator */}
      <section className="panel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">ROAD CONTROLS</p>
            <h2>Manual road-state simulator</h2>
          </div>
          <button className="secondary" onClick={load}>Refresh</button>
        </div>

        <div className="roads">
          {roads.map((road) => {
            const displayStatus =
              road.status === "SAFE"
                ? "OPEN"
                : road.status === "BLOCKED"
                ? "FLOODED"
                : road.status;

            return (
              <article className="road" key={road.road_code}>
                <div>
                  <p className="code">{road.road_code}</p>
                  <h3>{road.name}</h3>
                  <p className="meta">
                    {road.from_node && road.to_node
                      ? `${road.from_node} ↔ ${road.to_node} · `
                      : ""}
                    Source: {road.source} · Confidence:{" "}
                    {Math.round(road.confidence * 100)}%
                  </p>
                </div>

                <div className="roadActions">
                  <span className={`status ${displayStatus.toLowerCase()}`}>
                    {displayStatus}
                  </span>

                  <div className="buttons">
                    {statuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatus(road.road_code, status)}
                        style={
                          displayStatus === status
                            ? { outline: "2px solid #38bdf8", fontWeight: "bold" }
                            : {}
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
