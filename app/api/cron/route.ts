import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/**
 * POST /api/cron — Automated maintenance tasks
 * Protected by CRON_SECRET env var (set in Vercel Cron or call manually)
 *
 * Tasks:
 * 1. Expire unanswered bookings (48h without chofer response)
 * 2. Suspend choferes with overdue commissions (past fecha_limite)
 * 3. Mark overdue commissions as 'vencida'
 */
export async function POST(request: NextRequest) {
  // Validate secret
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || process.env.SEED_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const results: Record<string, number> = {};

  try {
    // 1. Expire unanswered bookings (pendiente for > 48h)
    const { rowCount: expiredBookings } = await pool.query(
      `UPDATE reservas SET
        status = 'expirada',
        updated_at = now()
      WHERE status = 'pendiente'
      AND created_at < now() - INTERVAL '48 hours'`
    );
    results.reservas_expiradas = expiredBookings ?? 0;

    // 2. Expire unanswered counteroffers (contraoferta for > 48h)
    const { rowCount: expiredCounters } = await pool.query(
      `UPDATE reservas SET
        status = 'expirada',
        updated_at = now()
      WHERE status = 'contraoferta'
      AND updated_at < now() - INTERVAL '48 hours'`
    );
    results.contraofertas_expiradas = expiredCounters ?? 0;

    // 3. Expire unconfirmed bookings (aceptada but not confirmed, and trip date is today or past)
    const { rowCount: unconfirmed } = await pool.query(
      `UPDATE reservas SET
        status = 'expirada',
        updated_at = now()
      WHERE status = 'aceptada'
      AND fecha <= CURRENT_DATE`
    );
    results.sin_confirmar_expiradas = unconfirmed ?? 0;

    // 4. Mark overdue commissions
    const { rowCount: overdueComms } = await pool.query(
      `UPDATE comisiones SET
        status = 'vencida'
      WHERE status = 'pendiente'
      AND fecha_limite < CURRENT_DATE`
    );
    results.comisiones_vencidas = overdueComms ?? 0;

    // 5. Suspend choferes with overdue commissions (any vencida commission)
    const { rowCount: suspended } = await pool.query(
      `UPDATE choferes SET
        status = 'suspendido',
        disponible = false,
        admin_nota = COALESCE(admin_nota, '') || ' Suspendido automáticamente por comisiones vencidas.',
        updated_at = now()
      WHERE status = 'activo'
      AND id IN (
        SELECT DISTINCT chofer_id FROM comisiones WHERE status = 'vencida'
      )`
    );
    results.choferes_suspendidos = suspended ?? 0;

    // 6. Reactivate choferes that paid all overdue commissions
    const { rowCount: reactivated } = await pool.query(
      `UPDATE choferes SET
        status = 'activo',
        admin_nota = COALESCE(admin_nota, '') || ' Reactivado automáticamente al liquidar comisiones.',
        updated_at = now()
      WHERE status = 'suspendido'
      AND id NOT IN (
        SELECT DISTINCT chofer_id FROM comisiones WHERE status IN ('pendiente', 'vencida')
      )
      AND admin_nota LIKE '%comisiones vencidas%'`
    );
    results.choferes_reactivados = reactivated ?? 0;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[cron] Error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

/** GET also works for Vercel Cron (which sends GET) */
export async function GET(request: NextRequest) {
  return POST(request);
}
