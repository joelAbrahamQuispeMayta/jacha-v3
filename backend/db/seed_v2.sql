-- ═══════════════════════════════════════════
-- Planes con precios en Bolivianos (estimados)
-- Tip: ajústalos desde el panel admin
-- ═══════════════════════════════════════════

INSERT INTO planes (slug, tier, nombre, precio, moneda, orden, features) VALUES
('silver', 'Iniciación', 'Blue Silver', 1700, 'Bs.', 1,
 '["Recorrido por las 5 fachadas más icónicas","Audioguía técnica sobre arquitectura Neoandina","Transporte panorámico con Wi-Fi","Fotografía desde puntos estratégicos","Guía local bilingüe certificado"]'::jsonb),

('gold', 'Experiencia', 'Aurum Gold', 3800, 'Bs.', 2,
 '["Acceso exclusivo a Salones de Gala","Experiencia de Realidad Aumentada","Almuerzo Gourmet en el Cholet","Brindis con bebida artesanal andina","Transporte privado de lujo","Guía especializado en arquitectura"]'::jsonb),

('platinum', 'Distinción', 'Platinum VIP', 8300, 'Bs.', 3,
 '["Acceso privado a Penthouses","Charla con maestros constructores","Cena privada exclusiva en el Cholet","Sesión fotográfica profesional","Transporte y seguridad VIP","Atención personalizada 24/7"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Configuración global (una sola fila)
INSERT INTO config (proxima_salida_fecha, proxima_salida_cupos, proxima_salida_lugar, whatsapp_contacto, email_contacto)
SELECT '2026-12-20', 'Solo quedan 4 cupos disponibles', 'El Alto', '+591 7X XXX XXXX', 'hola@jachatours.bo'
WHERE NOT EXISTS (SELECT 1 FROM config);