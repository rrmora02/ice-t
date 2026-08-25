/**
 * Fechas calculadas en la zona horaria del NEGOCIO, no en la del servidor.
 *
 * El servidor de producción corre en UTC. Usar `new Date().toISOString()`
 * para saber "qué día es hoy" funciona hasta que la diferencia horaria
 * cruza la medianoche: en México (UTC-6), a las 18:00 locales el servidor
 * ya cree que es el día siguiente, deja de encontrar las ventas del día y
 * el corte de "Ventas de hoy" se va a cero. Por eso el día se resuelve
 * siempre contra `businesses.timezone`.
 */

/** Fecha actual (YYYY-MM-DD) en la zona horaria indicada. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  try {
    // "en-CA" formatea como YYYY-MM-DD, que es justo lo que espera Postgres.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Una zona horaria inválida guardada en el negocio no debe tumbar el
    // dashboard entero; se degrada a UTC.
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Suma (o resta, con días negativos) días a una fecha YYYY-MM-DD.
 *
 * La aritmética se hace en UTC sobre una fecha sin hora a propósito: así
 * un cambio de horario de verano no puede desplazar el resultado un día.
 */
export function shiftISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}
