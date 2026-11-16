import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { ah, HttpError, texto, idParam, BOLIVIA_BBOX as B } from '../utils/helpers.js';

const r = Router();
const CATEGORIAS = ['cholet', 'interior', 'tour'];
const COLS_PUBLICAS = `id, slug, nombre, descripcion, categoria, arquitecto,
                       direccion, zona, lat, lng, imagen, galeria, orden`;

/** Valida y limpia el cuerpo de un cholet. parcial=true → solo valida lo que venga (PUT) */
function leerCholet(b = {}, parcial = false) {
  const out = {};
  const pon = (k, v) => { if (v !== undefined) out[k] = v; };

  if (!parcial || b.slug !== undefined) {
    const slug = texto(b.slug, 60).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new HttpError(400, 'El slug solo puede tener minúsculas, números y guiones');
    pon('slug', slug);
  }
  if (!parcial || b.nombre !== undefined) {
    const nombre = texto(b.nombre, 120);
    if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
    pon('nombre', nombre);
  }
  if (!parcial || b.lat !== undefined || b.lng !== undefined) {
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'Latitud y longitud son obligatorias');
    if (lat < B.latMin || lat > B.latMax || lng < B.lngMin || lng > B.lngMax) {
      throw new HttpError(400, 'Las coordenadas deben estar dentro de Bolivia (¿invertiste latitud y longitud?)');
    }
    pon('lat', lat); pon('lng', lng);
  }
  if (b.categoria !== undefined) {
    if (!CATEGORIAS.includes(b.categoria)) throw new HttpError(400, 'Categoría inválida');
    pon('categoria', b.categoria);
  }
  if (b.descripcion !== undefined) pon('descripcion', texto(b.descripcion, 3000));
  if (b.arquitecto !== undefined) pon('arquitecto', texto(b.arquitecto, 120));
  if (b.direccion !== undefined) pon('direccion', texto(b.direccion, 200));
  if (b.zona !== undefined) pon('zona', texto(b.zona, 120));
  if (b.imagen !== undefined) pon('imagen', texto(b.imagen, 255));
  if (b.galeria !== undefined) {
    if (!Array.isArray(b.galeria) || b.galeria.length > 30) throw new HttpError(400, 'La galería debe ser una lista (máx. 30)');
    pon('galeria', JSON.stringify(b.galeria.map((g) => texto(g, 255)).filter(Boolean)));
  }
  if (b.orden !== undefined) {
    const o = Number.parseInt(b.orden, 10);
    if (!Number.isInteger(o)) throw new HttpError(400, 'El orden debe ser un número entero');
    pon('orden', o);
  }
  if (b.activo !== undefined) pon('activo', Boolean(b.activo));
  return out;
}

// GET /api/cholets → público (solo activos). ?categoria=cholet
r.get('/', ah(async (req, res) => {
  const cat = req.query.categoria;
  const { rows } = cat
    ? await pool.query(`SELECT ${COLS_PUBLICAS} FROM cholets WHERE activo = true AND categoria = $1 ORDER BY orden, id`, [cat])
    : await pool.query(`SELECT ${COLS_PUBLICAS} FROM cholets WHERE activo = true ORDER BY orden, id`);
  res.json(rows);
}));

// GET /api/cholets/all → admin (incluye inactivos)
r.get('/all', requireAdmin, ah(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cholets ORDER BY orden, id');
  res.json(rows);
}));

// GET /api/cholets/cercanos?lat=..&lng=..&km=5 → cholets a menos de X km (por defecto 5)
r.get('/cercanos', ah(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const km = req.query.km === undefined ? 5 : Number(req.query.km);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(400, 'lat y lng válidos son requeridos');
  }
  if (!Number.isFinite(km) || km <= 0 || km > 500) throw new HttpError(400, 'km debe estar entre 0 y 500');

  const { rows } = await pool.query(`
    SELECT * FROM (
      SELECT slug, nombre, lat, lng,
             ROUND((6371 * acos(LEAST(1, GREATEST(-1,
               cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
               sin(radians($1)) * sin(radians(lat))
             ))))::numeric, 3) AS distancia_km
        FROM cholets WHERE activo = true
    ) t
    WHERE distancia_km <= $3
    ORDER BY distancia_km ASC LIMIT 20`, [lat, lng, km]);
  res.json(rows);
}));

// GET /api/cholets/:slug → público
r.get('/:slug', ah(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLS_PUBLICAS} FROM cholets WHERE slug = $1 AND activo = true`, [req.params.slug]);
  if (!rows[0]) throw new HttpError(404, 'Cholet no encontrado');
  res.json(rows[0]);
}));

// POST /api/cholets → admin
r.post('/', requireAdmin, ah(async (req, res) => {
  const d = leerCholet(req.body, false);
  const c = { categoria: 'cholet', descripcion: '', arquitecto: '', direccion: '', zona: '',
              imagen: '', galeria: '[]', orden: 0, activo: true, ...d };
  try {
    const { rows } = await pool.query(
      `INSERT INTO cholets (slug, nombre, descripcion, categoria, arquitecto, direccion, zona,
                            lat, lng, imagen, galeria, orden, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [c.slug, c.nombre, c.descripcion, c.categoria, c.arquitecto, c.direccion, c.zona,
       c.lat, c.lng, c.imagen, c.galeria, c.orden, c.activo]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Ya existe un cholet con ese slug');
    throw e;
  }
}));

// PUT /api/cholets/:id → admin (solo cambia los campos enviados)
r.put('/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const d = leerCholet(req.body, true);
  const keys = Object.keys(d);
  if (!keys.length) throw new HttpError(400, 'Nada que actualizar');

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  try {
    const { rows } = await pool.query(
      `UPDATE cholets SET ${sets}, actualizado_en = now() WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => d[k]), id]);
    if (!rows[0]) throw new HttpError(404, 'Cholet no encontrado');
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Ya existe un cholet con ese slug');
    throw e;
  }
}));

// DELETE /api/cholets/:id → admin
r.delete('/:id', requireAdmin, ah(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM cholets WHERE id = $1', [idParam(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Cholet no encontrado');
  res.json({ ok: true });
}));

export default r;
