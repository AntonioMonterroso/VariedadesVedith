/* Utilidades compartidas: formato, iconos, avisos y ventanas. Sin dependencias. */
(function () {
  'use strict';

  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    chart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    backspace: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  };

  const icon = (name, cls = '') =>
    `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const money = (n) => 'Q' + (Number(n) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyShort = (n) => 'Q' + (Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 });

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const fmtDate = (v) => {
    if (!v) return '';
    const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtTime = (v) => new Date(v).toLocaleTimeString('es-GT', { hour: 'numeric', minute: '2-digit' });
  const fmtDateTime = (v) => `${fmtDate(v)} · ${fmtTime(v)}`;
  const ago = (v) => {
    const s = Math.max(1, Math.round((Date.now() - new Date(v)) / 1000));
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return `hace ${Math.round(s / 86400)} d`;
  };

  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  /* Convierte links "de compartir" comunes en links directos de imagen. */
  function imageUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]+)/);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200`;
    if (/dropbox\.com/.test(u)) u = u.replace(/[?&]dl=0/, '').replace(/([?&])dl=1/, '$1raw=1') + (/[?&]raw=1/.test(u) ? '' : (u.includes('?') ? '&raw=1' : '?raw=1'));
    return u;
  }
  const validUrl = (u) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(String(u || '').trim());

  /* Imagen con imagen de reemplazo si el link falla */
  function imgTag(url, alt = '', cls = '') {
    if (!url) return placeholder();
    return `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="${cls}" data-fallback="1">`;
  }
  function placeholder(text = 'Sin foto') {
    return `<div class="ph">${icon('image')}<span>${esc(text)}</span></div>`;
  }
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el && el.tagName === 'IMG' && el.dataset.fallback) {
      const holder = document.createElement('div');
      holder.className = 'ph';
      holder.innerHTML = icon('image') + '<span>Foto no disponible</span>';
      el.replaceWith(holder);
    }
  }, true);

  /* ---------- avisos ---------- */
  function toast(msg, opts = {}) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast' + (opts.error ? ' err' : '');
    t.innerHTML = `<span class="grow">${esc(msg)}</span>` + (opts.action ? `<button type="button">${esc(opts.action.label)}</button>` : '');
    if (opts.action) t.querySelector('button').addEventListener('click', () => { opts.action.fn(); t.remove(); });
    wrap.appendChild(t);
    const quitar = () => { t.classList.add('out'); setTimeout(() => t.remove(), 190); };
    setTimeout(quitar, opts.ms || (opts.action ? 7000 : 3200));
  }

  /* ---------- ventanas (hoja inferior en móvil, centrada en pantallas grandes) ---------- */
  const stack = [];
  function openModal({ title, body, footer, wide, onClose, onMount }) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title || 'Ventana')}">
        <div class="sheet-head"><h2>${esc(title || '')}</h2><button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div>
        <div class="sheet-body"></div>
        ${footer ? '<div class="sheet-foot"></div>' : ''}
      </div>`;
    const bodyEl = ov.querySelector('.sheet-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const footEl = ov.querySelector('.sheet-foot');
    if (footEl) { if (typeof footer === 'string') footEl.innerHTML = footer; else footEl.appendChild(footer); }
    const prevFocus = document.activeElement;
    const api = {
      el: ov, body: bodyEl, foot: footEl,
      close() {
        if (!ov.isConnected || ov.classList.contains('closing')) return;
        // salida más rápida que la entrada; con movimiento reducido se quita al instante
        ov.classList.add('closing');
        setTimeout(() => ov.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 230);
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (_) {}
        if (onClose) onClose();
      },
      setTitle(t) { ov.querySelector('h2').textContent = t; }
    };
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === api) api.close(); }
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) api.close(); });
    ov.querySelector('[data-close]').addEventListener('click', () => api.close());
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    stack.push(api);
    if (onMount) onMount(api);
    const first = ov.querySelector('[autofocus], input:not([type=hidden]), select, textarea');
    if (first && matchMedia('(pointer: fine)').matches) first.focus();
    return api;
  }
  function closeAllModals() { while (stack.length) stack[stack.length - 1].close(); }

  function confirmDialog({ title, message, okLabel = 'Aceptar', danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const m = openModal({
        title: title || 'Confirmar',
        body: `<p>${esc(message)}</p>`,
        footer: `<button type="button" class="btn secondary" data-no>Cancelar</button><button type="button" class="btn ${danger ? 'danger' : ''}" data-ok>${esc(okLabel)}</button>`,
        onClose: () => finish(false)
      });
      m.foot.querySelector('[data-no]').addEventListener('click', () => m.close());
      m.foot.querySelector('[data-ok]').addEventListener('click', () => { finish(true); m.close(); });
    });
  }

  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function download(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function lsGet(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  window.U = { icon, esc, money, moneyShort, ymd, today, fmtDate, fmtTime, fmtDateTime, ago, norm, imageUrl, validUrl, imgTag, placeholder, toast, openModal, closeAllModals, confirmDialog, debounce, download, lsGet, lsSet };
})();
