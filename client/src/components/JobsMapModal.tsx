import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import mapboxgl from "mapbox-gl";
import { Map, Satellite } from "lucide-react";
import { geocodeAddress } from "../utils/geocodeAddress";

const CHISINAU_CENTER: [number, number] = [46.99, 28.98];
const DEFAULT_ZOOM = 12;
const MAPBOX_STYLE_ROAD = "mapbox://styles/vasilepopovici/cmlqvsvuc001601scb2aocofg";
const MAPBOX_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

type JobWithLocation = { job: string; location: string; lat?: number; lng?: number };
type GeocodedJob = { lat: number; lon: number; job: string; location: string };

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobWithLocation[];
  showMyLocation?: boolean;
};

type MapLayer = "street" | "satellite";

export default function JobsMapModal({ open, onClose, jobs, showMyLocation = false }: Props) {
  const { t } = useTranslation();
  const [markers, setMarkers] = useState<GeocodedJob[]>([]);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("street");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const myLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!open || !showMyLocation || typeof navigator === "undefined" || !navigator.geolocation) {
      setMyLocation(null);
      return;
    }
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    };
    let best: { lat: number; lng: number; accuracy: number } | null = null;
    const onPos = (pos: GeolocationPosition) => {
      const acc = pos.coords.accuracy ?? 9999;
      if (best === null || acc < best.accuracy) {
        best = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };
        setMyLocation([best.lat, best.lng]);
      }
    };
    const watchId = navigator.geolocation.watchPosition(onPos, () => {
      if (best) setMyLocation([best.lat, best.lng]);
      else setMyLocation(null);
    }, opts);
    const fallback = setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (best) setMyLocation([best.lat, best.lng]);
    }, 8000);
    return () => {
      clearTimeout(fallback);
      navigator.geolocation.clearWatch(watchId);
      setMyLocation(null);
    };
  }, [open, showMyLocation]);

  useEffect(() => {
    if (!open || jobs.length === 0) {
      setMarkers([]);
      return;
    }
    const withCoords = jobs.filter((j) => typeof j.lat === "number" && typeof j.lng === "number");
    const withAddressOnly = jobs.filter((j) => j.location?.trim() && !(typeof j.lat === "number" && typeof j.lng === "number"));
    const results: GeocodedJob[] = withCoords.map((j) => ({
      lat: j.lat!,
      lon: j.lng!,
      job: j.job,
      location: j.location || "",
    }));
    setMarkers([...results]);
    if (withAddressOnly.length === 0) return;
    setLoading(true);
    let index = 0;
    const run = () => {
      if (index >= withAddressOnly.length) {
        setMarkers((prev) => [...prev]);
        setLoading(false);
        return;
      }
      const job = withAddressOnly[index];
      geocodeAddress(job.location, MAPBOX_TOKEN).then((coord) => {
        if (coord) results.push({ lat: coord[0], lon: coord[1], job: job.job, location: job.location });
        index += 1;
        setMarkers([...results]);
        setTimeout(run, 1100);
      }).catch(() => {
        index += 1;
        setTimeout(run, 1100);
      });
    };
    run();
  }, [open, jobs]);

  // Init Mapbox map
  useEffect(() => {
    if (!open || !MAPBOX_TOKEN || !mapContainerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapLayer === "satellite" ? MAPBOX_STYLE_SATELLITE : MAPBOX_STYLE_ROAD,
      center: [CHISINAU_CENTER[1], CHISINAU_CENTER[0]],
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.remove();
        myLocationMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [open, MAPBOX_TOKEN ? "ok" : ""]);

  // Update map style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapLayer === "satellite" ? MAPBOX_STYLE_SATELLITE : MAPBOX_STYLE_ROAD);
  }, [mapLayer]);

  // Update markers and fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const allLngLats: [number, number][] = [];
    markers.forEach((m) => {
      const el = document.createElement("div");
      el.className = "mapboxgl-marker mapboxgl-marker-job";
      el.style.backgroundColor = "#6366f1";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.cursor = "pointer";
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div class="text-sm"><p class="font-semibold text-gray-900">${escapeHtml(m.job)}</p><p class="text-gray-600 mt-0.5">${escapeHtml(m.location)}</p></div>`
      );
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([m.lon, m.lat]).setPopup(popup).addTo(map);
      markersRef.current.push(marker);
      allLngLats.push([m.lon, m.lat]);
    });
    if (myLocation) {
      allLngLats.push([myLocation[1], myLocation[0]]);
      if (myLocationMarkerRef.current) myLocationMarkerRef.current.remove();
      const el = document.createElement("div");
      el.className = "mapboxgl-marker mapboxgl-marker-my";
      el.style.backgroundColor = "#22c55e";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div class="text-sm font-medium text-gray-900">${escapeHtml(t("dashboard.myLocationOnMap"))}</div>`
      );
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([myLocation[1], myLocation[0]]).setPopup(popup).addTo(map);
      myLocationMarkerRef.current = marker;
    } else {
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.remove();
        myLocationMarkerRef.current = null;
      }
    }
    if (allLngLats.length > 0) {
      let minLng = allLngLats[0][0], minLat = allLngLats[0][1], maxLng = minLng, maxLat = minLat;
      allLngLats.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      });
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 24, maxZoom: 14, duration: 0 });
    } else {
      map.flyTo({ center: [CHISINAU_CENTER[1], CHISINAU_CENTER[0]], zoom: DEFAULT_ZOOM });
    }
  }, [markers, myLocation, t]);

  if (!open) return null;

  const hasToken = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.trim());

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-[min(96vw,1400px)] max-h-[94vh] flex flex-col overflow-hidden modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 flex-shrink-0 flex-wrap">
          <h3 className="text-lg font-bold text-gray-900">{t("dashboard.jobsMapTitle")}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMapLayer("street")}
              title={t("dashboard.mapLayerStreet")}
              aria-label={t("dashboard.mapLayerStreet")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                mapLayer === "street" ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Map className="w-4 h-4" />
              {t("dashboard.mapLayerStreet")}
            </button>
            <button
              type="button"
              onClick={() => setMapLayer("satellite")}
              title={t("dashboard.mapLayerSatellite")}
              aria-label={t("dashboard.mapLayerSatellite")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                mapLayer === "satellite" ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Satellite className="w-4 h-4" />
              {t("dashboard.mapLayerSatellite")}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label={t("dashboard.close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {showMyLocation && (
          <p className="text-xs text-gray-500 px-4 pb-1 flex-shrink-0">
            {t("dashboard.myLocationOnMapHint", "Markerul verde arată locația ta. Vizibil doar pentru tine.")}
          </p>
        )}
        <div className="relative flex-1 min-h-[65vh]">
          {loading && markers.length === 0 && (
            <div className="absolute inset-0 z-[10] flex items-center justify-center bg-gray-50/90 rounded-b-2xl">
              <p className="text-gray-600 font-medium">{t("dashboard.loadingMap")}</p>
            </div>
          )}
          {hasToken ? (
            <div ref={mapContainerRef} className="w-full h-full min-h-[65vh] rounded-b-2xl" />
          ) : (
            <div className="w-full h-full min-h-[65vh] rounded-b-2xl flex items-center justify-center bg-gray-200 text-gray-600 p-4 text-center">
              <p className="text-sm">
                Pentru hartă Mapbox, adaugă <code className="bg-gray-300 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> în <code className="bg-gray-300 px-1 rounded">client/.env</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
