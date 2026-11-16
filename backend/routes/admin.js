// Herramientas del panel  →  /api/admin/*  (solo administradores)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { ah, HttpError, idParam, texto, conCodigo } from '../utils/helpers.js';

const r = Router();
r.use(requireAdmin);

// GET /api/admin/stats → todo el dashboard en una sola llamada
r.get('/stats', ah(async (req, res) => {
  const [res1, res2, res3, res4, res5] = await Promise.all([
    pool.query(`SELECT
        COUNT(*)::int                                                     AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente')::int                 AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'confirmado')::int                AS confirmadas,
        COUNT(*) FILTER (WHERE estado = 'cancelado')::int                 AS canceladas,
        COALESCE(SUM(total) FILTER (WHERE estado = 'confirmado'), 0)      AS ingresos_confirmados,
        COALESCE(SUM(total) FILTER (WHERE estado = 'pendiente'), 0)       AS ingresos_pendientes,
        COALESCE(SUM(num_personas) FILTER (WHERE estado = 'confirmado'), 0)::int AS personas_confirmadas
      FROM reservas`),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE activo)::int AS activos FROM cholets`),
    pool.query(`SELECT COUNT(*)::int AS total FROM clientes`),
    pool.query(`SELECT to_char(date_trunc('month', creado_en), 'YYYY-MM') AS mes, COUNT(*)::int AS reservas
                  FROM reservas WHERE creado_en >= date_trunc('month', now()) - interval '5 months'
                 GROUP BY 1 ORDER BY 1`),
    pool.query(`SELECT * FROM reservas ORDER BY creado_en DESC LIMIT 8`),
  ]);
  res.json({
    reservas: res1.rows[0],
    cholets: res2.rows[0],
    clientes: res3.rows[0],
    por_mes: res4.rows,
    recientes: res5.rows.map(conCodigo),
  });
}));

// GET /api/admin/clientes?q=
r.get('/clientes', ah(async (req, res) => {
  const q = texto(req.query.q, 80);
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
    where = 'WHERE c.nombre ILIKE $1 OR c.email ILIKE $1 OR c.whatsapp ILIKE $1';
  }
  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.email, c.whatsapp, c.pais, c.ciudad, c.activo, c.creado_en, c.ultimo_login,
            COUNT(r.id)::int AS reservas
       FROM clientes c LEFT JOIN reservas r ON r.cliente_id = c.id
       ${where}
      GROUP BY c.id ORDER BY c.creado_en DESC LIMIT 500`, params);
  res.json(rows);
}));

// PUT /api/admin/clientes/:id/activo  { activo: true|false }
r.put('/clientes/:id/activo', ah(async (req, res) => {
  const id = idParam(req.params.id);
  if (typeof req.body?.activo !== 'boolean') throw new HttpError(400, 'activo debe ser true o false');
  const { rowCount } = await pool.query('UPDATE clientes SET activo = $1 WHERE id = $2', [req.body.activo, id]);
  if (!rowCount) throw new HttpError(404, 'Cliente no encontrado');
  res.json({ ok: true });
}));

// POST /api/admin/clientes/:id/reset-password → genera una clave temporal (se muestra una sola vez)
r.post('/clientes/:id/reset-password', ah(async (req, res) => {
  const id = idParam(req.params.id);
  // 10 caracteres sin letras confusas (0/O, 1/l/I) + garantizamos letra y número
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = Array.from({ length: 8 }, () => pick(alfabeto));
  chars.push(pick('23456789'), pick('23456789'));
  const temporal = chars.sort(() => crypto.randomInt(3) - 1).join('');

  const { rowCount } = await pool.query('UPDATE clientes SET password_hash = $1 WHERE id = $2',
    [await bcrypt.hash(temporal, 10), id]);
  if (!rowCount) throw new HttpError(404, 'Cliente no encontrado');
  res.json({ temporal });
}));

export default r;
