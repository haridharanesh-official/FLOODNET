export type RoadStatus = "OPEN" | "CAUTION" | "FLOODED" | "UNKNOWN" | "SAFE" | "BLOCKED";

export interface Road {
  road_code: string;
  name: string;
  from_node?: string | null;
  to_node?: string | null;
  distance_m?: number;
  travel_time_sec?: number;
  status: RoadStatus;
  confidence: number;
  flood_coverage?: number;
  source: string;
  updated_at: string;
}

export interface RouteResponse {
  route_id: string;
  status: string;
  nodes: string[];
  roads: string[];
  distance_m: number;
  estimated_time_sec: number;
  risk_cost: number;
  reason?: string;
}

export interface NoRouteResponse {
  status: "NO_VERIFIED_ROUTE";
  reason: string;
}
