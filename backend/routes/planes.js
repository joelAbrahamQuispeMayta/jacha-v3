import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { ah, HttpError, texto, idParam } from '../utils/helpers.js';

const r = Router();

// GET /api/planes → público
r.get('/', ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM planes WHERE activo = true ORDER BY orden, id');
  res.json(rows);
}));

// GET /api/planes/all → admin (incluye inactivos)
r.get('/all', requireAdmin, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM planes ORDER BY orden, id');
  res.json(rows);
}));

// PUT /api/planes/:id → admin (solo cambia lo enviado)
r.put('/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = req.body || {};
  const d = {};

  if (b.nombre !== undefined) {
    d.nombre = texto(b.nombre, 60);
    if (!d.nombre) throw new HttpError(400, 'El nombre no puede estar vacío');
  }
  if (b.tier !== undefined) d.tier = texto(b.tier, 40);
  if (b.moneda !== undefined) {
    d.moneda = texto(b.moneda, 10);
    if (!d.moneda) throw new HttpError(400, 'La moneda no puede estar vacía');
  }
  if (b.precio !== undefined) {
    const p = b.precio === null || b.precio === '' ? NaN : Number(b.precio);
    if (!Number.isFinite(p) || p < 0 || p > 1000000) throw new HttpError(400, 'El precio debe ser un número entre 0 y 1.000.000');
    d.precio = Math.round(p * 100) / 100;
  }
  if (b.features !== undefined) {
    if (!Array.isArray(b.features) || b.features.length > 20) throw new HttpError(400, 'Las características deben ser una lista (máx. 20)');
    d.features = JSON.stringify(b.features.map((f) => texto(f, 160)).filter(Boolean));
  }
  if (b.orden !== undefined) {
    const o = Number.parseInt(b.orden, 10);
    if (!Number.isInteger(o)) throw new HttpError(400, 'Orden inválido');
    d.orden = o;
  }
  if (b.activo !== undefined) d.activo = Boolean(b.activo);

  const keys = Object.keys(d);
  if (!keys.length) throw new HttpError(400, 'Nada que actualizar');
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE planes SET ${sets}, actualizado_en = now() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => d[k]), id]
  );
  if (!rows[0]) throw new HttpError(404, 'Plan no encontrado');
  res.json(rows[0]);
}));

export default r;
