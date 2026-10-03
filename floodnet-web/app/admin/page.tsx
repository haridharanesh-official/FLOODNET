"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRoads } from "@/lib/api";
import type { Road } from "@/types/road";

export default function AdminOverviewPage() {
  const [roads, setRoads] = useState<Road[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoads()
      .then(setRoads)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    OPEN: roads.filter((r) => r.status === "OPEN" || r.status === "SAFE").length,
    CAUTION: roads.filter((r) => r.status === "CAUTION").length,
    FLOODED: roads.filter((r) => r.status === "FLOODED" || r.status === "BLOCKED").length,
    UNKNOWN: roads.filter((r) => r.status === "UNKNOWN").length,
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
          FloodNet Operations Overview
        </h1>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
          Monitor road network states, CCTV camera streams, and simulate real-time flood events.
        </p>
      </div>

      {/* Road State Statistics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div className="adminCard" style={{ margin: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "#4ade80", fontWeight: 700 }}>
            OPEN ROADS
          </span>
          <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", margin: "6px 0" }}>
            {counts.OPEN}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Normal traffic flow</span>
        </div>

        <div className="adminCard" style={{ margin: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "#facc15", fontWeight: 700 }}>
            CAUTION ROADS
          </span>
          <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", margin: "6px 0" }}>
            {counts.CAUTION}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Minor waterlogging</span>
        </div>

        <div className="adminCard" style={{ margin: 0, borderColor: "rgba(239, 68, 68, 0.4)" }}>
          <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 700 }}>
            FLOODED SEGMENTS
          </span>
          <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ef4444", margin: "6px 0" }}>
            {counts.FLOODED}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Closed for routing</span>
        </div>

        <div className="adminCard" style={{ margin: 0 }}>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 700 }}>
            UNKNOWN ROADS
          </span>
          <div style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", margin: "6px 0" }}>
            {counts.UNKNOWN}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>No recent observation</span>
        </div>
      </div>

      {/* Quick Action Simulator Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        <div className="adminCard">
          <h3 style={{ margin: "0 0 10px 0", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🚦</span> Road State Simulator
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            Simulate real-time road flooding or reopening. FLOODNET Core will automatically recalculate active routes and broadcast events to all connected navigation clients.
          </p>
          <Link
            href="/admin/roads"
            style={{
              display: "inline-block",
              background: "#0284c7",
              color: "#ffffff",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open Road Simulator ➔
          </Link>
        </div>

        <div className="adminCard">
          <h3 style={{ margin: "0 0 10px 0", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📹</span> CCTV Camera Monitoring
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            Inspect CCTV sensor telemetry placed along bridges, underpasses, and low-lying arterial roads. Simulate AI computer-vision flood detection events.
          </p>
          <Link
            href="/admin/cameras"
            style={{
              display: "inline-block",
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View CCTV Feeds ➔
          </Link>
        </div>
      </div>
    </div>
  );
}
