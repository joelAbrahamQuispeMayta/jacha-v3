// Sesión de ADMINISTRADORES  →  /api/auth/*
// (Los clientes usan /api/clientes/*, con tokens de rol distinto)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { firmarToken, requireAdmin } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ah, HttpError, texto, contrasenaFuerte, MSG_CONTRASENA } from '../utils/helpers.js';

const r = Router();

// Hash falso para gastar el mismo tiempo cuando el usuario no existe (evita adivinar usuarios por tiempo de respuesta)
const HASH_FALSO = bcrypt.hashSync('no-existe', 10);

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  mensaje: 'Demasiados intentos fallidos. Espera 15 minutos.',
  key: (req) => `${req.ip}|${texto(req.body?.username, 60).toLowerCase()}`,
});

// POST /api/auth/login
r.post('/login', limitarLogin, ah(async (req, res) => {
  const username = texto(req.body?.username, 60);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) throw new HttpError(400, 'Usuario y contraseña obligatorios');

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : HASH_FALSO);
  if (!user || !ok || user.rol !== 'admin') throw new HttpError(401, 'Usuario o contraseña incorrectos');

  const token = firmarToken(
    { id: user.id, username: user.username, rol: 'admin' },
    process.env.JWT_EXPIRES || '12h'
  );
  res.json({ token, username: user.username });
}));

// GET /api/auth/me  (ahora SÍ valida el token)
r.get('/me', requireAdmin, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, rol: req.user.rol });
});

// POST /api/auth/password  → cambiar contraseña del admin
r.post('/password', requireAdmin, ah(async (req, res) => {
  const actual = typeof req.body?.actual === 'string' ? req.body.actual : '';
  const nueva = req.body?.nueva;
  if (!contrasenaFuerte(nueva)) throw new HttpError(400, MSG_CONTRASENA);

  const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  const hash = await bcrypt.hash(nueva, 10);
  await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ ok: true });
}));

export default r;
