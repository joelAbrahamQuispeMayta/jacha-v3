// Cuentas de CLIENTES  →  /api/clientes/*
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { firmarToken, requireCliente } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  ah, HttpError, texto, emailValido, normalizarTelefono,
  contrasenaFuerte, MSG_CONTRASENA, conCodigo,
} from '../utils/helpers.js';

const r = Router();
const HASH_FALSO = bcrypt.hashSync('no-existe', 10);
const EXPIRA = process.env.CLIENT_JWT_EXPIRES || '30d';

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  mensaje: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.',
  key: (req) => `${req.ip}|${texto(req.body?.email, 120).toLowerCase()}`,
});
const limitarRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8,
  mensaje: 'Se crearon demasiadas cuentas desde tu conexión. Intenta más tarde.',
});

// Datos que sí puede ver el cliente de sí mismo (nunca el hash)
const publico = (c) => ({
  id: c.id, nombre: c.nombre, email: c.email, whatsapp: c.whatsapp,
  pais: c.pais, ciudad: c.ciudad, creado_en: c.creado_en,
});
const tokenDe = (c) => firmarToken({ id: c.id, email: c.email, nombre: c.nombre, rol: 'cliente' }, EXPIRA);

// POST /api/clientes/registro
r.post('/registro', limitarRegistro, ah(async (req, res) => {
  const nombre = texto(req.body?.nombre, 120);
  const email = texto(req.body?.email, 120).toLowerCase();
  const whatsapp = normalizarTelefono(req.body?.whatsapp);
  const password = req.body?.password;
  const pais = texto(req.body?.pais, 60) || 'Bolivia';
  const ciudad = texto(req.body?.ciudad, 80);

  if (nombre.length < 3) throw new HttpError(400, 'Escribe tu nombre completo');
  if (!emailValido(email)) throw new HttpError(400, 'El correo electrónico no es válido');
  if (!whatsapp) throw new HttpError(400, 'El celular no es válido. Ejemplo: 7XXXXXXX (Bolivia) o +54911... (otro país)');
  if (!contrasenaFuerte(password)) throw new HttpError(400, MSG_CONTRASENA);

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (nombre, email, whatsapp, pais, ciudad, password_hash, ultimo_login)
       VALUES ($1,$2,$3,$4,$5,$6, now()) RETURNING *`,
      [nombre, email, whatsapp, pais, ciudad, hash]
    );
    res.status(201).json({ token: tokenDe(rows[0]), cliente: publico(rows[0]) });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo. Prueba ingresar.');
    throw e;
  }
}));

// POST /api/clientes/login
r.post('/login', limitarLogin, ah(async (req, res) => {
  const email = texto(req.body?.email, 120).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Correo y contraseña obligatorios');

  const { rows } = await pool.query('SELECT * FROM clientes WHERE lower(email) = $1', [email]);
  const c = rows[0];
  const ok = await bcrypt.compare(password, c ? c.password_hash : HASH_FALSO);
  if (!c || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos');
  if (!c.activo) throw new HttpError(403, 'Tu cuenta está desactivada. Escríbenos por WhatsApp.');

  await pool.query('UPDATE clientes SET ultimo_login = now() WHERE id = $1', [c.id]);
  res.json({ token: tokenDe(c), cliente: publico(c) });
}));

// GET /api/clientes/me
r.get('/me', requireCliente, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1 AND activo = true', [req.user.id]);
  if (!rows[0]) throw new HttpError(401, 'Cuenta no encontrada');
  res.json(publico(rows[0]));
}));

// PUT /api/clientes/me  → editar perfil
r.put('/me', requireCliente, ah(async (req, res) => {
  const nombre = texto(req.body?.nombre, 120);
  const pais = texto(req.body?.pais, 60) || 'Bolivia';
  const ciudad = texto(req.body?.ciudad, 80);
  const whatsapp = normalizarTelefono(req.body?.whatsapp);
  if (nombre.length < 3) throw new HttpError(400, 'Escribe tu nombre completo');
  if (!whatsapp) throw new HttpError(400, 'El celular no es válido');

  const { rows } = await pool.query(
    `UPDATE clientes SET nombre=$1, whatsapp=$2, pais=$3, ciudad=$4 WHERE id=$5 RETURNING *`,
    [nombre, whatsapp, pais, ciudad, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'Cuenta no encontrada');
  res.json({ cliente: publico(rows[0]), token: tokenDe(rows[0]) });
}));

// POST /api/clientes/me/password
r.post('/me/password', requireCliente, ah(async (req, res) => {
  const actual = typeof req.body?.actual === 'string' ? req.body.actual : '';
  if (!contrasenaFuerte(req.body?.nueva)) throw new HttpError(400, MSG_CONTRASENA);

  const { rows } = await pool.query('SELECT password_hash FROM clientes WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  await pool.query('UPDATE clientes SET password_hash = $1 WHERE id = $2',
    [await bcrypt.hash(req.body.nueva, 10), req.user.id]);
  res.json({ ok: true });
}));

// GET /api/clientes/me/reservas
r.get('/me/reservas', requireCliente, ah(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, plan, plan_slug, num_personas, fecha_preferida, comentarios,
            estado, total, moneda, creado_en
       FROM reservas WHERE cliente_id = $1 ORDER BY creado_en DESC`,
    [req.user.id]
  );
  res.json(rows.map(conCodigo));
}));

// POST /api/clientes/me/reservas/:id/cancelar
r.post('/me/reservas/:id/cancelar', requireCliente, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identificador inválido');
  const { rows } = await pool.query(
    `UPDATE reservas SET estado = 'cancelado', actualizado_en = now()
      WHERE id = $1 AND cliente_id = $2 AND estado IN ('pendiente','confirmado')
      RETURNING id, plan, estado, num_personas, fecha_preferida, total, moneda, creado_en`,
    [id, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'No se puede cancelar esta reserva (no existe o ya está cancelada)');
  res.json(conCodigo(rows[0]));
}));

export default r;
