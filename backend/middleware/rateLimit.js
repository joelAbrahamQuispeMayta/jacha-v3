// Límite de intentos en memoria (sin dependencias). Suficiente para un solo servidor.
// Protege login, registro y reservas contra intentos masivos.
export function rateLimit({ windowMs, max, mensaje, key = (req) => req.ip }) {
  const hits = new Map(); // clave → { n, reset }

  const limpiar = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  limpiar.unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h); }
    h.n += 1;
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: mensaje || 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    }
    next();
  };
}
