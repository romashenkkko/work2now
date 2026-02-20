import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import mapboxgl from "mapbox-gl";

export type AddressGeo = { lat: number; lng: number; radiusM?: number };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (address: string, geo?: AddressGeo) => void;
  initialAddress?: string;
  /** Raza implicită (m) pentru check-in la locație (ex. 50) */
  defaultRadiusM?: number;
};

type Suggestion = { display_name: string; lat: string; lon: string };

const CHISINAU_CENTER: [number, number] = [46.99, 28.98];
const MAPBOX_STYLE_ROAD = "mapbox://styles/vasilepopovici/cmlqvsvuc001601scb2aocofg";
const MAPBOX_STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? "";

function mapboxSearch(query: string, token: string): Promise<Suggestion[]> {
  if (!token.trim()) return Promise.resolve([]);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&country=MD&limit=6`;
  return fetch(url)
    .then((res) => res.json())
    .then((data: { features?: { place_name: string; center: [number, number] }[] }) => {
      const features = data?.features ?? [];
      return features.map((f) => ({
        display_name: f.place_name,
        lat: String(f.center[1]),
        lon: String(f.center[0]),
      }));
    })
    .catch(() => []);
}

function mapboxReverseGeocode(lat: number, lng: number, token: string): Promise<string | null> {
  if (!token.trim()) return Promise.resolve(null);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(token)}`;
  return fetch(url)
    .then((res) => res.json())
    .then((data: { features?: { place_name: string }[] }) => data?.features?.[0]?.place_name ?? null)
    .catch(() => null);
}

export default function AddressPickerModal({ open, onClose, onConfirm, initialAddress = "", defaultRadiusM = 200 }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapType, setMapType] = useState<"road" | "satellite">("road");
  const [position, setPosition] = useState<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onMapClickRef = useRef<(lat: number, lng: number) => void>(() => {});

  useEffect(() => {
    if (!open) return;
    setSearch(initialAddress);
    setSuggestions([]);
    setShowSuggestions(false);
    setPosition(null);
  }, [open, initialAddress]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      mapboxSearch(q, MAPBOX_TOKEN)
        .then((data) => {
          setSuggestions(data);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const reverseGeocode = (lat: number, lon: number) => {
    mapboxReverseGeocode(lat, lon, MAPBOX_TOKEN).then((placeName) => {
      if (placeName) setSearch(placeName);
    });
  };

  const handleMapPick = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    reverseGeocode(lat, lng);
  };

  onMapClickRef.current = handleMapPick;

  const pickSuggestion = (s: Suggestion) => {
    setSearch(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setPosition([Number(s.lat), Number(s.lon)]);
  };

  // Init Mapbox map when modal opens and token exists
  useEffect(() => {
    if (!open || !MAPBOX_TOKEN || !mapContainerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const [lat, lng] = position ?? CHISINAU_CENTER;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapType === "satellite" ? MAPBOX_STYLE_SATELLITE : MAPBOX_STYLE_ROAD,
      center: [lng, lat],
      zoom: position ? 15 : 12,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("click", (e) => {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      onMapClickRef.current(lat, lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [open, MAPBOX_TOKEN ? "ok" : ""]);

  // Update map style when mapType changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(mapType === "satellite" ? MAPBOX_STYLE_SATELLITE : MAPBOX_STYLE_ROAD);
  }, [mapType]);

  // Update center and marker when position changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (position) {
      const [lat, lng] = position;
      map.flyTo({ center: [lng, lat], zoom: 15, duration: 0.5 });
      if (markerRef.current) markerRef.current.remove();
      const marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      markerRef.current = marker;
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.flyTo({ center: [CHISINAU_CENTER[1], CHISINAU_CENTER[0]], zoom: 12, duration: 0.5 });
    }
  }, [position]);

  if (!open) return null;

  const handleConfirm = () => {
    const addr = search.trim() || initialAddress;
    if (position) {
      onConfirm(addr, { lat: position[0], lng: position[1], radiusM: defaultRadiusM });
    } else {
      onConfirm(addr);
    }
    onClose();
  };

  const hasToken = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{initialAddress.trim() ? t("dashboard.changeAddress") : t("dashboard.addAddress")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label={t("dashboard.close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">{t("dashboard.searchAddress")}</span>
            <div className="relative" ref={wrapRef}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder={t("dashboard.addressPlaceholder")}
                className="block w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary"
                autoComplete="off"
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">...</span>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1 z-50">
                  {suggestions.map((s, i) => (
                    <li key={`${s.lat}-${s.lon}-${i}`}>
                      <button
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-primary/10 truncate"
                      >
                        {s.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
            <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs text-gray-500">
                {hasToken ? "© Mapbox" : "Mapbox"}
              </span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <button
                  type="button"
                  onClick={() => setMapType("road")}
                  className={`px-3 py-1.5 text-xs font-medium ${mapType === "road" ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  {t("dashboard.mapRoad", "Harta")}
                </button>
                <button
                  type="button"
                  onClick={() => setMapType("satellite")}
                  className={`px-3 py-1.5 text-xs font-medium ${mapType === "satellite" ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  {t("dashboard.mapSatellite", "Satelit")}
                </button>
              </div>
            </div>
            <div className="relative z-0 w-full rounded-b-xl" style={{ height: 480 }}>
              {hasToken ? (
                <div ref={mapContainerRef} className="w-full h-full rounded-b-xl" />
              ) : (
                <div className="w-full h-full rounded-b-xl flex items-center justify-center bg-gray-200 text-gray-600 p-4 text-center">
                  <p className="text-sm">
                    Pentru hartă Mapbox, adaugă <code className="bg-gray-300 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> în <code className="bg-gray-300 px-1 rounded">client/.env</code>.
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 px-2 py-1 bg-gray-50">
              {t("dashboard.mapClickHint", "Apasă pe hartă pentru a selecta locația.")}
            </p>
            <p className="text-xs text-gray-500 px-2 py-1 bg-gray-50 border-t border-gray-100">
              {t("dashboard.checkInGeoHint", "Locația selectată va fi folosită pentru check-in/check-out (angajații trebuie să fie în raza de 200 m).")}
            </p>
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("dashboard.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark"
          >
            {t("dashboard.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
