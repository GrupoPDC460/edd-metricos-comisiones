/* vistas-datos.js — Padrón, Historial, Exportar, WhatsApp, Importar y Configuración */
(function (g) {
  'use strict';
  const E = g.EDD, h = E.h, U = E.ui, A = E.app, O = E.ops, R = E.render;

  // ------------------------------------------------------------------ Padrón
  const fPad = { equipo: '', supervisor: '', q: '', estado: 'activos' };
  A.vistas.padron = function (root, args) {
    const tab = args[0] || 'personas';
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Padrón y equipos'), h('p', null, 'Gestores con su equipo, supervisor, fecha de ingreso, teléfono de WhatsApp y base de comisión. Desactivar a alguien no borra su historial.')),
      h('div', { class: 'acciones' }, U.btn('+ Agregar persona', () => modalPersona(null), 'primario'), U.btn('+ Agregar equipo', () => modalEquipo(null)))));
    root.append(U.pestanas([{ k: 'personas', t: 'Personas (' + E.db.personas.size + ')' }, { k: 'equipos', t: 'Equipos (' + E.db.equipos.size + ')' }], tab, k => { location.hash = '#/padron/' + k; }));
    if (tab === 'equipos') return pintarEquipos(root);
    const cuerpo = h('div');
    root.append(U.filtros(fPad, pintar, U.campo('Estado', U.select([{ v: 'activos', t: 'Activos' }, { v: 'inactivos', t: 'Inactivos' }, { v: 'todos', t: 'Todos' }], fPad.estado, v => { fPad.estado = v; pintar(); }))), cuerpo);
    pintar();
    function pintar() {
      const cfg = E.conf();
      cuerpo.innerHTML = '';
      const ps = U.filtrar(E.personas(false), fPad).filter(p => fPad.estado === 'todos' || (fPad.estado === 'activos' ? p.d.activo !== false : p.d.activo === false));
      cuerpo.append(U.tabla([{ t: 'Código' }, { t: 'Nombre' }, { t: 'Equipo' }, { t: 'Supervisor' }, { t: 'Ingreso' }, { t: 'WhatsApp' }, { t: 'Base', cls: 'num' }, { t: 'Estado' }],
        ps.map(p => h('tr', { class: 'clic' + (p.d.activo === false ? ' inactiva' : ''), onclick: () => modalPersona(p) },
          h('td', null, p.d.codigo || '—'), h('td', null, h('span', { class: 'nombre' }, p.d.nombre), h('span', { class: 'sub' }, (p.d.rol || '') + (p.d.es_supervisor ? ' · tiene equipo a cargo' : ''))),
          h('td', null, U.nombreEquipo(p.d.equipo_id)), h('td', null, E.supervisorDe(p) || '—'), h('td', null, p.d.fecha_ingreso ? E.fechaCorta(p.d.fecha_ingreso) : h('span', { class: 'chip proceso' }, 'Sin fecha')),
          h('td', null, p.d.telefono_wa || h('span', { class: 'muted' }, '—')),
          h('td', { class: 'num' }, E.comisiona(p) ? (p.d.base_comision != null && p.d.base_comision !== '' ? E.q(p.d.base_comision) : h('span', { class: 'muted', title: 'Base predeterminada' }, E.q(cfg.base_default))) : h('span', { class: 'muted peq' }, 'No comisiona')),
          h('td', null, p.d.activo === false ? h('span', { class: 'chip sin' }, 'Inactivo') : h('span', { class: 'chip cerrado' }, 'Activo'))))));
    }
  };
  function pintarEquipos(root) {
    root.append(U.tabla([{ t: 'Equipo' }, { t: 'Supervisor' }, { t: 'Comisión' }, { t: 'Integrantes activos', cls: 'num' }, { t: 'Estado' }],
      E.equipos().map(e => h('tr', { class: 'clic', onclick: () => modalEquipo(e) }, h('td', null, h('span', { class: 'nombre' }, e.d.nombre)), h('td', null, E.nombrePersona(e.d.supervisor_id) || h('span', { class: 'chip proceso' }, 'Sin supervisor')),
        h('td', null, e.d.comisiona ? h('span', { class: 'chip cerrado' }, 'Recibe comisión') : h('span', { class: 'chip sin' }, 'Sin comisión')), h('td', { class: 'num' }, String(E.miembros(e.id).length)),
        h('td', null, e.d.activo === false ? 'Inactivo' : 'Activo')))));
    root.append(h('p', { class: 'muted peq' }, 'Solo los equipos marcados "recibe comisión" entran en el consolidado de pago. El supervisor del equipo es el supervisor de sus integrantes, salvo que la persona tenga un supervisor directo distinto.'));
  }
  function modalPersona(p) {
    const cfg = E.conf(); const d = p ? E.clonar(p.d) : { activo: true };
    const c = {
      codigo: h('input', { class: 'campo', type: 'number', value: d.codigo || '', required: true }),
      nombre: h('input', { class: 'campo', value: d.nombre || '', required: true }),
      rol: h('input', { class: 'campo', value: d.rol || '' }),
      equipo: U.select([{ v: '', t: 'Sin asignar' }].concat(U.opcionesEquipo(false)), d.equipo_id || ''),
      sup: U.select([{ v: '', t: 'El supervisor de su equipo' }].concat(E.personas(true).filter(x => !p || x.id !== p.id).map(x => ({ v: x.id, t: x.d.nombre }))), d.supervisor_id || ''),
      fecha: h('input', { class: 'campo', type: 'date', value: d.fecha_ingreso || '' }),
      tel: h('input', { class: 'campo', value: d.telefono_wa || '', placeholder: '+502…' }),
      agente: h('input', { class: 'campo', value: d.agente || '' }),
      base: h('input', { class: 'campo num', type: 'number', min: 0, step: '0.01', value: d.base_comision == null ? '' : d.base_comision, placeholder: 'Predeterminada ' + E.q(cfg.base_default) }),
      notas: h('textarea', { class: 'campo', rows: 2 }, d.notas || ''),
      activo: h('input', { type: 'checkbox', checked: d.activo !== false }),
      esSup: h('input', { type: 'checkbox', checked: !!d.es_supervisor }),
    };
    const cuerpo = h('div', null, h('div', { class: 'rejilla' },
      U.campo('Código *', c.codigo), U.campo('Nombre completo *', c.nombre), U.campo('Rol / puesto', c.rol), U.campo('Equipo', c.equipo), U.campo('Supervisor directo', c.sup, 'Solo si es distinto al del equipo.'),
      U.campo('Fecha de ingreso', c.fecha, 'Define los meses con garantía mínima.'), U.campo('Teléfono de WhatsApp', c.tel, 'Con código de país.'), U.campo('Agente / extensión', c.agente),
      U.campo('Base de comisión (Q)', c.base, 'Vacío = base predeterminada.')),
      h('div', { style: { marginTop: '10px' } }, U.campo('Notas', c.notas)),
      h('div', { class: 'acciones', style: { marginTop: '10px' } }, h('label', { class: 'check' }, c.activo, 'Activo'), h('label', { class: 'check' }, c.esSup, 'Tiene equipo a cargo')),
      p && p.d.historial_previo ? h('p', { class: 'muted peq' }, 'Historial anterior al sistema (de su archivo EDD): ', Object.entries(p.d.historial_previo).sort().map(([m, x]) => h('span', { title: x.fuente, style: { marginRight: '6px' } }, E.periodo.corto(m) + ' ', U.sem(x.resultado)))) : null,
      p && p.d.garantia ? h('p', { class: 'muted peq' }, 'Garantía confirmada para ' + p.d.garantia.periodos.map(E.periodo.nombre).join(', ') + ' por ' + p.d.garantia.confirmado_por + '.') : null,
      p ? h('p', { class: 'muted peq' }, 'Última modificación: ' + (p.ub || '—') + ' · ' + E.fechaHora(p.ua) + (d.origen ? ' · origen: ' + d.origen.archivo + ', fila ' + d.origen.fila : '')) : null);
    E.modal({
      titulo: p ? 'Editar ' + p.d.nombre : 'Agregar persona', cuerpo, ancho: '860px', acciones: [{ label: 'Cancelar' },
      p ? { label: 'Ver cambios', onClick: () => verAuditoria([p.id], p.d.nombre) } : null,
      {
        label: 'Guardar', tipo: 'primario', onClick: async () => {
          const codigo = Number(c.codigo.value); const nombre = c.nombre.value.replace(/\s+/g, ' ').trim();
          if (!codigo) { c.codigo.classList.add('err'); throw new Error('El código es obligatorio.'); }
          if (!nombre) { c.nombre.classList.add('err'); throw new Error('El nombre es obligatorio.'); }
          const dup = E.personas().find(x => Number(x.d.codigo) === codigo && (!p || x.id !== p.id));
          if (dup) { c.codigo.classList.add('err'); throw new Error('El código ' + codigo + ' ya es de ' + dup.d.nombre + '.'); }
          const base = c.base.value === '' ? null : Number(c.base.value);
          if (base != null && !(base >= 0)) { c.base.classList.add('err'); throw new Error('La base debe ser un monto válido.'); }
          if (p && p.d.activo !== false && !c.activo.checked && !await E.confirmar('Desactivar', 'Desactivar a ' + nombre + ' lo saca de los planes nuevos y de los filtros de activos. Su historial se conserva.', 'Desactivar')) return false;
          const r = p ? E.copiaRec(p) : { id: 'p-' + codigo, d: { origen: { archivo: 'Alta manual', fila: null, fecha: E.hoyISO() } } };
          if (!p && E.db.personas.get(r.id)) r.id = 'p-' + codigo + '-' + E.uid();
          Object.assign(r.d, { codigo, nombre, rol: c.rol.value.trim(), equipo_id: c.equipo.value || null, supervisor_id: c.sup.value || null, fecha_ingreso: c.fecha.value || null, telefono_wa: c.tel.value.trim(), agente: c.agente.value.trim(), base_comision: base, notas: c.notas.value.trim(), activo: c.activo.checked, es_supervisor: c.esSup.checked });
          await E.guardar('personas', [r], p ? (p.d.equipo_id !== r.d.equipo_id ? 'cambio de equipo' : 'editar persona') : 'agregar persona');
          E.toast('Persona guardada.'); A.refrescar();
        }
      }].filter(Boolean),
    });
  }
  function modalEquipo(e) {
    const d = e ? E.clonar(e.d) : { comisiona: false, activo: true, orden: E.db.equipos.size + 1 };
    const nombre = h('input', { class: 'campo', value: d.nombre || '' });
    const sup = U.select([{ v: '', t: 'Sin supervisor' }].concat(E.personas(true).map(x => ({ v: x.id, t: x.d.nombre }))), d.supervisor_id || '');
    const com = h('input', { type: 'checkbox', checked: !!d.comisiona }), act = h('input', { type: 'checkbox', checked: d.activo !== false });
    const orden = h('input', { class: 'campo num', type: 'number', value: d.orden || 9 });
    E.modal({
      titulo: e ? 'Editar equipo' : 'Agregar equipo', cuerpo: h('div', null, h('div', { class: 'rejilla' }, U.campo('Nombre', nombre), U.campo('Supervisor', sup), U.campo('Orden', orden)),
        h('div', { class: 'acciones', style: { marginTop: '10px' } }, h('label', { class: 'check' }, com, 'Recibe comisión'), h('label', { class: 'check' }, act, 'Activo')),
        h('p', { class: 'muted peq' }, 'No se atribuye comisión a un equipo sin marcar "Recibe comisión".')),
      acciones: [{ label: 'Cancelar' },
      e ? { label: 'Eliminar', tipo: 'peligro', onClick: async () => { if (!await E.confirmar('Eliminar equipo', 'Solo se puede eliminar si no tiene personas asignadas.', 'Eliminar')) return false; await E.api.eliminar('equipos', e.id); E.db.equipos.delete(e.id); E.toast('Equipo eliminado.'); A.refrescar(); } } : null,
      {
        label: 'Guardar', tipo: 'primario', onClick: async () => {
          const n = nombre.value.trim(); if (!n) { nombre.classList.add('err'); throw new Error('Escribe el nombre del equipo.'); }
          const r = e ? E.copiaRec(e) : { id: 'eq-' + U.nombreArchivo(n).toLowerCase().replace(/_/g, '-') + '-' + E.uid().slice(-4), d: {} };
          Object.assign(r.d, { nombre: n, supervisor_id: sup.value || null, comisiona: com.checked, activo: act.checked, orden: Number(orden.value) || 9 });
          if (sup.value) { const sp = E.persona(sup.value); if (sp && !sp.d.es_supervisor) { const rs = E.copiaRec(sp); rs.d.es_supervisor = true; await E.guardar('personas', [rs], 'marcar supervisor'); } }
          await E.guardar('equipos', [r], e ? 'editar equipo' : 'crear equipo'); E.toast('Equipo guardado.'); A.refrescar();
        }
      }].filter(Boolean),
    });
  }
  function verAuditoria(ids, titulo) {
    const cuerpo = h('div', { class: 'cargando' }, 'Cargando…');
    E.modal({ titulo: 'Cambios · ' + titulo, cuerpo, ancho: '900px' });
    E.api.auditoria(null, ids).then(l => { cuerpo.className = ''; cuerpo.innerHTML = ''; cuerpo.append(U.tabla([{ t: 'Fecha' }, { t: 'Usuario' }, { t: 'Acción' }, { t: 'Detalle' }], l.map(x => h('tr', null, h('td', null, E.fechaHora(x.ts)), h('td', null, x.usuario || '—'), h('td', null, x.accion), h('td', null, O.resumenCambio(x.antes, x.despues)))))); }).catch(err => { cuerpo.textContent = err.hint || err.message; });
    return false;
  }

  // ------------------------------------------------------------------ Historial
  const fHist = { equipo: '', supervisor: '', q: '' };
  A.vistas.historial = function (root) {
    const pers = E.periodos();
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Historial y acumulado'), h('p', null, 'Solo cuentan los meses con evaluación autorizada (EDD) y métricos cerrados. Los meses en curso se muestran sin sumarse.')),
      h('div', { class: 'acciones' }, U.btn('Descargar historial (Excel)', () => descargarHistorial(filas())))));
    const cuerpo = h('div'); root.append(U.filtros(fHist, pintar), cuerpo);
    function filas() {
      return U.filtrar(E.personas(false), fHist).map(p => {
        const meses = pers.map(per => ({ per, ev: E.evaluacion(per.id, p.id), mt: E.metricos(per.id, p.id) }));
        if (!meses.some(m => m.ev || m.mt) && !p.d.historial_previo) return null;
        const conf = meses.filter(m => m.ev && m.ev.d.cierre);
        const cuenta = {}; conf.forEach(m => { cuenta[m.ev.d.resultado_final] = (cuenta[m.ev.d.resultado_final] || 0) + 1; });
        const pagado = E.r2(meses.filter(m => m.mt && m.mt.d.cierre && E.comisiona(p)).reduce((s, m) => s + m.mt.d.cierre.final, 0));
        return { p, meses, conf: conf.length, cuenta, pagado };
      }).filter(Boolean);
    }
    pintar();
    function pintar() {
      cuerpo.innerHTML = '';
      const fs = filas();
      cuerpo.append(U.tabla([{ t: 'Persona' }, { t: 'Antes del sistema' }].concat(pers.map(x => ({ t: E.periodo.corto(x.id) })), [{ t: 'Meses confirmados', cls: 'num' }, { t: 'Excede', cls: 'num' }, { t: 'Alcanza', cls: 'num' }, { t: 'Necesita mejorar', cls: 'num' }, { t: 'Crítico', cls: 'num' }, { t: 'Comisión pagada', cls: 'num' }]),
        fs.map(f => h('tr', { class: 'clic', onclick: () => { const ult = f.meses.filter(m => m.ev || m.mt).pop(); if (ult) location.hash = '#/ficha/' + ult.per.id + '/' + f.p.id; } },
          h('td', null, h('span', { class: 'nombre' }, f.p.d.nombre), h('span', { class: 'sub' }, (f.p.d.codigo || '') + ' · ' + U.nombreEquipo(f.p.d.equipo_id))),
          h('td', { class: 'peq' }, f.p.d.historial_previo ? Object.entries(f.p.d.historial_previo).sort().map(([m, x]) => h('div', { title: x.fuente }, E.periodo.corto(m) + ' ', U.sem(x.resultado))) : h('span', { class: 'muted' }, '—')),
          f.meses.map(m => h('td', null, m.ev ? (m.ev.d.cierre ? U.sem(m.ev.d.resultado_final) : h('span', { class: 'pendiente peq' }, 'en curso')) : h('span', { class: 'muted' }, '—'),
            m.mt && m.mt.d.cierre && E.comisiona(f.p) ? h('span', { class: 'sub' }, E.q(m.mt.d.cierre.final)) : null)),
          h('td', { class: 'num' }, String(f.conf)), E.RESULTADOS.map(r => h('td', { class: 'num' }, String(f.cuenta[r] || 0))), h('td', { class: 'num' }, E.q(f.pagado))))));
      const ult = h('div', { class: 'hoja', style: { marginTop: '16px' } }, h('h2', null, 'Últimos cambios registrados'), h('div', { class: 'cargando' }, 'Cargando…'));
      cuerpo.append(ult);
      E.api.auditoria(null, null, 60).then(l => { ult.lastChild.remove(); ult.append(U.tabla([{ t: 'Fecha' }, { t: 'Usuario' }, { t: 'Registro' }, { t: 'Acción' }, { t: 'Detalle' }], l.map(x => h('tr', null, h('td', null, E.fechaHora(x.ts)), h('td', null, x.usuario || '—'), h('td', null, etiquetaRegistro(x)), h('td', null, x.accion), h('td', null, O.resumenCambio(x.antes, x.despues)))))); }).catch(e => { ult.lastChild.textContent = e.hint || e.message; });
    }
  };
  function etiquetaRegistro(x) {
    const [per, pid] = String(x.registro_id).split('|');
    if (pid) return ({ evaluaciones: 'EDD', metricos: 'Métricos', planes: 'Plan de equipo' }[x.tabla] || x.tabla) + ' · ' + (E.nombrePersona(pid) || (E.equipo(pid) || { d: { nombre: pid } }).d.nombre) + ' · ' + E.periodo.corto(per);
    return ({ personas: 'Padrón', equipos: 'Equipo', periodos: 'Mes', config: 'Configuración', importaciones: 'Importación', acceso: 'Clave de acceso' }[x.tabla] || x.tabla) + ' · ' + (E.nombrePersona(x.registro_id) || (E.equipo(x.registro_id) || { d: {} }).d.nombre || x.registro_id);
  }
  function descargarHistorial(fs) {
    const pers = E.periodos();
    const enc = ['Código', 'Persona', 'Equipo'].concat(pers.map(p => 'EDD ' + E.periodo.corto(p.id)), pers.map(p => 'Pago ' + E.periodo.corto(p.id)), ['Meses confirmados'], E.RESULTADOS, ['Comisión pagada']);
    const datos = fs.map(f => [f.p.d.codigo || '', f.p.d.nombre, U.nombreEquipo(f.p.d.equipo_id)].concat(f.meses.map(m => m.ev && m.ev.d.cierre ? m.ev.d.resultado_final : ''), f.meses.map(m => m.mt && m.mt.d.cierre && E.comisiona(f.p) ? m.mt.d.cierre.final : ''), [f.conf], E.RESULTADOS.map(r => f.cuenta[r] || 0), [f.pagado]));
    E.descargar(E.excel.consolidado([enc].concat(datos), 'Historial'), 'Historial_EDD_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  // ------------------------------------------------------------------ Exportar
  const fExp = { equipo: '', supervisor: '', q: '' };
  let mesesExp = null;
  A.vistas.exportar = function (root) {
    const tpl = E.plantilla();
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Exportar EDD a Excel'), h('p', null, 'Un archivo por gestor con la hoja Resumen y una hoja por mes (por ejemplo "Octubre-2026"), con el diseño de la plantilla EDD original.'))));
    if (!tpl || !tpl.base64) { root.append(U.vacio('Falta la plantilla EDD', 'Sube el archivo EDD individual que sirve de plantilla (por ejemplo, el de un gestor) en Importar archivos o en Configuración.', U.btn('Ir a Configuración', () => { location.hash = '#/config'; }, 'primario'))); return; }
    const pers = E.periodos();
    if (!mesesExp) mesesExp = new Set(pers.map(p => p.id));
    const elegidos = new Set(); let tocado = false;
    const cuerpo = h('div');
    root.append(h('div', { class: 'hoja' }, h('h2', null, 'Meses a incluir'), h('div', { class: 'acciones' }, pers.map(p => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: mesesExp.has(p.id), onchange: e => { if (e.target.checked) mesesExp.add(p.id); else mesesExp.delete(p.id); pintar(); } }), E.periodo.nombre(p.id)))),
      h('p', { class: 'muted peq' }, 'Plantilla: ' + tpl.archivo + ' (subida por ' + tpl.subida_por + ' el ' + E.fecha(tpl.fecha) + '). En Resumen solo se escribe el resultado de meses autorizados.')));
    root.append(U.filtros(fExp, () => { tocado = false; pintar(); }), cuerpo);
    function candidatos() { return U.filtrar(E.personas(false), fExp).filter(p => [...mesesExp].some(per => E.evaluacion(per, p.id))); }
    function hojas(p) {
      return [...mesesExp].sort().map(per => ({ per, ev: E.evaluacion(per, p.id) })).filter(x => x.ev).map(x => ({ periodo: x.per, items: x.ev.d.items.map(i => ({ texto: i.texto, resultado: i.resultado })), final: x.ev.d.resultado_final || '', comentarios: x.ev.d.comentarios || '', confirmado: !!x.ev.d.cierre }));
    }
    pintar();
    function pintar() {
      cuerpo.innerHTML = '';
      const cs = candidatos();
      if (!tocado) { elegidos.clear(); cs.forEach(p => elegidos.add(p.id)); }
      const sel = cs.filter(p => elegidos.has(p.id));
      const todasHojas = sel.flatMap(hojas);
      const avisos = E.excel.revisionPrevia(todasHojas, { mesesResumen: tpl.meses_resumen || [] });
      const borrador = todasHojas.filter(x => !x.confirmado).length;
      if (borrador) avisos.push(borrador + ' hoja(s) mensual(es) corresponden a evaluaciones sin autorizar: se exportan con lo registrado, pero su resultado no se escribe en Resumen.');
      const conPrevio = sel.filter(p => p.d.historial_previo).length;
      cuerpo.append(h('div', { class: 'hoja' }, h('div', { class: 'hoja-cab' }, h('h2', null, 'Revisión antes de generar'),
        h('div', { class: 'acciones' },
          U.btn('Descargar Excel', async () => { if (sel.length !== 1) throw new Error('Elige una sola persona para descargar un archivo individual.'); await descargarUno(sel[0]); }, '', { disabled: sel.length !== 1 }),
          U.btn('Descargar ZIP (' + sel.length + ' archivos)', () => descargarZip(sel), 'primario', { disabled: !sel.length }))),
        h('p', null, h('b', null, sel.length + ' persona(s)'), ' · ' + todasHojas.length + ' hoja(s) mensual(es) · un archivo Excel separado por persona.' + (conPrevio ? ' ' + conPrevio + ' llevan además su historial anterior a ' + E.periodo.nombre(E.conf().periodo_inicial) + ' en la hoja Resumen.' : '')),
        avisos.length ? h('div', { class: 'aviso warn' }, h('b', null, 'Diferencias con la plantilla original:'), h('ul', null, avisos.map(a => h('li', null, a)))) : h('div', { class: 'aviso ok' }, 'El formato de la plantilla se conserva sin cambios para estos datos.')));
      cuerpo.append(U.tabla([{ t: '' }, { t: 'Persona' }, { t: 'Equipo' }, { t: 'Hojas' }, { t: 'Archivo' }], cs.map(p => {
        const hs = hojas(p);
        return h('tr', null, h('td', null, h('input', { type: 'checkbox', checked: elegidos.has(p.id), 'aria-label': 'Incluir a ' + p.d.nombre, onchange: e => { tocado = true; if (e.target.checked) elegidos.add(p.id); else elegidos.delete(p.id); pintar(); } })),
          h('td', null, h('span', { class: 'nombre' }, p.d.nombre)), h('td', null, U.nombreEquipo(p.d.equipo_id)),
          h('td', null, hs.map(x => E.periodo.hoja(x.periodo) + (x.confirmado ? '' : ' (sin autorizar)')).join(', ')), h('td', { class: 'peq muted' }, nombreLibro(p)));
      })));
    }
    async function descargarUno(p) { const b = await E.excel.generarLibro(tpl.base64, { codigo: p.d.codigo, nombre: p.d.nombre, rol: p.d.rol }, hojas(p), p.d.historial_previo); E.descargar(b, nombreLibro(p)); E.toast('Excel generado: ' + nombreLibro(p)); }
    async function descargarZip(sel) {
      if (!await E.confirmar('Generar ZIP', 'Se generarán ' + sel.length + ' archivos, uno por persona: ' + sel.map(p => p.d.nombre).join(', ') + '.', 'Generar')) return;
      const zip = new g.JSZip(); let n = 0;
      for (const p of sel) { zip.file(nombreLibro(p), await E.excel.generarLibro(tpl.base64, { codigo: p.d.codigo, nombre: p.d.nombre, rol: p.d.rol }, hojas(p), p.d.historial_previo)); n++; if (n % 5 === 0) E.toast('Generados ' + n + ' de ' + sel.length + '…'); }
      const blob = await zip.generateAsync({ type: 'blob' });
      const etiqueta = fExp.equipo && fExp.equipo !== '__sin' ? U.nombreArchivo(U.nombreEquipo(fExp.equipo)) : 'Padron';
      E.descargar(blob, 'EDD_' + etiqueta + '_' + new Date().toISOString().slice(0, 10) + '.zip'); E.toast('ZIP listo con ' + n + ' archivos.');
    }
  };
  const nombreLibro = p => ((p.d.codigo ? p.d.codigo + ' - ' : '') + p.d.nombre).replace(/[\\/:*?"<>|]/g, '') + '.xlsx';

  // ------------------------------------------------------------------ WhatsApp
  const fWa = { equipo: '', supervisor: '', q: '' };
  A.vistas.whatsapp = function (root) {
    const per = A.periodo;
    if (!per) { root.append(U.vacio('Sin meses', 'Crea o importa un mes primero.')); return; }
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'WhatsApp · ' + E.periodo.nombre(per)), h('p', null, 'Prepara para cada gestor el mensaje del plan (inicio de mes) o del resultado (cierre), con su imagen de EDD y métricos.'))));
    const cuerpo = h('div'); root.append(U.filtros(fWa, pintar), cuerpo); pintar();
    function lista() { return U.filtrar(E.personas(true), fWa).filter(p => E.evaluacion(per, p.id) || E.metricos(per, p.id)); }
    function pintar() {
      cuerpo.innerHTML = '';
      const ps = lista();
      cuerpo.append(h('div', { class: 'acciones', style: { marginBottom: '10px' } }, U.btn('Recorrer uno por uno (' + ps.length + ')', () => recorrer(ps, 0), 'primario', { disabled: !ps.length })));
      cuerpo.append(U.tabla([{ t: 'Persona' }, { t: 'Teléfono' }, { t: 'EDD' }, { t: 'Métricos' }, { t: 'Último mensaje' }, { t: '' }], ps.map(p => {
        const ev = E.evaluacion(per, p.id); const ult = ev && (ev.d.whatsapp || []).slice(-1)[0];
        return h('tr', null, h('td', null, h('span', { class: 'nombre' }, p.d.nombre), h('span', { class: 'sub' }, U.nombreEquipo(p.d.equipo_id))), h('td', null, p.d.telefono_wa || h('span', { class: 'chip proceso' }, 'Sin teléfono')),
          h('td', null, U.chip(E.calc.estadoEdd(ev))), h('td', null, U.chip(E.calc.estadoMet(E.metricos(per, p.id)))), h('td', { class: 'peq' }, ult ? (ult.tipo === 'final' ? 'Resultado' : 'Plan') + ' · ' + E.fecha(ult.fecha) : '—'),
          h('td', null, h('div', { class: 'acciones' }, U.btn('Plan', () => abrir(p, 'inicial'), 'mini'), U.btn('Resultado', () => abrir(p, 'final'), 'mini'))));
      })));
    }
    function abrir(p, tipo) { E.modal({ titulo: p.d.nombre, ancho: '780px', cuerpo: O.panelMensaje(per, p, { tipo }) }); }
    function recorrer(ps, i) {
      const p = ps[i];
      const cerrar = E.modal({ titulo: (i + 1) + ' de ' + ps.length + ' · ' + p.d.nombre, ancho: '780px', cuerpo: O.panelMensaje(per, p), acciones: [
        { label: '← Anterior', onClick: () => { if (i > 0) setTimeout(() => recorrer(ps, i - 1), 0); else return false; } },
        { label: 'Cerrar' },
        { label: 'Siguiente →', tipo: 'primario', onClick: () => { if (i < ps.length - 1) setTimeout(() => recorrer(ps, i + 1), 0); } }] });
      void cerrar;
    }
  };

  // ------------------------------------------------------------------ Importar
  let imp = null; // { leidos, prop, tab }
  A.vistas.importar = function (root) {
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Importar archivos'), h('p', null, 'Sube el Formato EDD (padrón), la plantilla EDD individual y los archivos de métricos. Nada se guarda hasta que revises el mapeo, los datos y las dudas, y confirmes.'))));
    if (!imp || !imp.prop) return pasoArchivos(root);
    pasoRevision(root);
  };
  function pasoArchivos(root) {
    imp = imp || { leidos: [], tab: 'resumen' };
    const lista = h('div');
    const input = h('input', { type: 'file', accept: '.xlsx,.xlsm', multiple: true, style: { display: 'none' }, onchange: e => agregar([...e.target.files]) });
    const zona = h('div', { class: 'zona-archivos' }, h('p', null, h('b', null, 'Arrastra aquí los archivos de Excel'), ' o ', h('button', { class: 'btn mini', type: 'button', onclick: () => input.click() }, 'elígelos')),
      h('p', { class: 'muted peq' }, 'Solo se leen las columnas necesarias (código, nombre, puesto, supervisor, estado, fechas de ingreso, país, teléfono corporativo, agente, EDD y MTR). Datos personales como DPI, dirección, familia o salud no se leen ni se guardan.'), input, lista);
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
    zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('sobre'); agregar([...e.dataTransfer.files]); });
    const periodo = U.select(Array.from({ length: 6 }, (_, i) => E.periodo.sumar(E.conf().periodo_inicial, i)).map(id => ({ v: id, t: E.periodo.nombre(id) })), E.conf().periodo_inicial);
    const tipos = { padron: 'Padrón (Formato EDD)', plantilla: 'Archivo EDD individual', metricos: 'Métricos de equipo' };
    const analizarBtn = U.btn('Analizar archivos', async () => {
      if (leyendo > 0) throw new Error('Espera a que termine la lectura de los archivos.');
      estado.textContent = 'Analizando…';
      imp.prop = await E.importar.analizar(imp.leidos.filter(a => a.tipo), { periodo: periodo.value }); imp.tab = 'resumen'; A.refrescar();
    }, 'primario');
    const pintarLista = () => { lista.innerHTML = ''; imp.leidos.forEach((a, i) => lista.append(h('div', { class: 'archivo' }, h('span', null, h('b', null, a.nombre), ' · ', a.tipo ? tipos[a.tipo] : h('span', { style: { color: 'var(--err)' } }, 'No se reconoce el formato')), h('button', { class: 'btn mini fantasma', type: 'button', onclick: () => { imp.leidos.splice(i, 1); pintarLista(); } }, 'Quitar')))); };
    let leyendo = 0;
    const estado = h('p', { class: 'muted peq', 'aria-live': 'polite' });
    async function agregar(files) {
      leyendo += files.length; analizarBtn.disabled = true;
      for (const f of files) {
        estado.textContent = 'Leyendo ' + f.name + '… (' + leyendo + ' pendiente' + (leyendo > 1 ? 's' : '') + ')';
        await new Promise(r => setTimeout(r, 0));
        try { const a = await E.excel.leer(f); imp.leidos = imp.leidos.filter(x => x.nombre !== a.nombre).concat([a]); } catch (e) { E.toast('No se pudo leer ' + f.name + ': ' + e.message, 'err'); }
        leyendo--; pintarLista();
      }
      estado.textContent = imp.leidos.length + ' archivo(s) listos.'; analizarBtn.disabled = leyendo > 0;
    }
    pintarLista();
    root.append(h('div', { class: 'hoja' }, zona, h('div', { class: 'rejilla', style: { marginTop: '14px' } }, U.campo('Mes al que corresponden los planes del Formato EDD', periodo, 'El sistema arranca en ' + E.periodo.nombre(E.conf().periodo_inicial) + '; no se crean meses anteriores.')),
      h('div', { class: 'acciones', style: { marginTop: '14px' } }, analizarBtn, estado)));
    E.api.importaciones().then(l => {
      if (!l.length) return;
      root.append(h('div', { class: 'hoja' }, h('h2', null, 'Importaciones anteriores'), U.tabla([{ t: 'Fecha' }, { t: 'Usuario' }, { t: 'Archivos' }, { t: 'Guardado' }], l.map(x => h('tr', null, h('td', null, E.fechaHora(x.data.fecha)), h('td', null, x.data.usuario), h('td', { class: 'peq' }, x.data.archivos.map(a => a.nombre).join(', ')),
        h('td', { class: 'peq' }, Object.entries(x.data.resumen).map(([k, v]) => v + ' ' + k).join(' · ')))))));
    }).catch(() => { });
  }
  function pasoRevision(root) {
    const prop = imp.prop;
    const pend = E.importar.pendientes(prop);
    const tabs = [{ k: 'resumen', t: 'Resumen' }, { k: 'mapeo', t: 'Mapeo detectado' }, { k: 'equipos', t: 'Equipos' }, { k: 'personas', t: 'Personas (' + prop.personas.length + ')' }, (prop.individuales || []).length ? { k: 'archivos', t: 'Archivos EDD (' + prop.individuales.length + ')' } : null, { k: 'dudas', t: 'Dudas', n: pend.length || null }, { k: 'guardar', t: 'Vista previa y confirmar' }].filter(Boolean);
    root.append(h('div', { class: 'acciones', style: { marginBottom: '10px' } }, U.btn('← Cambiar archivos', () => { imp.prop = null; A.refrescar(); }), h('span', { class: 'muted peq', title: prop.archivos.map(a => a.nombre).join('\n') }, prop.archivos.length + ' archivos: ' + Object.entries(prop.archivos.reduce((o, a) => (o[a.tipo] = (o[a.tipo] || 0) + 1, o), {})).map(([t, n]) => n + ' ' + ({ padron: 'padrón', plantilla: 'EDD individuales', metricos: 'de métricos' }[t] || t)).join(', '))));
    root.append(U.pestanas(tabs, imp.tab, k => { imp.tab = k; A.refrescar(); }));
    const c = h('div', { class: 'hoja' }); root.append(c);
    ({ resumen: tResumen, mapeo: tMapeo, equipos: tEquipos, personas: tPersonas, archivos: tArchivos, dudas: tDudas, guardar: tGuardar }[imp.tab] || tResumen)(c, prop, pend);
  }
  function tResumen(c, prop, pend) {
    const dec = prop.dudas.filter(d => d.tipo === 'decision'), av = prop.dudas.filter(d => d.tipo === 'aviso');
    c.append(h('h2', null, 'Qué se encontró'), h('ul', { class: 'lista-simple' },
      h('li', null, 'Padrón: ' + prop.personas.length + ' personas en la hoja "' + prop.padron.hoja + '" (' + prop.personas.filter(p => p.edd.length).length + ' con plan EDD, ' + prop.personas.filter(p => p.met.length).length + ' con métricos con ponderación).'),
      h('li', null, 'Archivos de métricos: ' + (prop.metricos.map(m => m.archivo + ' → ' + (m.equipo ? m.equipo.nombre : 'equipo no reconocido') + ' (' + m.resumen.length + ' personas)').join('; ') || 'ninguno') + '.'),
      h('li', null, 'Plantilla EDD: ' + (prop.plantilla ? prop.plantilla.archivo + ' · hojas ' + prop.plantilla.analisis.hojas.map(x => x.nombre + (x.oculta ? ' (oculta)' : '')).join(', ') + '. Se usa como plantilla maestra limpia, sin datos de la persona.' : 'no se subió') + ''),
      h('li', null, 'Mes de los planes: ' + E.periodo.nombre(prop.periodo) + '.')),
      h('div', { class: pend.length ? 'aviso warn' : 'aviso ok' }, pend.length ? pend.length + ' de ' + dec.length + ' decisión(es) pendientes. Revísalas en la pestaña Dudas.' : 'Todas las decisiones están resueltas.'),
      h('p', { class: 'muted' }, av.length + ' aviso(s) informativo(s) en la pestaña Dudas.'));
  }
  function tMapeo(c, prop) {
    c.append(h('h2', null, 'Columnas detectadas en el Formato EDD'), U.tabla([{ t: 'Dato' }, { t: 'Encabezado' }, { t: 'Columna' }, { t: 'Uso en el sistema' }], prop.padron.mapeo.map(m => h('tr', null, h('td', null, m.campo), h('td', null, m.encabezado), h('td', null, m.columna || h('span', { class: 'chip proceso' }, 'No encontrada')), h('td', null, m.uso)))));
    prop.metricos.forEach(m => c.append(h('h3', { style: { marginTop: '16px' } }, m.archivo), h('p', { class: 'muted peq' }, 'Hoja Resumen: "Empleado" (código y nombre), "Total" (base de comisión), "Garantizado". Hojas por persona: celda B1 (código), columna C (ponderación) y E (entregable). Columnas no usadas: ' + (m.columnasNoImportadas.join(', ') || 'ninguna') + '.')));
  }
  function tEquipos(c, prop) {
    c.append(h('h2', null, 'Equipos y supervisores'), h('p', null, 'Propuesta inicial según la estructura indicada. Puedes cambiar nombres, supervisor y si reciben comisión; después también se edita en Padrón.'));
    prop.equipos.forEach(eq => {
      const nom = h('input', { class: 'campo', value: eq.nombre, disabled: eq.existe, oninput: e => { eq.nombre = e.target.value; } });
      const sup = U.select([{ v: '', t: 'Sin supervisor por ahora' }].concat(prop.personas.map(p => ({ v: p.codigo, t: p.nombre + ' (' + p.codigo + ')' }))), eq.supervisor_codigo || '', v => {
        eq.supervisor_codigo = v ? Number(v) : null; const d = prop.dudas.find(x => x.id === 'sup:' + eq.id); if (d) { d.valor = v ? String(v) : 'pendiente'; }
      }, { disabled: eq.existe });
      const com = h('input', { type: 'checkbox', checked: eq.comisiona, disabled: eq.existe, onchange: e => { eq.comisiona = e.target.checked; } });
      c.append(h('div', { class: 'rejilla', style: { borderTop: '1px solid var(--linea-2)', paddingTop: '10px', marginTop: '10px' } }, U.campo('Equipo', nom), U.campo('Supervisor (buscado: ' + (eq.supervisorBuscado || '—') + ')', sup, eq.coincidencia || (eq.existe ? 'Ya existe en el sistema.' : 'Sin coincidencia exacta: elige o deja pendiente.')),
        h('label', { class: 'check', style: { alignSelf: 'end', paddingBottom: '10px' } }, com, 'Recibe comisión')));
    });
  }
  function tPersonas(c, prop) {
    const cfg = E.conf();
    const eqOps = [{ v: '', t: 'Sin asignar' }].concat(prop.equipos.map(e => ({ v: e.id, t: e.nombre })));
    c.append(h('h2', null, 'Datos interpretados'), h('p', null, 'Revisa y corrige antes de guardar. "Activo" viene de la columna Estado; confirma la lista en Dudas.'));
    c.append(U.tabla([{ t: 'Activo' }, { t: 'Persona' }, { t: 'Equipo' }, { t: 'Ingreso' }, { t: 'WhatsApp' }, { t: 'Base (Q)' }, { t: 'Plan EDD' }, { t: 'Métricos' }], prop.personas.map(p => {
      const act = h('input', { type: 'checkbox', checked: p.activo, disabled: p.existe, onchange: e => { p.activo = e.target.checked; } });
      const eq = U.select(eqOps, p.equipo_id, v => { p.equipo_id = v; p.equipoFuente = 'Elegido en la importación'; }, { disabled: p.existe });
      const f = h('input', { class: 'campo', type: 'date', value: p.fecha_ingreso || '', disabled: p.existe, onchange: e => { p.fecha_ingreso = e.target.value || null; } });
      const t = h('input', { class: 'campo', value: p.telefono, disabled: p.existe, oninput: e => { p.telefono = e.target.value.trim(); } });
      const b = h('input', { class: 'campo num', type: 'number', value: p.base == null ? '' : p.base, placeholder: E.q(cfg.base_default), disabled: p.existe, oninput: e => { p.base = e.target.value === '' ? null : Number(e.target.value); } });
      return h('tr', { class: p.existe ? 'inactiva' : null }, h('td', null, act), h('td', null, h('span', { class: 'nombre' }, p.nombre), h('span', { class: 'sub' }, p.codigo + ' · ' + (p.rol || '') + (p.existe ? ' · ya existe (no se modifica)' : '') + (p.lider && !p.supervisorArchivo ? ' · líder: ' + p.lider : '') + ' · estado: ' + p.estadoArchivo)),
        h('td', { style: { minWidth: '170px' } }, eq, p.equipoFuente ? h('span', { class: 'sub' }, p.equipoFuente) : null), h('td', null, f), h('td', { style: { minWidth: '150px' } }, t), h('td', { style: { width: '110px' } }, b),
        h('td', { class: 'peq' }, p.edd.length ? p.edd.length + ' directriz(es)' : '—'), h('td', { class: 'peq' }, p.met.length ? p.met.map(m => m.peso + '%').join(' / ') : '—'));
    })));
  }
  function tArchivos(c, prop) {
    const ind = prop.individuales || [];
    const sel = U.select(ind.map(x => ({ v: x.archivo, t: x.archivo + (x.an.plantillaOculta ? '' : ' (hoja de mes visible)') })), prop.plantilla && prop.plantilla.archivo, async v => {
      const x = ind.find(y => y.archivo === v); try { prop.plantilla = await E.importar.prepararPlantilla(x); E.toast('Plantilla maestra: ' + v); } catch (e) { E.errorToast(e); }
    });
    c.append(h('h2', null, 'Archivos EDD individuales'),
      h('p', null, 'Uno de ellos sirve de plantilla maestra: se le quitan los datos de la persona, las fórmulas enlazadas y las hojas de meses, y se conserva el diseño (Resumen, hoja "Plan de trabajo", semáforo, bordes y logo). Con esa plantilla se genera el archivo de cada gestor.'),
      h('div', { style: { maxWidth: '640px' } }, U.campo('Plantilla maestra', sel, 'Se recomienda una con la hoja "Mes- Año" oculta: es el formato estándar (columna de criterios de 46.9).')),
      h('h3', { style: { marginTop: '16px' } }, 'Resultados anteriores a ' + E.periodo.nombre(E.conf().periodo_inicial)),
      h('p', { class: 'muted peq' }, 'Leídos de la hoja Resumen y de las hojas de cada mes. Solo se usan si en Dudas eliges incluirlos; se escriben como historial en la hoja Resumen del Excel. Pasa el cursor sobre un resultado para ver de dónde viene.'));
    const meses = [...new Set(prop.personas.flatMap(p => Object.keys(p.historial || {})))].sort();
    c.append(U.tabla([{ t: 'Persona' }, { t: 'Archivo' }].concat(meses.map(m => ({ t: E.periodo.corto(m) }))), prop.personas.filter(p => p.archivoEdd).map(p => h('tr', null,
      h('td', null, h('span', { class: 'nombre' }, p.nombre), h('span', { class: 'sub' }, p.codigo)), h('td', { class: 'peq muted' }, p.archivoEdd),
      meses.map(m => { const x = (p.historial || {})[m]; if (!x) return h('td', null, h('span', { class: 'muted' }, '—'));
        return h('td', { title: x.fuente + (x.excluido ? ' · no se incluye: ' + x.excluido : '') + (x.conflicto ? ' · dos valores distintos: decide en Dudas' : '') },
          x.excluido ? h('span', { class: 'pendiente peq' }, 'excluido') : U.sem(x.valor, x.conflicto ? 'Por decidir' : '—'), !x.opciones.resumen && !x.excluido ? h('span', { class: 'sub' }, 'solo en hoja') : null); })))));
  }
  function tDudas(c, prop) {
    const dec = prop.dudas.filter(d => d.tipo === 'decision'), av = prop.dudas.filter(d => d.tipo === 'aviso');
    c.append(h('h2', null, 'Decisiones (' + dec.length + ')'), h('p', null, 'El sistema no resuelve contradicciones por su cuenta: elige una opción en cada caso.'));
    dec.forEach(d => {
      const box = h('div', { class: 'duda decision' + (d.valor != null && d.valor !== '' ? ' resuelta' : '') }, h('span', { class: 'etq' }, d.area), h('h4', null, d.titulo), h('p', { class: 'peq' }, d.detalle));
      d.opciones.forEach(o => box.append(h('label', { class: 'opcion' }, h('input', { type: d.opciones.length === 1 ? 'checkbox' : 'radio', name: d.id, checked: d.valor === o.valor, onchange: e => {
        d.valor = e.target.checked ? o.valor : null; E.importar.aplicarDecision(prop, d); box.classList.toggle('resuelta', d.valor != null);
        const n = document.querySelector('.pestanas .contador'); const p2 = E.importar.pendientes(prop).length; if (n) { n.textContent = p2; n.hidden = !p2; }
      } }), o.etiqueta)));
      c.append(box);
    });
    c.append(h('h2', { style: { marginTop: '18px' } }, 'Avisos (' + av.length + ')'));
    av.forEach(d => c.append(h('div', { class: 'duda' }, h('span', { class: 'etq' }, d.area), h('h4', null, d.titulo), h('p', { class: 'peq' }, d.detalle))));
  }
  function tGuardar(c, prop, pend) {
    let reg;
    try { reg = E.importar.construirRegistros(prop); } catch (e) { c.append(h('div', { class: 'aviso err' }, e.message)); return; }
    const pub = h('input', { type: 'checkbox', checked: prop.publicarInicial, onchange: e => { prop.publicarInicial = e.target.checked; } });
    c.append(h('h2', null, 'Esto es lo que se guardará'), h('ul', { class: 'lista-simple' },
      h('li', null, reg.equipos.length + ' equipo(s) nuevo(s): ' + (reg.equipos.map(e => e.d.nombre + (e.d.comisiona ? ' (comisión)' : '')).join(', ') || '—')),
      h('li', null, reg.personas.length + ' persona(s) nueva(s) en el padrón (' + reg.personas.filter(p => p.d.activo).length + ' activas).'),
      h('li', null, 'Mes: ' + E.periodo.nombre(prop.periodo) + (reg.periodo ? ' (nuevo)' : ' (ya existe)') + '.'),
      h('li', null, 'Planes comunes de equipo detectados: ' + (reg.planes.map(p => (prop.equipos.find(e => e.id === p.d.equipo_id) || {}).nombre + ' · ' + (p.d.tipo === 'edd' ? p.d.items.length + ' directrices' : p.d.items.length + ' métricos')).join('; ') || 'ninguno') + '.'),
      h('li', null, reg.evals.length + ' evaluación(es) EDD con resultados en blanco (' + reg.evals.filter(e => e.d.excepcion).length + ' con plan individual distinto al del equipo: ' + (reg.evals.filter(e => e.d.excepcion).map(e => e.d.snapshot.nombre).join(', ') || 'ninguna') + ').'),
      h('li', null, reg.mets.length + ' plan(es) de métricos sin resultados.')),
      h('label', { class: 'check' }, pub, 'Registrar estos planes como la versión inicial publicada de ' + E.periodo.nombre(prop.periodo)),
      pend.length ? h('div', { class: 'aviso warn' }, 'Faltan ' + pend.length + ' decisión(es): ' + pend.map(d => d.titulo).join(' · ')) : null,
      h('div', { class: 'acciones', style: { marginTop: '14px' } }, U.btn('Confirmar e importar', async (ev) => {
        const b = ev.currentTarget; const prog = t => { b.textContent = 'Guardando: ' + t + '…'; };
        const r = await E.importar.aplicar(prop, prog);
        imp = null; await E.cargar(); A.periodo = prop.periodo; try { localStorage.setItem('edd_periodo', prop.periodo); } catch (e) { }
        E.toast('Importación lista: ' + r.personas + ' personas, ' + r.evaluaciones + ' EDD y ' + r.metricos + ' planes de métricos.');
        location.hash = '#/panel';
      }, 'primario', { disabled: !!pend.length })));
  }

  // ------------------------------------------------------------------ Configuración
  A.vistas.config = function (root) {
    const cfg = E.conf(); const rec = E.db.config.get('general');
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Configuración'), h('p', null, 'Reglas de comisión y garantía, textos de WhatsApp, plantilla EDD y acceso.'))));
    const c = {
      base: h('input', { class: 'campo num', type: 'number', min: 0, step: '0.01', value: cfg.base_default }),
      gpct: h('input', { class: 'campo num', type: 'number', min: 0, max: 100, value: cfg.garantia_pct }),
      gmes: h('input', { class: 'campo num', type: 'number', min: 0, max: 12, value: cfg.garantia_meses }),
      regla: U.select([{ v: 'mes_ingreso', t: 'El mes de ingreso cuenta como mes 1' }, { v: 'primer_mes_completo', t: 'El primer mes completo cuenta como mes 1' }], cfg.garantia_regla),
      pmax: h('input', { class: 'campo num', type: 'number', min: 1, max: 8, value: cfg.planes_max }),
      mmax: h('input', { class: 'campo num', type: 'number', min: 1, max: 10, value: cfg.met_max }),
      wai: h('textarea', { class: 'campo', rows: 8 }, cfg.wa_inicial), waf: h('textarea', { class: 'campo', rows: 10 }, cfg.wa_final),
    };
    root.append(h('div', { class: 'hoja' }, h('h2', null, 'Comisión y garantía'), h('div', { class: 'rejilla' },
      U.campo('Base de comisión predeterminada (Q)', c.base, 'Es el 100 % de la comisión. Las bases personales se editan en Padrón.'), U.campo('Garantía mínima (% de la base)', c.gpct), U.campo('Meses con garantía', c.gmes), U.campo('Cómo se cuentan los meses', c.regla),
      U.campo('Máximo de planes EDD por mes', c.pmax), U.campo('Máximo de métricos por persona', c.mmax)),
      h('p', { class: 'muted peq' }, 'Pago de cada métrico = base × ponderación × % de cumplimiento (0 a 100). Las ponderaciones de cada persona deben sumar 100 %. Mes inicial del sistema: ' + E.periodo.nombre(cfg.periodo_inicial) + '.')));
    root.append(h('div', { class: 'hoja' }, h('h2', null, 'Mensajes de WhatsApp'), h('p', { class: 'muted peq' }, 'Marcadores: {nombre}, {nombre_completo}, {mes}, {plan}, {metricos}, {base}, {resultado}, {total}, {comentarios}, {supervisor}.'),
      h('div', { class: 'dos' }, U.campo('Inicio de mes (plan)', c.wai), U.campo('Cierre (resultado)', c.waf))));
    root.append(h('div', { class: 'acciones', style: { marginBottom: '16px' } }, U.btn('Guardar configuración', async () => {
      const d = Object.assign({}, rec ? rec.d : E.DEF, {
        base_default: Number(c.base.value), garantia_pct: Number(c.gpct.value), garantia_meses: Number(c.gmes.value), garantia_regla: c.regla.value,
        planes_max: Number(c.pmax.value), met_max: Number(c.mmax.value), wa_inicial: c.wai.value, wa_final: c.waf.value,
      });
      if (!(d.base_default > 0)) throw new Error('La base predeterminada debe ser mayor que 0.');
      if (!(d.garantia_pct >= 0 && d.garantia_pct <= 100)) throw new Error('La garantía debe estar entre 0 y 100 %.');
      await E.guardar('config', [{ id: 'general', v: rec ? rec.v : null, d }], 'configuración'); E.toast('Configuración guardada.'); A.refrescar();
    }, 'primario')));
    const tpl = E.plantilla();
    const archivo = h('input', { type: 'file', accept: '.xlsx', style: { display: 'none' }, onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const a = await E.excel.leer(f);
        if (a.tipo !== 'plantilla') throw new Error('El archivo no parece una plantilla EDD individual (necesita la hoja "Resumen" y la hoja oculta de mes).');
        const limpia = await E.excel.limpiarPlantilla(a.buf); const meses = await E.excel.mesesDePlantilla(limpia.base64); const an = await E.excel.analizarPlantilla(a);
        const prev = E.db.config.get('plantilla');
        await E.guardar('config', [{ id: 'plantilla', v: prev ? prev.v : null, d: { archivo: f.name, base64: limpia.base64, logo: limpia.logo, hoja_mes: limpia.hojaMes, meses_resumen: meses, hojas: an.hojas, subida_por: E.api.usuario, fecha: E.hoyISO() } }], 'reemplazar plantilla');
        E.toast('Plantilla actualizada.'); A.refrescar();
      } catch (err) { E.errorToast(err); }
    } });
    root.append(h('div', { class: 'hoja' }, h('h2', null, 'Plantilla EDD de Excel'),
      tpl ? h('p', null, tpl.archivo + ' · subida por ' + tpl.subida_por + ' el ' + E.fechaHora(tpl.fecha) + '. Hojas: ' + (tpl.hojas || []).map(x => x.nombre).join(', ') + '. Meses en Resumen: ' + ((tpl.meses_resumen || [])[0] || '—') + ' a ' + ((tpl.meses_resumen || []).slice(-1)[0] || '—') + '.') : h('p', null, 'No hay plantilla. Sube el archivo EDD individual de cualquier gestor: el sistema quita sus datos y conserva el formato.'),
      archivo, U.btn(tpl ? 'Reemplazar plantilla' : 'Subir plantilla', () => archivo.click())));
    const actual = h('input', { class: 'campo', type: 'password', autocomplete: 'current-password' }), nueva = h('input', { class: 'campo', type: 'password', autocomplete: 'new-password' });
    root.append(h('div', { class: 'hoja' }, h('h2', null, 'Acceso'), h('p', null, 'Versión actual: todas las personas con la clave pueden consultar y editar. La base ya tiene preparados los roles "supervisor" (editar) y "consulta" (solo ver) para activarlos después con claves separadas.'),
      h('div', { class: 'rejilla' }, U.campo('Clave actual', actual), U.campo('Clave nueva (mínimo 8 caracteres)', nueva)),
      h('div', { class: 'acciones', style: { marginTop: '10px' } }, U.btn('Cambiar clave', async () => { await E.api.cambiarClave(actual.value, nueva.value); actual.value = nueva.value = ''; E.toast('Clave cambiada. Las otras sesiones abiertas se cerraron.'); }, 'primario')),
      h('p', { class: 'muted peq' }, 'Sesión: ' + E.api.usuario + '. Cada cambio queda registrado con este nombre.')));
  };
})(window);
