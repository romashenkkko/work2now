import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Map, Satellite } from "lucide-react";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const CHISINAU_CENTER: [number, number] = [46.99, 28.98];
const DEFAULT_ZOOM = 12;

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type JobWithLocation = { job: string; location: string };
type GeocodedJob = { lat: number; lon: number; job: string; location: string };

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) {
      map.setView(CHISINAU_CENTER, DEFAULT_ZOOM);
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [map, positions]);
  return null;
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `${NOMINATIM_SEARCH}?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=1`,
      { headers: { "Accept-Language": "ro,en", "User-Agent": "Work2NowApp/1.0 (contact@work2now.app)" } }
    );
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      const lat = Number(data[0].lat);
      const lon = Number(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    }
  } catch {
    // ignore
  }
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobWithLocation[];
};

type MapLayer = "street" | "satellite";

export default function JobsMapModal({ open, onClose, jobs }: Props) {
  const { t } = useTranslation();
  const [markers, setMarkers] = useState<GeocodedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("street");

  useEffect(() => {
    if (!open || jobs.length === 0) {
      setMarkers([]);
      return;
    }
    const withLocation = jobs.filter((j) => j.location?.trim());
    if (withLocation.length === 0) {
      setMarkers([]);
      return;
    }
    setLoading(true);
    const results: GeocodedJob[] = [];
    let index = 0;
    const run = () => {
      if (index >= withLocation.length) {
        setMarkers(results);
        setLoading(false);
        return;
      }
      const job = withLocation[index];
      geocodeAddress(job.location).then((coord) => {
        if (coord) results.push({ lat: coord[0], lon: coord[1], job: job.job, location: job.location });
        index += 1;
        setTimeout(run, 1100);
      });
    };
    run();
  }, [open, jobs]);

  if (!open) return null;

  const positions = markers.map((m) => [m.lat, m.lon] as [number, number]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden modal-content-enter"
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
                mapLayer === "street"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                mapLayer === "satellite"
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
        <div className="flex-1 min-h-[400px] relative">
          {loading && markers.length === 0 && (
            <div className="absolute inset-0 z-[10] flex items-center justify-center bg-gray-50/90 rounded-b-2xl">
              <p className="text-gray-600 font-medium">{t("dashboard.loadingMap")}</p>
            </div>
          )}
          <MapContainer
            center={CHISINAU_CENTER}
            zoom={DEFAULT_ZOOM}
            className="w-full h-full min-h-[400px] rounded-b-2xl"
            scrollWheelZoom
          >
            {mapLayer === "street" ? (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
            ) : (
              <>
                <TileLayer
                  attribution="&copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://cartodb-basemaps-a.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png"
                />
              </>
            )}
            <FitBounds positions={positions} />
            {markers.map((m, i) => (
              <Marker key={`${m.lat}-${m.lon}-${i}`} position={[m.lat, m.lon]} icon={defaultIcon}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">{m.job}</p>
                    <p className="text-gray-600 mt-0.5">{m.location}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
