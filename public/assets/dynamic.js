/* JACHA TOURS · Script dinámico (requiere common.js)
   1. Agrega "Ingresar / Mi cuenta" al menú de todas las páginas.
   2. Carga precios y configuración desde la API y los inyecta en el DOM:
        data-config="fecha | cupos | whatsapp | email"
        data-plan="silver" data-field="precio | nombre | tier | precio-plano"
   3. Botón flotante de WhatsApp con el número configurado en el panel.
   Si la API no responde, se queda el texto que ya está escrito en el HTML.
*/
(() => {
  const { JachaAuth: Auth, Jacha: J } = window;

  // ── 1. Menú de cuenta ──
  function menuCuenta() {
    const logueado = Auth.logueado();
    const href = logueado ? 'mi-cuenta.html' : 'login.html';
    const texto = logueado ? 'Mi cuenta' : 'Ingresar';
    const actual = location.pathname.split('/').pop().replace(/\.html$/, '');
    const activo = (logueado ? 'mi-cuenta' : 'login') === actual ? ' active' : '';
    document.querySelectorAll('.nav-links, .nav-drawer').forEach((box) => {
      if (box.querySelector('.nav-account')) return;
      const a = document.createElement('a');
      a.href = href;
      a.className = 'nav-account' + activo;
      a.textContent = texto;
      // En el menú móvil el botón dorado "Reservar" va al final; la cuenta se inserta antes
      const boton = box.querySelector('.btn');
      boton ? box.insertBefore(a, boton) : box.appendChild(a);
    });
  }

  // ── 2 y 3. Datos dinámicos ──
  async function cargar() {
    const [configRes, planesRes] = await Promise.all([
      fetch('/api/config').catch(() => null),
      fetch('/api/planes').catch(() => null),
    ]);
    const config = configRes?.ok ? await configRes.json() : null;
    const planes = planesRes?.ok ? await planesRes.json() : [];

    if (config) {
      window.JACHA_CONFIG = config;
      const salidaVigente = config.proxima_salida_fecha && config.proxima_salida_fecha >= J.hoy();

      document.querySelectorAll('[data-config="fecha"]').forEach((el) => {
        el.textContent = salidaVigente ? J.fecha(config.proxima_salida_fecha) : 'Próxima fecha por confirmar';
      });
      document.querySelectorAll('[data-config="cupos"]').forEach((el) => {
        if (!salidaVigente) { el.textContent = 'Consulta disponibilidad por WhatsApp'; return; }
        if (config.proxima_salida_cupos) el.textContent = `${config.proxima_salida_cupos} · ${config.proxima_salida_lugar || 'El Alto'}`;
      });
      const tel = J.normTel(config.whatsapp_contacto);
      document.querySelectorAll('[data-config="whatsapp"]').forEach((el) => {
        if (!tel) return;
        el.textContent = J.verTel(tel);
        if (el.tagName === 'A') el.href = J.wa(tel, 'Hola Jacha Tours, quisiera información sobre el circuito de cholets.');
      });
      document.querySelectorAll('[data-config="email"]').forEach((el) => {
        if (config.email_contacto) el.textContent = config.email_contacto;
      });
      botonWhatsApp(tel);
    }

    const porSlug = Object.fromEntries(planes.map((p) => [p.slug, p]));
    document.querySelectorAll('[data-plan]').forEach((el) => {
      const p = porSlug[el.dataset.plan];
      if (!p) return;
      switch (el.dataset.field) {
        case 'precio': el.innerHTML = `${J.dinero(p.precio, p.moneda)} <small>/ persona</small>`; break;
        case 'precio-plano': el.textContent = J.dinero(p.precio, p.moneda); break;
        case 'nombre': el.textContent = p.nombre; break;
        case 'tier': el.textContent = p.tier; break;
      }
    });
  }

  function botonWhatsApp(tel) {
    if (!tel || document.querySelector('.wa-float') || location.pathname.includes('/admin/')) return;
    const a = document.createElement('a');
    a.className = 'wa-float';
    a.href = J.wa(tel, 'Hola Jacha Tours, quisiera información sobre el circuito de cholets.');
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    a.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9.5L4 22v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg><span>WhatsApp</span>';
    document.body.appendChild(a);
  }

  menuCuenta();
  cargar().catch((e) => console.warn('[dynamic.js] Falló la carga dinámica:', e));
})();
