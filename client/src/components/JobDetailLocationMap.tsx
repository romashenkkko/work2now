import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

const MAPBOX_STYLE_ROAD = "mapbox://styles/vasilepopovici/cmlqvsvuc001601scb2aocofg";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

type Props = {
  lat: number;
  lng: number;
  className?: string;
};

/** Hartă statică cu pin (detalii job). Necesită VITE_MAPBOX_ACCESS_TOKEN. */
export default function JobDetailLocationMap({ lat, lng, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    const token = MAPBOX_TOKEN.trim();
    if (!el || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: el,
      style: MAPBOX_STYLE_ROAD,
      center: [lng, lat],
      zoom: 14,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    new mapboxgl.Marker({ color: "#6d28d9" }).setLngLat([lng, lat]).addTo(map);

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    };
    map.on("load", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={containerRef} className={className ?? "h-full w-full min-h-[12rem]"} />;
}
