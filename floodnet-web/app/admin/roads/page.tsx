"use client";

import { useEffect, useState } from "react";
import { fetchRoads, updateRoadStatus } from "@/lib/api";
import type { Road, RoadStatus } from "@/types/road";

const ALL_STATUSES: RoadStatus[] = ["OPEN", "CAUTION", "FLOODED", "UNKNOWN"];

export default function AdminRoadsPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);
  const [recentLog, setRecentLog] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchRoads();
      setRoads(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (roadCode: string, newStatus: RoadStatus, roadName: string) => {
    setUpdatingCode(roadCode);
    try {
      await updateRoadStatus(roadCode, newStatus, 1.0, "MANUAL_SIMULATION");
      setRecentLog(`Updated ${roadName} (${roadCode}) ➔ ${newStatus}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update road status");
    } finally {
      setUpdatingCode(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
            Road State Simulator
          </h1>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
            Control real-time road conditions. When a road is set to FLOODED, FLOODNET Core automatically initiates dynamic rerouting for active user navigation sessions.
          </p>
        </div>
        <button
          onClick={load}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {recentLog && (
        <div
          style={{
            background: "rgba(2, 132, 199, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#7dd3fc",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚡ {recentLog}</span>
          <button
            onClick={() => setRecentLog(null)}
            style={{ background: "transparent", border: "none", color: "#7dd3fc", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {roads.map((road) => {
          const code = road.road_code || road.road_id || "";
          const isFlooded = road.status === "FLOODED" || road.status === "BLOCKED";
          const isCaution = road.status === "CAUTION";
          const isOpen = road.status === "OPEN" || road.status === "SAFE";

          return (
            <div
              key={code}
              className={`roadCard ${isFlooded ? "flooded" : isCaution ? "caution" : ""}`}
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc" }}>
                    {road.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                      color: "#64748b",
                      background: "#1e293b",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {code}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Corridor: {road.from_node} ↔ {road.to_node} · Source: {road.source} · Confidence: {Math.round(road.confidence * 100)}%
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: isFlooded
                      ? "rgba(239, 68, 68, 0.2)"
                      : isCaution
                      ? "rgba(245, 158, 11, 0.2)"
                      : isOpen
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(100, 116, 139, 0.2)",
                    color: isFlooded
                      ? "#f87171"
                      : isCaution
                      ? "#facc15"
                      : isOpen
                      ? "#4ade80"
                      : "#94a3b8",
                    border: `1px solid ${
                      isFlooded
                        ? "rgba(239, 68, 68, 0.4)"
                        : isCaution
                        ? "rgba(245, 158, 11, 0.4)"
                        : isOpen
                        ? "rgba(16, 185, 129, 0.4)"
                        : "rgba(100, 116, 139, 0.4)"
                    }`,
                  }}
                >
                  {road.status}
                </span>

                <div className="statusBtnGroup">
                  {ALL_STATUSES.map((st) => (
                    <button
                      key={st}
                      disabled={updatingCode === code}
                      className={`statusBtn ${
                        road.status === st || (st === "OPEN" && road.status === "SAFE") || (st === "FLOODED" && road.status === "BLOCKED")
                          ? `active-${st.toLowerCase()}`
                          : ""
                      }`}
                      onClick={() => handleStatusChange(code, st, road.name)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
