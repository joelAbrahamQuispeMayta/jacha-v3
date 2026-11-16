// Utilidades compartidas: errores, validaciones y datos adaptados a Bolivia.

/** Error con código HTTP para responder al cliente con un mensaje claro */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Envuelve rutas async para que cualquier error llegue al manejador global (Express 4 no lo hace solo) */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Texto limpio: recorta espacios y limita el largo. Devuelve '' si no es texto. */
export function texto(v, max = 255) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

/** Entero positivo desde un parámetro de URL (o lanza 400) */
export function idParam(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identificador inválido');
  return n;
}

export const emailValido = (e) =>
  typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/**
 * Celulares de Bolivia: 8 dígitos, empiezan con 6 o 7  → +591 7XXXXXXX
 * Fijos (El Alto/La Paz: 2XXXXXXX) también se aceptan.
 * Turistas: cualquier número internacional que empiece con "+" (7 a 15 dígitos).
 * Devuelve el número normalizado "+591XXXXXXXX", o null si no es válido.
 */
export function normalizarTelefono(input) {
  if (input === undefined || input === null) return null;
  let s = String(input).trim();
  if (!s) return null;
  const tienePlus = s.startsWith('+') || s.startsWith('00');
  let d = s.replace(/\D/g, '');
  if (s.startsWith('00')) d = d.slice(2);

  if (!tienePlus) {
    if (/^[67]\d{7}$/.test(d)) return '+591' + d;           // celular boliviano
    if (/^[2-4]\d{7}$/.test(d)) return '+591' + d;           // fijo boliviano
    if (/^591[2-467]\d{7}$/.test(d)) return '+' + d;         // 591 sin el "+"
    return null;
  }
  if (d.startsWith('591')) return /^591[2-467]\d{7}$/.test(d) ? '+' + d : null;
  return d.length >= 7 && d.length <= 15 ? '+' + d : null;    // otros países
}

/** "+59171234567" → "+591 7123 4567" (solo para mostrar) */
export function formatearTelefono(t) {
  const m = /^\+591(\d{4})(\d{4})$/.exec(t || '');
  return m ? `+591 ${m[1]} ${m[2]}` : t || '';
}

/** Fecha de hoy en Bolivia (America/La_Paz) como "YYYY-MM-DD" */
export function hoyBolivia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** ¿Es una fecha real con formato YYYY-MM-DD? */
export function fechaValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Código visible de una reserva: JCH-00012 */
export const codigoReserva = (id) => 'JCH-' + String(id).padStart(5, '0');

/** Agrega el código a una fila de reserva */
export const conCodigo = (r) => (r ? { ...r, codigo: codigoReserva(r.id) } : r);

/** Rectángulo aproximado de Bolivia: sirve para detectar latitud/longitud invertidas */
export const BOLIVIA_BBOX = { latMin: -22.95, latMax: -9.6, lngMin: -69.7, lngMax: -57.4 };

export function contrasenaFuerte(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
}
export const MSG_CONTRASENA = 'La contraseña debe tener al menos 8 caracteres, con letras y números';
