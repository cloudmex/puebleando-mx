import { getPool } from "./db";

export type TipoNotificacion =
  | "nueva_solicitud"       // Chofer: new booking request
  | "contraoferta"          // User: chofer made counteroffer
  | "reserva_aceptada"      // Both: booking accepted
  | "reserva_confirmada"    // User: chofer confirmed 24h before
  | "reserva_cancelada"     // Both: booking cancelled
  | "reserva_completada"    // Both: trip completed
  | "nueva_calificacion"    // Both: received a rating
  | "comision_pendiente"    // Chofer: new commission created
  | "comision_vencida"      // Chofer: commission overdue
  | "cuenta_suspendida"     // Chofer: account suspended
  | "chofer_aprobado"       // Chofer: registration approved
  | "chofer_rechazado"      // Chofer: registration rejected
  | "nuevo_mensaje";        // Both: new chat message

/**
 * Create an in-app notification for a user.
 * Silently fails if the table doesn't exist yet.
 */
export async function crearNotificacion(
  userId: string,
  tipo: TipoNotificacion,
  titulo: string,
  mensaje: string,
  link?: string
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO notificaciones (user_id, tipo, titulo, mensaje, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tipo, titulo, mensaje, link || null]
    );
  } catch {
    // Table may not exist yet — silently fail
  }
}

/**
 * Notify the chofer about a new booking request
 */
export async function notificarNuevaSolicitud(choferUserId: string, reservaId: string, usuarioNombre: string) {
  await crearNotificacion(
    choferUserId,
    "nueva_solicitud",
    "Nueva solicitud de pueblear",
    `${usuarioNombre} quiere pueblear contigo`,
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify the user about a counteroffer
 */
export async function notificarContraoferta(usuarioId: string, reservaId: string, precio: number) {
  await crearNotificacion(
    usuarioId,
    "contraoferta",
    "Contraoferta recibida",
    `El chofer propone $${precio} MXN`,
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify both parties about acceptance
 */
export async function notificarAceptada(userId: string, reservaId: string, precioFinal: number) {
  await crearNotificacion(
    userId,
    "reserva_aceptada",
    "Reserva aceptada",
    `Precio acordado: $${precioFinal} MXN`,
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify the user about chofer confirmation
 */
export async function notificarConfirmada(usuarioId: string, reservaId: string) {
  await crearNotificacion(
    usuarioId,
    "reserva_confirmada",
    "Viaje confirmado",
    "Tu chofer ha confirmado el viaje",
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify about cancellation
 */
export async function notificarCancelada(userId: string, reservaId: string, motivo: string) {
  await crearNotificacion(
    userId,
    "reserva_cancelada",
    "Puebleada cancelada",
    motivo,
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify about trip completion
 */
export async function notificarCompletada(userId: string, reservaId: string) {
  await crearNotificacion(
    userId,
    "reserva_completada",
    "Viaje completado",
    "¡Califica tu experiencia!",
    `/pueblear/${reservaId}`
  );
}

/**
 * Notify about new message
 */
export async function notificarNuevoMensaje(userId: string, reservaId: string, senderName: string) {
  await crearNotificacion(
    userId,
    "nuevo_mensaje",
    "Nuevo mensaje",
    `${senderName} te envió un mensaje`,
    `/pueblear/${reservaId}`
  );
}
