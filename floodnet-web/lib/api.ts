import type {
  NoRouteResponse,
  NodeInfo,
  Road,
  RoadStatus,
  RouteResponse,
} from "@/types/road";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchRoads(): Promise<Road[]> {
  const response = await fetch(`${API_BASE}/api/v1/roads`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load roads from FLOODNET Core");
  }

  return response.json();
}

export async function fetchNodes(): Promise<NodeInfo[]> {
  const response = await fetch(`${API_BASE}/api/v1/routes/nodes`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load geographical navigation nodes");
  }

  return response.json();
}

export async function fetchNetwork(): Promise<Road[]> {
  const response = await fetch(`${API_BASE}/api/v1/routes/network`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load road network geometry");
  }

  return response.json();
}

export interface CalculateRouteParams {
  origin_node?: string;
  destination_node?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
}

export async function calculateRoute(
  params: CalculateRouteParams
): Promise<RouteResponse | NoRouteResponse> {
  const response = await fetch(`${API_BASE}/api/v1/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || `Route calculation failed with status ${response.status}`
    );
  }

  return response.json();
}

export async function updateRoadStatus(
  roadCode: string,
  status: RoadStatus,
  confidence = 1.0,
  source = "MANUAL_SIMULATION",
  applyFilter = false
): Promise<Road> {
  const response = await fetch(
    `${API_BASE}/api/v1/roads/${roadCode}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        confidence,
        source,
        coverage: status === "FLOODED" ? 0.8 : 0.0,
        apply_filter: applyFilter,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Unable to update road status");
  }

  return response.json();
}
