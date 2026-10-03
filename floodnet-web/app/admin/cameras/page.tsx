"use client";

import { useState } from "react";
import { updateRoadStatus } from "@/lib/api";
import type { CCTVCamera } from "@/types/road";

const INITIAL_CAMERAS: CCTVCamera[] = [
  {
    id: "CAM-01",
    name: "Cooum River Bridge Camera",
    lat: 13.078,
    lng: 80.268,
    monitored_road_code: "ROAD_AC",
    monitored_road_name: "River Side Expressway",
    status: "ACTIVE",
    last_detection: "Live",
    flood_level_cm: 3,
  },
  {
    id: "CAM-02",
    name: "EVR Salai Underpass Camera",
    lat: 13.079,
    lng: 80.262,
    monitored_road_code: "ROAD_AB",
    monitored_road_name: "EVR Periyar Salai",
    status: "ACTIVE",
    last_detection: "Live",
    flood_level_cm: 0,
  },
  {
    id: "CAM-03",
    name: "Anna Salai Flyover Camera",
    lat: 13.065,
    lng: 80.255,
    monitored_road_code: "ROAD_BD",
    monitored_road_name: "East Link Avenue",
    status: "ACTIVE",
    last_detection: "Live",
    flood_level_cm: 2,
  },
  {
    id: "CAM-04",
    name: "Central Bypass Subway Camera",
    lat: 13.062,
    lng: 80.261,
    monitored_road_code: "ROAD_CD",
    monitored_road_name: "Central Bypass Salai",
    status: "ACTIVE",
    last_detection: "Live",
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
    last_detection: "Live",
    flood_level_cm: 1,
  },
];

export default function AdminCamerasPage() {
  const [cameras, setCameras] = useState<CCTVCamera[]>(INITIAL_CAMERAS);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const simulateAiDetection = async (cam: CCTVCamera, isFlood: boolean) => {
    setTriggeringId(cam.id);
    try {
      await updateRoadStatus(
        cam.monitored_road_code,
        isFlood ? "FLOODED" : "OPEN",
        0.98,
        "CCTV_AI_SIMULATOR"
      );

      setCameras((prev) =>
        prev.map((c) =>
          c.id === cam.id
            ? {
                ...c,
                status: isFlood ? "ALERT" : "ACTIVE",
                flood_level_cm: isFlood ? 24 : 2,
                last_detection: "Just now",
              }
            : c
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to trigger detection");
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 6px 0" }}>
          CCTV Camera Telemetry & Simulation
        </h1>
        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
          Simulates future AI PC edge camera events. In production, edge computer vision instances push detections via Mosquitto MQTT.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {cameras.map((cam) => {
          const isAlert = cam.status === "ALERT";

          return (
            <div
              key={cam.id}
              className="adminCard"
              style={{
                borderColor: isAlert ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.08)",
                background: isAlert
                  ? "linear-gradient(180deg, rgba(239, 68, 68, 0.1), rgba(15, 23, 42, 0.95))"
                  : "rgba(15, 23, 42, 0.8)",
              }}
            >
              {/* Camera Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.2rem" }}>📹</span>
                  <strong style={{ fontSize: "1rem", color: "#f8fafc" }}>{cam.name}</strong>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: isAlert ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                    color: isAlert ? "#f87171" : "#4ade80",
                    border: `1px solid ${isAlert ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                  }}
                >
                  {cam.status}
                </span>
              </div>

              {/* Feed Simulation Mock */}
              <div
                style={{
                  height: "140px",
                  background: "#020617",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "10px",
                    fontSize: "0.68rem",
                    color: "#38bdf8",
                    fontFamily: "monospace",
                  }}
                >
                  REC ● {cam.id} [{cam.lat.toFixed(4)}, {cam.lng.toFixed(4)}]
                </div>

                <div
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    right: "10px",
                    fontSize: "0.72rem",
                    color: isAlert ? "#ef4444" : "#22c55e",
                    fontWeight: 700,
                  }}
                >
                  WATER LEVEL: {cam.flood_level_cm} cm
                </div>

                <span style={{ fontSize: "2.4rem", opacity: 0.8 }}>
                  {isAlert ? "🌊" : "🚗"}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>
                  {isAlert ? "WATER HAZARD DETECTED" : "CLEAR PAVEMENT"}
                </span>
              </div>

              {/* Monitored Road details */}
              <div style={{ fontSize: "0.82rem", color: "#cbd5e1", marginBottom: "14px", lineHeight: 1.4 }}>
                <div><b>Road:</b> {cam.monitored_road_name} ({cam.monitored_road_code})</div>
                <div style={{ color: "#94a3b8" }}>Last AI Detection: {cam.last_detection}</div>
              </div>

              {/* Simulation Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  disabled={triggeringId === cam.id}
                  onClick={() => simulateAiDetection(cam, true)}
                  style={{
                    flex: 1,
                    background: "#dc2626",
                    border: "none",
                    color: "#ffffff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Simulate Flood
                </button>
                <button
                  disabled={triggeringId === cam.id}
                  onClick={() => simulateAiDetection(cam, false)}
                  style={{
                    flex: 1,
                    background: "#059669",
                    border: "none",
                    color: "#ffffff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Simulate Clear
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
