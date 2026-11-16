-- ═══════════════════════════════════════════
-- Datos iniciales · Cholets de El Alto
-- Coordenadas aproximadas (edítalas desde el panel admin)
-- ═══════════════════════════════════════════

INSERT INTO cholets (slug, nombre, descripcion, categoria, arquitecto, direccion, zona, lat, lng, imagen, orden) VALUES
('crucero',      'Cholet Crucero',       'El cholet más fotografiado de El Alto. Su diseño náutico-andino fusiona la forma de un crucero trasatlántico con colores y símbolos de la cosmovisión aymara.', 'cholet',   'Freddy Mamani', 'Av. 6 de Marzo, El Alto', 'Ciudad Satélite', -16.5053000, -68.1856000, 'assets/img/cholets/crucero.jpg', 1),
('transformer',  'The Transformer',      'Diseñado por el maestro Freddy Mamani Silvestre. Fachadas en colores vibrantes y salones interiores repletos de espejos y detalles dorados.',           'cholet',   'Freddy Mamani', 'Av. Juan Pablo II, El Alto', 'Río Seco',       -16.5003000, -68.1701000, 'assets/img/cholets/transformer.jpg', 2),
('titanic',      'Cholet Titanic',       'El ícono absoluto del movimiento neoandino. Salones de gala con iluminación dinámica y detalles dorados.',                                          'cholet',   NULL,            'Av. 6 de Marzo, El Alto', 'Ciudad Satélite', -16.5120000, -68.1950000, 'assets/img/cholets/titanic.jpg', 3),
('moreno',       'Cholet Moreno',        'Ambientes luminosos, detalles geométricos y un recorrido sofisticado para eventos privados de alto nivel.',                                              'cholet',   NULL,            'Villa Adela, El Alto',    'Villa Adela',     -16.5085000, -68.1750000, 'assets/img/cholets/moreno.jpg', 4),
('ingenio',      'El Ingenio',           'Monumento a la creatividad alteña. Fachadas de colores vibrantes y salones gourmet para el cierre del circuito.',                                        'cholet',   NULL,            'Av. 6 de Marzo, El Alto', 'Ciudad Satélite', -16.5032000, -68.1800000, 'assets/img/cholets/ingenio.jpg', 5),
('salon-condor', 'Salón Cóndor',         'El interior más opulento del circuito. Pan de oro, arabescos geométricos y una iluminación teatral.',                                                   'interior', NULL,            'El Alto, Bolivia',        'Centro',          -16.5100000, -68.1820000, 'assets/img/interiores/salon-gala.jpg', 6)
ON CONFLICT (slug) DO NOTHING;