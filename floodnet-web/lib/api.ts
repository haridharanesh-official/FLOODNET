import type { NoRouteResponse, Road, RoadStatus, RouteResponse } from "@/types/road";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchRoads(): Promise<Road[]> {
  const response = await fetch(`${API_BASE}/api/v1/roads`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load roads");
  }

  return response.json();
}

export async function updateRoadStatus(
  roadCode: string,
  status: RoadStatus
): Promise<Road> {
  const response = await fetch(
    `${API_BASE}/api/v1/roads/${roadCode}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        confidence: 1,
        source: "MANUAL_SIMULATION",
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Unable to update road");
  }

  return response.json();
}

export async function calculateRoute(
  originNode: string,
  destinationNode: string
): Promise<RouteResponse | NoRouteResponse> {
  const response = await fetch(`${API_BASE}/api/v1/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_node: originNode,
      destination_node: destinationNode,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to calculate route");
  }

  return response.json();
}
