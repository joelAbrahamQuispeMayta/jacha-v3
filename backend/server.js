import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import clientesRoutes from './routes/clientes.js';
import choletsRoutes from './routes/cholets.js';
import reservasRoutes from './routes/reservas.js';
import planesRoutes from './routes/planes.js';
import configRoutes from './routes/config.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');   // ← SOLO esta carpeta es pública
const PROD = process.env.NODE_ENV === 'production';

// ── Comprobaciones de arranque ──
const EJEMPLOS_SECRETO = ['cambia_esto_por_una_cadena_larga_aleatoria_1234567890'];
function revisarEntorno() {
  const s = process.env.JWT_SECRET || '';
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en backend/.env');
  if (s.length < 16) throw new Error('JWT_SECRET falta o es muy corto (mínimo 16 caracteres) en backend/.env');
  if (EJEMPLOS_SECRETO.includes(s)) {
    const msg = 'JWT_SECRET sigue siendo el de ejemplo. Genera uno propio:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';
    if (PROD) throw new Error(msg);
    console.warn('⚠️  ' + msg);
  }
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

// ── Cabeceras de seguridad ──
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com",
      "media-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=15552000');
  next();
});

// CORS: el sitio y la API viven en el mismo origen, así que por defecto NO se abre a otros dominios.
// Si algún día separas el frontend, pon CORS_ORIGIN=https://tudominio.com en .env
if (process.env.CORS_ORIGIN) {
  app.use('/api', cors({ origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
}
app.use(express.json({ limit: '100kb' }));

// ── API ──
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: true, ts: Date.now() }); }
  catch { res.status(503).json({ ok: false, db: false }); }
});
app.use('/api/auth', authRoutes);          // administradores
app.use('/api/clientes', clientesRoutes);  // clientes (registro / login / mi cuenta)
app.use('/api/cholets', choletsRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── Frontend (solo la carpeta public/) ──
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],                // /reservas  →  reservas.html
  index: 'index.html',
  setHeaders(res, file) {
    // Fotos y videos pesados: caché de 7 días. HTML/JS/CSS: se revalidan siempre (cambios al instante).
    if (/\.(jpe?g|png|webp|gif|svg|mp4|webm|woff2?)$/i.test(file)) res.set('Cache-Control', 'public, max-age=604800');
    else res.set('Cache-Control', 'no-cache');
  },
}));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));

// ── Manejo de errores ──
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err.code === '22P02' || err.code === '22007' || err.code === '22003') {
    return res.status(400).json({ error: 'Dato con formato inválido' });
  }
  console.error('[ERROR]', req.method, req.originalUrl, '→', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Arranque ──
async function asegurarAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const { rows } = await pool.query('SELECT id, password_hash FROM usuarios WHERE username = $1', [username]);

  if (rows.length === 0) {
    // Sin ADMIN_PASSWORD en .env generamos una al azar y la mostramos una sola vez
    const generada = !process.env.ADMIN_PASSWORD;
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await pool.query('INSERT INTO usuarios (username, password_hash, rol) VALUES ($1,$2,$3)',
      [username, await bcrypt.hash(password, 10), 'admin']);
    console.log(`✅ Usuario admin creado → ${username}${generada ? ' / ' + password + '   (¡anótala, no se vuelve a mostrar!)' : ''}`);
    return;
  }
  // Aviso si sigue con una contraseña conocida
  for (const debil of ['admin123', 'admin', '123456']) {
    if (await bcrypt.compare(debil, rows[0].password_hash)) {
      console.warn(`⚠️  El usuario "${username}" usa una contraseña débil/por defecto. Cámbiala en Panel → Dashboard → Seguridad.`);
      break;
    }
  }
}

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    revisarEntorno();
    await pool.query('SELECT 1');
    console.log('✅ Conectado a PostgreSQL');
    await migrate();
    console.log('✅ Estructura de la base de datos al día');
    await asegurarAdmin();

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Servidor corriendo:`);
      console.log(`   Sitio:      http://localhost:${PORT}/`);
      console.log(`   Mapa:       http://localhost:${PORT}/mapa.html`);
      console.log(`   Clientes:   http://localhost:${PORT}/login.html`);
      console.log(`   Admin:      http://localhost:${PORT}/admin/login.html`);
      console.log(`   API health: http://localhost:${PORT}/api/health\n`);
    });

    const cerrar = () => server.close(() => pool.end().then(() => process.exit(0)));
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
  } catch (e) {
    console.error('❌ Error al arrancar:', e.message);
    process.exit(1);
  }
})();

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
