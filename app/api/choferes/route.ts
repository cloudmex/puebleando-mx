import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

/** GET /api/choferes — List active choferes (public) */
export async function GET(request: NextRequest) {
  try {
    const zona = request.nextUrl.searchParams.get("zona");
    const disponible = request.nextUrl.searchParams.get("disponible");

    const pool = getPool();
    if (pool) {
      let query = `
        SELECT c.*,
          json_build_object(
            'id', v.id, 'marca', v.marca, 'modelo', v.modelo, 'anio', v.anio,
            'color', v.color, 'capacidad_pasajeros', v.capacidad_pasajeros,
            'foto_frente_url', v.foto_frente_url, 'foto_lateral_url', v.foto_lateral_url,
            'foto_interior_url', v.foto_interior_url
          ) AS vehiculo
        FROM choferes c
        LEFT JOIN vehiculos v ON v.chofer_id = c.id AND v.activo = true
        WHERE c.status = 'activo'
      `;
      const params: unknown[] = [];
      let idx = 1;

      if (zona) {
        query += ` AND $${idx} = ANY(c.zonas_cobertura)`;
        params.push(zona);
        idx++;
      }
      if (disponible === "true") {
        query += ` AND c.disponible = true`;
      }

      query += ` ORDER BY c.calificacion_promedio DESC, c.total_viajes DESC`;

      const { rows } = await pool.query(query, params);
      const choferes = rows.map(sanitizeChofer);
      return NextResponse.json({ choferes });
    }

    const supabase = getSupabaseServerClient(true);
    if (!supabase) return NextResponse.json({ choferes: [] });

    let q = supabase
      .from("choferes")
      .select("*, vehiculos(*)")
      .eq("status", "activo")
      .order("calificacion_promedio", { ascending: false });

    if (zona) q = q.contains("zonas_cobertura", [zona]);
    if (disponible === "true") q = q.eq("disponible", true);

    const { data } = await q;
    const choferes = (data ?? []).map(sanitizeChofer);
    return NextResponse.json({ choferes });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/choferes — Register as chofer (requires invitation code) */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { codigo_invitacion, nombre_completo, telefono, bio } = body;

    if (!codigo_invitacion || !nombre_completo || !telefono) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const pool = getPool();
    if (pool) {
      // Validate invitation code
      const { rows: codigos } = await pool.query(
        "SELECT * FROM codigos_invitacion WHERE codigo = $1 AND activo = true AND usado_por IS NULL",
        [codigo_invitacion]
      );
      if (codigos.length === 0) {
        return NextResponse.json({ error: "Código de invitación inválido o ya usado" }, { status: 400 });
      }

      // Check not already registered
      const { rows: existing } = await pool.query(
        "SELECT id FROM choferes WHERE user_id = $1",
        [auth.userId]
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: "Ya tienes un perfil de chofer" }, { status: 409 });
      }

      // Create chofer
      const { rows } = await pool.query(
        `INSERT INTO choferes (user_id, codigo_invitacion_id, nombre_completo, telefono, bio, status)
         VALUES ($1, $2, $3, $4, $5, 'pendiente_documentos')
         RETURNING *`,
        [auth.userId, codigos[0].id, nombre_completo, telefono, bio || null]
      );

      // Mark code as used
      await pool.query(
        "UPDATE codigos_invitacion SET usado_por = $1, usado_en = now() WHERE id = $2",
        [auth.userId, codigos[0].id]
      );

      return NextResponse.json({ chofer: rows[0] }, { status: 201 });
    }

    const supabase = getSupabaseServerClient(true);
    if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    // Validate code
    const { data: codigoData } = await supabase
      .from("codigos_invitacion")
      .select("*")
      .eq("codigo", codigo_invitacion)
      .eq("activo", true)
      .is("usado_por", null)
      .single();

    if (!codigoData) {
      return NextResponse.json({ error: "Código de invitación inválido o ya usado" }, { status: 400 });
    }

    // Check existing
    const { data: existingData } = await supabase
      .from("choferes")
      .select("id")
      .eq("user_id", auth.userId)
      .single();

    if (existingData) {
      return NextResponse.json({ error: "Ya tienes un perfil de chofer" }, { status: 409 });
    }

    const { data: chofer, error } = await supabase
      .from("choferes")
      .insert({
        user_id: auth.userId,
        codigo_invitacion_id: codigoData.id,
        nombre_completo,
        telefono,
        bio: bio || null,
        status: "pendiente_documentos",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mark code used
    await supabase
      .from("codigos_invitacion")
      .update({ usado_por: auth.userId, usado_en: new Date().toISOString() })
      .eq("id", codigoData.id);

    return NextResponse.json({ chofer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Strip sensitive fields from chofer data */
function sanitizeChofer(row: Record<string, unknown>) {
  return {
    id: row.id,
    nombre_completo: row.nombre_completo,
    foto_url: row.foto_url,
    bio: row.bio,
    tipo_licencia: row.tipo_licencia,
    anios_experiencia: row.anios_experiencia,
    zonas_cobertura: row.zonas_cobertura,
    precio_base_hora: row.precio_base_hora,
    calificacion_promedio: row.calificacion_promedio,
    total_viajes: row.total_viajes,
    total_calificaciones: row.total_calificaciones,
    disponible: row.disponible,
    disponibilidad_notas: row.disponibilidad_notas,
    vehiculo: row.vehiculo || (Array.isArray(row.vehiculos) ? row.vehiculos[0] : null),
  };
}
