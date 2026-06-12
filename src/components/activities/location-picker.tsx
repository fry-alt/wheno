"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LatLng {
  lat: number;
  lng: number;
}

const DEFAULT_CENTER: L.LatLngExpression = [55.751, 37.618]; // Москва
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  function place(map: L.Map, lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#5b7cfa",
        fillOpacity: 1,
      }).addTo(map);
    }
    onChangeRef.current({ lat, lng });
  }

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const start: L.LatLngExpression = value ? [value.lat, value.lng] : DEFAULT_CENTER;
    const map = L.map(ref.current, { attributionControl: false, zoomControl: false }).setView(start, value ? 14 : 10);
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
    if (value) {
      markerRef.current = L.circleMarker([value.lat, value.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#5b7cfa",
        fillOpacity: 1,
      }).addTo(map);
    }
    map.on("click", (e: L.LeafletMouseEvent) => place(map, e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Init once — `value` is only the initial center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const map = mapRef.current;
      if (!map) return;
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 15);
      place(map, latitude, longitude);
    });
  }

  return (
    <div className="relative">
      <div ref={ref} className="h-56 w-full overflow-hidden rounded-xl border border-border" />
      <button
        type="button"
        onClick={useMyLocation}
        className="absolute right-2 top-2 z-[500] rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow active:scale-95"
      >
        📍 моё место
      </button>
      <p className="mt-1 text-xs text-muted">Тапни по карте, чтобы поставить точку</p>
    </div>
  );
}
