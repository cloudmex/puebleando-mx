-- =============================================
-- SCHEMA: Pueblear con Chofer Personal
-- Choferes, vehículos, reservas, negociación,
-- mensajería, calificaciones, comisiones
-- =============================================

-- ── Códigos de invitación para registro de choferes ──
CREATE TABLE IF NOT EXISTS codigos_invitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  creado_por UUID REFERENCES auth.users(id),
  usado_por UUID REFERENCES auth.users(id),
  usado_en TIMESTAMPTZ,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Perfil del chofer ──
CREATE TYPE chofer_status AS ENUM (
  'pendiente_documentos',
  'en_revision',
  'activo',
  'suspendido',
  'rechazado'
);

CREATE TABLE IF NOT EXISTS choferes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_invitacion_id UUID REFERENCES codigos_invitacion(id),
  status chofer_status DEFAULT 'pendiente_documentos',

  -- Datos personales
  nombre_completo TEXT NOT NULL,
  telefono TEXT NOT NULL,
  foto_url TEXT,
  bio TEXT,

  -- Documentos
  ine_frente_url TEXT,
  ine_reverso_url TEXT,
  antecedentes_url TEXT,

  -- Licencia
  licencia_frente_url TEXT,
  licencia_reverso_url TEXT,
  tipo_licencia TEXT, -- 'particular', 'chofer', 'federal'
  anios_experiencia INTEGER DEFAULT 0,

  -- Zonas y precios
  zonas_cobertura TEXT[] DEFAULT '{}', -- e.g. {'centro','zapopan','tlaquepaque','tonala','chapala','tequila'}
  precio_base_hora NUMERIC(10,2),     -- precio sugerido por hora

  -- Calificación
  calificacion_promedio NUMERIC(3,2) DEFAULT 0,
  total_viajes INTEGER DEFAULT 0,
  total_calificaciones INTEGER DEFAULT 0,

  -- Disponibilidad
  disponible BOOLEAN DEFAULT false,
  disponibilidad_notas TEXT,

  -- Admin
  admin_nota TEXT,
  revisado_por UUID REFERENCES auth.users(id),
  revisado_en TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Vehículo del chofer ──
CREATE TABLE IF NOT EXISTS vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  anio INTEGER NOT NULL,
  color TEXT NOT NULL,
  placas TEXT,
  capacidad_pasajeros INTEGER DEFAULT 4,

  -- Fotos
  foto_frente_url TEXT,
  foto_lateral_url TEXT,
  foto_interior_url TEXT,

  -- Documentos
  tarjeta_circulacion_url TEXT,
  seguro_url TEXT,
  seguro_vigencia DATE,

  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Reservas (Pueblear) ──
CREATE TYPE reserva_status AS ENUM (
  'pendiente',        -- usuario envió solicitud
  'contraoferta',     -- chofer hizo contraoferta
  'aceptada',         -- ambas partes de acuerdo
  'confirmada',       -- chofer confirmó 24h antes
  'en_curso',         -- viaje en progreso
  'completada',       -- viaje terminado
  'cancelada',        -- cancelada por alguna parte
  'expirada'          -- no se respondió a tiempo
);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  chofer_id UUID NOT NULL REFERENCES choferes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  status reserva_status DEFAULT 'pendiente',

  -- Detalles del viaje
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracion_horas INTEGER NOT NULL DEFAULT 4,  -- 4, 6, 8 horas
  num_pasajeros INTEGER NOT NULL DEFAULT 1,
  punto_recogida TEXT NOT NULL,               -- dirección o punto de recogida
  punto_entrega TEXT,                         -- dirección o punto de entrega (null = mismo que recogida)
  destinos TEXT[] DEFAULT '{}',               -- lugares a visitar
  notas TEXT,                                 -- notas adicionales del usuario

  -- Verificación del usuario
  usuario_foto_url TEXT,
  usuario_ine_url TEXT,

  -- Negociación de precio
  precio_propuesto NUMERIC(10,2) NOT NULL,    -- precio que propone el usuario
  precio_contraoferta NUMERIC(10,2),          -- contraoferta del chofer
  precio_final NUMERIC(10,2),                 -- precio acordado

  -- Comisión
  comision_porcentaje NUMERIC(5,2) DEFAULT 12.00,
  comision_monto NUMERIC(10,2),

  -- Cancelación
  cancelado_por UUID REFERENCES auth.users(id),
  motivo_cancelacion TEXT,

  -- Timestamps
  aceptada_en TIMESTAMPTZ,
  confirmada_en TIMESTAMPTZ,
  iniciada_en TIMESTAMPTZ,
  completada_en TIMESTAMPTZ,
  cancelada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Notificaciones in-app ──
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  link TEXT,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id, leida);

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificaciones_own ON notificaciones FOR ALL USING (auth.uid() = user_id);

-- ── Mensajes (chat entre usuario y chofer) ──
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  contenido TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Calificaciones ──
CREATE TABLE IF NOT EXISTS calificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id),
  autor_id UUID NOT NULL REFERENCES auth.users(id),     -- quien califica
  destinatario_id UUID NOT NULL REFERENCES auth.users(id), -- quien recibe
  tipo TEXT NOT NULL CHECK (tipo IN ('usuario_a_chofer', 'chofer_a_usuario')),
  puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reserva_id, tipo)  -- solo una calificación por tipo por reserva
);

-- ── Comisiones ──
CREATE TYPE comision_status AS ENUM ('pendiente', 'pagada', 'vencida');

CREATE TABLE IF NOT EXISTS comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID NOT NULL REFERENCES choferes(id),
  reserva_id UUID NOT NULL REFERENCES reservas(id),
  monto NUMERIC(10,2) NOT NULL,
  status comision_status DEFAULT 'pendiente',
  fecha_limite DATE,
  pagada_en TIMESTAMPTZ,
  referencia_pago TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Rangos de precio sugeridos por zona/duración ──
CREATE TABLE IF NOT EXISTS precios_sugeridos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona TEXT NOT NULL,           -- 'centro', 'periferia', 'foraneo'
  duracion_horas INTEGER NOT NULL,
  precio_min NUMERIC(10,2) NOT NULL,
  precio_max NUMERIC(10,2) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

-- Seed precios sugeridos para Guadalajara
INSERT INTO precios_sugeridos (zona, duracion_horas, precio_min, precio_max, descripcion) VALUES
  ('centro', 4, 800, 1200, 'Guadalajara centro y alrededores cercanos — medio día'),
  ('centro', 6, 1200, 1800, 'Guadalajara centro y alrededores cercanos — día parcial'),
  ('centro', 8, 1600, 2400, 'Guadalajara centro y alrededores cercanos — día completo'),
  ('periferia', 4, 1000, 1500, 'Zapopan, Tlaquepaque, Tonalá — medio día'),
  ('periferia', 6, 1500, 2200, 'Zapopan, Tlaquepaque, Tonalá — día parcial'),
  ('periferia', 8, 2000, 3000, 'Zapopan, Tlaquepaque, Tonalá — día completo'),
  ('foraneo', 4, 1500, 2200, 'Chapala, Tequila, Tapalpa — medio día'),
  ('foraneo', 6, 2200, 3200, 'Chapala, Tequila, Tapalpa — día parcial'),
  ('foraneo', 8, 2800, 4200, 'Chapala, Tequila, Tapalpa — día completo');

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_choferes_user_id ON choferes(user_id);
CREATE INDEX IF NOT EXISTS idx_choferes_status ON choferes(status);
CREATE INDEX IF NOT EXISTS idx_vehiculos_chofer_id ON vehiculos(chofer_id);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_id ON reservas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reservas_chofer_id ON reservas(chofer_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_mensajes_reserva_id ON mensajes(reserva_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_chofer_id ON comisiones(chofer_id);
CREATE INDEX IF NOT EXISTS idx_comisiones_status ON comisiones(status);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_codigo ON codigos_invitacion(codigo);

-- ── RLS Policies ──
ALTER TABLE choferes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_sugeridos ENABLE ROW LEVEL SECURITY;

-- Choferes: públicos si activos, propietario puede editar
CREATE POLICY choferes_public_read ON choferes FOR SELECT USING (status = 'activo');
CREATE POLICY choferes_own_read ON choferes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY choferes_own_update ON choferes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY choferes_insert ON choferes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Vehículos: públicos si chofer activo, propietario puede editar
CREATE POLICY vehiculos_public_read ON vehiculos FOR SELECT
  USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND (choferes.status = 'activo' OR choferes.user_id = auth.uid())));
CREATE POLICY vehiculos_own_insert ON vehiculos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND choferes.user_id = auth.uid()));
CREATE POLICY vehiculos_own_update ON vehiculos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND choferes.user_id = auth.uid()));

-- Reservas: solo participantes
CREATE POLICY reservas_usuario ON reservas FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY reservas_chofer ON reservas FOR SELECT
  USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = reservas.chofer_id AND choferes.user_id = auth.uid()));
CREATE POLICY reservas_insert ON reservas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY reservas_update_usuario ON reservas FOR UPDATE USING (auth.uid() = usuario_id);
CREATE POLICY reservas_update_chofer ON reservas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = reservas.chofer_id AND choferes.user_id = auth.uid()));

-- Mensajes: solo participantes de la reserva
CREATE POLICY mensajes_read ON mensajes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM reservas r
    LEFT JOIN choferes c ON c.id = r.chofer_id
    WHERE r.id = mensajes.reserva_id
    AND (r.usuario_id = auth.uid() OR c.user_id = auth.uid())
  ));
CREATE POLICY mensajes_insert ON mensajes FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM reservas r
    LEFT JOIN choferes c ON c.id = r.chofer_id
    WHERE r.id = mensajes.reserva_id
    AND (r.usuario_id = auth.uid() OR c.user_id = auth.uid())
  ));

-- Calificaciones: públicas para leer, solo autor puede crear
CREATE POLICY calificaciones_read ON calificaciones FOR SELECT USING (true);
CREATE POLICY calificaciones_insert ON calificaciones FOR INSERT WITH CHECK (auth.uid() = autor_id);

-- Comisiones: solo el chofer ve las suyas
CREATE POLICY comisiones_own ON comisiones FOR SELECT
  USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = comisiones.chofer_id AND choferes.user_id = auth.uid()));

-- Códigos de invitación: solo admin puede ver/crear
CREATE POLICY codigos_admin ON codigos_invitacion FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND trust_level = 'admin')
);

-- Precios sugeridos: públicos
CREATE POLICY precios_public ON precios_sugeridos FOR SELECT USING (activo = true);

-- ── Trigger: actualizar calificación promedio del chofer ──
CREATE OR REPLACE FUNCTION actualizar_calificacion_chofer()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE choferes SET
    calificacion_promedio = (
      SELECT COALESCE(AVG(puntuacion), 0)
      FROM calificaciones
      WHERE destinatario_id = (SELECT user_id FROM choferes WHERE id = NEW.destinatario_id)
      AND tipo = 'usuario_a_chofer'
    ),
    total_calificaciones = (
      SELECT COUNT(*)
      FROM calificaciones
      WHERE destinatario_id = (SELECT user_id FROM choferes WHERE id = NEW.destinatario_id)
      AND tipo = 'usuario_a_chofer'
    )
  WHERE user_id = NEW.destinatario_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actualizar_calificacion
  AFTER INSERT ON calificaciones
  FOR EACH ROW
  WHEN (NEW.tipo = 'usuario_a_chofer')
  EXECUTE FUNCTION actualizar_calificacion_chofer();

-- ── Trigger: crear comisión al completar reserva ──
CREATE OR REPLACE FUNCTION crear_comision_reserva()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completada' AND OLD.status != 'completada' THEN
    INSERT INTO comisiones (chofer_id, reserva_id, monto, fecha_limite)
    VALUES (
      NEW.chofer_id,
      NEW.id,
      COALESCE(NEW.precio_final, NEW.precio_propuesto) * (NEW.comision_porcentaje / 100),
      (NEW.completada_en::date + INTERVAL '15 days')::date
    );
    -- Update chofer total_viajes
    UPDATE choferes SET total_viajes = total_viajes + 1 WHERE id = NEW.chofer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crear_comision
  AFTER UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION crear_comision_reserva();
