-- ═══════════════════════════════════════════
-- JACHA TOURS · Esquema de base de datos
-- ═══════════════════════════════════════════

-- Usuarios administradores
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(60) UNIQUE NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  rol           VARCHAR(20) DEFAULT 'admin',
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- Cholets / puntos del circuito
CREATE TABLE IF NOT EXISTS cholets (
  id             SERIAL PRIMARY KEY,
  slug           VARCHAR(60) UNIQUE NOT NULL,
  nombre         VARCHAR(120) NOT NULL,
  descripcion    TEXT,
  categoria      VARCHAR(30) DEFAULT 'cholet',  -- cholet | interior | tour
  arquitecto     VARCHAR(120),
  direccion      VARCHAR(200),
  zona           VARCHAR(120),
  lat            DECIMAL(10,7) NOT NULL,
  lng            DECIMAL(10,7) NOT NULL,
  imagen         VARCHAR(255),
  galeria        JSONB DEFAULT '[]'::jsonb,
  activo         BOOLEAN DEFAULT true,
  orden          INTEGER DEFAULT 0,
  creado_en      TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cholets_activo ON cholets(activo);
CREATE INDEX IF NOT EXISTS idx_cholets_cat    ON cholets(categoria);

-- Reservas
CREATE TABLE IF NOT EXISTS reservas (
  id              SERIAL PRIMARY KEY,
  nombre_cliente  VARCHAR(120) NOT NULL,
  whatsapp        VARCHAR(30),
  email           VARCHAR(120),
  plan            VARCHAR(40),
  num_personas    INTEGER DEFAULT 1,
  fecha_preferida DATE,
  comentarios     TEXT,
  estado          VARCHAR(20) DEFAULT 'pendiente',  -- pendiente | confirmado | cancelado
  creado_en       TIMESTAMPTZ DEFAULT now(),
  actualizado_en  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha  ON reservas(creado_en DESC);