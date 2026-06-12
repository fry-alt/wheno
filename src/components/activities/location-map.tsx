"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Read-only single-marker map for showing one place (activity detail). */
export function LocationMap({ lat, lng, color = "#5b7cfa" }: { lat: number; lng: number; color?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([lat, lng], 14);
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
    L.circleMarker([lat, lng], {
      radius: 9,
      color: "#ffffff",
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={ref} className="h-44 w-full overflow-hidden rounded-2xl border border-border" />;
}
