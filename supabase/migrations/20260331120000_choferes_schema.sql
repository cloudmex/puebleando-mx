-- =============================================
-- MIGRATION: Pueblear con Chofer Personal
-- Full schema for choferes system
-- =============================================

-- ── Códigos de invitación ──
CREATE TABLE IF NOT EXISTS codigos_invitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  creado_por UUID REFERENCES auth.users(id),
  usado_por UUID REFERENCES auth.users(id),
  usado_en TIMESTAMPTZ,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Enum: chofer_status ──
DO $$ BEGIN
  CREATE TYPE chofer_status AS ENUM (
    'pendiente_documentos','en_revision','activo','suspendido','rechazado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Choferes ──
CREATE TABLE IF NOT EXISTS choferes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_invitacion_id UUID REFERENCES codigos_invitacion(id),
  status chofer_status DEFAULT 'pendiente_documentos',
  nombre_completo TEXT NOT NULL,
  telefono TEXT NOT NULL,
  foto_url TEXT,
  bio TEXT,
  ine_frente_url TEXT,
  ine_reverso_url TEXT,
  antecedentes_url TEXT,
  licencia_frente_url TEXT,
  licencia_reverso_url TEXT,
  tipo_licencia TEXT,
  anios_experiencia INTEGER DEFAULT 0,
  zonas_cobertura TEXT[] DEFAULT '{}',
  precio_base_hora NUMERIC(10,2),
  calificacion_promedio NUMERIC(3,2) DEFAULT 0,
  total_viajes INTEGER DEFAULT 0,
  total_calificaciones INTEGER DEFAULT 0,
  disponible BOOLEAN DEFAULT false,
  disponibilidad_notas TEXT,
  admin_nota TEXT,
  revisado_por UUID REFERENCES auth.users(id),
  revisado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Vehículos ──
CREATE TABLE IF NOT EXISTS vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID NOT NULL REFERENCES choferes(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  anio INTEGER NOT NULL,
  color TEXT NOT NULL,
  placas TEXT,
  capacidad_pasajeros INTEGER DEFAULT 4,
  foto_frente_url TEXT,
  foto_lateral_url TEXT,
  foto_interior_url TEXT,
  tarjeta_circulacion_url TEXT,
  seguro_url TEXT,
  seguro_vigencia DATE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Enum: reserva_status ──
DO $$ BEGIN
  CREATE TYPE reserva_status AS ENUM (
    'pendiente','contraoferta','aceptada','confirmada',
    'en_curso','completada','cancelada','expirada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Reservas ──
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  chofer_id UUID NOT NULL REFERENCES choferes(id),
  vehiculo_id UUID REFERENCES vehiculos(id),
  status reserva_status DEFAULT 'pendiente',
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracion_horas INTEGER NOT NULL DEFAULT 4,
  num_pasajeros INTEGER NOT NULL DEFAULT 1,
  punto_recogida TEXT,
  punto_entrega TEXT,
  destinos TEXT[] DEFAULT '{}',
  notas TEXT,
  usuario_foto_url TEXT,
  usuario_ine_url TEXT,
  precio_propuesto NUMERIC(10,2) NOT NULL,
  precio_contraoferta NUMERIC(10,2),
  precio_final NUMERIC(10,2),
  comision_porcentaje NUMERIC(5,2) DEFAULT 12.00,
  comision_monto NUMERIC(10,2),
  cancelado_por UUID REFERENCES auth.users(id),
  motivo_cancelacion TEXT,
  aceptada_en TIMESTAMPTZ,
  confirmada_en TIMESTAMPTZ,
  iniciada_en TIMESTAMPTZ,
  completada_en TIMESTAMPTZ,
  cancelada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Notificaciones ──
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

-- ── Mensajes ──
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
  autor_id UUID NOT NULL REFERENCES auth.users(id),
  destinatario_id UUID NOT NULL REFERENCES auth.users(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('usuario_a_chofer', 'chofer_a_usuario')),
  puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reserva_id, tipo)
);

-- ── Enum: comision_status ──
DO $$ BEGIN
  CREATE TYPE comision_status AS ENUM ('pendiente', 'pagada', 'vencida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Comisiones ──
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

-- ── Precios sugeridos ──
CREATE TABLE IF NOT EXISTS precios_sugeridos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona TEXT NOT NULL,
  duracion_horas INTEGER NOT NULL,
  precio_min NUMERIC(10,2) NOT NULL,
  precio_max NUMERIC(10,2) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true
);

-- Seed precios (only if table is empty)
INSERT INTO precios_sugeridos (zona, duracion_horas, precio_min, precio_max, descripcion)
SELECT * FROM (VALUES
  ('centro', 4, 800.00, 1200.00, 'Guadalajara centro y alrededores cercanos — medio día'),
  ('centro', 6, 1200.00, 1800.00, 'Guadalajara centro y alrededores cercanos — día parcial'),
  ('centro', 8, 1600.00, 2400.00, 'Guadalajara centro y alrededores cercanos — día completo'),
  ('periferia', 4, 1000.00, 1500.00, 'Zapopan, Tlaquepaque, Tonalá — medio día'),
  ('periferia', 6, 1500.00, 2200.00, 'Zapopan, Tlaquepaque, Tonalá — día parcial'),
  ('periferia', 8, 2000.00, 3000.00, 'Zapopan, Tlaquepaque, Tonalá — día completo'),
  ('foraneo', 4, 1500.00, 2200.00, 'Chapala, Tequila, Tapalpa — medio día'),
  ('foraneo', 6, 2200.00, 3200.00, 'Chapala, Tequila, Tapalpa — día parcial'),
  ('foraneo', 8, 2800.00, 4200.00, 'Chapala, Tequila, Tapalpa — día completo')
) AS v(zona, duracion_horas, precio_min, precio_max, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM precios_sugeridos LIMIT 1);

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
CREATE INDEX IF NOT EXISTS idx_notificaciones_user ON notificaciones(user_id, leida);

-- ── RLS ──
ALTER TABLE choferes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_sugeridos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- Policies (using DO blocks to avoid errors if they already exist)
DO $$ BEGIN
  CREATE POLICY choferes_public_read ON choferes FOR SELECT USING (status = 'activo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY choferes_own_read ON choferes FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY choferes_own_update ON choferes FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY choferes_insert ON choferes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY vehiculos_public_read ON vehiculos FOR SELECT
    USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND (choferes.status = 'activo' OR choferes.user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY vehiculos_own_insert ON vehiculos FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND choferes.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY vehiculos_own_update ON vehiculos FOR UPDATE
    USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = vehiculos.chofer_id AND choferes.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY reservas_usuario ON reservas FOR SELECT USING (auth.uid() = usuario_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY reservas_chofer ON reservas FOR SELECT
    USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = reservas.chofer_id AND choferes.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY reservas_insert ON reservas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY reservas_update_usuario ON reservas FOR UPDATE USING (auth.uid() = usuario_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY reservas_update_chofer ON reservas FOR UPDATE
    USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = reservas.chofer_id AND choferes.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mensajes_read ON mensajes FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM reservas r LEFT JOIN choferes c ON c.id = r.chofer_id
      WHERE r.id = mensajes.reserva_id AND (r.usuario_id = auth.uid() OR c.user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY mensajes_insert ON mensajes FOR INSERT
    WITH CHECK (auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM reservas r LEFT JOIN choferes c ON c.id = r.chofer_id
      WHERE r.id = mensajes.reserva_id AND (r.usuario_id = auth.uid() OR c.user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY calificaciones_read ON calificaciones FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY calificaciones_insert ON calificaciones FOR INSERT WITH CHECK (auth.uid() = autor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY comisiones_own ON comisiones FOR SELECT
    USING (EXISTS (SELECT 1 FROM choferes WHERE choferes.id = comisiones.chofer_id AND choferes.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY codigos_admin ON codigos_invitacion FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND trust_level = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY precios_public ON precios_sugeridos FOR SELECT USING (activo = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY notificaciones_own ON notificaciones FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Triggers ──
CREATE OR REPLACE FUNCTION actualizar_calificacion_chofer()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE choferes SET
    calificacion_promedio = (
      SELECT COALESCE(AVG(puntuacion), 0) FROM calificaciones
      WHERE destinatario_id = (SELECT user_id FROM choferes WHERE id = NEW.destinatario_id)
      AND tipo = 'usuario_a_chofer'
    ),
    total_calificaciones = (
      SELECT COUNT(*) FROM calificaciones
      WHERE destinatario_id = (SELECT user_id FROM choferes WHERE id = NEW.destinatario_id)
      AND tipo = 'usuario_a_chofer'
    )
  WHERE user_id = NEW.destinatario_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_calificacion ON calificaciones;
CREATE TRIGGER trg_actualizar_calificacion
  AFTER INSERT ON calificaciones
  FOR EACH ROW
  WHEN (NEW.tipo = 'usuario_a_chofer')
  EXECUTE FUNCTION actualizar_calificacion_chofer();

CREATE OR REPLACE FUNCTION crear_comision_reserva()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completada' AND OLD.status != 'completada' THEN
    INSERT INTO comisiones (chofer_id, reserva_id, monto, fecha_limite)
    VALUES (
      NEW.chofer_id, NEW.id,
      COALESCE(NEW.precio_final, NEW.precio_propuesto) * (NEW.comision_porcentaje / 100),
      (NEW.completada_en::date + INTERVAL '15 days')::date
    );
    UPDATE choferes SET total_viajes = total_viajes + 1 WHERE id = NEW.chofer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crear_comision ON reservas;
CREATE TRIGGER trg_crear_comision
  AFTER UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION crear_comision_reserva();
