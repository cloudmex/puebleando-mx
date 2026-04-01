import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPool } from "@/lib/db";

/** GET /api/choferes/[id] — Get chofer profile + vehicle + ratings */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pool = getPool();
    if (pool) {
      const { rows } = await pool.query(
        `SELECT c.id, c.nombre_completo, c.foto_url, c.bio, c.tipo_licencia,
                c.anios_experiencia, c.zonas_cobertura, c.precio_base_hora,
                c.calificacion_promedio, c.total_viajes, c.total_calificaciones,
                c.disponible, c.disponibilidad_notas
         FROM choferes c WHERE c.id = $1 AND c.status = 'activo'`,
        [id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "Chofer no encontrado" }, { status: 404 });
      }

      const { rows: vehiculos } = await pool.query(
        `SELECT id, marca, modelo, anio, color, capacidad_pasajeros,
                foto_frente_url, foto_lateral_url, foto_interior_url
         FROM vehiculos WHERE chofer_id = $1 AND activo = true`,
        [id]
      );

      const { rows: calificaciones } = await pool.query(
        `SELECT cal.puntuacion, cal.comentario, cal.created_at, up.display_name as autor_nombre
         FROM calificaciones cal
         JOIN user_profiles up ON up.id = cal.autor_id
         WHERE cal.destinatario_id = (SELECT user_id FROM choferes WHERE id = $1)
         AND cal.tipo = 'usuario_a_chofer'
         ORDER BY cal.created_at DESC LIMIT 10`,
        [id]
      );

      return NextResponse.json({
        chofer: { ...rows[0], vehiculo: vehiculos[0] || null },
        calificaciones,
      });
    }

    const supabase = getSupabaseServerClient(true);
    if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { data: chofer } = await supabase
      .from("choferes")
      .select("id, nombre_completo, foto_url, bio, tipo_licencia, anios_experiencia, zonas_cobertura, precio_base_hora, calificacion_promedio, total_viajes, total_calificaciones, disponible, disponibilidad_notas, vehiculos(id, marca, modelo, anio, color, capacidad_pasajeros, foto_frente_url, foto_lateral_url, foto_interior_url)")
      .eq("id", id)
      .eq("status", "activo")
      .single();

    if (!chofer) return NextResponse.json({ error: "Chofer no encontrado" }, { status: 404 });

    return NextResponse.json({
      chofer: {
        ...chofer,
        vehiculo: Array.isArray(chofer.vehiculos) ? chofer.vehiculos[0] : null,
        vehiculos: undefined,
      },
      calificaciones: [],
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH /api/choferes/[id] — Update own chofer profile */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();

    const pool = getPool();
    if (pool) {
      // Verify ownership
      const { rows: check } = await pool.query(
        "SELECT user_id, status FROM choferes WHERE id = $1",
        [id]
      );
      if (check.length === 0 || check[0].user_id !== auth.userId) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      const allowedFields = [
        "nombre_completo", "telefono", "foto_url", "bio",
        "ine_frente_url", "ine_reverso_url", "antecedentes_url",
        "licencia_frente_url", "licencia_reverso_url", "tipo_licencia",
        "anios_experiencia", "zonas_cobertura", "precio_base_hora",
      ];

      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          sets.push(`${field} = $${idx}`);
          values.push(body[field]);
          idx++;
        }
      }

      if (sets.length === 0) {
        return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
      }

      sets.push(`updated_at = now()`);
      values.push(id);

      const { rows } = await pool.query(
        `UPDATE choferes SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      // If all required docs are present and status is pendiente_documentos, move to en_revision
      const chofer = rows[0];
      if (chofer.status === "pendiente_documentos" && body.submit_for_review) {
        const hasAllDocs = chofer.ine_frente_url && chofer.ine_reverso_url &&
          chofer.antecedentes_url && chofer.licencia_frente_url && chofer.licencia_reverso_url;
        if (hasAllDocs) {
          await pool.query(
            "UPDATE choferes SET status = 'en_revision' WHERE id = $1",
            [id]
          );
          chofer.status = "en_revision";
        }
      }

      // Handle vehicle data
      if (body.vehiculo) {
        const v = body.vehiculo;
        const { rows: existingV } = await pool.query(
          "SELECT id FROM vehiculos WHERE chofer_id = $1 AND activo = true",
          [id]
        );
        if (existingV.length > 0) {
          await pool.query(
            `UPDATE vehiculos SET marca=$1, modelo=$2, anio=$3, color=$4, capacidad_pasajeros=$5,
             foto_frente_url=$6, foto_lateral_url=$7, foto_interior_url=$8,
             tarjeta_circulacion_url=$9, seguro_url=$10, seguro_vigencia=$11
             WHERE chofer_id = $12 AND activo = true`,
            [v.marca, v.modelo, v.anio, v.color, v.capacidad_pasajeros || 4,
             v.foto_frente_url, v.foto_lateral_url, v.foto_interior_url,
             v.tarjeta_circulacion_url, v.seguro_url, v.seguro_vigencia, id]
          );
        } else {
          await pool.query(
            `INSERT INTO vehiculos (chofer_id, marca, modelo, anio, color, capacidad_pasajeros,
             foto_frente_url, foto_lateral_url, foto_interior_url,
             tarjeta_circulacion_url, seguro_url, seguro_vigencia)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [id, v.marca, v.modelo, v.anio, v.color, v.capacidad_pasajeros || 4,
             v.foto_frente_url, v.foto_lateral_url, v.foto_interior_url,
             v.tarjeta_circulacion_url, v.seguro_url, v.seguro_vigencia]
          );
        }
      }

      return NextResponse.json({ chofer });
    }

    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
