-- ═══════════════════════════════════════════
-- JACHA TOURS · Migración v2
-- Añade tabla de planes y configuración global
-- ═══════════════════════════════════════════

-- Planes (Blue Silver, Aurum Gold, Platinum VIP)
CREATE TABLE IF NOT EXISTS planes (
  id             SERIAL PRIMARY KEY,
  slug           VARCHAR(30) UNIQUE NOT NULL,
  tier           VARCHAR(40),
  nombre         VARCHAR(60),
  precio         DECIMAL(10,2) DEFAULT 0,
  moneda         VARCHAR(10) DEFAULT 'Bs.',
  features       JSONB DEFAULT '[]'::jsonb,
  activo         BOOLEAN DEFAULT true,
  orden          INTEGER DEFAULT 0,
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Configuración global (una sola fila)
CREATE TABLE IF NOT EXISTS config (
  id                        SERIAL PRIMARY KEY,
  proxima_salida_fecha      DATE,
  proxima_salida_cupos      VARCHAR(100),
  proxima_salida_lugar      VARCHAR(100),
  whatsapp_contacto         VARCHAR(30),
  email_contacto            VARCHAR(120),
  actualizado_en            TIMESTAMPTZ DEFAULT now()
);