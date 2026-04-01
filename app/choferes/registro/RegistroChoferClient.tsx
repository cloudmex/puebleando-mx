"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { getApiAuthHeader } from "@/lib/apiAuth";
import { ZONAS_GDL } from "@/types/choferes";
import FileUpload from "@/components/ui/FileUpload";

type Step = "codigo" | "datos" | "documentos" | "vehiculo" | "revision";

export default function RegistroChoferClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("codigo");
  const [choferId, setChoferId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Step 1: Code
  const [codigo, setCodigo] = useState("");

  // Step 2: Personal data
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [bio, setBio] = useState("");
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState("");

  // Step 3: Documents
  const [ineFrente, setIneFrente] = useState("");
  const [ineReverso, setIneReverso] = useState("");
  const [antecedentes, setAntecedentes] = useState("");
  const [licenciaFrente, setLicenciaFrente] = useState("");
  const [licenciaReverso, setLicenciaReverso] = useState("");
  const [tipoLicencia, setTipoLicencia] = useState("particular");
  const [aniosExperiencia, setAniosExperiencia] = useState(1);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);
  const [precioBase, setPrecioBase] = useState("");

  // Step 4: Vehicle
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [color, setColor] = useState("");
  const [capacidad, setCapacidad] = useState(4);
  const [fotoFrente, setFotoFrente] = useState("");
  const [fotoLateral, setFotoLateral] = useState("");
  const [fotoInterior, setFotoInterior] = useState("");
  const [tarjetaCirculacion, setTarjetaCirculacion] = useState("");
  const [seguroUrl, setSeguroUrl] = useState("");
  const [seguroVigencia, setSeguroVigencia] = useState("");

  if (loading) return <LoadingScreen />;
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
        <div className="text-center p-6">
          <h2 className="title-md mb-3">Inicia sesión para registrarte como chofer</h2>
          <button onClick={() => router.push("/auth/login?redirect=/choferes/registro")} className="btn-primary">
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  async function handleCodigoSubmit() {
    setError("");
    setSaving(true);
    try {
      const headers = await getApiAuthHeader();
      const res = await fetch("/api/choferes", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ codigo_invitacion: codigo.trim(), nombre_completo: nombre || "Pendiente", telefono: telefono || "Pendiente" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setChoferId(data.chofer.id);
      setStep("datos");
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  async function handleDatosSubmit() {
    if (!nombre.trim() || !telefono.trim()) { setError("Nombre y teléfono son obligatorios"); return; }
    setError("");
    setSaving(true);
    try {
      const headers = await getApiAuthHeader();
      await fetch(`/api/choferes/${choferId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_completo: nombre, telefono, bio, foto_url: fotoPerfilUrl || null }),
      });
      setStep("documentos");
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  async function handleDocumentosSubmit() {
    if (!ineFrente || !ineReverso || !antecedentes || !licenciaFrente || !licenciaReverso) {
      setError("Todos los documentos son obligatorios");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const headers = await getApiAuthHeader();
      await fetch(`/api/choferes/${choferId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          ine_frente_url: ineFrente,
          ine_reverso_url: ineReverso,
          antecedentes_url: antecedentes,
          licencia_frente_url: licenciaFrente,
          licencia_reverso_url: licenciaReverso,
          tipo_licencia: tipoLicencia,
          anios_experiencia: aniosExperiencia,
          zonas_cobertura: zonasSeleccionadas,
          precio_base_hora: precioBase ? Number(precioBase) : null,
        }),
      });
      setStep("vehiculo");
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  async function handleVehiculoSubmit() {
    if (!marca || !modelo || !color) { setError("Marca, modelo y color son obligatorios"); return; }
    setError("");
    setSaving(true);
    try {
      const headers = await getApiAuthHeader();
      await fetch(`/api/choferes/${choferId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          submit_for_review: true,
          vehiculo: {
            marca, modelo, anio, color, capacidad_pasajeros: capacidad,
            foto_frente_url: fotoFrente || null,
            foto_lateral_url: fotoLateral || null,
            foto_interior_url: fotoInterior || null,
            tarjeta_circulacion_url: tarjetaCirculacion || null,
            seguro_url: seguroUrl || null,
            seguro_vigencia: seguroVigencia || null,
          },
        }),
      });
      setStep("revision");
    } catch { setError("Error de conexión"); }
    finally { setSaving(false); }
  }

  function toggleZona(z: string) {
    setZonasSeleccionadas(prev =>
      prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]
    );
  }

  const stepLabels = [
    { key: "codigo", label: "1. Código" },
    { key: "datos", label: "2. Datos" },
    { key: "documentos", label: "3. Documentos" },
    { key: "vehiculo", label: "4. Vehículo" },
    { key: "revision", label: "5. Revisión" },
  ];
  const currentIdx = stepLabels.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen" style={{ paddingTop: "calc(var(--topbar-h) + 16px)", paddingBottom: "calc(var(--bottomnav-h) + 24px)" }}>
      <div className="max-w-lg mx-auto px-4">
        <h1 className="headline-md mb-2">Registro de Chofer</h1>
        <p className="body-lg mb-6" style={{ color: "var(--on-surface-variant)" }}>
          Pueblear con chofer personal — Guadalajara
        </p>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {stepLabels.map((s, i) => (
            <div key={s.key} className="flex-1 h-1 rounded-full" style={{
              background: i <= currentIdx ? "var(--primary)" : "var(--outline)",
            }} />
          ))}
        </div>
        <p className="label-sm mb-4" style={{ color: "var(--primary)" }}>
          {stepLabels[currentIdx]?.label}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--error-container)", color: "var(--error)" }}>
            {error}
          </div>
        )}

        {/* Step: Código */}
        {step === "codigo" && (
          <div className="space-y-4">
            <p className="body-lg">Ingresa tu código de invitación para comenzar el registro.</p>
            <div>
              <label className="label-sm block mb-1">Código de invitación</label>
              <input type="text" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="PBL-XXXXXX" className="input-field" style={{ textTransform: "uppercase" }} />
            </div>
            <div>
              <label className="label-sm block mb-1">Nombre completo</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre completo" className="input-field" />
            </div>
            <div>
              <label className="label-sm block mb-1">Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                placeholder="33 1234 5678" className="input-field" />
            </div>
            <button onClick={handleCodigoSubmit} disabled={!codigo.trim() || saving} className="btn-primary w-full">
              {saving ? "Validando..." : "Continuar"}
            </button>
          </div>
        )}

        {/* Step: Datos */}
        {step === "datos" && (
          <div className="space-y-4">
            <FileUpload label="Foto de perfil" bucket="choferes-fotos" value={fotoPerfilUrl}
              onChange={setFotoPerfilUrl} accept="image/*" />
            <div>
              <label className="label-sm block mb-1">Nombre completo</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-sm block mb-1">Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label-sm block mb-1">Bio / Presentación</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                placeholder="Cuéntanos sobre ti y tu experiencia..." className="input-field" />
            </div>
            <button onClick={handleDatosSubmit} disabled={saving} className="btn-primary w-full">
              {saving ? "Guardando..." : "Continuar"}
            </button>
          </div>
        )}

        {/* Step: Documentos */}
        {step === "documentos" && (
          <div className="space-y-4">
            <h3 className="title-md">Identificación</h3>
            <FileUpload label="INE frente *" bucket="choferes-docs" value={ineFrente}
              onChange={setIneFrente} accept="image/*,application/pdf" />
            <FileUpload label="INE reverso *" bucket="choferes-docs" value={ineReverso}
              onChange={setIneReverso} accept="image/*,application/pdf" />
            <FileUpload label="Antecedentes no penales *" bucket="choferes-docs" value={antecedentes}
              onChange={setAntecedentes} accept="image/*,application/pdf" />

            <h3 className="title-md mt-6">Licencia de conducir</h3>
            <FileUpload label="Licencia frente *" bucket="choferes-docs" value={licenciaFrente}
              onChange={setLicenciaFrente} accept="image/*,application/pdf" />
            <FileUpload label="Licencia reverso *" bucket="choferes-docs" value={licenciaReverso}
              onChange={setLicenciaReverso} accept="image/*,application/pdf" />
            <div>
              <label className="label-sm block mb-1">Tipo de licencia</label>
              <select value={tipoLicencia} onChange={e => setTipoLicencia(e.target.value)} className="input-field">
                <option value="particular">Particular</option>
                <option value="chofer">Chofer</option>
                <option value="federal">Federal</option>
              </select>
            </div>
            <div>
              <label className="label-sm block mb-1">Años de experiencia</label>
              <input type="number" value={aniosExperiencia} onChange={e => setAniosExperiencia(Number(e.target.value))}
                min={0} max={50} className="input-field" />
            </div>

            <h3 className="title-md mt-6">Zonas de cobertura</h3>
            <div className="flex flex-wrap gap-2">
              {ZONAS_GDL.map(z => (
                <button key={z.id} onClick={() => toggleZona(z.id)}
                  className="tag" style={{
                    background: zonasSeleccionadas.includes(z.id) ? "var(--primary)" : "var(--surface-container-high)",
                    color: zonasSeleccionadas.includes(z.id) ? "var(--on-primary)" : "var(--on-surface)",
                  }}>
                  {z.label}
                </button>
              ))}
            </div>

            <div>
              <label className="label-sm block mb-1">Precio base por hora (MXN)</label>
              <input type="number" value={precioBase} onChange={e => setPrecioBase(e.target.value)}
                placeholder="200" className="input-field" />
            </div>

            <button onClick={handleDocumentosSubmit} disabled={saving} className="btn-primary w-full">
              {saving ? "Guardando..." : "Continuar"}
            </button>
          </div>
        )}

        {/* Step: Vehículo */}
        {step === "vehiculo" && (
          <div className="space-y-4">
            <h3 className="title-md">Datos del vehículo</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-sm block mb-1">Marca</label>
                <input type="text" value={marca} onChange={e => setMarca(e.target.value)} className="input-field" placeholder="Toyota" />
              </div>
              <div>
                <label className="label-sm block mb-1">Modelo</label>
                <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} className="input-field" placeholder="Corolla" />
              </div>
              <div>
                <label className="label-sm block mb-1">Año</label>
                <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} className="input-field" />
              </div>
              <div>
                <label className="label-sm block mb-1">Color</label>
                <input type="text" value={color} onChange={e => setColor(e.target.value)} className="input-field" placeholder="Blanco" />
              </div>
            </div>
            <div>
              <label className="label-sm block mb-1">Capacidad de pasajeros</label>
              <input type="number" value={capacidad} onChange={e => setCapacidad(Number(e.target.value))}
                min={1} max={15} className="input-field" />
            </div>

            <h3 className="title-md mt-6">Fotos del vehículo</h3>
            <FileUpload label="Foto frente" bucket="choferes-fotos" value={fotoFrente}
              onChange={setFotoFrente} accept="image/*" />
            <FileUpload label="Foto lateral" bucket="choferes-fotos" value={fotoLateral}
              onChange={setFotoLateral} accept="image/*" />
            <FileUpload label="Foto interior" bucket="choferes-fotos" value={fotoInterior}
              onChange={setFotoInterior} accept="image/*" />

            <h3 className="title-md mt-6">Documentos del vehículo</h3>
            <FileUpload label="Tarjeta de circulación" bucket="choferes-docs" value={tarjetaCirculacion}
              onChange={setTarjetaCirculacion} accept="image/*,application/pdf" />
            <FileUpload label="Seguro vigente" bucket="choferes-docs" value={seguroUrl}
              onChange={setSeguroUrl} accept="image/*,application/pdf" />
            <div>
              <label className="label-sm block mb-1">Vigencia del seguro</label>
              <input type="date" value={seguroVigencia} onChange={e => setSeguroVigencia(e.target.value)} className="input-field" />
            </div>

            <button onClick={handleVehiculoSubmit} disabled={saving} className="btn-primary w-full">
              {saving ? "Enviando..." : "Enviar a revisión"}
            </button>
          </div>
        )}

        {/* Step: Revision */}
        {step === "revision" && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="headline-md mb-3">Tu registro está en revisión</h2>
            <p className="body-lg mb-6" style={{ color: "var(--on-surface-variant)" }}>
              Revisaremos tus documentos y te notificaremos cuando tu perfil esté activo.
              Esto generalmente toma de 1 a 3 días hábiles.
            </p>
            <button onClick={() => router.push("/mi-cuenta")} className="btn-primary">
              Ir a mi cuenta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: "var(--topbar-h)" }}>
      <div className="animate-pulse text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-3" style={{ background: "var(--primary-container)" }} />
        <p className="label-sm" style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    </div>
  );
}
