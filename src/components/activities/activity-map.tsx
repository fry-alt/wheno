"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";

import { categoryColor, categoryForType } from "@/lib/activities/category";
import type { ActivityCardData } from "@/lib/activities/types";

const DEFAULT_CENTER: L.LatLngExpression = [55.751, 37.618]; // Москва
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

export function ActivityMap({ items, timezone }: { items: ActivityCardData[]; timezone: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { attributionControl: false, zoomControl: false }).setView(DEFAULT_CENTER, 10);
    L.tileLayer(TILES, { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: L.LatLngExpression[] = [];
    for (const d of items) {
      const a = d.activity;
      if (a.lat == null || a.lng == null) continue;
      const color = categoryColor(categoryForType(a.type));
      const when = formatInTimeZone(a.starts_at, timezone, "EEE d MMM, HH:mm", { locale: ru });
      const marker = L.circleMarker([a.lat, a.lng], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<a href="/activities/${a.id}" style="font-weight:600;color:inherit;text-decoration:none">${esc(a.title)}</a>` +
          `<br><span style="opacity:.65;font-size:12px">${when}${a.place ? ` · ${esc(a.place)}` : ""}</span>`,
      );
      marker.addTo(layer);
      bounds.push([a.lat, a.lng]);
    }
    if (bounds.length > 0) {
      map.fitBounds(bounds as L.LatLngBoundsLiteral, { padding: [40, 40], maxZoom: 15 });
    }
  }, [items, timezone]);

  return <div ref={ref} className="h-[60vh] w-full overflow-hidden rounded-2xl border border-border" />;
}
