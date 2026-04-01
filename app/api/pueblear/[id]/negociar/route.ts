import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getChoferByUserId } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { notificarContraoferta, notificarAceptada, notificarCancelada } from "@/lib/notificaciones";

/** POST /api/pueblear/[id]/negociar — Chofer makes counteroffer OR user accepts/rejects */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { accion, precio_contraoferta } = body;

    const pool = getPool();
    if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const { rows } = await pool.query("SELECT * FROM reservas WHERE id = $1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const reserva = rows[0];
    const chofer = await getChoferByUserId(auth.userId);
    const isChofer = chofer && String(chofer.id) === String(reserva.chofer_id);
    const isUsuario = reserva.usuario_id === auth.userId;

    if (!isChofer && !isUsuario) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Chofer makes counteroffer (only when status is 'pendiente')
    if (isChofer && accion === "contraoferta") {
      if (reserva.status !== "pendiente") {
        return NextResponse.json({ error: "Solo puedes contraofertar en reservas pendientes" }, { status: 400 });
      }
      if (!precio_contraoferta || precio_contraoferta <= 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }

      await pool.query(
        `UPDATE reservas SET
          status = 'contraoferta',
          precio_contraoferta = $1,
          updated_at = now()
        WHERE id = $2`,
        [precio_contraoferta, id]
      );
      notificarContraoferta(reserva.usuario_id, id, precio_contraoferta);
      return NextResponse.json({ ok: true, status: "contraoferta" });
    }

    // Chofer accepts original price
    if (isChofer && accion === "aceptar") {
      if (reserva.status !== "pendiente") {
        return NextResponse.json({ error: "Solo puedes aceptar reservas pendientes" }, { status: 400 });
      }
      const precioFinal = reserva.precio_propuesto;
      const comision = precioFinal * 0.12;

      await pool.query(
        `UPDATE reservas SET
          status = 'aceptada',
          precio_final = $1,
          comision_monto = $2,
          aceptada_en = now(),
          updated_at = now()
        WHERE id = $3`,
        [precioFinal, comision, id]
      );
      notificarAceptada(reserva.usuario_id, id, precioFinal);
      return NextResponse.json({ ok: true, status: "aceptada", precio_final: precioFinal });
    }

    // Chofer rejects
    if (isChofer && accion === "rechazar") {
      if (reserva.status !== "pendiente" && reserva.status !== "contraoferta") {
        return NextResponse.json({ error: "No se puede rechazar en este estado" }, { status: 400 });
      }
      await pool.query(
        `UPDATE reservas SET status = 'cancelada', cancelado_por = $1,
         motivo_cancelacion = 'Rechazada por el chofer', cancelada_en = now(), updated_at = now()
         WHERE id = $2`,
        [auth.userId, id]
      );
      notificarCancelada(reserva.usuario_id, id, "El chofer rechazó tu solicitud");
      return NextResponse.json({ ok: true, status: "cancelada" });
    }

    // User accepts counteroffer
    if (isUsuario && accion === "aceptar") {
      if (reserva.status !== "contraoferta") {
        return NextResponse.json({ error: "No hay contraoferta que aceptar" }, { status: 400 });
      }
      const precioFinal = reserva.precio_contraoferta;
      const comision = precioFinal * 0.12;

      await pool.query(
        `UPDATE reservas SET
          status = 'aceptada',
          precio_final = $1,
          comision_monto = $2,
          aceptada_en = now(),
          updated_at = now()
        WHERE id = $3`,
        [precioFinal, comision, id]
      );
      // Notify chofer
      const { rows: choferInfo } = await pool.query(
        "SELECT user_id FROM choferes WHERE id = $1", [reserva.chofer_id]
      );
      if (choferInfo[0]) notificarAceptada(choferInfo[0].user_id, id, precioFinal);
      return NextResponse.json({ ok: true, status: "aceptada", precio_final: precioFinal });
    }

    // User rejects counteroffer → reservation is cancelled (must restart)
    if (isUsuario && accion === "rechazar") {
      if (reserva.status !== "contraoferta") {
        return NextResponse.json({ error: "No hay contraoferta que rechazar" }, { status: 400 });
      }
      await pool.query(
        `UPDATE reservas SET status = 'cancelada', cancelado_por = $1,
         motivo_cancelacion = 'Usuario rechazó la contraoferta', cancelada_en = now(), updated_at = now()
         WHERE id = $2`,
        [auth.userId, id]
      );
      return NextResponse.json({ ok: true, status: "cancelada" });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
