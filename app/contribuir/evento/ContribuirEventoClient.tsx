"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import Map, { ViewStateChangeEvent, Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { Place, CategoryId } from "@/types";
import { Event } from "@/types/events";
import { createRoute, addPlaceToRoute, addEventToRoute } from "@/lib/routeStore";

import { CATEGORIES } from "@/lib/data";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const INPUT_STYLE = {
  background: "var(--bg-subtle, rgba(0,0,0,0.03))",
  border: "1.5px solid var(--border, rgba(0,0,0,0.1))",
  borderRadius: "16px",
  padding: "0 16px",
  height: 52,
  fontSize: "1rem",
  color: "var(--text, #111)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
  transition: "border-color 0.2s ease"
};

// --- ICONOS INLINE ---
const IconPin = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.2))" }}>
    <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#C4622D" stroke="white" strokeWidth="2"/>
    <circle cx="12" cy="9" r="3" fill="white"/>
  </svg>
);

const IconCamera = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const IconCross = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconLocation = () => (
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>
     <line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line>
     <line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line>
   </svg>
);

export interface ContribuirEventoProps {
  places: Place[];
  events: Event[];
}

export default function ContribuirEventoClient({ places, events }: ContribuirEventoProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [viewState, setViewState] = useState({
    longitude: -105.4410,
    latitude: 20.8689,
    zoom: 15
  });
  
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("Sayulita");
  const [stateName, setStateName] = useState("Nayarit");
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceText, setPriceText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [routeStops, setRouteStops] = useState<(Place | Event)[]>([]);
  const [showRouteSave, setShowRouteSave] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(searchQuery)}&access_token=${MAPBOX_TOKEN}&limit=5&language=es`);
          const data = await res.json();
          setSearchResults(data.features || []);
          setShowResults(true);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectResult = (feature: any) => {
    const [lon, lat] = feature.geometry.coordinates;
    setViewState(prev => ({ ...prev, longitude: lon, latitude: lat, zoom: 16 }));
    setSearchQuery(feature.properties.name || feature.properties.full_address);
    setShowResults(false);
  };

  const toggleRouteStop = (item: Place | Event) => {
    setRouteStops(prev => {
      const exists = prev.find(s => s.id === item.id);
      if (exists) return prev.filter(s => s.id !== item.id);
      return [...prev, item];
    });
  };

  const handleSaveRoute = () => {
    if (!routeName.trim() || routeStops.length < 2) return;
    const newRoute = createRoute(routeName.trim());
    routeStops.forEach(stop => {
      const isPlace = 'town' in stop;
      if (isPlace) {
        addPlaceToRoute(newRoute.id, stop as Place);
      } else {
        addEventToRoute(newRoute.id, stop as Event);
      }
    });
    router.push("/rutas?toast=ruta_creada");
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState((prev) => ({
          ...prev,
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }));
      });
    }
  }, []);

  const handleMapMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
    if (!isMapMoving) setIsMapMoving(true);
    if (showResults) setShowResults(false);
  }, [isMapMoving, showResults]);

  const handleMapMoveEnd = useCallback(() => {
    setIsMapMoving(false);
  }, []);

  const goToMyLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setViewState((prev) => ({
          ...prev,
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          zoom: 16,
        }));
      });
    }
  };

  const handleConfirmLocation = async () => {
    setMapLoading(true);
    try {
      if (MAPBOX_TOKEN) {
        const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?longitude=${viewState.longitude}&latitude=${viewState.latitude}&types=poi,address,place&access_token=${MAPBOX_TOKEN}`);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const mainFeature = data.features[0];
          const foundVenue = mainFeature.properties?.name || mainFeature.properties?.full_address || "";
          if (foundVenue) setVenueName(foundVenue);
          if (mainFeature.properties?.context) {
            const foundCity = mainFeature.properties.context.place?.name || "";
            const foundState = mainFeature.properties.context.region?.name || "";
            if (foundCity) setCity(foundCity);
            if (foundState) setStateName(foundState);
          }
        }
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
    setMapLoading(false);
    setStep(2);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  const publishEvent = async () => {
    if (!user) { router.push("/auth/login?redirect=/contribuir/evento"); return; }
    if (!category || !title || !startDate) { setError("Campos requeridos faltantes."); return; }
    setLoading(true);
    let uploadedImageUrl = "";
    if (imageFile) {
      try {
        const isLocal = !isSupabaseConfigured();
        const token = isLocal 
          ? localStorage.getItem("puebleando_mock_token")
          : getSupabaseClient() ? (await getSupabaseClient()!.auth.getSession()).data.session?.access_token : null;
        const fd = new FormData();
        fd.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedImageUrl = uploadData.url;
        }
      } catch (err) { console.error("Upload error", err); }
    }
    try {
      const isLocal = !isSupabaseConfigured();
      const token = isLocal 
        ? localStorage.getItem("puebleando_mock_token")
        : getSupabaseClient() ? (await getSupabaseClient()!.auth.getSession()).data.session?.access_token : null;
      const payload = {
        title, description, category, start_date: startDate, end_date: endDate || null,
        venue_name: venueName, city, state: stateName, is_free: isFree,
        price_text: isFree ? "Entrada libre" : priceText,
        image_url: uploadedImageUrl, latitude: viewState.latitude, longitude: viewState.longitude
      };
      const res = await fetch("/api/contribuir/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al publicar"); setLoading(false); return; }
      router.push(data.published ? `/evento/${data.id}?toast=evento_publicado` : "/mi-cuenta?toast=evento_en_revision");
    } catch (err: any) { setError(err.message || "Error al enviar"); setLoading(false); }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", background: "#f5f5f5", paddingTop: "var(--safe-top)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Map
          {...viewState}
          onMove={handleMapMove}
          onMoveEnd={handleMapMoveEnd}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: "100%", height: "100%" }}
        >
          {places.filter(p => !selectedCat || p.category === selectedCat).map(p => (
            <Marker key={p.id} longitude={p.longitude} latitude={p.latitude} anchor="bottom">
              <button 
                onClick={() => isRouteMode ? toggleRouteStop(p) : null}
                style={{ background: "none", border: "none", padding: 0, cursor: isRouteMode ? "pointer" : "default" }}
              >
                <div style={{ 
                  width: 36, height: 36, background: routeStops.find(s => s.id === p.id) ? "var(--jade)" : "var(--terracota)", 
                  borderRadius: "50%", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)", color: "white"
                }}>
                  <CategoryIcon id={p.category} size={20} />
                </div>
              </button>
            </Marker>
          ))}
          {isRouteMode && routeStops.length > 1 && (
            <Source type="geojson" data={{
              type: "Feature", properties: {},
              geometry: {
                type: "LineString",
                coordinates: routeStops.filter(s => s.longitude !== undefined && s.latitude !== undefined).map(s => [s.longitude!, s.latitude!])
              }
            }}>
              <Layer id="route-line" type="line" paint={{ "line-color": "#2D7D62", "line-width": 4, "line-dasharray": [1, 1] }} />
            </Source>
          )}
        </Map>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)", pointerEvents: "none" }} />
        <motion.div animate={{ y: isMapMoving ? -15 : 0, scale: isMapMoving ? 1.1 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ position: "absolute", top: "50%", left: "50%", translateX: "-50%", translateY: "-100%", pointerEvents: "none", zIndex: 10 }}>
          <IconPin />
          <motion.div animate={{ scale: isMapMoving ? 0.6 : 1, opacity: isMapMoving ? 0.2 : 0.4 }} style={{ width: 12, height: 4, background: "black", borderRadius: "50%", position: "absolute", bottom: -2, left: "50%", translateX: "-50%", filter: "blur(2px)" }} />
        </motion.div>
        <div style={{ position: "absolute", top: "calc(var(--topbar-h) + var(--safe-top, 0px) + 16px)", left: 20, right: 20, zIndex: 50 }}>
          <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderRadius: "20px", padding: "4px 12px", display: "flex", alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.3)" }}>
             <div style={{ color: "var(--terracota)", marginRight: 10, display: "flex", alignItems: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div>
             <input type="text" placeholder="Busca el lugar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => { if (searchResults.length > 0) setShowResults(true); }} style={{ background: "transparent", border: "none", height: 48, flex: 1, fontSize: "100%", outline: "none", color: "var(--text)" }} />
             {isSearching && <div className="w-5 h-5 border-2 border-terracota border-t-transparent rounded-full animate-spin mr-2" />}
             {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", padding: "0 4px" }}><IconCross /></button>}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0", scrollbarWidth: "none" }}>
            <button onClick={() => setSelectedCat(null)} style={{ padding: "8px 16px", borderRadius: "20px", whiteSpace: "nowrap", background: !selectedCat ? "var(--terracota)" : "rgba(255,255,255,0.8)", color: !selectedCat ? "white" : "var(--text)", border: "1px solid rgba(0,0,0,0.05)", fontWeight: 600, fontSize: "0.85rem" }}>Todos</button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id as CategoryId)} style={{ padding: "8px 16px", borderRadius: "20px", whiteSpace: "nowrap", background: selectedCat === c.id ? "var(--terracota)" : "rgba(255,255,255,0.8)", color: selectedCat === c.id ? "white" : "var(--text)", border: "1px solid rgba(0,0,0,0.05)", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 4 }}>
                <CategoryIcon id={c.id} size={18} color={selectedCat === c.id ? "white" : "var(--text)"} /> {c.name}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {showResults && searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ marginTop: 8, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderRadius: "20px", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                {searchResults.map((f, i) => (
                  <button key={f.id || i} onClick={() => handleSelectResult(f)} style={{ width: "100%", padding: "14px 18px", textAlign: "left", background: "transparent", border: "none", borderBottom: i === searchResults.length - 1 ? "none" : "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{f.properties.name || f.properties.full_address}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {step === 1 && (
          <div style={{ position: "absolute", bottom: 100, right: 20, display: "flex", flexDirection: "column", gap: 12, zIndex: 30 }}>
            <button onClick={() => setIsRouteMode(!isRouteMode)} style={{ width: 50, height: 50, borderRadius: "25px", background: isRouteMode ? "var(--jade)" : "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer", color: isRouteMode ? "white" : "var(--text)" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg></button>
            <button onClick={goToMyLocation} style={{ width: 50, height: 50, borderRadius: "25px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", display: "flex", justifyContent: "center", alignItems: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.15)", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer", color: "var(--terracota)" }}><IconLocation /></button>
          </div>
        )}
        <AnimatePresence>
          {step === 1 && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ position: "absolute", bottom: 30, left: 20, right: 20, zIndex: 20 }}>
              <button onClick={handleConfirmLocation} disabled={mapLoading} className="btn-primary" style={{ width: "100%", height: 56, fontSize: "1.1rem", borderRadius: "var(--r-full)", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, boxShadow: "0 8px 16px rgba(196,98,45,0.3)", marginBottom: "var(--safe-bottom)" }}>
                {mapLoading ? "Ubicando..." : "Confirmar Ubicación"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {step === 2 && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setStep(1)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "black", zIndex: 30, cursor: "pointer" }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "85%", background: "var(--bg)", borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 40, display: "flex", flexDirection: "column", boxShadow: "0 -10px 40px rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 16, paddingBottom: 12, cursor: "pointer" }} onClick={() => setStep(1)}><div style={{ width: 48, height: 6, borderRadius: 10, background: "var(--border-strong, #ccc)" }} /></div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 120px", display: "flex", flexDirection: "column", gap: 24 }}>
                <div><input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />{imagePreview ? <div style={{ position: "relative", width: "100%", height: 180, borderRadius: 16, overflow: "hidden" }}><img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button onClick={() => { setImageFile(null); setImagePreview(""); }} style={{ position: "absolute", top: 12, right: 12, width: 36, height: 36, borderRadius: 18, background: "rgba(0,0,0,0.6)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", border: "none", cursor: "pointer" }}><IconCross /></button></div> : <div onClick={() => fileInputRef.current?.click()} style={{ width: "100%", height: 120, borderRadius: 16, background: "var(--bg-subtle)", border: "2px dashed var(--border)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--text-secondary)" }}><IconCamera /><span style={{ fontSize: "0.95rem", fontWeight: 500 }}>Añadir foto del evento</span></div>}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Título *</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej. Torneo de Surf Local" style={INPUT_STYLE} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Categoría *</label><div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>{CATEGORIES.map((c) => { const isSelected = category === c.id; return (<button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{ padding: "10px 16px", borderRadius: "var(--r-full)", border: `1.5px solid ${isSelected ? "var(--terracota)" : "var(--border)"}`, background: isSelected ? "var(--terracota)" : "var(--bg)", color: isSelected ? "white" : "var(--text)", fontWeight: isSelected ? 600 : 500, fontSize: "0.95rem", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s ease" }}><CategoryIcon id={c.id} size={18} color={selectedCat === c.id ? "white" : "var(--text)"} /> {c.name}</button>); })}</div></div>
                <div style={{ display: "flex", gap: 16 }}><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Cuándo empieza *</label><input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={INPUT_STYLE} /></div><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Cuándo termina</label><input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={INPUT_STYLE} /></div></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Lugar exacto</label><input type="text" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Ej. Calle Principal #12" style={INPUT_STYLE} /></div>
                <div style={{ display: "flex", gap: 16 }}><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Ciudad</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} style={INPUT_STYLE} /></div><div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Estado</label><input type="text" value={stateName} onChange={(e) => setStateName(e.target.value)} style={INPUT_STYLE} /></div></div>
                <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="isFree" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="w-5 h-5 accent-terracota" /><label htmlFor="isFree" className="text-sm font-semibold text-zinc-700">Este evento es GRATUITO</label></div>
                {!isFree && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Costo / Info de boletos</label><input type="text" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="Ej. $200 preventa" style={INPUT_STYLE} /></div>)}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Descripción</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cuenta más detalles del evento..." style={{ ...INPUT_STYLE, height: 120, padding: "12px 16px", resize: "none" }} /></div>
                {error && <p style={{ color: "var(--error)", fontSize: "0.9rem", fontWeight: 600 }}>{error}</p>}
                <button onClick={publishEvent} disabled={loading} className="btn-primary" style={{ width: "100%", height: 56, marginTop: 16 }}>{loading ? "Publicando..." : "Publicar Evento"}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
