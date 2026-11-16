/* JACHA TOURS · Utilidades comunes del sitio público
   - Sesión de CLIENTE (guardada en localStorage, con protección si el navegador la bloquea)
   - Formato de dinero y fechas para Bolivia (Bs., es-BO, hora de La Paz)
   - Validación de celulares bolivianos / internacionales
   - Enlaces de WhatsApp
*/
(function () {
  const KEY = 'jacha_cliente_token';
  const NAME = 'jacha_cliente_nombre';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
  };

  // ¿El token sigue vigente? (lee la fecha de vencimiento del JWT; el servidor igual lo verifica)
  function vigente(token) {
    try {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return !p.exp || p.exp * 1000 > Date.now();
    } catch { return false; }
  }

  const Auth = {
    token() { const t = store.get(KEY); return t && vigente(t) ? t : null; },
    logueado() { return !!Auth.token(); },
    nombre() { return store.get(NAME) || ''; },
    guardar(token, cliente) { store.set(KEY, token); if (cliente?.nombre) store.set(NAME, cliente.nombre); },
    salir() { store.del(KEY); store.del(NAME); },
    cerrarSesion() { Auth.salir(); location.href = 'index.html'; },

    /** Llama a la API. Lanza Error(mensaje) con .status si falla. */
    async api(path, opts = {}) {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      const t = Auth.token();
      if (t) headers.Authorization = 'Bearer ' + t;
      let res;
      try { res = await fetch('/api' + path, { ...opts, headers }); }
      catch { const e = new Error('Sin conexión con el servidor. Revisa tu internet.'); e.status = 0; throw e; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && t) Auth.salir();
      if (!res.ok) { const e = new Error(data.error || `Error ${res.status}`); e.status = res.status; throw e; }
      return data;
    },
  };

  // ── Utilidades Bolivia ──
  const Util = {
    /** "71234567" → "+59171234567"; null si no es válido. Acepta números de otros países con "+" */
    normTel(input) {
      const s = String(input || '').trim();
      if (!s) return null;
      const plus = s.startsWith('+') || s.startsWith('00');
      let d = s.replace(/\D/g, '');
      if (s.startsWith('00')) d = d.slice(2);
      if (!plus) {
        if (/^[67]\d{7}$/.test(d) || /^[2-4]\d{7}$/.test(d)) return '+591' + d;
        if (/^591[2-467]\d{7}$/.test(d)) return '+' + d;
        return null;
      }
      if (d.startsWith('591')) return /^591[2-467]\d{7}$/.test(d) ? '+' + d : null;
      return d.length >= 7 && d.length <= 15 ? '+' + d : null;
    },
    /** "+59171234567" → "+591 7123 4567" */
    verTel(t) {
      const m = /^\+591(\d{4})(\d{4})$/.exec(t || '');
      return m ? `+591 ${m[1]} ${m[2]}` : (t || '');
    },
    /** Dinero con formato boliviano: Bs. 1.700 (acepta moneda) */
    dinero(n, moneda = 'Bs.') {
      const v = Number(n) || 0;
      return `${moneda} ${v.toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;
    },
    /** Fecha YYYY-MM-DD → "15 de junio de 2026" sin corrimientos de zona horaria */
    fecha(iso) {
      if (!iso) return '';
      const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return `${d} de ${meses[m - 1]} de ${y}`;
    },
    /** Fecha y hora (timestamp ISO) en hora de Bolivia */
    fechaHora(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleString('es-BO', {
        timeZone: 'America/La_Paz', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    },
    /** Hoy en Bolivia, YYYY-MM-DD */
    hoy() {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    },
    /** Enlace wa.me con mensaje; recibe el número en cualquier formato válido */
    wa(tel, mensaje) {
      const n = Util.normTel(tel);
      if (!n) return null;
      return `https://wa.me/${n.slice(1)}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
    },
    /** Escapa HTML para insertar texto de la API de forma segura */
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
  };

  window.JachaAuth = Auth;
  window.Jacha = Util;
})();
