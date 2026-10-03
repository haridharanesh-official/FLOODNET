export type RoadStatus = "OPEN" | "CAUTION" | "FLOODED" | "UNKNOWN" | "SAFE" | "BLOCKED";

export interface NodeInfo {
  node_id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Road {
  road_code?: string;
  road_id?: string;
  name: string;
  from_node?: string | null;
  to_node?: string | null;
  distance_m?: number;
  travel_time_sec?: number;
  status: RoadStatus;
  confidence: number;
  flood_confidence?: number;
  flood_coverage?: number;
  source: string;
  updated_at: string;
  last_observed_at?: string;
  geometry?: number[][]; // [[lat, lng], [lat, lng], ...]
}

export interface RouteResponse {
  route_id: string;
  status: string;
  origin_name?: string;
  destination_name?: string;
  nodes: string[];
  roads: string[];
  road_names?: string[];
  distance_m: number;
  estimated_time_sec: number;
  risk_cost: number;
  geometry: number[][]; // [[lat, lng], [lat, lng], ...]
  avoided_flooded_roads: string[];
  reason?: string;
}

export interface NoRouteResponse {
  status: "NO_VERIFIED_ROUTE";
  reason: string;
  avoided_flooded_roads?: string[];
}

export interface RoadStatusChangedEvent {
  type: "road.status.changed";
  road_id: string;
  road_name?: string;
  previous_status?: string | null;
  new_status: RoadStatus;
  confidence: number;
  source: string;
  updated_at: string;
  geometry?: number[][];
}

export interface RouteRecalculatedEvent {
  type: "route.recalculated";
  route_id: string;
  reason: string;
  blocked_road: string;
  blocked_road_name?: string;
  old_path: string[];
  new_path: string[];
  new_path_names?: string[];
  old_eta_sec: number;
  new_eta_sec: number;
  geometry: number[][];
  avoided_flooded_roads: string[];
}

export interface RouteUnavailableEvent {
  type: "route.unavailable";
  route_id: string;
  reason: string;
  blocked_road: string;
  blocked_road_name?: string;
}

export interface CCTVCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  monitored_road_code: string;
  monitored_road_name: string;
  status: "ACTIVE" | "OFFLINE" | "ALERT";
  last_detection: string;
  flood_level_cm: number;
}
