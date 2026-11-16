import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { ah, HttpError, texto, emailValido, normalizarTelefono, fechaValida } from '../utils/helpers.js';

const r = Router();

const VACIA = {
  proxima_salida_fecha: null, proxima_salida_cupos: '', proxima_salida_lugar: 'El Alto',
  whatsapp_contacto: '', email_contacto: '', tipo_cambio: 6.96,
};

// GET /api/config → público
r.get('/', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM config ORDER BY id LIMIT 1');
  res.json(rows[0] || VACIA);
}));

// PUT /api/config → admin
r.put('/', requireAdmin, ah(async (req, res) => {
  const b = req.body || {};

  const fecha = b.proxima_salida_fecha || null;
  if (fecha && !fechaValida(fecha)) throw new HttpError(400, 'La fecha de salida no es válida');

  const wsRaw = texto(b.whatsapp_contacto, 30);
  const whatsapp = wsRaw ? normalizarTelefono(wsRaw) : '';
  if (wsRaw && !whatsapp) throw new HttpError(400, 'El WhatsApp no es válido. Ejemplo: 71234567 o +591 71234567');

  const email = texto(b.email_contacto, 120);
  if (email && !emailValido(email)) throw new HttpError(400, 'El correo de contacto no es válido');

  const tc = b.tipo_cambio === undefined || b.tipo_cambio === '' ? 6.96 : Number(b.tipo_cambio);
  if (!Number.isFinite(tc) || tc <= 0 || tc > 100) throw new HttpError(400, 'El tipo de cambio no es válido');

  const vals = [
    fecha,
    texto(b.proxima_salida_cupos, 100),
    texto(b.proxima_salida_lugar, 100) || 'El Alto',
    whatsapp,
    email,
    tc,
  ];

  const ex = await pool.query('SELECT id FROM config ORDER BY id LIMIT 1');
  const { rows } = ex.rowCount === 0
    ? await pool.query(
        `INSERT INTO config (proxima_salida_fecha, proxima_salida_cupos, proxima_salida_lugar,
                             whatsapp_contacto, email_contacto, tipo_cambio)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, vals)
    : await pool.query(
        `UPDATE config SET proxima_salida_fecha=$1, proxima_salida_cupos=$2, proxima_salida_lugar=$3,
                whatsapp_contacto=$4, email_contacto=$5, tipo_cambio=$6, actualizado_en = now()
          WHERE id = $7 RETURNING *`, [...vals, ex.rows[0].id]);
  res.json(rows[0]);
}));

export default r;
