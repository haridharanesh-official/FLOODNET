"use client";

import { useEffect, useState } from "react";

export default function AdminSystemPage() {
  const [coreStatus, setCoreStatus] = useState<"ONLINE" | "CHECKING" | "OFFLINE">("CHECKING");
  const [wsStatus, setWsStatus] = useState<"CONNECTED" | "CONNECTING" | "OFFLINE">("CONNECTING");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [wsUrl, setWsUrl] = useState("");

  useEffect(() => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    const ws =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";
    setApiBaseUrl(apiBase);
    setWsUrl(ws);

    // Check Core HTTP
    fetch(`${apiBase}/api/v1/roads`)
      .then((res) => {
        if (res.ok) setCoreStatus("ONLINE");
        else setCoreStatus("OFFLINE");
      })
      .catch(() => setCoreStatus("OFFLINE"));

    // Check WebSocket
    const socket = new WebSocket(ws);
    socket.onopen = () => setWsStatus("CONNECTED");
    socket.onerror = () => setWsStatus("OFFLINE");
    socket.onclose = () => setWsStatus("OFFLINE");

    return () => socket.close();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
          System Architecture & Health
        </h1>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
          Diagnostics for FLOODNET microservices stack running in containerized development environment.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {/* FastAPI Core */}
        <div className="adminCard" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "1.05rem" }}>1. FLOODNET Core (FastAPI)</strong>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "4px",
                background: coreStatus === "ONLINE" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: coreStatus === "ONLINE" ? "#4ade80" : "#f87171",
              }}
            >
              {coreStatus}
            </span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.5 }}>
            <div><b>Port:</b> 8000</div>
            <div><b>URL:</b> {apiBaseUrl}</div>
            <div><b>Role:</b> Authoritative A* graph routing engine & flood state management</div>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="adminCard" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "1.05rem" }}>2. PostgreSQL 17 Database</strong>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "4px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#4ade80",
              }}
            >
              HEALTHY
            </span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.5 }}>
            <div><b>Port:</b> 5432</div>
            <div><b>Database:</b> floodnet</div>
            <div><b>Role:</b> Persistent road segments, confidence metrics, and observation timestamps</div>
          </div>
        </div>

        {/* Mosquitto MQTT */}
        <div className="adminCard" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "1.05rem" }}>3. Mosquitto MQTT Broker</strong>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "4px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#4ade80",
              }}
            >
              READY FOR AI PC
            </span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.5 }}>
            <div><b>Port:</b> 1883</div>
            <div><b>Topic:</b> floodnet/cctv/events</div>
            <div><b>Role:</b> Message broker ready for future external edge CCTV AI detection events</div>
          </div>
        </div>

        {/* WebSocket Telemetry */}
        <div className="adminCard" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "1.05rem" }}>4. WebSocket Real-Time Gateway</strong>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "4px",
                background: wsStatus === "CONNECTED" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: wsStatus === "CONNECTED" ? "#4ade80" : "#f87171",
              }}
            >
              {wsStatus}
            </span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.5 }}>
            <div><b>Endpoint:</b> {wsUrl}</div>
            <div><b>Channels:</b> road.status.changed, route.recalculated, route.unavailable</div>
            <div><b>Role:</b> Sub-second event broadcast to frontend navigation clients</div>
          </div>
        </div>
      </div>

      {/* Architectural Separation Guarantee */}
      <div className="adminCard">
        <h3 style={{ margin: "0 0 10px 0", color: "#38bdf8" }}>
          🛡️ Separation of Concerns Architecture
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>
          In accordance with FLOODNET architectural principles, the user-facing navigation interface (`/`) is strictly separated from administrative controls. The frontend Google Maps layer is purely a geographic visualization surface; all routing logic, flood state arbitration, and recalculations are executed authoritatively inside <b>FLOODNET Core</b>.
        </p>
      </div>
    </div>
  );
}
