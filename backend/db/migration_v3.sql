-- ═══════════════════════════════════════════
-- JACHA TOURS · Migración v3
-- · Cuentas de clientes (separadas de los administradores)
-- · Reservas vinculadas a cliente, con plan, total y nota interna
-- · Tipo de cambio Bs/$us en la configuración
-- Es IDEMPOTENTE: se puede ejecutar muchas veces sin problema.
-- Se ejecuta sola al arrancar el servidor (npm start).
-- ═══════════════════════════════════════════

-- Clientes (usuarios públicos)
CREATE TABLE IF NOT EXISTS clientes (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  whatsapp      VARCHAR(20),
  pais          VARCHAR(60)  DEFAULT 'Bolivia',
  ciudad        VARCHAR(80),
  password_hash VARCHAR(120) NOT NULL,
  activo        BOOLEAN DEFAULT true,
  creado_en     TIMESTAMPTZ DEFAULT now(),
  ultimo_login  TIMESTAMPTZ
);
-- Un correo = una cuenta (sin importar mayúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email ON clientes (lower(email));

-- Reservas: nuevas columnas
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS plan_slug  VARCHAR(30);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS total      DECIMAL(10,2);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS moneda     VARCHAR(10) DEFAULT 'Bs.';
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS nota_admin TEXT;
CREATE INDEX IF NOT EXISTS idx_reservas_cliente ON reservas(cliente_id);

-- Restricciones (NOT VALID = no revisa filas viejas, solo las nuevas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_estado_chk') THEN
    ALTER TABLE reservas ADD CONSTRAINT reservas_estado_chk
      CHECK (estado IN ('pendiente','confirmado','cancelado')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_personas_chk') THEN
    ALTER TABLE reservas ADD CONSTRAINT reservas_personas_chk
      CHECK (num_personas BETWEEN 1 AND 100) NOT VALID;
  END IF;
END $$;

-- Configuración: tipo de cambio oficial referencial (Bs por 1 $us)
ALTER TABLE config ADD COLUMN IF NOT EXISTS tipo_cambio DECIMAL(6,2) DEFAULT 6.96;
