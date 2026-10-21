/* vistas-mes.js — Panel del mes y Planes del mes (planes comunes por equipo, excepciones, garantía) */
(function (g) {
  'use strict';
  const E = g.EDD, h = E.h, U = E.ui, A = E.app;
  const O = E.ops = {};

  // ------------------------------------------------------------------ operaciones
  O.esSupervisorDeEquipo = p => E.equipos().some(e => e.d.supervisor_id === p.id);
  O.mesCerrado = per => { const p = E.db.periodos.get(per); return !!(p && p.d.estado === 'cerrado'); };
  O.nuevaEval = (per, p, items) => ({ id: E.idEval(per, p.id), d: { periodo_id: per, persona_id: p.id, snapshot: E.snapshot(p), items, excepcion: false, resultado_final: null, comentarios: '', autorizado_por: null, plan_inicial: null, cierre: null } });
  O.nuevoMet = (per, p, items) => ({ id: E.idEval(per, p.id), d: { periodo_id: per, persona_id: p.id, snapshot: E.snapshot(p), items, excepcion: false, plan_inicial: null, cierre: null } });
  O.itemEdd = (t, origen) => ({ id: t.id || 'e' + E.uid(), texto: t.texto || '', origen: origen || 'individual', resultado: null });
  O.itemMet = (t, origen) => ({ id: t.id || 'm' + E.uid(), nombre: t.nombre || '', meta: t.meta || '', peso: t.peso == null ? null : Number(t.peso), resultado: '', cumplimiento: null, notas: '', responsable: '', reduccion: null, origen: origen || 'individual' });

  // Calcula qué pasaría al aplicar un plan de equipo a cada integrante
  O.previaAplicar = function (per, eqId, tipo) {
    const plan = E.db.planes.get(E.idPlan(per, eqId, tipo));
    return E.miembros(eqId).filter(p => !O.esSupervisorDeEquipo(p)).map(p => {
      const rec = tipo === 'edd' ? E.evaluacion(per, p.id) : E.metricos(per, p.id);
      let estado = 'nuevo', motivo = 'Se crea su plan con el plan del equipo.';
      if (rec && rec.d.cierre) { estado = 'cerrado'; motivo = 'Ya está cerrado; no se modifica.'; }
      else if (rec && (rec.d.excepcion || (tipo === 'met' && (rec.d.items || []).some(i => i.origen === 'individual')))) { estado = 'excepcion'; motivo = 'Tiene un plan individual (excepción); se conserva salvo que marques reemplazarlo.'; }
      else if (rec) { estado = 'actualiza'; motivo = tipo === 'edd' ? 'Se actualizan las directrices del equipo y se conservan las individuales.' : 'Se actualizan los métricos del equipo.'; }
      if (plan && tipo === 'edd' && rec && estado === 'actualiza') {
        const total = plan.d.items.length + rec.d.items.filter(i => i.origen === 'individual').length;
        if (total > E.conf().planes_max) { estado = 'excede'; motivo = 'Quedaría con ' + total + ' directrices (máximo ' + E.conf().planes_max + ').'; }
      }
      return { p, rec, estado, motivo };
    });
  };
  O.aplicarPlan = async function (per, eqId, tipo, filas, reemplazar) {
    const plan = E.db.planes.get(E.idPlan(per, eqId, tipo));
    if (!plan || !plan.d.items.length) throw new Error('Guarda primero el plan del equipo.');
    const recs = [];
    filas.forEach(({ p, rec, estado }) => {
      if (estado === 'cerrado' || estado === 'excede') return;
      if (estado === 'excepcion' && !reemplazar.has(p.id)) return;
      if (tipo === 'edd') {
        const prev = new Map((rec ? rec.d.items : []).map(i => [i.id, i]));
        const eq = plan.d.items.map(t => { const ant = prev.get(t.id); return { id: t.id, texto: t.texto, origen: 'equipo', resultado: ant && ant.texto === t.texto ? ant.resultado : null }; });
        const indiv = estado === 'excepcion' ? [] : (rec ? rec.d.items.filter(i => i.origen === 'individual') : []);
        const r = rec ? E.copiaRec(rec) : O.nuevaEval(per, p, []);
        r.d.items = eq.concat(indiv); r.d.excepcion = false; r.d.snapshot = E.snapshot(p);
        recs.push(r);
      } else {
        const prev = new Map((rec ? rec.d.items : []).map(i => [i.id, i]));
        const items = plan.d.items.map(t => {
          const ant = prev.get(t.id); const base = O.itemMet(t, 'equipo');
          if (ant && ant.nombre === t.nombre && Number(ant.peso) === Number(t.peso)) Object.assign(base, { resultado: ant.resultado, cumplimiento: ant.cumplimiento, notas: ant.notas, responsable: ant.responsable, reduccion: ant.reduccion });
          return base;
        });
        const r = rec ? E.copiaRec(rec) : O.nuevoMet(per, p, []);
        r.d.items = items; r.d.excepcion = false; r.d.snapshot = E.snapshot(p);
        recs.push(r);
      }
    });
    const ahora = E.hoyISO();
    await E.guardar(tipo === 'edd' ? 'evaluaciones' : 'metricos', recs, 'aplicar plan de equipo');
    const pl = E.copiaRec(plan); pl.d.aplicado = { por: E.api.usuario, fecha: ahora, personas: recs.map(r => r.d.persona_id) };
    await E.guardar('planes', [pl], 'aplicar plan de equipo');
    return recs.length;
  };
  O.publicarIniciales = async function (per, filtroIds) {
    const ahora = E.hoyISO(), quien = E.api.usuario;
    const evs = [...E.db.evaluaciones.values()].filter(r => r.d.periodo_id === per && !r.d.plan_inicial && r.d.items.length && (!filtroIds || filtroIds.has(r.d.persona_id))).map(r => { const c = E.copiaRec(r); c.d.plan_inicial = { items: c.d.items.map(i => i.texto), por: quien, fecha: ahora }; return c; });
    const mts = [...E.db.metricos.values()].filter(r => r.d.periodo_id === per && !r.d.plan_inicial && r.d.items.length && (!filtroIds || filtroIds.has(r.d.persona_id))).map(r => {
      const c = E.copiaRec(r);
      if (Math.abs(E.calc.sumaPesos(c.d.items) - 100) > 0.001) return null;
      c.d.plan_inicial = { items: c.d.items.map(i => ({ nombre: i.nombre, meta: i.meta, peso: i.peso })), base: E.calc.base(c, E.persona(c.d.persona_id)), por: quien, fecha: ahora }; return c;
    }).filter(Boolean);
    await E.guardar('evaluaciones', evs, 'publicar plan inicial');
    await E.guardar('metricos', mts, 'publicar plan inicial');
    return evs.length + mts.length;
  };

  // ------------------------------------------------------------------ Panel
  A.vistas.panel = function (root) {
    const per = A.periodo;
    if (!per) {
      root.append(U.vacio('Todavía no hay meses', 'Importa el Formato EDD para crear el padrón y los planes de ' + E.periodo.nombre(E.conf().periodo_inicial) + ', o crea el primer mes.',
        U.btn('Importar archivos', () => { location.hash = '#/importar'; }, 'primario'), U.btn('Crear mes', () => A.nuevoMes())));
      return;
    }
    const f = A.filtros;
    root.append(h('div', { class: 'cab' }, h('div', null, h('h1', null, 'Panel de ' + E.periodo.nombre(per)), h('p', null, 'Resultado EDD de cada gestor y, para los equipos con comisión, el consolidado de métricos, garantía y total a pagar.')),
      h('div', { class: 'acciones' }, U.btn('Descargar consolidado (Excel)', () => descargarConsolidado(per, filasPanel(per, f), 'xlsx'), 'primario'), U.btn('CSV', () => descargarConsolidado(per, filasPanel(per, f), 'csv')))));
    const cuerpo = h('div');
    root.append(U.filtros(f, pintar), cuerpo);
    pintar();
    function pintar() {
      cuerpo.innerHTML = '';
      const filas = filasPanel(per, f);
      const conEv = filas.filter(x => x.ev), cerradas = conEv.filter(x => x.ev.d.cierre);
      const com = filas.filter(x => x.com && x.mt);
      const totalFinal = E.r2(com.reduce((s, x) => s + x.rm.final, 0));
      const metCerr = com.filter(x => x.mt.d.cierre).length;
      const dist = {}; cerradas.forEach(x => { dist[x.ev.d.resultado_final] = (dist[x.ev.d.resultado_final] || 0) + 1; });
      cuerpo.append(h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('span', null, 'EDD autorizadas'), h('b', null, cerradas.length + ' / ' + conEv.length),
          h('div', { class: 'barra-res', title: E.RESULTADOS.map(r => r + ': ' + (dist[r] || 0)).join(' · ') }, E.RESULTADOS.map(r => dist[r] ? h('i', { style: { width: (dist[r] / Math.max(1, conEv.length) * 100) + '%', background: E.COLOR[r].bg } }) : null))),
        h('div', { class: 'kpi' }, h('span', null, 'Métricos cerrados (equipos con comisión)'), h('b', null, metCerr + ' / ' + com.length)),
        h('div', { class: 'kpi' }, h('span', null, 'Total a pagar ' + (metCerr === com.length && com.length ? '(todo cerrado)' : '(proyectado con lo registrado)')), h('b', null, E.q(totalFinal))),
        h('div', { class: 'kpi' }, h('span', null, 'Sin plan este mes'), h('b', null, String(filas.filter(x => !x.ev && !x.mt).length)))));
      const trs = filas.map(x => {
        const est = E.calc.estadoEdd(x.ev), em = E.calc.estadoMet(x.mt);
        return h('tr', { class: 'clic' + (x.p.d.activo === false ? ' inactiva' : ''), onclick: () => { location.hash = '#/ficha/' + per + '/' + x.p.id; } },
          h('td', null, h('span', { class: 'nombre' }, x.p.d.nombre), h('span', { class: 'sub' }, (x.p.d.codigo || 's/c') + ' · ' + U.nombreEquipo(x.p.d.equipo_id) + (x.p.d.activo === false ? ' · inactivo' : ''))),
          h('td', null, E.supervisorDe(x.p) || h('span', { class: 'muted' }, '—')),
          h('td', null, U.chip(est), x.ev && x.ev.d.excepcion ? h('div', null, h('span', { class: 'chip exc' }, 'Excepción')) : null),
          h('td', null, x.ev ? U.sem(x.ev.d.resultado_final, 'Pendiente') : h('span', { class: 'muted' }, '—')),
          h('td', null, x.mt ? U.chip(em) : (x.com ? h('span', { class: 'chip sin' }, 'Sin métricos') : h('span', { class: 'muted peq' }, 'No comisiona'))),
          h('td', { class: 'num' }, x.com && x.mt ? E.q(x.rm.base) : '—'),
          h('td', { class: 'num' }, x.com && x.mt ? E.q(x.rm.calculado) : '—'),
          h('td', { class: 'num' }, x.com && x.mt ? (x.rm.elegible ? E.q(x.rm.garantiaAplicada) : '—') : '—'),
          h('td', { class: 'num' }, x.com && x.mt ? h('b', null, E.q(x.rm.final)) : '—'));
      });
      const pie = com.length ? h('tr', null, h('td', { colspan: 5 }, 'Total equipos con comisión (' + com.length + ' personas)'),
        h('td', { class: 'num' }, E.q(com.reduce((s, x) => s + x.rm.base, 0))), h('td', { class: 'num' }, E.q(com.reduce((s, x) => s + x.rm.calculado, 0))),
        h('td', { class: 'num' }, E.q(com.reduce((s, x) => s + (x.rm.elegible ? x.rm.garantiaAplicada : 0), 0))), h('td', { class: 'num' }, E.q(totalFinal))) : null;
      cuerpo.append(U.tabla([{ t: 'Gestor' }, { t: 'Supervisor' }, { t: 'EDD' }, { t: 'Resultado EDD' }, { t: 'Métricos' }, { t: 'Base', cls: 'num' }, { t: 'Calculado', cls: 'num' }, { t: 'Garantía', cls: 'num' }, { t: 'Total a pagar', cls: 'num' }], trs, pie));
      cuerpo.append(h('p', { class: 'muted peq' }, 'El total solo suma a personas de equipos marcados "recibe comisión" que tienen métricos. Haz clic en una fila para abrir su evaluación.'));
    }
  };
  function filasPanel(per, f) {
    const cfg = E.conf();
    let ps = E.personas(false).filter(p => E.evaluacion(per, p.id) || E.metricos(per, p.id) || (p.d.activo !== false && p.d.equipo_id && !O.esSupervisorDeEquipo(p)));
    ps = U.filtrar(ps, f);
    return ps.map(p => { const mt = E.metricos(per, p.id); return { p, ev: E.evaluacion(per, p.id), mt, rm: mt ? E.calc.metricos(mt, p, cfg) : null, com: E.comisiona(p) }; });
  }
  O.filasPanel = filasPanel;
  function descargarConsolidado(per, filas, formato) {
    const com = filas.filter(x => x.com && x.mt && x.rm.base > 0);
    if (!com.length) { E.toast('No hay personas con comisión configurada en este filtro.', 'warn'); return; }
    const enc = ['Código', 'Gestor', 'Equipo', 'Supervisor', 'Métricos', 'Base comisión', 'Pago calculado', 'Garantía aplicada', 'Total a pagar', 'Estado métricos', 'Resultado EDD', 'Estado EDD'];
    const datos = com.map(x => [x.p.d.codigo || '', x.p.d.nombre, U.nombreEquipo(x.p.d.equipo_id), E.supervisorDe(x.p), x.rm.items.length, x.rm.base, x.rm.calculado, x.rm.elegible ? x.rm.garantiaAplicada : 0, x.rm.final, E.calc.estadoMet(x.mt).t, x.ev ? x.ev.d.resultado_final || '' : '', E.calc.estadoEdd(x.ev).t]);
    const tot = ['', 'TOTAL', '', '', '', E.r2(com.reduce((s, x) => s + x.rm.base, 0)), E.r2(com.reduce((s, x) => s + x.rm.calculado, 0)), E.r2(com.reduce((s, x) => s + (x.rm.elegible ? x.rm.garantiaAplicada : 0), 0)), E.r2(com.reduce((s, x) => s + x.rm.final, 0)), '', '', ''];
    const nombre = 'Consolidado_comisiones_' + E.periodo.hoja(per);
    if (formato === 'csv') {
      const csv = [enc].concat(datos, [tot]).map(f => f.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      E.descargar(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), nombre + '.csv');
    } else E.descargar(E.excel.consolidado([enc].concat(datos, [tot]), E.periodo.hoja(per)), nombre + '.xlsx');
    E.toast('Consolidado descargado: ' + com.length + ' personas (sin las que no tienen comisión configurada).');
  }
  O.descargarConsolidado = descargarConsolidado;

  // ------------------------------------------------------------------ Planes del mes
  A.vistas.planes = function (root) {
    const per = A.periodo;
    if (!per) { root.append(U.vacio('Crea el primer mes', 'Los planes se definen por mes.', U.btn('Crear mes', () => A.nuevoMes(), 'primario'))); return; }
    const periodo = E.db.periodos.get(per); const cfg = E.conf(); const cerrado = O.mesCerrado(per);
    const sinPublicar = [...E.db.evaluaciones.values(), ...E.db.metricos.values()].filter(r => r.d.periodo_id === per && !r.d.plan_inicial && (r.d.items || []).length).length;
    const num = h('input', { class: 'campo num', type: 'number', min: 1, max: cfg.planes_max, value: periodo.d.num_planes || 5, style: { width: '90px' }, disabled: cerrado });
    root.append(h('div', { class: 'cab' },
      h('div', null, h('h1', null, 'Planes de ' + E.periodo.nombre(per)), h('p', null, 'Define el plan común de cada equipo y aplícalo a sus integrantes. Las excepciones se editan en la ficha de cada persona.')),
      h('div', { class: 'acciones' },
        U.btn('Publicar planes iniciales (' + sinPublicar + ')', async () => {
          if (!sinPublicar) { E.toast('Todos los planes con contenido ya tienen su versión inicial.'); return; }
          if (!await E.confirmar('Publicar planes iniciales', 'Se guarda una copia de la versión inicial de ' + sinPublicar + ' plan(es) EDD y de métricos de ' + E.periodo.nombre(per) + ', con tu nombre y la fecha. Esa copia no cambia aunque luego se edite el plan.', 'Publicar')) return;
          const n = await O.publicarIniciales(per); E.toast(n + ' plan(es) publicados.'); A.refrescar();
        }, 'primario', { disabled: cerrado }),
        U.btn(cerrado ? 'Reabrir mes' : 'Cerrar mes', () => alternarMes(per), cerrado ? '' : 'peligro'))));
    if (cerrado) root.append(h('div', { class: 'aviso warn' }, 'Este mes está cerrado: sus planes, evaluaciones y métricos no se pueden editar. Reábrelo indicando el motivo si necesitas corregir algo.'));
    root.append(h('div', { class: 'hoja' }, h('div', { class: 'hoja-cab' }, h('div', null, h('h2', null, 'Cantidad de planes de trabajo del mes'), h('p', { class: 'muted' }, 'Normalmente entre 4 y 6. La plantilla de Excel trae 5 filas; con más se agregan filas con el mismo formato.')),
      h('div', { class: 'acciones' }, num, U.btn('Guardar', async () => {
        const n = Number(num.value); if (!(n >= 1 && n <= cfg.planes_max)) { num.classList.add('err'); throw new Error('La cantidad debe estar entre 1 y ' + cfg.planes_max + '.'); }
        const r = E.copiaRec(periodo); r.d.num_planes = n; await E.guardar('periodos', [r], 'cantidad de planes'); E.toast('Cantidad de planes guardada.'); A.refrescar();
      }, '', { disabled: cerrado })))));
    const equipos = E.equipos().filter(e => e.d.activo !== false);
    if (!equipos.length) root.append(U.vacio('No hay equipos', 'Crea los equipos en Padrón o importa el Formato EDD.', U.btn('Ir a Padrón', () => { location.hash = '#/padron'; })));
    equipos.forEach(eq => root.append(tarjetaEquipo(per, eq, periodo, cerrado)));
    root.append(seccionGarantia(per));
    const sinEquipo = E.personas(true).filter(p => !p.d.equipo_id && !O.esSupervisorDeEquipo(p) && !p.d.es_supervisor);
    if (sinEquipo.length) root.append(h('div', { class: 'hoja' }, h('h2', null, 'Personas sin equipo'), h('p', null, 'No reciben planes de equipo. Abre su ficha para crear un plan individual o asígnales equipo en Padrón.'),
      U.tabla([{ t: 'Persona' }, { t: 'EDD' }, { t: 'Métricos' }], sinEquipo.map(p => h('tr', { class: 'clic', onclick: () => { location.hash = '#/ficha/' + per + '/' + p.id; } },
        h('td', null, h('span', { class: 'nombre' }, p.d.nombre), h('span', { class: 'sub' }, p.d.codigo || '')), h('td', null, U.chip(E.calc.estadoEdd(E.evaluacion(per, p.id)))), h('td', null, U.chip(E.calc.estadoMet(E.metricos(per, p.id)))))))));
  };

  async function alternarMes(per) {
    const r = E.copiaRec(E.db.periodos.get(per));
    if (r.d.estado === 'cerrado') {
      const motivo = await E.pedirTexto('Reabrir ' + E.periodo.nombre(per), 'Motivo de la reapertura', { requerido: true, boton: 'Reabrir' }); if (!motivo) return;
      r.d.estado = 'abierto'; r.d.reaperturas = (r.d.reaperturas || []).concat([{ por: E.api.usuario, fecha: E.hoyISO(), motivo }]);
      await E.guardar('periodos', [r], 'reabrir mes: ' + motivo);
    } else {
      const evs = [...E.db.evaluaciones.values()].filter(x => x.d.periodo_id === per); const mts = [...E.db.metricos.values()].filter(x => x.d.periodo_id === per);
      const abiertos = evs.filter(x => !x.d.cierre).length + mts.filter(x => !x.d.cierre).length;
      if (!await E.confirmar('Cerrar ' + E.periodo.nombre(per), (abiertos ? 'Hay ' + abiertos + ' evaluación(es) o métricos sin cerrar; quedarán como están. ' : 'Todo está cerrado. ') + 'Al cerrar el mes ya no se podrá editar hasta reabrirlo.', 'Cerrar mes')) return;
      r.d.estado = 'cerrado'; r.d.cerrado_por = E.api.usuario; r.d.cerrado_fecha = E.hoyISO();
      await E.guardar('periodos', [r], 'cerrar mes');
    }
    A.refrescar();
  }

  function tarjetaEquipo(per, eq, periodo, cerrado) {
    const cfg = E.conf();
    const miembros = E.miembros(eq.id).filter(p => !O.esSupervisorDeEquipo(p));
    const t = h('div', { class: 'hoja' });
    t.append(h('div', { class: 'hoja-cab' }, h('div', null, h('h2', null, eq.d.nombre), h('p', { class: 'muted' }, 'Supervisor: ' + (E.nombrePersona(eq.d.supervisor_id) || 'sin asignar') + ' · ' + miembros.length + ' integrante(s) activo(s) · ' + (eq.d.comisiona ? 'recibe comisión' : 'sin comisión configurada')))));
    t.append(h('div', { class: 'dos' }, editorEdd(per, eq, periodo, cerrado), editorMet(per, eq, cerrado)));
    return t;
  }

  function editorEdd(per, eq, periodo, cerrado) {
    const cfg = E.conf();
    const id = E.idPlan(per, eq.id, 'edd'); const rec = E.db.planes.get(id);
    let items = rec ? E.clonar(rec.d.items) : [];
    const caja = h('div');
    const pintar = () => {
      caja.innerHTML = '';
      caja.append(h('h3', null, 'Plan de trabajo común (EDD)'), h('p', { class: 'muted peq' }, items.length + ' directriz(es) del equipo. El mes tiene ' + (periodo.d.num_planes || 5) + ' planes; el resto puede ser individual.'));
      items.forEach((it, i) => {
        const ta = h('textarea', { class: 'campo', rows: 2, disabled: cerrado }, it.texto); ta.addEventListener('input', () => { it.texto = ta.value; });
        caja.append(h('div', { class: 'plan-item' }, h('span', { class: 'n' }, i + 1), ta, h('div', { class: 'acciones' },
          h('button', { class: 'btn mini fantasma', type: 'button', title: 'Subir', disabled: cerrado || i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; pintar(); } }, '↑'),
          h('button', { class: 'btn mini fantasma', type: 'button', title: 'Quitar', disabled: cerrado, onclick: () => { items.splice(i, 1); pintar(); } }, '✕'))));
      });
      caja.append(h('div', { class: 'acciones' },
        h('button', { class: 'btn mini', type: 'button', disabled: cerrado || items.length >= cfg.planes_max, onclick: () => { items.push({ id: 'e' + E.uid(), texto: '' }); pintar(); const tas = caja.querySelectorAll('.plan-item textarea'); if (tas.length) tas[tas.length - 1].focus(); } }, '+ Agregar directriz'),
        U.btn('Guardar plan', async () => {
          items = items.map(i => Object.assign(i, { texto: i.texto.trim() }));
          if (items.some(i => !i.texto)) throw new Error('Hay directrices vacías. Escribe el texto o quítalas.');
          if (items.length > cfg.planes_max) throw new Error('Máximo ' + cfg.planes_max + ' directrices.');
          const r = rec ? E.copiaRec(rec) : { id, d: { periodo_id: per, equipo_id: eq.id, tipo: 'edd' } };
          r.d.items = items; await E.guardar('planes', [r], 'plan EDD de equipo'); E.toast('Plan EDD de ' + eq.d.nombre + ' guardado. Aplícalo al equipo para actualizar a cada persona.'); A.refrescar();
        }, 'primario', { disabled: cerrado }),
        U.btn('Aplicar al equipo', () => modalAplicar(per, eq, 'edd'), '', { disabled: cerrado || !rec })));
      if (rec && rec.d.aplicado) caja.append(h('p', { class: 'muted peq' }, 'Aplicado por ' + rec.d.aplicado.por + ' el ' + E.fechaHora(rec.d.aplicado.fecha) + '.'));
    };
    pintar(); return caja;
  }

  function editorMet(per, eq, cerrado) {
    const cfg = E.conf();
    const id = E.idPlan(per, eq.id, 'met'); const rec = E.db.planes.get(id);
    let items = rec ? E.clonar(rec.d.items) : [];
    const caja = h('div');
    const pintar = () => {
      caja.innerHTML = '';
      const suma = E.calc.sumaPesos(items);
      caja.append(h('div', { class: 'hoja-cab', style: { marginBottom: '4px' } }, h('h3', null, 'Métricos comunes'), h('span', { class: 'suma ' + (Math.abs(suma - 100) < 0.001 ? 'ok' : 'mal') }, 'Suma ' + suma + '%')));
      caja.append(h('p', { class: 'muted peq' }, eq.d.comisiona ? 'Base predeterminada ' + E.q(cfg.base_default) + '. Pago = base × peso × cumplimiento.' : 'Este equipo no recibe comisión; los métricos se registran sin pago.'));
      items.forEach((it, i) => {
        const nom = h('textarea', { class: 'campo', rows: 2, placeholder: 'Métrico o entregable', disabled: cerrado }, it.nombre); nom.addEventListener('input', () => { it.nombre = nom.value; });
        const meta = h('input', { class: 'campo', placeholder: 'Meta', value: it.meta || '', disabled: cerrado }); meta.addEventListener('input', () => { it.meta = meta.value; });
        const peso = h('input', { class: 'campo num', type: 'number', min: 0, max: 100, step: '0.5', placeholder: '%', value: it.peso == null ? '' : it.peso, disabled: cerrado, 'data-peso': '1' });
        peso.addEventListener('input', () => { it.peso = E.num(peso.value); const s = E.calc.sumaPesos(items); const b = caja.querySelector('.suma'); b.textContent = 'Suma ' + s + '%'; b.className = 'suma ' + (Math.abs(s - 100) < 0.001 ? 'ok' : 'mal'); caja.querySelectorAll('[data-peso]').forEach(x => x.classList.remove('err')); });
        caja.append(h('div', { class: 'plan-met' }, h('span', { class: 'n' }, i + 1), nom, meta, peso, h('button', { class: 'btn mini fantasma', type: 'button', title: 'Quitar', disabled: cerrado, onclick: () => { items.splice(i, 1); pintar(); } }, '✕')));
      });
      caja.append(h('div', { class: 'acciones' },
        h('button', { class: 'btn mini', type: 'button', disabled: cerrado || items.length >= cfg.met_max, onclick: () => { items.push({ id: 'm' + E.uid(), nombre: '', meta: '', peso: null }); pintar(); } }, '+ Agregar métrico'),
        U.btn('Guardar métricos', async () => {
          items.forEach(i => { i.nombre = (i.nombre || '').trim(); i.meta = (i.meta || '').trim(); });
          if (items.some(i => !i.nombre)) throw new Error('Hay métricos sin nombre.');
          const s = E.calc.sumaPesos(items);
          if (items.length && (Math.abs(s - 100) > 0.001 || items.some(i => i.peso == null || i.peso <= 0))) {
            caja.querySelectorAll('[data-peso]').forEach(x => x.classList.add('err'));
            throw new Error('Las ponderaciones suman ' + s + '%. Deben sumar exactamente 100% y cada una debe ser mayor que 0. Corrige los campos marcados.');
          }
          const r = rec ? E.copiaRec(rec) : { id, d: { periodo_id: per, equipo_id: eq.id, tipo: 'met' } };
          r.d.items = items.map(i => ({ id: i.id, nombre: i.nombre, meta: i.meta, peso: Number(i.peso) }));
          await E.guardar('planes', [r], 'métricos de equipo'); E.toast('Métricos de ' + eq.d.nombre + ' guardados.'); A.refrescar();
        }, 'primario', { disabled: cerrado }),
        U.btn('Aplicar al equipo', () => modalAplicar(per, eq, 'met'), '', { disabled: cerrado || !rec })));
      if (rec && rec.d.aplicado) caja.append(h('p', { class: 'muted peq' }, 'Aplicado por ' + rec.d.aplicado.por + ' el ' + E.fechaHora(rec.d.aplicado.fecha) + '.'));
    };
    pintar(); return caja;
  }

  function modalAplicar(per, eq, tipo) {
    const filas = O.previaAplicar(per, eq.id, tipo);
    const reemplazar = new Set();
    const etiqueta = { nuevo: 'Se crea', actualiza: 'Se actualiza', excepcion: 'Excepción', cerrado: 'Cerrado', excede: 'No cabe' };
    const trs = filas.map(f => {
      const chk = f.estado === 'excepcion' ? h('input', { type: 'checkbox', onchange: e => { if (e.target.checked) reemplazar.add(f.p.id); else reemplazar.delete(f.p.id); } }) : null;
      return h('tr', null, h('td', null, h('span', { class: 'nombre' }, f.p.d.nombre)), h('td', null, h('span', { class: 'chip ' + (f.estado === 'excepcion' ? 'exc' : f.estado === 'cerrado' || f.estado === 'excede' ? 'sin' : 'publicado') }, etiqueta[f.estado])),
        h('td', null, f.motivo, chk ? h('label', { class: 'check', style: { display: 'flex', marginTop: '4px' } }, chk, 'Reemplazar su plan individual por el del equipo') : null));
    });
    E.modal({
      titulo: 'Aplicar ' + (tipo === 'edd' ? 'plan EDD' : 'métricos') + ' de ' + eq.d.nombre, ancho: '820px',
      cuerpo: h('div', null, h('p', null, 'Revisa a quién se aplica antes de confirmar. Los resultados ya registrados se conservan cuando la directriz o el métrico no cambió.'),
        U.tabla([{ t: 'Persona' }, { t: 'Acción' }, { t: 'Detalle' }], trs)),
      acciones: [{ label: 'Cancelar' }, { label: 'Aplicar', tipo: 'primario', onClick: async () => { const n = await O.aplicarPlan(per, eq.id, tipo, filas, reemplazar); E.toast('Plan aplicado a ' + n + ' persona(s).'); A.refrescar(); } }],
    });
  }

  // ------------------------------------------------------------------ Garantía de ingreso
  function seccionGarantia(per) {
    const cfg = E.conf();
    const ps = E.personas(true).filter(p => E.comisiona(p) && !O.esSupervisorDeEquipo(p)).map(p => ({ p, g: E.calc.garantia(p, per, cfg) }))
      .filter(x => x.g.requiereConfirmar || (x.g.confirmada && (x.g.periodos.some(z => z >= per) || x.g.periodos.includes(per))));
    const caja = h('div', { class: 'hoja' }, h('h2', null, 'Garantía de ingreso: vista previa'),
      h('p', null, 'En sus primeros ' + cfg.garantia_meses + ' meses el gestor recibe al menos el ' + cfg.garantia_pct + ' % de su base. Regla actual: ' + (cfg.garantia_regla === 'primer_mes_completo' ? 'el primer mes completo después del ingreso cuenta como mes 1' : 'el mes de ingreso cuenta como mes 1') + ' (se cambia en Configuración). Confirma qué periodos reconoce el sistema antes del primer cierre.'));
    if (!ps.length) { caja.append(h('p', { class: 'muted' }, 'No hay personas por confirmar para ' + E.periodo.nombre(per) + '.')); return caja; }
    caja.append(U.tabla([{ t: 'Persona' }, { t: 'Fecha de ingreso' }, { t: 'Periodos que reconoce el sistema' }, { t: '¿Aplica en ' + E.periodo.corto(per) + '?' }, { t: 'Estado' }, { t: '' }],
      ps.map(x => h('tr', null, h('td', null, h('span', { class: 'nombre' }, x.p.d.nombre), h('span', { class: 'sub' }, U.nombreEquipo(x.p.d.equipo_id))),
        h('td', null, x.p.d.fecha_ingreso ? E.fechaCorta(x.p.d.fecha_ingreso) : h('span', { class: 'chip proceso' }, 'Sin fecha')),
        h('td', null, x.g.periodos.length ? x.g.periodos.map(E.periodo.nombre).join(', ') : '—'),
        h('td', null, x.g.elegible ? 'Sí' : 'No'),
        h('td', null, x.g.confirmada ? h('span', { class: 'chip cerrado' }, 'Confirmado por ' + x.g.confirmado_por) : h('span', { class: 'chip proceso' }, 'Por confirmar')),
        h('td', null, U.btn(x.g.confirmada ? 'Revisar' : 'Confirmar', () => O.modalGarantia(x.p, per), 'mini'))))));
    return caja;
  }
  O.modalGarantia = function (p, per) {
    const cfg = E.conf();
    const fecha = h('input', { class: 'campo', type: 'date', value: p.d.fecha_ingreso || '' });
    const lista = h('div');
    let marcados = new Set((p.d.garantia && p.d.garantia.periodos) || E.calc.periodosGarantiaPropuestos(p, cfg));
    const pintar = () => {
      const prop = E.calc.periodosGarantiaPropuestos({ d: Object.assign({}, p.d, { fecha_ingreso: fecha.value || null }) }, cfg);
      if (!p.d.garantia) marcados = new Set(prop);
      const opciones = [...new Set(prop.concat([per], [...marcados]))].sort();
      lista.innerHTML = '';
      lista.append(h('p', { class: 'muted peq' }, prop.length ? 'Según la fecha y la regla, el sistema propone: ' + prop.map(E.periodo.nombre).join(' y ') + '.' : 'Sin fecha de ingreso no hay propuesta; marca los periodos manualmente o escribe la fecha.'));
      opciones.forEach(id => { const c = h('input', { type: 'checkbox', checked: marcados.has(id), onchange: e => { if (e.target.checked) marcados.add(id); else marcados.delete(id); } }); lista.append(h('label', { class: 'check', style: { display: 'flex' } }, c, E.periodo.nombre(id))); });
    };
    fecha.addEventListener('change', () => { if (!p.d.garantia) marcados = new Set(); pintar(); });
    pintar();
    const nota = h('input', { class: 'campo', placeholder: 'Opcional', value: (p.d.garantia && p.d.garantia.nota) || '' });
    E.modal({
      titulo: 'Garantía de ingreso · ' + p.d.nombre, cuerpo: h('div', { class: 'rejilla', style: { gridTemplateColumns: '1fr' } }, U.campo('Fecha de ingreso', fecha), U.campo('Periodos con garantía mínima', lista), U.campo('Nota', nota)),
      acciones: [{ label: 'Cancelar' }, {
        label: 'Confirmar periodos', tipo: 'primario', onClick: async () => {
          if (marcados.size > cfg.garantia_meses && !await E.confirmar('Más periodos que la regla', 'Marcaste ' + marcados.size + ' periodos y la regla indica ' + cfg.garantia_meses + '. ¿Confirmas?', 'Sí, confirmar')) return false;
          const r = E.copiaRec(p);
          r.d.fecha_ingreso = fecha.value || null;
          r.d.garantia = { periodos: [...marcados].sort(), confirmado_por: E.api.usuario, confirmado_fecha: E.hoyISO(), regla: cfg.garantia_regla, nota: nota.value.trim() };
          await E.guardar('personas', [r], 'confirmar garantía de ingreso'); E.toast('Garantía confirmada para ' + p.d.nombre + '.'); A.refrescar();
        }
      }]
    });
  };
})(window);
