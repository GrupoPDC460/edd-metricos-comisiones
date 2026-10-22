/* core.js — utilidades, conexión con Supabase (RPC), almacén en memoria y reglas de negocio. */
(function (g) {
  'use strict';
  const E = g.EDD = g.EDD || {};

  E.CFG = {
    url: 'https://mbbmpemzheqbvvganphs.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYm1wZW16aGVxYnZ2Z2FucGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxOTM2OTIsImV4cCI6MjEwMjc2OTY5Mn0.MdcpI0NrC_erURFPLtwtzC4ShSBGNnYLAyNpQD_TuR8',
  };

  E.MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  E.MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  E.RESULTADOS = ['Excede Expectativas', 'Alcanza Expectativas', 'Necesita Mejorar', 'Crítico'];
  E.CUMPLE = ['Cumple', 'No Cumple'];
  // Colores tomados del formato condicional de la plantilla EDD (semáforo)
  E.COLOR = {
    'Cumple': { bg: '#BDDC9C', fg: '#16300A' },
    'No Cumple': { bg: '#F37474', fg: '#3D0606' },
    'Excede Expectativas': { bg: '#4E95D9', fg: '#04121F' },
    'Alcanza Expectativas': { bg: '#92D050', fg: '#12280A' },
    'Necesita Mejorar': { bg: '#FFF06A', fg: '#3A3300' },
    'Crítico': { bg: '#DA0000', fg: '#000000' },
  };
  E.DEF = {
    base_default: 1500, garantia_pct: 75, garantia_meses: 2, garantia_regla: 'mes_ingreso',
    periodo_inicial: '2026-10', planes_min: 4, planes_max: 6, met_min: 3, met_max: 6,
    wa_inicial: 'Hola {nombre}, este es tu plan de trabajo de {mes}.\n\n*Plan de trabajo*\n{plan}\n\n*Métricos* (base {base})\n{metricos}\n\nCualquier duda, lo conversamos.\n{supervisor}',
    wa_final: 'Hola {nombre}, este es el cierre de tu evaluación de {mes}.\n\n*Resultado: {resultado}*\n\n*Plan de trabajo*\n{plan}\n\n*Métricos*\n{metricos}\nTotal a pagar: *{total}*\n\n{comentarios}\n{supervisor}',
  };

  // ---------------------------------------------------------------- utilidades
  E.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  E.r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  E.num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  E.q = n => n == null || n === '' || isNaN(n) ? '—' : 'Q' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  E.pct = n => n == null || n === '' ? '—' : (E.r2(n) + '%');
  E.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  E.norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  E.hoyISO = () => new Date().toISOString();
  E.fecha = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }); };
  E.fechaHora = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); };
  E.fechaCorta = ymd => { if (!ymd) return '—'; const [y, m, d] = String(ymd).slice(0, 10).split('-'); return d + '/' + m + '/' + y; };
  E.periodo = {
    id: (y, m) => y + '-' + String(m).padStart(2, '0'),
    partes: id => { const [y, m] = String(id).split('-').map(Number); return { y, m }; },
    nombre: id => { const { y, m } = E.periodo.partes(id); return E.MESES[m - 1] + ' ' + y; },
    hoja: id => { const { y, m } = E.periodo.partes(id); return E.MESES[m - 1] + '-' + y; },
    corto: id => { const { y, m } = E.periodo.partes(id); return E.MES_ABR[m - 1] + '-' + String(y).slice(2); },
    mesTexto: id => { const { y, m } = E.periodo.partes(id); return E.MESES[m - 1].toLowerCase() + ' de ' + y; },
    sumar: (id, n) => { const { y, m } = E.periodo.partes(id); const t = y * 12 + (m - 1) + n; return E.periodo.id(Math.floor(t / 12), (t % 12) + 1); },
    indice: id => { const { y, m } = E.periodo.partes(id); return y * 12 + (m - 1); },
    serialExcel: id => { const { y, m } = E.periodo.partes(id); return Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000); },
  };

  // DOM
  E.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  };
  E.toast = function (msg, tipo) {
    const box = document.getElementById('toasts'); if (!box) return;
    const t = E.h('div', { class: 'toast ' + (tipo || 'ok'), role: 'status' }, msg);
    box.append(t); setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4700);
  };
  E.modal = function ({ titulo, cuerpo, acciones, ancho }) {
    const root = document.getElementById('modales');
    const cerrar = () => { wrap.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') cerrar(); };
    const pie = E.h('div', { class: 'modal-pie' });
    (acciones || [{ label: 'Cerrar' }]).forEach(a => pie.append(E.h('button', {
      class: 'btn ' + (a.tipo || ''), type: 'button', onclick: async (ev) => {
        if (!a.onClick) return cerrar();
        ev.currentTarget.disabled = true;
        try { const r = await a.onClick(); if (r !== false) cerrar(); } catch (e) { E.errorToast(e); } finally { if (ev.currentTarget) ev.currentTarget.disabled = false; }
      }
    }, a.label)));
    const wrap = E.h('div', { class: 'modal-fondo', onclick: e => { if (e.target === wrap) cerrar(); } },
      E.h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', style: ancho ? { maxWidth: ancho } : null },
        E.h('div', { class: 'modal-cab' }, E.h('h2', null, titulo), E.h('button', { class: 'icono', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
        E.h('div', { class: 'modal-cuerpo' }, cuerpo), pie));
    root.append(wrap); document.addEventListener('keydown', esc);
    requestAnimationFrame(() => E.ui && E.ui.ajustarTextareas(wrap));
    const f = wrap.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
    return cerrar;
  };
  E.confirmar = (titulo, texto, label) => new Promise(res => {
    E.modal({ titulo, cuerpo: E.h('p', null, texto), acciones: [{ label: 'Cancelar', onClick: () => res(false) }, { label: label || 'Confirmar', tipo: 'primario', onClick: () => res(true) }] });
  });
  E.pedirTexto = (titulo, etiqueta, opc = {}) => new Promise(res => {
    const inp = E.h(opc.multilinea ? 'textarea' : 'input', { class: 'campo', rows: 3, value: opc.valor || '' });
    E.modal({
      titulo, cuerpo: E.h('label', { class: 'f' }, E.h('span', null, etiqueta), inp),
      acciones: [{ label: 'Cancelar', onClick: () => res(null) }, {
        label: opc.boton || 'Aceptar', tipo: 'primario', onClick: () => {
          const v = inp.value.trim(); if (opc.requerido && !v) { inp.classList.add('err'); E.toast('Este dato es obligatorio.', 'err'); return false; } res(v);
        }
      }]
    });
  });
  E.descargar = function (blob, nombre) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };
  E.errorToast = function (e) {
    console.error(e);
    E.toast(e && (e.hint || e.message) ? (e.hint || e.message) : 'Ocurrió un error inesperado.', 'err');
  };

  // ---------------------------------------------------------------- API
  class ApiError extends Error { constructor(code, hint) { super(hint || code); this.code = code; this.hint = hint; } }
  E.ApiError = ApiError;
  E.api = {
    token: null, usuario: null, rol: null,
    transporte: null, // en pruebas se reemplaza por un simulador
    async rpc(fn, args) {
      if (this.transporte) return this.transporte(fn, args);
      let res;
      try {
        res = await fetch(E.CFG.url + '/rest/v1/rpc/' + fn, {
          method: 'POST', headers: { apikey: E.CFG.key, Authorization: 'Bearer ' + E.CFG.key, 'Content-Type': 'application/json' },
          body: JSON.stringify(args || {}),
        });
      } catch (e) { throw new ApiError('RED', 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'); }
      const txt = await res.text();
      const json = txt ? JSON.parse(txt) : null;
      if (!res.ok) {
        const code = json && json.message || 'ERROR';
        const hint = json && json.hint || (json && json.message) || 'Error del servidor';
        const err = new ApiError(code, hint);
        if (code === 'EDD_SESION' && fn !== 'edd_login') setTimeout(() => E.app && E.app.sesionVencida(), 0);
        throw err;
      }
      return json;
    },
    login(clave, usuario) { return this.rpc('edd_login', { p_clave: clave, p_usuario: usuario }); },
    logout() { return this.rpc('edd_logout', { p_token: this.token }); },
    cargar() { return this.rpc('edd_cargar', { p_token: this.token }); },
    guardar(tabla, registros, motivo) { return this.rpc('edd_guardar', { p_token: this.token, p_tabla: tabla, p_registros: registros, p_motivo: motivo || null }); },
    eliminar(tabla, id, motivo) { return this.rpc('edd_eliminar', { p_token: this.token, p_tabla: tabla, p_id: id, p_motivo: motivo || null }); },
    auditoria(tabla, ids, limite) { return this.rpc('edd_auditoria_ver', { p_token: this.token, p_tabla: tabla || null, p_ids: ids || null, p_limite: limite || 300 }); },
    importaciones() { return this.rpc('edd_importaciones_ver', { p_token: this.token }); },
    cambiarClave(actual, nueva) { return this.rpc('edd_cambiar_clave', { p_token: this.token, p_actual: actual, p_nueva: nueva }); },
  };

  // ---------------------------------------------------------------- almacén
  const TABLAS = ['config', 'equipos', 'personas', 'periodos', 'planes', 'evaluaciones', 'metricos'];
  E.db = { cargado: false };
  TABLAS.forEach(t => E.db[t] = new Map());
  E.db.importaciones = new Map();

  E.cargar = async function () {
    const r = await E.api.cargar();
    TABLAS.forEach(t => {
      const m = new Map();
      (r[t] || []).forEach(x => m.set(x.id, { id: x.id, v: x.version, ua: x.updated_at, ub: x.updated_by, d: x.data || {} }));
      E.db[t] = m;
    });
    E.db.cargado = true;
    return r;
  };
  // Guarda registros {id, d, v}. Actualiza versiones locales. motivo queda en la auditoría.
  E.guardar = async function (tabla, recs, motivo) {
    recs = Array.isArray(recs) ? recs : [recs];
    if (!recs.length) return [];
    const out = [];
    for (let i = 0; i < recs.length; i += 150) {
      const lote = recs.slice(i, i + 150);
      const res = await E.api.guardar(tabla, lote.map(r => ({ id: r.id, data: r.d, version: r.v || null })), motivo);
      res.forEach((x, k) => {
        const r = lote[k];
        r.v = x.version; if (!x.sin_cambios) { r.ua = x.updated_at; r.ub = x.updated_by; }
        E.db[tabla].set(r.id, r); out.push(r);
      });
    }
    return out;
  };
  E.clonar = o => JSON.parse(JSON.stringify(o));
  E.copiaRec = r => ({ id: r.id, v: r.v, ua: r.ua, ub: r.ub, d: E.clonar(r.d) });

  E.conf = function () {
    const r = E.db.config.get('general');
    return Object.assign({}, E.DEF, r ? r.d : {});
  };
  E.plantilla = () => { const r = E.db.config.get('plantilla'); return r ? r.d : null; };

  // Consultas
  E.persona = id => E.db.personas.get(id);
  E.equipo = id => E.db.equipos.get(id);
  E.personas = (soloActivas) => [...E.db.personas.values()].filter(p => !soloActivas || p.d.activo !== false).sort((a, b) => (a.d.nombre || '').localeCompare(b.d.nombre || '', 'es'));
  E.equipos = () => [...E.db.equipos.values()].sort((a, b) => (a.d.orden || 99) - (b.d.orden || 99) || (a.d.nombre || '').localeCompare(b.d.nombre || '', 'es'));
  E.periodos = () => [...E.db.periodos.values()].sort((a, b) => a.id.localeCompare(b.id));
  E.idEval = (per, pid) => per + '|' + pid;
  E.idPlan = (per, eq, tipo) => per + '|' + eq + '|' + tipo;
  E.evaluacion = (per, pid) => E.db.evaluaciones.get(E.idEval(per, pid));
  E.metricos = (per, pid) => E.db.metricos.get(E.idEval(per, pid));
  E.miembros = (eqId, soloActivas = true) => E.personas(soloActivas).filter(p => p.d.equipo_id === eqId);
  E.nombrePersona = id => { const p = id && E.persona(id); return p ? p.d.nombre : ''; };
  E.supervisorDe = p => {
    if (!p) return '';
    if (p.d.supervisor_id) return E.nombrePersona(p.d.supervisor_id);
    const eq = p.d.equipo_id && E.equipo(p.d.equipo_id);
    return eq && eq.d.supervisor_id ? E.nombrePersona(eq.d.supervisor_id) : '';
  };
  E.supervisoresLista = () => {
    const ids = new Set();
    E.equipos().forEach(e => e.d.supervisor_id && ids.add(e.d.supervisor_id));
    E.personas(true).forEach(p => p.d.es_supervisor && ids.add(p.id));
    return [...ids].map(id => E.persona(id)).filter(Boolean).sort((a, b) => a.d.nombre.localeCompare(b.d.nombre, 'es'));
  };
  E.primerNombre = n => String(n || '').trim().split(/\s+/)[0] || '';
  E.snapshot = p => {
    const eq = p.d.equipo_id ? E.equipo(p.d.equipo_id) : null;
    return { codigo: p.d.codigo || null, nombre: p.d.nombre, rol: p.d.rol || '', equipo_id: p.d.equipo_id || null, equipo: eq ? eq.d.nombre : '', supervisor: E.supervisorDe(p) };
  };
  E.comisiona = p => { const eq = p && p.d.equipo_id && E.equipo(p.d.equipo_id); return !!(eq && eq.d.comisiona); };

  // ---------------------------------------------------------------- cálculo
  const C = E.calc = {};
  C.pago = (base, peso, cumpl) => (cumpl == null || base == null || peso == null) ? null : E.r2(Number(base) * Number(peso) / 100 * Number(cumpl) / 100);
  C.sumaPesos = items => E.r2((items || []).reduce((s, it) => s + (Number(it.peso) || 0), 0));
  C.base = (rec, p, cfg) => {
    cfg = cfg || E.conf();
    if (rec && rec.d && rec.d.cierre && rec.d.cierre.base != null) return Number(rec.d.cierre.base);
    if (p && p.d.base_comision != null && p.d.base_comision !== '') return Number(p.d.base_comision);
    return Number(cfg.base_default);
  };
  // Número de mes del gestor (1 = primer mes) según la regla configurada; null si no hay fecha.
  C.mesGestor = (fechaIngreso, periodoId, regla) => {
    if (!fechaIngreso) return null;
    const [y, m, d] = String(fechaIngreso).slice(0, 10).split('-').map(Number);
    if (!y || !m) return null;
    let inicio = y * 12 + (m - 1);
    if (regla === 'primer_mes_completo' && d > 1) inicio += 1;
    return E.periodo.indice(periodoId) - inicio + 1;
  };
  C.periodosGarantiaPropuestos = (p, cfg) => {
    cfg = cfg || E.conf();
    const f = p && p.d.fecha_ingreso; if (!f) return [];
    const [y, m, d] = f.slice(0, 10).split('-').map(Number);
    let inicio = E.periodo.id(y, m);
    if (cfg.garantia_regla === 'primer_mes_completo' && d > 1) inicio = E.periodo.sumar(inicio, 1);
    return Array.from({ length: Number(cfg.garantia_meses) || 0 }, (_, i) => E.periodo.sumar(inicio, i));
  };
  // ¿Necesita la persona confirmar sus periodos de garantía antes del cierre de periodoId?
  C.garantia = (p, periodoId, cfg) => {
    cfg = cfg || E.conf();
    const conf = p && p.d.garantia && p.d.garantia.confirmado_fecha ? p.d.garantia : null;
    const propuestos = C.periodosGarantiaPropuestos(p, cfg);
    const periodos = conf ? (conf.periodos || []) : propuestos;
    const sinFecha = !p || !p.d.fecha_ingreso;
    const relevante = sinFecha || propuestos.some(x => x >= periodoId) || periodos.includes(periodoId);
    return {
      elegible: periodos.includes(periodoId), periodos, propuestos, confirmada: !!conf, sinFecha,
      requiereConfirmar: !conf && relevante, confirmado_por: conf && conf.confirmado_por, confirmado_fecha: conf && conf.confirmado_fecha,
    };
  };
  // Resumen completo de métricos y comisión de un registro
  C.metricos = (rec, p, cfg) => {
    cfg = cfg || E.conf();
    const d = rec ? rec.d : { items: [] };
    const base = C.base(rec, p, cfg);
    const items = (d.items || []).map(it => {
      const cumpl = it.cumplimiento == null || it.cumplimiento === '' ? null : Number(it.cumplimiento);
      return Object.assign({}, it, { cumplimiento: cumpl, monto: C.pago(base, it.peso, 100), pago: C.pago(base, it.peso, cumpl) });
    });
    const suma = C.sumaPesos(items);
    const completo = items.length > 0 && items.every(it => it.cumplimiento != null);
    const calculado = E.r2(items.reduce((s, it) => s + (it.pago || 0), 0));
    const g = C.garantia(p, d.periodo_id, cfg);
    const minimo = E.r2(base * Number(cfg.garantia_pct) / 100);
    const elegible = rec && rec.d.cierre ? !!rec.d.cierre.elegible : g.elegible;
    const final = elegible ? Math.max(calculado, minimo) : calculado;
    const garantiaAplicada = elegible ? E.r2(Math.max(0, minimo - calculado)) : 0;
    const errores = [];
    if (!items.length) errores.push('No hay métricos asignados.');
    if (items.length && Math.abs(suma - 100) > 0.001) errores.push('Las ponderaciones suman ' + suma + '%; deben sumar 100%.');
    items.forEach((it, i) => {
      if (it.cumplimiento != null && (it.cumplimiento < 0 || it.cumplimiento > 100)) errores.push('Métrico ' + (i + 1) + ': el cumplimiento debe estar entre 0 y 100.');
    });
    const pendientes = [];
    items.forEach((it, i) => {
      if (it.cumplimiento == null) pendientes.push('Métrico ' + (i + 1) + ': falta el % de cumplimiento.');
      else if (it.cumplimiento < 100 && !(it.reduccion && it.reduccion.por && it.reduccion.motivo)) pendientes.push('Métrico ' + (i + 1) + ': la reducción necesita supervisor que autoriza y motivo.');
    });
    if (!(base > 0)) pendientes.push('No hay base de comisión configurada.');
    if (g.requiereConfirmar && !(rec && rec.d.cierre)) pendientes.push('Confirma los periodos de garantía de ingreso de esta persona.');
    return { base, items, suma, completo, calculado, minimo, elegible, garantiaAplicada, final: E.r2(final), errores, pendientes, garantia: g };
  };
  C.edd = rec => {
    const items = rec ? rec.d.items || [] : [];
    const evaluados = items.filter(i => i.resultado).length;
    const pendientes = [];
    if (!items.length) pendientes.push('No hay directrices en el plan.');
    if (evaluados < items.length) pendientes.push('Faltan ' + (items.length - evaluados) + ' directriz(es) por calificar.');
    if (!rec || !rec.d.resultado_final) pendientes.push('Falta el resultado final elegido por el supervisor.');
    if (!rec || !rec.d.autorizado_por) pendientes.push('Falta quién autoriza el resultado.');
    return { total: items.length, evaluados, cumple: items.filter(i => i.resultado === 'Cumple').length, pendientes };
  };
  C.estadoEdd = rec => {
    if (!rec) return { k: 'sin', t: 'Sin plan' };
    if (rec.d.cierre) return { k: 'cerrado', t: 'Cerrada' };
    if ((rec.d.items || []).some(i => i.resultado) || rec.d.resultado_final) return { k: 'proceso', t: 'En evaluación' };
    if (rec.d.plan_inicial) return { k: 'publicado', t: 'Plan publicado' };
    return { k: 'borrador', t: 'Plan en borrador' };
  };
  C.estadoMet = rec => {
    if (!rec) return { k: 'sin', t: 'Sin métricos' };
    if (rec.d.cierre) return { k: 'cerrado', t: 'Cerrado' };
    if ((rec.d.items || []).some(i => i.cumplimiento != null && i.cumplimiento !== '')) return { k: 'proceso', t: 'En evaluación' };
    if (rec.d.plan_inicial) return { k: 'publicado', t: 'Plan publicado' };
    return { k: 'borrador', t: 'Plan en borrador' };
  };

  // Mensaje de WhatsApp a partir de una plantilla con marcadores
  E.mensajeWA = function (tipo, per, p) {
    const cfg = E.conf();
    const ev = E.evaluacion(per, p.id), mt = E.metricos(per, p.id);
    const plantilla = tipo === 'final' ? cfg.wa_final : cfg.wa_inicial;
    const itemsEdd = ev ? (tipo === 'inicial' && ev.d.plan_inicial ? ev.d.plan_inicial.items.map(t => ({ texto: t })) : ev.d.items) : [];
    const plan = itemsEdd.length ? itemsEdd.map((it, i) => (i + 1) + '. ' + String(it.texto).replace(/\s*\n\s*/g, ' ') + (tipo === 'final' ? ' — ' + (it.resultado || 'Sin calificar') : '')).join('\n') : '(sin plan registrado)';
    let metricos = '(sin métricos registrados)', total = '—', base = '—';
    if (mt) {
      const r = C.metricos(mt, p, cfg);
      base = E.q(r.base);
      const fuente = tipo === 'inicial' && mt.d.plan_inicial ? mt.d.plan_inicial.items : r.items;
      metricos = fuente.map((it, i) => {
        const linea = (i + 1) + '. ' + String(it.nombre).replace(/\s*\n\s*/g, ' ') + (it.meta ? ' · Meta: ' + it.meta : '') + ' · ' + it.peso + '%';
        if (tipo !== 'final') return linea;
        const ri = r.items[i] || {};
        return linea + ' · Cumplimiento ' + E.pct(ri.cumplimiento) + ' · ' + E.q(ri.pago);
      }).join('\n');
      if (tipo === 'final') {
        metricos += '\nPago calculado: ' + E.q(r.calculado) + (r.elegible ? '\nGarantía aplicada: ' + E.q(r.garantiaAplicada) : '');
        total = E.q(r.final);
      }
    }
    const vals = {
      nombre: E.primerNombre(p.d.nombre), nombre_completo: p.d.nombre, mes: E.periodo.mesTexto(per),
      resultado: ev && ev.d.resultado_final ? ev.d.resultado_final : 'Pendiente', plan, metricos, total, base,
      comentarios: ev && ev.d.comentarios ? ev.d.comentarios : '', supervisor: E.supervisorDe(p),
    };
    return plantilla.replace(/\{(\w+)\}/g, (m, k) => k in vals ? vals[k] : m).replace(/\n{3,}/g, '\n\n').trim();
  };
  E.telefonoDigitos = t => String(t || '').replace(/\D/g, '');
})(typeof window !== 'undefined' ? window : globalThis);
