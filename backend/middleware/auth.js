import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SECRET = () => process.env.JWT_SECRET;

/** Crea un token. rol = 'admin' | 'cliente' */
export function firmarToken(payload, expiresIn) {
  return jwt.sign(payload, SECRET(), { expiresIn, issuer: 'jacha-tours' });
}

function leerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function verificar(token) {
  return jwt.verify(token, SECRET(), { issuer: 'jacha-tours' });
}

/** Exige un token válido, de cualquier rol */
export function requireAuth(req, res, next) {
  const token = leerToken(req);
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión' });
  try {
    req.user = verificar(token);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o vencida. Ingresa de nuevo.' });
  }
}

/** Solo administradores */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Acceso solo para administradores' });
    next();
  });
}

/** Solo clientes con cuenta */
export function requireCliente(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'cliente') return res.status(403).json({ error: 'Acceso solo para clientes' });
    next();
  });
}

/** Si hay token válido lo lee (req.user), si no, sigue como invitado */
export function optionalAuth(req, res, next) {
  const token = leerToken(req);
  if (token) {
    try { req.user = verificar(token); } catch { /* token malo = invitado */ }
  }
  next();
}
