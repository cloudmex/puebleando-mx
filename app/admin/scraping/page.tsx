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
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", base_url: "", default_category: "cultura" });

  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchData();
  }, []);

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
    setIsCrawlRunning(true);
    try {
      const res = await fetch("/api/scraping/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Scraping iniciado: ${data.jobId}`);
        fetchData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Error al iniciar el scraping");
    } finally {
      setIsCrawlRunning(false);
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
        <button 
          onClick={() => setShowAddSource(true)}
          className="px-4 py-2 bg-jade text-white rounded-lg font-bold text-sm shadow-sm hover:brightness-110 transition-all"
        >
          + Nueva Fuente
        </button>
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
                  {isCrawlRunning ? 'Procesando...' : 'Actualizar ahora'}
                </button>
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
                  <span className="text-[10px] font-bold text-text-secondary">{job.new_events} nuevos</span>
                </div>
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
    </div>
  );
}
