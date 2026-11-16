import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  ah, HttpError, texto, idParam, emailValido, normalizarTelefono,
  fechaValida, hoyBolivia, conCodigo, codigoReserva,
} from '../utils/helpers.js';

const r = Router();

const limitarReservas = rateLimit({
  windowMs: 60 * 60 * 1000, max: 12,
  mensaje: 'Enviaste muchas solicitudes seguidas. Escríbenos por WhatsApp para ayudarte.',
});

// POST /api/reservas → público (invitado) o con sesión de cliente
r.post('/', limitarReservas, optionalAuth, ah(async (req, res) => {
  const b = req.body || {};
  const esCliente = req.user?.rol === 'cliente';

  // Si es cliente con sesión, rellenamos con su perfil lo que falte
  let perfil = null;
  if (esCliente) {
    const q = await pool.query('SELECT id, nombre, email, whatsapp FROM clientes WHERE id = $1 AND activo = true', [req.user.id]);
    perfil = q.rows[0] || null;
  }

  const nombre = texto(b.nombre_cliente, 120) || perfil?.nombre || '';
  const emailRaw = texto(b.email, 120).toLowerCase() || perfil?.email || '';
  const whatsapp = normalizarTelefono(b.whatsapp) || (perfil?.whatsapp ?? null);
  const comentarios = texto(b.comentarios, 600);
  const personas = Number.parseInt(b.num_personas, 10);
  const fecha = b.fecha_preferida ? String(b.fecha_preferida) : null;

  if (nombre.length < 3) throw new HttpError(400, 'Escribe tu nombre completo');
  if (b.whatsapp && !normalizarTelefono(b.whatsapp)) {
    throw new HttpError(400, 'El celular no es válido. Ejemplo: 7XXXXXXX (Bolivia) o +54911... (otro país)');
  }
  if (emailRaw && !emailValido(emailRaw)) throw new HttpError(400, 'El correo electrónico no es válido');
  if (!whatsapp && !emailRaw) throw new HttpError(400, 'Indica un WhatsApp o un correo para poder contactarte');
  if (!Number.isInteger(personas) || personas < 1 || personas > 100) {
    throw new HttpError(400, 'El número de personas debe estar entre 1 y 100');
  }
  if (fecha) {
    if (!fechaValida(fecha)) throw new HttpError(400, 'La fecha no es válida');
    if (fecha < hoyBolivia()) throw new HttpError(400, 'La fecha preferida no puede ser anterior a hoy');
  }

  // El precio SIEMPRE se calcula en el servidor con la tabla planes (el navegador no decide el monto)
  const slug = texto(b.plan_slug, 30).toLowerCase();
  const nombrePlan = texto(b.plan, 60);
  const { rows: pl } = await pool.query(
    `SELECT slug, nombre, precio, moneda FROM planes
      WHERE activo = true AND (slug = $1 OR lower(nombre) = lower($2)) LIMIT 1`,
    [slug, nombrePlan]
  );
  if (!pl[0]) throw new HttpError(400, 'Elige un plan válido');
  const plan = pl[0];
  const total = Math.round(Number(plan.precio) * personas * 100) / 100;

  const { rows } = await pool.query(
    `INSERT INTO reservas (cliente_id, nombre_cliente, whatsapp, email, plan, plan_slug,
                           num_personas, fecha_preferida, comentarios, total, moneda)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, estado, plan, plan_slug, num_personas, fecha_preferida, total, moneda, creado_en`,
    [perfil?.id ?? null, nombre, whatsapp, emailRaw || null, plan.nombre, plan.slug,
     personas, fecha, comentarios, total, plan.moneda]
  );
  res.status(201).json(conCodigo(rows[0]));
}));

// GET /api/reservas → admin. Filtros: ?estado= &q= &desde= &hasta=
r.get('/', requireAdmin, ah(async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };

  const { estado, q, desde, hasta } = req.query;
  if (estado) {
    if (!['pendiente', 'confirmado', 'cancelado'].includes(estado)) throw new HttpError(400, 'Estado inválido');
    add('r.estado = ?', estado);
  }
  if (desde && fechaValida(desde)) add('r.creado_en >= (?::date)::timestamptz', desde);
  if (hasta && fechaValida(hasta)) add("r.creado_en < ((?::date) + 1)::timestamptz", hasta);
  if (q) {
    const t = texto(q, 80);
    const mCodigo = /^JCH-?(\d+)$/i.exec(t);
    if (mCodigo) add('r.id = ?', Number(mCodigo[1]));
    else {
      params.push(`%${t.replace(/[%_\\]/g, '\\$&')}%`);
      const p = '$' + params.length;
      where.push(`(r.nombre_cliente ILIKE ${p} OR r.email ILIKE ${p} OR r.whatsapp ILIKE ${p} OR r.plan ILIKE ${p})`);
    }
  }

  const { rows } = await pool.query(
    `SELECT r.*, c.email AS cuenta_email
       FROM reservas r LEFT JOIN clientes c ON c.id = r.cliente_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY r.creado_en DESC LIMIT 1000`,
    params
  );
  res.json(rows.map(conCodigo));
}));

// PUT /api/reservas/:id → admin: cambiar estado y/o nota interna
r.put('/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { estado } = req.body || {};
  const nota = req.body?.nota_admin === undefined ? null : texto(req.body.nota_admin, 1000);
  if (estado !== undefined && !['pendiente', 'confirmado', 'cancelado'].includes(estado)) {
    throw new HttpError(400, 'Estado inválido');
  }
  if (estado === undefined && nota === null) throw new HttpError(400, 'Nada que actualizar');

  const { rows } = await pool.query(
    `UPDATE reservas SET estado = COALESCE($1, estado), nota_admin = COALESCE($2, nota_admin),
            actualizado_en = now()
      WHERE id = $3 RETURNING *`,
    [estado ?? null, nota, id]
  );
  if (!rows[0]) throw new HttpError(404, 'Reserva no encontrada');
  res.json(conCodigo(rows[0]));
}));

// DELETE /api/reservas/:id → admin
r.delete('/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, `La reserva ${codigoReserva(id)} no existe`);
  res.json({ ok: true });
}));

export default r;
