// Utilidades compartidas del panel admin (JACHA TOURS)
const API = '/api';
const TOKEN_KEY = 'jacha_token';          // token de ADMIN (distinto al de clientes)

function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* sin storage */ } }
function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* nada */ } }

function logout() { clearToken(); location.href = 'login.html'; }

/** Llama a la API. Si el servidor dice 401 (sesión vencida) vuelve al login. */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try { res = await fetch(API + path, { ...opts, headers }); }
  catch { throw new Error('Sin conexión con el servidor'); }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !opts.noRedirect) {
    clearToken(); location.href = 'login.html';
    throw new Error('Sesión vencida');
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/** Menú lateral común a todas las páginas del panel */
function renderSidebar(active) {
  const items = [
    ['dashboard', 'Dashboard'], ['reservas', 'Reservas'], ['clientes', 'Clientes'],
    ['cholets', 'Cholets & Mapa'], ['planes', 'Precios & Salida'],
  ];
  const el = document.getElementById('sidebar');
  if (!el) return;
  el.innerHTML = `
    <div class="sidebar-logo">JACHA TOURS<small>Panel Admin</small></div>
    <nav class="sidebar-nav">
      ${items.map(([k, t]) => `<a href="${k}.html"${k === active ? ' class="active"' : ''}>${t}</a>`).join('')}
      <a href="../index.html" target="_blank" rel="noopener">Ver sitio →</a>
      <a href="#" id="logoutBtn">Cerrar sesión</a>
    </nav>`;
  document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

function toast(msg, isError = false) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3600);
}

/** Escapa HTML (evita XSS al mostrar datos que escribieron otros) */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-12-20" → "20 dic 2026" (sin corrimiento por zona horaria) */
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1]} ${y}`;
}

/** Timestamp → fecha y hora de Bolivia */
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: 'America/La_Paz', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** 1700 → "Bs. 1.700" */
function money(n, moneda = 'Bs.') {
  return `${moneda} ${(Number(n) || 0).toLocaleString('es-BO', { maximumFractionDigits: 2 })}`;
}

/** "+59171234567" → "+591 7123 4567" */
function fmtTel(t) {
  const m = /^\+591(\d{4})(\d{4})$/.exec(t || '');
  return m ? `+591 ${m[1]} ${m[2]}` : (t || '');
}

/** Enlace de WhatsApp (solo si el número tiene formato +XXXXXXXX) */
function waLink(tel, texto) {
  const d = String(tel || '').replace(/\D/g, '');
  if (!/^\+/.test(String(tel || '')) || d.length < 8) return null;
  return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

/** Valor seguro para CSV: comillas dobles y protección contra fórmulas de Excel (=,+,-,@) */
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Verifica sesión (token válido en el servidor) al cargar cada página del panel */
async function requireSession(active) {
  renderSidebar(active);
  if (!getToken()) { location.href = 'login.html'; throw new Error('sin sesión'); }
  const me = await api('/auth/me');
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = me.username || 'admin';
  return me;
}
