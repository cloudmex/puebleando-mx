"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getSupabaseClient } from "@/lib/supabase";
import { ScrapingSource, ScrapingJob } from "@/types/events";

export default function ScrapingAdmin() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(false);
  const [isCrawlRunning, setIsCrawlRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [activeCrawlSourceId, setActiveCrawlSourceId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [crawlMessage, setCrawlMessage] = useState<string>("");
  const [crawlResult, setCrawlResult] = useState<{ nuevos: number; errores: number } | null>(null);
  const [crawlError, setCrawlError] = useState<string>("");
  const [discoverMessage, setDiscoverMessage] = useState<string>("");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", base_url: "", default_category: "cultura" });

  // API sync states
  const [ebStatus, setEbStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [tmStatus, setTmStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [geoStatus, setGeoStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [cdmxStatus, setCdmxStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [bandsStatus, setBandsStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [osmStatus, setOsmStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [wikiStatus, setWikiStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [sicStatus, setSicStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [sicFestStatus, setSicFestStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  const [seedStatus, setSeedStatus] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });

  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchData();
  }, []);

  // Poll the pipeline status every 3 s while a job is running
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraping?jobId=${activeJobId}`);
        const data = await res.json();
        setCrawlMessage(data.progreso || "");
        if (data.status === "completed") {
          setIsCrawlRunning(false);
          setActiveJobId(null);
          setCrawlResult(data.resultado ?? null);
          clearInterval(interval);
          fetchData();
        } else if (data.status === "failed") {
          setIsCrawlRunning(false);
          setActiveJobId(null);
          setCrawlError(data.error || "Error desconocido");
          clearInterval(interval);
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/scraping/admin-data");
      const data = await res.json();
      if (data.sources) setSources(data.sources);
      if (data.jobs) setJobs(data.jobs);
      if (data.events) setRecentEvents(data.events);
      if (data.simulated !== undefined) setIsSimulated(data.simulated);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerScraping(sourceId: string) {
    if (isCrawlRunning) {
      setCrawlError("Ya hay un scraping en progreso");
      return;
    }
    setActiveCrawlSourceId(sourceId);
    setIsCrawlRunning(true);
    setCrawlResult(null);
    setCrawlError("");
    setCrawlMessage("Iniciando…");
    try {
      const res = await fetch("/api/scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setCrawlError("Ya hay un scraping en progreso");
        setIsCrawlRunning(false);
        return;
      }
      if (data.jobId) {
        setActiveJobId(data.jobId);
        setCrawlMessage("Actualizando eventos…");
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (err: any) {
      setCrawlError(err.message);
      setIsCrawlRunning(false);
    }
  }

  async function discoverSources() {
    setIsDiscovering(true);
    setDiscoverMessage("Buscando fuentes locales…");
    try {
      const res = await fetch("/api/scraping/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "toda la República Mexicana (los 32 estados)" }),
      });
      const data = await res.json();
      if (data.success) {
        const parts: string[] = [];
        if (data.discovered > 0) parts.push(`${data.discovered} nuevas`);
        if (data.existentes > 0) parts.push(`${data.existentes} ya existían`);
        if (data.invalidas > 0) parts.push(`${data.invalidas} inválidas`);
        setDiscoverMessage(
          data.discovered > 0
            ? `✓ ${parts.join(" · ")}`
            : parts.length > 0
            ? `Sin nuevas — ${parts.join(" · ")}`
            : "Sin resultados"
        );

        // Auto-trigger scraping for newly discovered sources
        if (data.sources && data.sources.length > 0) {
          for (const newSrc of data.sources) {
            try {
              await fetch("/api/scraping/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sourceId: newSrc.id }),
              });
            } catch (crawlErr) {
              console.error(`Failed to auto-crawl ${newSrc.id}:`, crawlErr);
            }
          }
        }

        fetchData();
      } else {
        setDiscoverMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setDiscoverMessage("Error de red al descubrir fuentes");
    } finally {
      setIsDiscovering(false);
    }
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/scraping/admin-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      if (res.ok) {
        setShowAddSource(false);
        setNewSource({ name: "", base_url: "", default_category: "cultura" });
        fetchData();
      }
    } catch (err) {
      alert("Error al agregar fuente");
    }
  }

  async function syncEventbrite() {
    setEbStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/eventbrite", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setEbStatus({ loading: false, result: `✓ ${data.inserted} nuevos · ${data.duplicates} dupes · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setEbStatus({ loading: false, error: err.message });
    }
  }

  async function syncTicketmaster() {
    setTmStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/ticketmaster", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setTmStatus({ loading: false, result: `✓ ${data.inserted} nuevos · ${data.duplicates} dupes · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setTmStatus({ loading: false, error: err.message });
    }
  }

  async function runBatchGeocode() {
    setGeoStatus({ loading: true });
    try {
      const res = await fetch("/api/geocoding/batch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setGeoStatus({
        loading: false,
        result: `✓ ${data.geocoded}/${data.processed} geocodificados · ${data.failed} sin resultado`,
      });
      fetchData();
    } catch (err: any) {
      setGeoStatus({ loading: false, error: err.message });
    }
  }

  async function syncCDMX() {
    setCdmxStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/cdmx-cartelera", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setCdmxStatus({ loading: false, result: `✓ ${data.inserted} nuevos · ${data.duplicates} dupes · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setCdmxStatus({ loading: false, error: err.message });
    }
  }

  async function syncBandsintown() {
    setBandsStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/bandsintown", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setBandsStatus({ loading: false, result: `✓ ${data.inserted} nuevos · ${data.duplicates} dupes · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setBandsStatus({ loading: false, error: err.message });
    }
  }

  async function syncOSM() {
    setOsmStatus({ loading: true });
    try {
      const res = await fetch("/api/places/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setOsmStatus({ loading: false, result: `✓ ${data.inserted} insertados · ${data.skipped} omitidos · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setOsmStatus({ loading: false, error: err.message });
    }
  }

  async function syncSICPlaces() {
    setSicStatus({ loading: true });
    try {
      const res = await fetch("/api/places/sync/sic", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setSicStatus({ loading: false, result: `✓ ${data.inserted} insertados · ${data.skipped} omitidos · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setSicStatus({ loading: false, error: err.message });
    }
  }

  async function syncSICFestivals() {
    setSicFestStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/sic-festivals", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setSicFestStatus({ loading: false, result: `✓ ${data.inserted} nuevos · ${data.duplicates} dupes · ${data.errors} errores` });
      fetchData();
    } catch (err: any) {
      setSicFestStatus({ loading: false, error: err.message });
    }
  }

  async function seedTourismSources() {
    setSeedStatus({ loading: true });
    try {
      const res = await fetch("/api/scraping/seed-sources", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setSeedStatus({ loading: false, result: `✓ ${data.added}/${data.total} fuentes agregadas · ${data.skipped} ya existían` });
      fetchData();
    } catch (err: any) {
      setSeedStatus({ loading: false, error: err.message });
    }
  }

  async function syncWikidata() {
    setWikiStatus({ loading: true });
    try {
      const res = await fetch("/api/enrichment/wikidata", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setWikiStatus({ loading: false, result: `✓ ${data.enriched} enriquecidos · ${data.inserted} nuevos · ${data.skipped} omitidos` });
      fetchData();
    } catch (err: any) {
      setWikiStatus({ loading: false, error: err.message });
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("¿Estás seguro de eliminar este evento?")) return;
    try {
      const res = await fetch(`/api/scraping/admin-data?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Error al eliminar el evento");
      }
    } catch (err) {
      alert("Error de red al eliminar");
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto" style={{ paddingTop: "var(--topbar-h)" }}>
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Administración de Scraping</h1>
          <div className="flex items-center gap-3">
            <p className="text-secondary">Gestiona las fuentes de eventos y monitorea el estado del rastreo.</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isSimulated ? 'bg-maiz/20 text-maiz' : 'bg-jade/20 text-jade'}`}>
              {isSimulated ? 'Modo Simulación' : 'Modo Real (API)'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-3">
            <button
              onClick={discoverSources}
              disabled={isDiscovering}
              className="px-4 py-2 bg-maiz text-stone-900 rounded-lg font-bold text-sm shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {isDiscovering ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Investigando…
                </span>
              ) : '✨ Descubrir Fuentes IA'}
            </button>
            <button
              onClick={() => setShowAddSource(true)}
              className="px-4 py-2 bg-jade text-white rounded-lg font-bold text-sm shadow-sm hover:brightness-110 transition-all"
            >
              + Nueva Fuente
            </button>
          </div>
          {discoverMessage && (
            <p className={`text-[10px] font-bold ${discoverMessage.startsWith('✓') ? 'text-jade' : discoverMessage.startsWith('Error') ? 'text-rojo' : 'text-text-muted'}`}>
              {discoverMessage}
            </p>
          )}
        </div>
      </header>

      {showAddSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md border border-border"
          >
            <h2 className="text-xl font-bold mb-4">Nueva Fuente de Scraping</h2>
            <form onSubmit={addSource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold label-muted mb-1">Nombre</label>
                <input 
                  type="text" 
                  required
                  value={newSource.name}
                  onChange={e => setNewSource({...newSource, name: e.target.value})}
                  className="w-full p-2 border border-border rounded-lg bg-bg-subtle focus:border-terracota transition-all outline-none" 
                  placeholder="Ej: Cultura Guadalajara"
                />
              </div>
              <div>
                <label className="block text-xs font-bold label-muted mb-1">URL Base</label>
                <input 
                  type="url" 
                  required
                  value={newSource.base_url}
                  onChange={e => setNewSource({...newSource, base_url: e.target.value})}
                  className="w-full p-2 border border-border rounded-lg bg-bg-subtle focus:border-terracota transition-all outline-none" 
                  placeholder="https://ejemplo.com/eventos"
                />
              </div>
              <div>
                <label className="block text-xs font-bold label-muted mb-1">Categoría por Defecto</label>
                <select 
                  className="w-full p-2 border border-border rounded-lg bg-bg-subtle outline-none"
                  value={newSource.default_category}
                  onChange={e => setNewSource({...newSource, default_category: e.target.value})}
                >
                  <option value="cultura">Cultura</option>
                  <option value="festivales">Festivales</option>
                  <option value="experiencias">Experiencias</option>
                  <option value="tradiciones">Tradiciones</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddSource(false)}
                  className="flex-1 py-2 bg-bg-muted rounded-lg font-bold text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-terracota text-white rounded-lg font-bold text-sm shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── API Integrations ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/><path d="M9 8h6"/><path d="M9 12h4"/></svg>
          APIs de Eventos Estructurados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Eventbrite */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#F05537]/10 flex items-center justify-center text-sm font-black text-[#F05537]">Eb</div>
              <div>
                <h3 className="font-bold text-sm text-text">Eventbrite México</h3>
                <p className="text-[10px] text-muted">Fechas exactas · coordenadas · categorías</p>
              </div>
            </div>
            <button
              onClick={syncEventbrite}
              disabled={ebStatus.loading}
              className="w-full py-2.5 bg-[#F05537] text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {ebStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Sincronizando…
                </span>
              ) : 'Sincronizar ahora'}
            </button>
            {ebStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{ebStatus.result}</p>}
            {ebStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{ebStatus.error}</p>}
            {!process.env.NEXT_PUBLIC_EVENTBRITE_CONFIGURED && (
              <p className="text-[9px] text-muted mt-1.5 text-center">Agrega EVENTBRITE_API_KEY en .env para activar</p>
            )}
          </div>

          {/* Ticketmaster */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#026CDF]/10 flex items-center justify-center text-sm font-black text-[#026CDF]">Tm</div>
              <div>
                <h3 className="font-bold text-sm text-text">Ticketmaster México</h3>
                <p className="text-[10px] text-muted">Conciertos · espectáculos · artes</p>
              </div>
            </div>
            <button
              onClick={syncTicketmaster}
              disabled={tmStatus.loading}
              className="w-full py-2.5 bg-[#026CDF] text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {tmStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Sincronizando…
                </span>
              ) : 'Sincronizar ahora'}
            </button>
            {tmStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{tmStatus.result}</p>}
            {tmStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{tmStatus.error}</p>}
            {!process.env.NEXT_PUBLIC_TICKETMASTER_CONFIGURED && (
              <p className="text-[9px] text-muted mt-1.5 text-center">Agrega TICKETMASTER_API_KEY en .env para activar</p>
            )}
          </div>

          {/* CDMX Cartelera Cultural */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-base">🎭</div>
              <div>
                <h3 className="font-bold text-sm text-text">CDMX Cartelera Cultural</h3>
                <p className="text-[10px] text-muted">Eventos gratuitos del Gobierno CDMX</p>
              </div>
            </div>
            <button
              onClick={syncCDMX}
              disabled={cdmxStatus.loading}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {cdmxStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Sincronizando…
                </span>
              ) : 'Sincronizar ahora'}
            </button>
            {cdmxStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{cdmxStatus.result}</p>}
            {cdmxStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{cdmxStatus.error}</p>}
          </div>

          {/* Bandsintown */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-base">🎸</div>
              <div>
                <h3 className="font-bold text-sm text-text">Bandsintown — Conciertos</h3>
                <p className="text-[10px] text-muted">Artistas mexicanos · filtrado a MX</p>
              </div>
            </div>
            <button
              onClick={syncBandsintown}
              disabled={bandsStatus.loading}
              className="w-full py-2.5 bg-purple-700 text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {bandsStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Sincronizando…
                </span>
              ) : 'Sincronizar ahora'}
            </button>
            {bandsStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{bandsStatus.result}</p>}
            {bandsStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{bandsStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">Requiere BANDSINTOWN_APP_ID en .env</p>
          </div>

          {/* Batch Geocoding */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm sm:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-terracota/10 flex items-center justify-center text-base">🗺️</div>
              <div>
                <h3 className="font-bold text-sm text-text">Geocodificar eventos sin coordenadas</h3>
                <p className="text-[10px] text-muted">Procesa hasta 50 eventos con ciudad/estado pero sin lat/lng usando Mapbox</p>
              </div>
            </div>
            <button
              onClick={runBatchGeocode}
              disabled={geoStatus.loading}
              className="w-full py-2.5 bg-terracota text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {geoStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Geocodificando…
                </span>
              ) : 'Geocodificar ahora'}
            </button>
            {geoStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{geoStatus.result}</p>}
            {geoStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{geoStatus.error}</p>}
          </div>
        </div>
      </section>

      {/* ── Places Sources ────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          Fuentes de Lugares
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* OpenStreetMap */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#7EBC6F]/10 flex items-center justify-center text-base">🗺️</div>
              <div>
                <h3 className="font-bold text-sm text-text">OpenStreetMap</h3>
                <p className="text-[10px] text-muted">Zonas arqueológicas, museos, mercados y reservas</p>
              </div>
            </div>
            <button
              onClick={syncOSM}
              disabled={osmStatus.loading}
              className="w-full py-2.5 bg-[#7EBC6F] text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {osmStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Importando… (puede tardar 1–2 min)
                </span>
              ) : 'Importar lugares (~500)'}
            </button>
            {osmStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{osmStatus.result}</p>}
            {osmStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{osmStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">Sin API key requerida · deduplicado por ID</p>
          </div>

          {/* Wikidata */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#990000]/10 flex items-center justify-center text-base">📚</div>
              <div>
                <h3 className="font-bold text-sm text-text">Wikidata</h3>
                <p className="text-[10px] text-muted">Enriquece lugares con descripciones e imágenes</p>
              </div>
            </div>
            <button
              onClick={syncWikidata}
              disabled={wikiStatus.loading}
              className="w-full py-2.5 bg-[#990000] text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {wikiStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Enriqueciendo…
                </span>
              ) : 'Enriquecer lugares'}
            </button>
            {wikiStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{wikiStatus.result}</p>}
            {wikiStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{wikiStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">Sin API key requerida · actualiza existentes por proximidad</p>
          </div>

          {/* SIC — Recintos culturales */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-base">🏛️</div>
              <div>
                <h3 className="font-bold text-sm text-text">SIC — Recintos Culturales</h3>
                <p className="text-[10px] text-muted">Museos, teatros, galerías, zonas arq. · nacional · con coords</p>
              </div>
            </div>
            <button
              onClick={syncSICPlaces}
              disabled={sicStatus.loading}
              className="w-full py-2.5 bg-blue-700 text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {sicStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Importando… (puede tardar 2–3 min)
                </span>
              ) : 'Importar recintos'}
            </button>
            {sicStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{sicStatus.result}</p>}
            {sicStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{sicStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">sic.cultura.gob.mx · sin API key · deduplicado por ID</p>
          </div>
        </div>
      </section>

      {/* ── LLM Scraper Seeds ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          Fuentes de Festivales &amp; Eventos Locales
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SIC Festivales */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-base">🎪</div>
              <div>
                <h3 className="font-bold text-sm text-text">SIC — Festivales Nacionales</h3>
                <p className="text-[10px] text-muted">662 festivales · 9 estados turísticos · geocodificados</p>
              </div>
            </div>
            <button
              onClick={syncSICFestivals}
              disabled={sicFestStatus.loading}
              className="w-full py-2.5 bg-orange-600 text-white rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {sicFestStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Importando festivales…
                </span>
              ) : 'Importar festivales'}
            </button>
            {sicFestStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{sicFestStatus.result}</p>}
            {sicFestStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{sicFestStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">Requiere NEXT_PUBLIC_MAPBOX_TOKEN para geocodificar</p>
          </div>

          {/* Seed turismo estatal */}
          <div className="p-5 bg-white border border-border rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-maiz/10 flex items-center justify-center text-base">🌐</div>
              <div>
                <h3 className="font-bold text-sm text-text">Semillar Turismo Estatal</h3>
                <p className="text-[10px] text-muted">19 sitios oficiales de turismo por estado — para el scraper IA</p>
              </div>
            </div>
            <button
              onClick={seedTourismSources}
              disabled={seedStatus.loading}
              className="w-full py-2.5 bg-maiz text-stone-900 rounded-xl font-bold text-xs hover:brightness-110 transition-all disabled:opacity-40"
            >
              {seedStatus.loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                  Agregando fuentes…
                </span>
              ) : 'Agregar fuentes estatales'}
            </button>
            {seedStatus.result && <p className="text-[10px] text-jade font-bold mt-1.5 text-center">{seedStatus.result}</p>}
            {seedStatus.error && <p className="text-[10px] text-rojo font-bold mt-1.5 text-center line-clamp-2">{seedStatus.error}</p>}
            <p className="text-[9px] text-muted mt-1.5 text-center">Oaxaca · Jalisco · Yucatán · Puebla · Chiapas · CDMX + más</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Fuentes */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>
              Fuentes Activas
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sources.length === 0 && <p className="text-muted text-sm italic">No hay fuentes configuradas.</p>}
            {sources.map(source => (
              <div key={source.id} className="group p-5 bg-white border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-text group-hover:text-terracota transition-colors">{source.name}</h3>
                    <p className="text-[10px] text-muted font-medium uppercase tracking-tight mt-0.5">{source.default_category}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${source.is_active ? 'bg-jade/10 text-jade' : 'bg-zinc-100 text-zinc-500'}`}>
                    {source.is_active ? '● ACTIVA' : '○ INACTIVA'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary mb-5 line-clamp-1 opacity-70">{source.base_url}</p>
                <button
                  onClick={() => triggerScraping(source.id)}
                  disabled={isCrawlRunning || !source.is_active}
                  className="w-full py-2.5 bg-terracota text-white rounded-xl font-bold text-xs shadow-sm shadow-terracota/20 hover:bg-terracota-hover hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:translate-y-0"
                >
                  {isCrawlRunning && activeCrawlSourceId === source.id ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="animate-spin h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                      Actualizando eventos…
                    </span>
                  ) : 'Actualizar ahora'}
                </button>
                {activeCrawlSourceId === source.id && !isCrawlRunning && crawlResult && (
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-jade font-bold">
                      ✓ {crawlResult.nuevos} nuevos eventos
                    </p>
                    <a href="/?view=eventos" className="text-[10px] text-terracota font-bold underline underline-offset-2">
                      Ver en mapa →
                    </a>
                  </div>
                )}
                {activeCrawlSourceId === source.id && !isCrawlRunning && crawlError && (
                  <p className="text-[10px] text-rojo font-bold text-center mt-1.5 line-clamp-2">
                    {crawlError}
                  </p>
                )}
                {isCrawlRunning && activeCrawlSourceId === source.id && crawlMessage && (
                  <p className="text-[10px] text-text-muted text-center mt-1.5 truncate">
                    {crawlMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Últimas 4 Ejecuciones */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Últimas Ejecuciones
          </h2>
          <div className="space-y-3">
            {jobs.length === 0 && <p className="text-muted text-sm italic">Sin historial.</p>}
            {jobs.slice(0, 4).map(job => (
              <div key={job.id} className="p-3.5 bg-white border border-border rounded-xl shadow-xs transition-colors hover:border-zinc-300">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-text truncate max-w-[120px]">
                    {sources.find(s => s.id === job.source_id)?.name || 'Fuente'}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${
                    job.status === 'completed' ? 'bg-jade/10 text-jade' : 
                    job.status === 'failed' ? 'bg-rojo/10 text-rojo' : 'bg-maiz/10 text-maiz'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-muted">{new Date(job.started_at).toLocaleDateString()}</span>
                  <span className="text-[10px] font-bold text-text-secondary">
                    {job.new_events} nuevos{job.failed_events > 0 && <span className="text-rojo ml-1">· {job.failed_events} err</span>}
                  </span>
                </div>
                {job.error_message && (
                  <p className="text-[9px] text-rojo mt-1.5 line-clamp-2 font-mono bg-rojo/5 rounded px-1.5 py-1">
                    {job.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Gestión de Eventos */}
      <section className="pt-8 border-t border-border">
        <div className="flex flex-col items-center mb-8">
          <h2 className="text-2xl font-display font-bold text-text">Gestión de Eventos</h2>
          <p className="text-xs text-muted mt-1 uppercase tracking-[0.2em]">Últimos descubrimientos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {recentEvents.length === 0 && (
            <div className="col-span-full py-12 text-center bg-bg-subtle border-2 border-dashed border-zinc-200 rounded-3xl">
              <p className="text-muted text-sm italic">No se han encontrado eventos recientemente.</p>
            </div>
          )}
          {recentEvents.map(event => (
            <div key={event.id} className="relative group bg-white border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
              <div className="relative h-24 bg-bg-muted overflow-hidden">
                {event.image_url ? (
                  <img src={event.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">📅</div>
                )}
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-md text-rojo hover:bg-rojo hover:text-white rounded-xl transition-all shadow-lg scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                  title="Eliminar evento"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-maiz">{event.category}</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                  <span className="text-[9px] text-muted font-bold truncate">{event.source_name}</span>
                </div>
                <h4 className="font-bold text-sm text-text leading-tight line-clamp-2 min-h-[2.5rem] mb-2">{event.title}</h4>
                <div className="flex justify-between items-center pt-2 border-t border-zinc-50">
                  <span className="text-[10px] text-muted font-medium">{new Date(event.scraped_at).toLocaleDateString()}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${event.status === 'nuevo' ? 'bg-jade/10 text-jade' : 'bg-blue-50 text-blue-600'}`}>
                    {event.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Debug Panel ──────────────────────────────────────────────── */}
      <DebugPanel />
    </div>
  );
}

// ── DebugPanel component ──────────────────────────────────────────────
function DebugPanel() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [testing, setTesting] = useState(false);

  async function runHealthCheck() {
    setLoading(true);
    try {
      const res = await fetch("/api/scraping/debug");
      setReport(await res.json());
    } catch (err) {
      setReport({ error: "No se pudo conectar con el endpoint de debug" });
    } finally {
      setLoading(false);
    }
  }

  async function runPipelineTest() {
    if (!testUrl) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/scraping/debug?testUrl=${encodeURIComponent(testUrl)}`);
      setReport(await res.json());
    } catch (err) {
      setReport({ error: "Error en test de pipeline" });
    } finally {
      setTesting(false);
    }
  }

  const checkIcon = (ok: boolean) => ok
    ? <span className="text-jade font-black">✓</span>
    : <span className="text-rojo font-black">✗</span>;

  return (
    <section className="pt-8 border-t border-border mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          Diagnóstico del Pipeline
        </h2>
        <button
          onClick={runHealthCheck}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-bold bg-bg-muted border border-border rounded-lg hover:border-zinc-400 transition-all disabled:opacity-50"
        >
          {loading ? "Verificando…" : "Verificar estado"}
        </button>
      </div>

      {/* Pipeline test input */}
      <div className="flex gap-2 mb-4">
        <input
          type="url"
          value={testUrl}
          onChange={e => setTestUrl(e.target.value)}
          placeholder="https://cultura.jalisco.gob.mx — probar URL específica"
          className="flex-1 px-3 py-2 text-xs border border-border rounded-lg bg-bg-subtle outline-none focus:border-terracota"
        />
        <button
          onClick={runPipelineTest}
          disabled={testing || !testUrl}
          className="px-3 py-2 text-xs font-bold bg-terracota text-white rounded-lg disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {testing ? "Probando…" : "Test pipeline"}
        </button>
      </div>

      {report && (
        <div className="space-y-3">
          {/* Health checks grid */}
          {report.checks && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(report.checks).map(([name, check]: [string, any]) => (
                <div key={name} className={`p-3 rounded-xl border text-xs ${check.ok ? 'border-jade/20 bg-jade/5' : 'border-rojo/20 bg-rojo/5'}`}>
                  <div className="flex items-center gap-1.5 mb-1 font-bold">
                    {checkIcon(check.ok)}
                    <span className="capitalize">{name}</span>
                    {check.latency_ms && <span className="text-muted font-normal ml-auto">{check.latency_ms}ms</span>}
                  </div>
                  <p className="text-muted text-[10px] line-clamp-2">{check.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Job failures */}
          {report.recent_failures && report.recent_failures.length > 0 && (
            <div className="p-3 rounded-xl border border-rojo/20 bg-rojo/5">
              <p className="text-xs font-bold text-rojo mb-2">Últimas fallas ({report.recent_failures.length})</p>
              {report.recent_failures.map((f: any, i: number) => (
                <div key={i} className="text-[10px] text-text-secondary mb-1 font-mono">
                  <span className="text-rojo">{f.source}</span> — {f.error}
                </div>
              ))}
            </div>
          )}

          {/* Jobs summary */}
          {report.jobs_summary && (
            <div className="flex gap-4 text-[10px] text-muted font-bold">
              <span>Total: {report.jobs_summary.total}</span>
              <span className="text-jade">✓ {report.jobs_summary.completed} completados</span>
              <span className="text-rojo">✗ {report.jobs_summary.failed} fallidos</span>
              {report.jobs_summary.running > 0 && <span className="text-maiz">◎ {report.jobs_summary.running} corriendo</span>}
            </div>
          )}

          {/* Pipeline test result */}
          {report.pipeline_test && (
            <div className="p-3 rounded-xl border border-border bg-bg-subtle">
              <p className="text-xs font-bold mb-2">Test: {report.pipeline_test.url as string}</p>
              {report.pipeline_test.fetch && (
                <div className="text-[10px] mb-2">
                  <span className="font-bold">Fetch: </span>
                  {(report.pipeline_test.fetch as any).ok
                    ? <span className="text-jade">✓ HTTP {(report.pipeline_test.fetch as any).status} · {(report.pipeline_test.fetch as any).bytes} bytes · {(report.pipeline_test.fetch as any).latency_ms}ms</span>
                    : <span className="text-rojo">✗ {(report.pipeline_test.fetch as any).error}</span>
                  }
                </div>
              )}
              {report.pipeline_test.llm && (
                <div className="text-[10px] mb-2">
                  <span className="font-bold">LLM: </span>
                  {(report.pipeline_test.llm as any).ok
                    ? <span className="text-jade">✓ {(report.pipeline_test.llm as any).events_found} eventos extraídos · {(report.pipeline_test.llm as any).latency_ms}ms</span>
                    : <span className="text-rojo">✗ {(report.pipeline_test.llm as any).error}</span>
                  }
                </div>
              )}
              {report.pipeline_test.llm?.ok && (report.pipeline_test.llm as any).raw_response?.events?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] font-bold cursor-pointer text-text-secondary">Ver eventos extraídos</summary>
                  <pre className="text-[9px] font-mono text-text-secondary mt-1 overflow-auto max-h-40 bg-bg-muted rounded p-2">
                    {JSON.stringify((report.pipeline_test.llm as any).raw_response.events, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <p className="text-[9px] text-muted">{report.timestamp}</p>
        </div>
      )}
    </section>
  );
}
