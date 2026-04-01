// ── Chofer system types ──

export type ChoferStatus =
  | 'pendiente_documentos'
  | 'en_revision'
  | 'activo'
  | 'suspendido'
  | 'rechazado';

export interface Chofer {
  id: string;
  user_id: string;
  status: ChoferStatus;
  nombre_completo: string;
  telefono: string;
  foto_url?: string;
  bio?: string;

  // Documents (URLs)
  ine_frente_url?: string;
  ine_reverso_url?: string;
  antecedentes_url?: string;
  licencia_frente_url?: string;
  licencia_reverso_url?: string;
  tipo_licencia?: string;
  anios_experiencia: number;

  // Coverage & pricing
  zonas_cobertura: string[];
  precio_base_hora?: number;

  // Ratings
  calificacion_promedio: number;
  total_viajes: number;
  total_calificaciones: number;

  // Availability
  disponible: boolean;
  disponibilidad_notas?: string;

  // Admin
  admin_nota?: string;

  created_at: string;
  updated_at: string;
}

/** Public-facing chofer profile (no sensitive docs) */
export interface ChoferPublico {
  id: string;
  nombre_completo: string;
  foto_url?: string;
  bio?: string;
  tipo_licencia?: string;
  anios_experiencia: number;
  zonas_cobertura: string[];
  precio_base_hora?: number;
  calificacion_promedio: number;
  total_viajes: number;
  total_calificaciones: number;
  disponible: boolean;
  disponibilidad_notas?: string;
  vehiculo?: VehiculoPublico;
}

export interface Vehiculo {
  id: string;
  chofer_id: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  placas?: string;
  capacidad_pasajeros: number;
  foto_frente_url?: string;
  foto_lateral_url?: string;
  foto_interior_url?: string;
  tarjeta_circulacion_url?: string;
  seguro_url?: string;
  seguro_vigencia?: string;
  activo: boolean;
  created_at: string;
}

export interface VehiculoPublico {
  id: string;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  capacidad_pasajeros: number;
  foto_frente_url?: string;
  foto_lateral_url?: string;
  foto_interior_url?: string;
}

// ── Reservas ──

export type ReservaStatus =
  | 'pendiente'
  | 'contraoferta'
  | 'aceptada'
  | 'confirmada'
  | 'en_curso'
  | 'completada'
  | 'cancelada'
  | 'expirada';

export interface Reserva {
  id: string;
  usuario_id: string;
  chofer_id: string;
  vehiculo_id?: string;
  status: ReservaStatus;

  fecha: string;         // YYYY-MM-DD
  hora_inicio: string;   // HH:MM
  duracion_horas: number;
  num_pasajeros: number;
  punto_recogida: string;
  punto_entrega?: string;
  destinos: string[];
  notas?: string;

  usuario_foto_url?: string;
  usuario_ine_url?: string;

  precio_propuesto: number;
  precio_contraoferta?: number;
  precio_final?: number;

  comision_porcentaje: number;
  comision_monto?: number;

  cancelado_por?: string;
  motivo_cancelacion?: string;

  aceptada_en?: string;
  confirmada_en?: string;
  iniciada_en?: string;
  completada_en?: string;
  cancelada_en?: string;
  created_at: string;
  updated_at: string;

  // Joined data (optional)
  chofer?: ChoferPublico;
  usuario_nombre?: string;
}

// ── Mensajes ──

export interface Mensaje {
  id: string;
  reserva_id: string;
  sender_id: string;
  contenido: string;
  leido: boolean;
  created_at: string;
  sender_nombre?: string;
}

// ── Calificaciones ──

export type TipoCalificacion = 'usuario_a_chofer' | 'chofer_a_usuario';

export interface Calificacion {
  id: string;
  reserva_id: string;
  autor_id: string;
  destinatario_id: string;
  tipo: TipoCalificacion;
  puntuacion: number; // 1-5
  comentario?: string;
  created_at: string;
}

// ── Comisiones ──

export type ComisionStatus = 'pendiente' | 'pagada' | 'vencida';

export interface Comision {
  id: string;
  chofer_id: string;
  reserva_id: string;
  monto: number;
  status: ComisionStatus;
  fecha_limite?: string;
  pagada_en?: string;
  referencia_pago?: string;
  created_at: string;
}

// ── Códigos de invitación ──

export interface CodigoInvitacion {
  id: string;
  codigo: string;
  creado_por?: string;
  usado_por?: string;
  usado_en?: string;
  activo: boolean;
  created_at: string;
}

// ── Precios sugeridos ──

export interface PrecioSugerido {
  id: string;
  zona: string;
  duracion_horas: number;
  precio_min: number;
  precio_max: number;
  descripcion?: string;
}

// ── Zonas de Guadalajara ──

export const ZONAS_GDL = [
  { id: 'centro', label: 'Centro de Guadalajara' },
  { id: 'zapopan', label: 'Zapopan' },
  { id: 'tlaquepaque', label: 'Tlaquepaque' },
  { id: 'tonala', label: 'Tonalá' },
  { id: 'chapala', label: 'Lago de Chapala' },
  { id: 'tequila', label: 'Tequila' },
  { id: 'tapalpa', label: 'Tapalpa' },
  { id: 'mazamitla', label: 'Mazamitla' },
  { id: 'ajijic', label: 'Ajijic' },
] as const;

export type ZonaId = (typeof ZONAS_GDL)[number]['id'];

export const DURACIONES = [
  { value: 4, label: 'Medio día (4 horas)' },
  { value: 6, label: 'Día parcial (6 horas)' },
  { value: 8, label: 'Día completo (8 horas)' },
] as const;
