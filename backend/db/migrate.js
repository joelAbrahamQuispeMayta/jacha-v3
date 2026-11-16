// Ejecuta los scripts SQL de estructura, en orden. Todos son idempotentes.
// Uso manual:  npm run db:migrate
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['init.sql', 'migration_v2.sql', 'migration_v3.sql'];

export async function migrate() {
  for (const f of FILES) {
    const sql = fs.readFileSync(path.join(__dirname, f), 'utf8');
    await pool.query(sql);
  }
}

// Si se ejecuta directamente: node db/migrate.js [--seed]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      await migrate();
      console.log('✅ Estructura de la base de datos al día');
      if (process.argv.includes('--seed')) {
        for (const f of ['seed.sql', 'seed_v2.sql']) {
          await pool.query(fs.readFileSync(path.join(__dirname, f), 'utf8'));
          console.log(`✅ Datos iniciales cargados: ${f}`);
        }
      }
    } catch (e) {
      console.error('❌', e.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
}
