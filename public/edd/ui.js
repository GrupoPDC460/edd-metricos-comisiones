/* ui.js — piezas de interfaz reutilizables */
(function (g) {
  'use strict';
  const E = g.EDD, h = E.h;
  const U = E.ui = {};
  E.app = E.app || { vistas: {} };

  U.chip = est => h('span', { class: 'chip ' + est.k }, est.t);
  U.sem = (r, vacio) => {
    if (!r) return h('span', { class: 'pendiente' }, vacio || 'Sin calificar');
    const c = E.COLOR[r] || { bg: '#eee', fg: '#222' };
    return h('span', { class: 'sem', style: { background: c.bg, color: c.fg } }, r);
  };
  U.select = (opciones, valor, onChange, attrs) => {
    const s = h('select', Object.assign({ class: 'campo' }, attrs || {}));
    opciones.forEach(o => { const op = h('option', { value: o.v }, o.t); if (String(o.v) === String(valor == null ? '' : valor)) op.selected = true; s.append(op); });
    if (onChange) s.addEventListener('change', () => onChange(s.value));
    return s;
  };
  U.campo = (etiqueta, control, ayuda) => h('label', { class: 'f' }, h('span', null, etiqueta), control, ayuda ? h('small', null, ayuda) : null);
  U.tabla = (cols, filas, pie) => h('div', { class: 'tabla-env' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.cls || null, style: c.w ? { width: c.w } : null }, c.t)))),
    h('tbody', null, filas.length ? filas : h('tr', null, h('td', { colspan: cols.length, class: 'vacio' }, 'No hay registros con estos filtros.'))),
    pie ? h('tfoot', null, pie) : null));
  U.vacio = (titulo, texto, ...acciones) => h('div', { class: 'hoja vacio' }, h('h2', null, titulo), texto ? h('p', null, texto) : null, acciones.length ? h('div', { class: 'acciones', style: { justifyContent: 'center', marginTop: '12px' } }, acciones) : null);
  U.btn = (label, onClick, cls, attrs) => h('button', Object.assign({ type: 'button', class: 'btn ' + (cls || ''), onclick: async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await onClick(e); } catch (err) { E.errorToast(err); } finally { if (b.isConnected) b.disabled = false; }
  } }, attrs || {}), label);
  U.pestanas = (items, actual, onSel) => h('div', { class: 'pestanas', role: 'tablist' }, items.map(it => h('button', {
    type: 'button', role: 'tab', class: it.k === actual ? 'sel' : null, 'aria-selected': it.k === actual ? 'true' : 'false', onclick: () => onSel(it.k),
  }, it.t, it.n ? h('span', { class: 'contador' }, it.n) : null)));
  U.nombreEquipo = id => { const e = id && E.equipo(id); return e ? e.d.nombre : 'Sin asignar'; };
  U.opcionesEquipo = (incluirVacio, textoVacio) => (incluirVacio ? [{ v: '', t: textoVacio || 'Todos los equipos' }] : []).concat(E.equipos().map(e => ({ v: e.id, t: e.d.nombre + (e.d.activo === false ? ' (inactivo)' : '') })));
  U.opcionesSupervisor = (textoVacio) => [{ v: '', t: textoVacio || 'Todos los supervisores' }].concat(E.supervisoresLista().map(p => ({ v: p.id, t: p.d.nombre })));
  U.opcionesAutoriza = () => {
    const nombres = new Set(E.supervisoresLista().map(p => p.d.nombre));
    if (E.api.usuario) nombres.add(E.api.usuario);
    return [{ v: '', t: 'Elige quién autoriza' }].concat([...nombres].sort((a, b) => a.localeCompare(b, 'es')).map(n => ({ v: n, t: n })));
  };

  // Filtros comunes: equipo, supervisor y búsqueda
  U.filtros = (f, onCambio, extra) => {
    const q = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar por nombre o código', value: f.q || '' });
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; onCambio(); }, 220); });
    return h('div', { class: 'rejilla', style: { marginBottom: '14px' } },
      U.campo('Equipo', U.select(U.opcionesEquipo(true).concat([{ v: '__sin', t: 'Sin equipo asignado' }]), f.equipo, v => { f.equipo = v; onCambio(); })),
      U.campo('Supervisor', U.select(U.opcionesSupervisor(), f.supervisor, v => { f.supervisor = v; onCambio(); })),
      U.campo('Gestor', q), extra || null);
  };
  U.filtrar = (personas, f) => personas.filter(p => {
    if (f.equipo === '__sin' && p.d.equipo_id) return false;
    if (f.equipo && f.equipo !== '__sin' && p.d.equipo_id !== f.equipo) return false;
    if (f.supervisor) {
      const eq = p.d.equipo_id && E.equipo(p.d.equipo_id);
      const sup = p.d.supervisor_id || (eq && eq.d.supervisor_id);
      if (sup !== f.supervisor) return false;
    }
    if (f.q) { const q = E.norm(f.q); if (!E.norm(p.d.nombre).includes(q) && !String(p.d.codigo || '').includes(q)) return false; }
    return true;
  });
  U.copiarTexto = async t => {
    try { await navigator.clipboard.writeText(t); E.toast('Texto copiado.'); }
    catch (e) { const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, t); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); E.toast('Texto copiado.'); }
  };
  U.img = async (canvasPromise) => { const c = await canvasPromise; const im = h('img', { alt: 'Vista previa', src: c.toDataURL('image/png') }); im._canvas = c; return im; };
  U.ajustar = ta => { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 38) + 'px'; };
  U.ajustarTextareas = root => (root || document).querySelectorAll('textarea.campo').forEach(U.ajustar);
  document.addEventListener('input', e => { if (e.target && e.target.matches && e.target.matches('textarea.campo')) U.ajustar(e.target); });
  U.nombreArchivo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_');
})(window);
