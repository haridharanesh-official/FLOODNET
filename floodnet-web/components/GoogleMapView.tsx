"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
import type { CCTVCamera, NodeInfo, Road, RouteResponse } from "@/types/road";

interface GoogleMapViewProps {
  apiKey?: string;
  originNode: NodeInfo | null;
  destNode: NodeInfo | null;
  activeRoute: RouteResponse | null;
  networkRoads: Road[];
  onPlaceSelect?: (place: { name: string; lat: number; lng: number }) => void;
  onNodeSelect?: (node: NodeInfo, type: "origin" | "destination") => void;
  cameras?: CCTVCamera[];
}

export default function GoogleMapView({
  apiKey,
  originNode,
  destNode,
  activeRoute,
  networkRoads,
  onPlaceSelect,
  cameras = [],
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const mapInstanceRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const routeHaloPolylineRef = useRef<any>(null);
  const floodedPolylinesRef = useRef<Map<string, any>>(new Map());
  const cautionPolylinesRef = useRef<Map<string, any>>(new Map());
  const markersRef = useRef<Map<string, any>>(new Map());
  const cameraMarkersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Default center: Chennai corridor between Central Station and Anna Salai
  const defaultCenter = { lat: 13.068, lng: 80.263 };

  // 1. Initialize Google Map
  useEffect(() => {
    let isCancelled = false;

    loadGoogleMaps(apiKey)
      .then((googleMaps) => {
        if (isCancelled || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          const map = new googleMaps.Map(mapContainerRef.current, {
            center: defaultCenter,
            zoom: 14,
            mapTypeId: "roadmap",
            mapTypeControl: true,
            mapTypeControlOptions: {
              style: googleMaps.MapTypeControlStyle.HORIZONTAL_BAR,
              position: googleMaps.ControlPosition.TOP_RIGHT,
            },
            zoomControl: true,
            zoomControlOptions: {
              position: googleMaps.ControlPosition.RIGHT_CENTER,
            },
            streetViewControl: false,
            fullscreenControl: true,
            fullscreenControlOptions: {
              position: googleMaps.ControlPosition.RIGHT_BOTTOM,
            },
            // Clean modern navigation map styling
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
              {
                featureType: "transit",
                elementType: "labels",
                stylers: [{ visibility: "simplified" }],
              },
              {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#93c5fd" }],
              },
            ],
          });

          mapInstanceRef.current = map;
          infoWindowRef.current = new googleMaps.InfoWindow();

          // Initialize Places Autocomplete if search input exists
          if (searchInputRef.current && googleMaps.places) {
            const autocomplete = new googleMaps.places.Autocomplete(
              searchInputRef.current,
              {
                types: ["geocode", "establishment"],
                componentRestrictions: { country: "in" },
                fields: ["formatted_address", "geometry", "name"],
              }
            );

            autocomplete.addListener("place_changed", () => {
              const place = autocomplete.getPlace();
              if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                map.panTo({ lat, lng });
                map.setZoom(15);
                if (onPlaceSelect) {
                  onPlaceSelect({
                    name: place.name || place.formatted_address || "Selected Location",
                    lat,
                    lng,
                  });
                }
              }
            });
          }

          setMapLoaded(true);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to load Google Maps:", err);
          setMapError(
            "Google Maps failed to load. Please check your internet connection or verify your Google Maps JavaScript API key."
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [apiKey]);

  // 2. Render Origin & Destination Markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;
    const gmaps = window.google.maps;
    const map = mapInstanceRef.current;

    // Origin Marker (Pulsing Blue Navigation Dot)
    let originMarker = markersRef.current.get("origin");
    if (originNode) {
      const pos = { lat: originNode.lat, lng: originNode.lng };
      if (!originMarker) {
        originMarker = new gmaps.Marker({
          position: pos,
          map,
          title: `Start: ${originNode.name}`,
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#0284c7",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          zIndex: 100,
        });
        markersRef.current.set("origin", originMarker);
      } else {
        originMarker.setPosition(pos);
        originMarker.setTitle(`Start: ${originNode.name}`);
        originMarker.setMap(map);
      }
    } else if (originMarker) {
      originMarker.setMap(null);
    }

    // Destination Marker (Vibrant Red Pin)
    let destMarker = markersRef.current.get("dest");
    if (destNode) {
      const pos = { lat: destNode.lat, lng: destNode.lng };
      if (!destMarker) {
        destMarker = new gmaps.Marker({
          position: pos,
          map,
          title: `Destination: ${destNode.name}`,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new gmaps.Size(38, 38),
            anchor: new gmaps.Point(19, 38),
          },
          zIndex: 100,
        });
        markersRef.current.set("dest", destMarker);
      } else {
        destMarker.setPosition(pos);
        destMarker.setTitle(`Destination: ${destNode.name}`);
        destMarker.setMap(map);
      }
    } else if (destMarker) {
      destMarker.setMap(null);
    }
  }, [mapLoaded, originNode, destNode]);

  // 3. Render Active Route Polyline
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;
    const gmaps = window.google.maps;
    const map = mapInstanceRef.current;

    // If there is an active route with geometry
    if (activeRoute && activeRoute.geometry && activeRoute.geometry.length > 0) {
      const path = activeRoute.geometry.map(([lat, lng]) => ({ lat, lng }));

      // Under-glow/halo polyline for high contrast
      if (!routeHaloPolylineRef.current) {
        routeHaloPolylineRef.current = new gmaps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#0369a1",
          strokeOpacity: 0.5,
          strokeWeight: 10,
          zIndex: 49,
          map,
        });
      } else {
        routeHaloPolylineRef.current.setPath(path);
        routeHaloPolylineRef.current.setMap(map);
      }

      // Active navigation route polyline (Google Maps Blue)
      if (!routePolylineRef.current) {
        routePolylineRef.current = new gmaps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#0284c7",
          strokeOpacity: 0.95,
          strokeWeight: 6,
          zIndex: 50,
          map,
        });
      } else {
        routePolylineRef.current.setPath(path);
        routePolylineRef.current.setMap(map);
      }

      // Auto-fit bounds to route
      const bounds = new gmaps.LatLngBounds();
      path.forEach((pt: any) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 80, bottom: 180, left: 60, right: 60 });
    } else {
      // Clear route polyline if no active route
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
      }
      if (routeHaloPolylineRef.current) {
        routeHaloPolylineRef.current.setMap(null);
      }
    }
  }, [mapLoaded, activeRoute]);

  // 4. Render FLOODNET Overlays: Confirmed Flooded and Caution Road Segments
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;
    const gmaps = window.google.maps;
    const map = mapInstanceRef.current;

    const currentFloodedKeys = new Set<string>();
    const currentCautionKeys = new Set<string>();

    networkRoads.forEach((road) => {
      const roadId = road.road_code || road.road_id;
      if (!roadId || !road.geometry || road.geometry.length === 0) return;

      const path = road.geometry.map(([lat, lng]) => ({ lat, lng }));

      // FLOODED ROAD OVERLAY (BOLD RED)
      if (road.status === "FLOODED" || road.status === "BLOCKED") {
        currentFloodedKeys.add(roadId);

        let poly = floodedPolylinesRef.current.get(roadId);
        if (!poly) {
          poly = new gmaps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#dc2626", // Bright danger red
            strokeOpacity: 0.9,
            strokeWeight: 8,
            zIndex: 60,
            map,
          });

          // Click on flooded road displays InfoWindow with flood status
          poly.addListener("click", (e: any) => {
            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(`
                <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 240px; color: #0f172a;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
                      ⚠️ FLOOD HAZARD
                    </span>
                  </div>
                  <strong style="font-size: 14px; display: block; margin-bottom: 2px;">${road.name}</strong>
                  <p style="font-size: 12px; color: #475569; margin: 0 0 6px 0;">Confirmed road flooding detected. Segment closed for navigation.</p>
                  <div style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px 6px; border-radius: 4px;">
                    Source: <b>${road.source}</b> · Confidence: <b>${Math.round(road.confidence * 100)}%</b>
                  </div>
                </div>
              `);
              infoWindowRef.current.setPosition(e.latLng || path[Math.floor(path.length / 2)]);
              infoWindowRef.current.open(map);
            }
          });

          floodedPolylinesRef.current.set(roadId, poly);
        } else {
          poly.setPath(path);
          poly.setMap(map);
        }

        // Flooded Hazard Marker at midpoint
        const midPoint = path[Math.floor(path.length / 2)];
        const markerKey = `flood_marker_${roadId}`;
        let marker = markersRef.current.get(markerKey);
        if (!marker) {
          marker = new gmaps.Marker({
            position: midPoint,
            map,
            title: `FLOOD HAZARD: ${road.name}`,
            label: {
              text: "⚠️",
              fontSize: "16px",
            },
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: "#ef4444",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            zIndex: 65,
          });
          marker.addListener("click", () => {
            if (infoWindowRef.current) {
              infoWindowRef.current.setContent(`
                <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 240px; color: #0f172a;">
                  <span style="background: #fee2e2; color: #b91c1c; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
                    ⚠️ CONFIRMED FLOOD
                  </span>
                  <p style="margin: 6px 0 2px; font-weight: 700; font-size: 13px;">${road.name}</p>
                  <p style="font-size: 12px; color: #64748b; margin: 0;">Rerouting active to avoid this segment.</p>
                </div>
              `);
              infoWindowRef.current.setPosition(midPoint);
              infoWindowRef.current.open(map);
            }
          });
          markersRef.current.set(markerKey, marker);
        } else {
          marker.setPosition(midPoint);
          marker.setMap(map);
        }
      }

      // CAUTION ROAD OVERLAY (AMBER)
      if (road.status === "CAUTION") {
        currentCautionKeys.add(roadId);

        let poly = cautionPolylinesRef.current.get(roadId);
        if (!poly) {
          poly = new gmaps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#f59e0b", // Amber/yellow
            strokeOpacity: 0.85,
            strokeWeight: 6,
            zIndex: 40,
            map,
          });
          cautionPolylinesRef.current.set(roadId, poly);
        } else {
          poly.setPath(path);
          poly.setMap(map);
        }
      }
    });

    // Remove polylines that are no longer flooded
    floodedPolylinesRef.current.forEach((poly, key) => {
      if (!currentFloodedKeys.has(key)) {
        poly.setMap(null);
        floodedPolylinesRef.current.delete(key);
        const marker = markersRef.current.get(`flood_marker_${key}`);
        if (marker) {
          marker.setMap(null);
          markersRef.current.delete(`flood_marker_${key}`);
        }
      }
    });

    // Remove caution polylines that are no longer caution
    cautionPolylinesRef.current.forEach((poly, key) => {
      if (!currentCautionKeys.has(key)) {
        poly.setMap(null);
        cautionPolylinesRef.current.delete(key);
      }
    });
  }, [mapLoaded, networkRoads]);

  // 5. Render CCTV Camera Markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google) return;
    const gmaps = window.google.maps;
    const map = mapInstanceRef.current;

    cameras.forEach((cam) => {
      let marker = cameraMarkersRef.current.get(cam.id);
      const pos = { lat: cam.lat, lng: cam.lng };

      if (!marker) {
        marker = new gmaps.Marker({
          position: pos,
          map,
          title: `CCTV: ${cam.name} (${cam.monitored_road_name})`,
          label: {
            text: "📹",
            fontSize: "13px",
          },
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: cam.status === "ALERT" ? "#ef4444" : "#059669",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 70,
        });

        marker.addListener("click", () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(`
              <div style="font-family: system-ui, sans-serif; padding: 6px; max-width: 250px; color: #0f172a;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <span style="font-weight: 800; font-size: 12px; color: #0369a1;">📹 ${cam.name}</span>
                  <span style="background: ${cam.status === "ALERT" ? "#fee2e2" : "#dcfce7"}; color: ${cam.status === "ALERT" ? "#b91c1c" : "#15803d"}; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;">
                    ${cam.status}
                  </span>
                </div>
                <div style="font-size: 12px; margin-bottom: 4px;">
                  <b>Monitoring:</b> ${cam.monitored_road_name}
                </div>
                <div style="font-size: 11px; color: #64748b;">
                  Flood Level: <b>${cam.flood_level_cm} cm</b> · Last Check: <b>${cam.last_detection}</b>
                </div>
              </div>
            `);
            infoWindowRef.current.setPosition(pos);
            infoWindowRef.current.open(map);
          }
        });

        cameraMarkersRef.current.set(cam.id, marker);
      } else {
        marker.setPosition(pos);
        marker.setMap(map);
      }
    });
  }, [mapLoaded, cameras]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Hidden search input for Google Places Autocomplete */}
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search destination or address in Google Places..."
        style={{ display: "none" }}
      />

      {/* Main Google Maps DOM Node */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#e2e8f0",
        }}
      />

      {/* Loading state indicator */}
      {!mapLoaded && !mapError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(15, 23, 42, 0.9)",
            color: "#f8fafc",
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            zIndex: 10,
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="spinner" />
          <span style={{ fontWeight: 600 }}>Loading Google Maps...</span>
        </div>
      )}

      {/* Map loading error fallback */}
      {mapError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(30, 41, 59, 0.95)",
            border: "1px solid #ef4444",
            color: "#f8fafc",
            padding: "20px 24px",
            borderRadius: "12px",
            maxWidth: "460px",
            textAlign: "center",
            zIndex: 10,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🗺️</div>
          <h3 style={{ margin: "0 0 8px 0", color: "#f87171" }}>
            Google Maps Setup Required
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            {mapError}
          </p>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            Configure your <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> or click the Key icon in the top header.
          </div>
        </div>
      )}
    </div>
  );
}
