"use client";

import { useEffect, useState } from "react";

interface LogItem {
  id: string;
  time: string;
  type: string;
  title: string;
  detail: string;
  payload: any;
}

export default function AdminAlertsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const timeStr = new Date().toLocaleTimeString();
        const id = Math.random().toString(36).substring(2, 9);

        let title = msg.type;
        let detail = "";

        if (msg.type === "road.status.changed") {
          title = `Road ${msg.new_status}: ${msg.road_name || msg.road_id}`;
          detail = `Previous: ${msg.previous_status || "UNKNOWN"} ➔ New: ${msg.new_status} (Source: ${msg.source}, Conf: ${Math.round(msg.confidence * 100)}%)`;
        } else if (msg.type === "route.recalculated") {
          title = `Route Recalculated: Avoided ${msg.blocked_road_name || msg.blocked_road}`;
          detail = `Active Route ${msg.route_id} updated. New ETA: ${Math.round(msg.new_eta_sec)}s. Path: ${msg.new_path_names?.join(" ➔ ") || msg.new_path.join(" ➔ ")}`;
        } else if (msg.type === "route.unavailable") {
          title = `🚨 Route Unavailable: ${msg.blocked_road_name || msg.blocked_road}`;
          detail = `All remaining paths are blocked by confirmed flood hazards. Route ${msg.route_id} terminated.`;
        }

        setLogs((prev) => [
          {
            id,
            time: timeStr,
            type: msg.type,
            title,
            detail,
            payload: msg,
          },
          ...prev.slice(0, 49),
        ]);
      } catch (e) {
        console.error("Failed to parse log message", e);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
            Live Flood Alerts & Rerouting Logs
          </h1>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
            Live WebSocket telemetry stream capturing road flood events and core A* dynamic reroute recalculations.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`liveDot ${connected ? "online" : "offline"}`} />
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: connected ? "#4ade80" : "#f87171" }}>
            {connected ? "LIVE TELEMETRY" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="adminCard" style={{ textAlign: "center", padding: "48px 24px" }}>
          <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "12px" }}>📡</span>
          <h3 style={{ margin: "0 0 8px 0" }}>Listening for Live Events</h3>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
            Trigger a flood event from the <b>Road Controls</b> or <b>CCTV Cameras</b> tab to observe live broadcast events here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {logs.map((log) => {
            const isFlooded = log.type === "road.status.changed" && log.payload?.new_status === "FLOODED";
            const isRecalc = log.type === "route.recalculated";
            const isUnavail = log.type === "route.unavailable";

            return (
              <div
                key={log.id}
                className="adminCard"
                style={{
                  margin: 0,
                  padding: "16px 20px",
                  borderColor: isUnavail
                    ? "#ef4444"
                    : isFlooded
                    ? "rgba(239, 68, 68, 0.4)"
                    : isRecalc
                    ? "rgba(56, 189, 248, 0.4)"
                    : "rgba(255, 255, 255, 0.08)",
                  background: isUnavail
                    ? "rgba(153, 27, 27, 0.2)"
                    : isFlooded
                    ? "rgba(239, 68, 68, 0.08)"
                    : isRecalc
                    ? "rgba(2, 132, 199, 0.08)"
                    : "rgba(15, 23, 42, 0.7)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>
                      {isUnavail ? "🚨" : isFlooded ? "🌊" : isRecalc ? "⚡" : "ℹ️"}
                    </span>
                    <strong style={{ fontSize: "0.95rem", color: "#f8fafc" }}>
                      {log.title}
                    </strong>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                    {log.time}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.4 }}>
                  {log.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
