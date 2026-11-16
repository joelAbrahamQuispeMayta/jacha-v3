import pg from 'pg';
import 'dotenv/config';

// DATE (oid 1082) → texto "YYYY-MM-DD" tal cual, sin convertir a Date.
// Así una fecha como 2026-12-20 nunca se corre un día por la zona horaria.
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC / DECIMAL (oid 1700) → número JS (precios, lat, lng, totales)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  // Las fechas "de corte" (reportes, filtros) se calculan en hora de Bolivia
  options: '-c timezone=America/La_Paz',
  // Para bases en la nube (Neon, Supabase, Render...) pon DB_SSL=true en .env
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => console.error('[PG] Error inesperado:', err.message));
