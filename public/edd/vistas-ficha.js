/* vistas-ficha.js — ficha de una persona en un mes: EDD, métricos, mensaje y cambios */
(function (g) {
  'use strict';
  const E = g.EDD, h = E.h, U = E.ui, A = E.app, O = E.ops, R = E.render;

  // Las fichas antiguas (#/ficha/mes/persona/pestaña) se abren en la sección EDD o Métricos
  A.vistas.ficha = function (root, args) {
    const per = args[0], pid = args[1], tab = args[2] || 'edd';
    if (per && E.db.periodos.get(per) && A.periodo !== per) { A.periodo = per; try { localStorage.setItem('edd_periodo', per); } catch (e) { } }
    if (pid) A.personaSel = pid;
    location.replace('#/' + (tab === 'met' ? 'met' : 'edd') + '/' + (pid || ''));
  };
  A.vistas.edd = (root, args) => vistaPersona(root, 'edd', args);
  A.vistas.met = (root, args) => vistaPersona(root, 'met', args);

  function vistaPersona(root, tipo, args) {
    const per = A.periodo;
    const titulo = tipo === 'edd' ? 'Evaluación de desempeño EDD' : 'Métricos y comisión';
    const texto = tipo === 'edd' ? 'Plan de trabajo y resultado individual, con el formato visual EDD.' : 'Metas comunes, excepciones individuales y cumplimiento con su pago en quetzales.';
    if (!per) { root.append(U.cabecera(titulo, texto)); root.append(U.vacio('Todavía no hay meses', 'Importa los archivos o crea el primer mes.', U.btn('⇧ Importar archivos', () => { location.hash = '#/importar'; }, 'primario'))); return; }
    const lista = O.filasPanel(per, A.filtros).map(x => x.p);
    let pid = args[0] || A.personaSel;
    if (!pid || !E.persona(pid)) pid = lista.length ? lista[0].id : null;
    const p = pid && E.persona(pid);
    if (p) A.personaSel = p.id;
    const ir = id => { A.personaSel = id; location.hash = '#/' + tipo + '/' + id; };
    const acciones = [];
    if (p && tipo === 'edd') {
      acciones.push(U.btn('⇩ Excel individual', () => O.excelPersona(p)), U.btn('✆ Mensaje', () => E.modal({ titulo: p.d.nombre, ancho: '780px', cuerpo: O.panelMensaje(per, p) })),
        U.btn('◷ Cambios', () => { const c = h('div'); E.modal({ titulo: 'Historial de cambios · ' + p.d.nombre, ancho: '900px', cuerpo: c }); tabCambios(c, per, p); }),
        U.btn('＋ Agregar plan', () => modalAgregarPlan(per, p), 'primario'));
    }
    if (p && tipo === 'met') {
      acciones.push(U.btn('✆ Mensaje', () => E.modal({ titulo: p.d.nombre, ancho: '780px', cuerpo: O.panelMensaje(per, p) })), U.btn('Editar base', () => O.modalPersona(p)), U.btn('☰ Métricos del equipo', () => { location.hash = '#/planes'; }, 'suave'));
    }
    root.append(U.cabecera(titulo, texto, ...acciones));
    const i = p ? lista.findIndex(x => x.id === p.id) : -1;
    const opciones = lista.map(x => ({ v: x.id, t: x.d.nombre + (x.d.codigo ? ' · ' + x.d.codigo : '') }));
    if (p && i < 0) opciones.unshift({ v: p.id, t: p.d.nombre + ' (fuera del filtro)' });
    root.append(h('div', { class: 'filtros' },
      U.select(opciones.length ? opciones : [{ v: '', t: 'No hay gestores con estos filtros' }], p ? p.id : '', v => v && ir(v), { 'aria-label': 'Gestor', style: { minWidth: '280px' } }),
      U.select(U.opcionesEquipo(true), A.filtros.equipo, v => { A.filtros.equipo = v; A.personaSel = null; location.hash = '#/' + tipo; A.render(); }, { 'aria-label': 'Equipo' }),
      h('button', { class: 'btn', type: 'button', disabled: i <= 0, onclick: () => ir(lista[i - 1].id) }, '← Anterior'),
      h('span', { class: 'muted peq' }, i >= 0 ? (i + 1) + ' de ' + lista.length : ''),
      h('button', { class: 'btn', type: 'button', disabled: i < 0 || i >= lista.length - 1, onclick: () => ir(lista[i + 1].id) }, 'Siguiente →')));
    if (!p) { root.append(U.vacio('Selecciona un gestor', 'Agrega o importa el padrón para comenzar.')); return; }
    const snap = E.snapshot(p);
    const ev = E.evaluacion(per, p.id), mt = E.metricos(per, p.id);
    root.append(h('div', { class: 'hoja ficha-mini' },
      h('div', { class: 'persona' }, U.ini(p.d.nombre, true), h('div', null, h('h2', null, p.d.nombre), h('small', null, [p.d.codigo ? 'Código ' + p.d.codigo : 'Sin código', p.d.rol, snap.supervisor ? 'Supervisor: ' + snap.supervisor : null].filter(Boolean).join(' · ')))),
      h('div', { class: 'acciones' }, U.equipoPill(p.d.equipo_id), h('span', { class: 'chip ' + E.calc.estadoEdd(ev).k }, 'EDD: ' + E.calc.estadoEdd(ev).t), E.comisiona(p) ? h('span', { class: 'chip ' + E.calc.estadoMet(mt).k }, 'Métricos: ' + E.calc.estadoMet(mt).t) : h('span', { class: 'chip sin' }, 'Sin comisión'), ev && ev.d.resultado_final ? U.sem(ev.d.resultado_final) : null)));
    if (O.mesCerrado(per)) root.append(h('div', { class: 'aviso warn' }, E.periodo.nombre(per) + ' está cerrado. Para editar, reábrelo en Planes del mes.'));
    const cont = h('div'); root.append(cont);
    (tipo === 'edd' ? tabEdd : tabMet)(cont, per, p);
  }

  function modalAgregarPlan(per, p) {
    const ta = h('textarea', { class: 'campo', rows: 2, placeholder: 'Ej.: Rendición de cuentas al 100%' });
    const eqs = E.equipos().filter(e => e.d.activo !== false);
    const sups = E.supervisoresLista().filter(s => eqs.some(e => e.d.supervisor_id === s.id));
    const destino = U.select([{ v: 'persona', t: 'Solo a ' + p.d.nombre }]
      .concat(p.d.equipo_id ? [{ v: 'eq:' + p.d.equipo_id, t: 'Todo ' + U.nombreEquipo(p.d.equipo_id) }] : [])
      .concat(sups.map(s => ({ v: 'sup:' + s.id, t: 'Equipos de ' + s.d.nombre })))
      .concat([{ v: 'todos', t: 'Todos los equipos' }]), 'persona');
    const exc = h('input', { type: 'checkbox', checked: true });
    E.modal({
      titulo: 'Agregar plan de trabajo EDD', cuerpo: h('div', { style: { display: 'grid', gap: '12px' } }, U.campo('Directriz / plan de trabajo *', ta), U.campo('Asignar a', destino),
        h('label', { class: 'check' }, exc, 'Incluir a quienes tienen plan individual'),
        h('p', { class: 'muted peq' }, 'Al asignarla a un equipo se agrega a su plan común de ' + E.periodo.nombre(per) + ' y se aplica a sus integrantes. Las evaluaciones cerradas no se modifican.')),
      acciones: [{ label: 'Cancelar' }, {
        label: 'Agregar plan', tipo: 'primario', onClick: async () => {
          const texto = ta.value.trim(); if (!texto) { ta.classList.add('err'); throw new Error('Escribe la directriz.'); }
          const d = destino.value;
          if (d === 'persona') { await O.agregarDirectrizPersona(per, p, texto); E.toast('Directriz agregada a ' + p.d.nombre + '.'); A.refrescar(); return; }
          const ids = d === 'todos' ? eqs.map(e => e.id) : d.startsWith('eq:') ? [d.slice(3)] : eqs.filter(e => e.d.supervisor_id === d.slice(4)).map(e => e.id);
          const r = await O.agregarDirectriz(per, texto, ids, { aplicar: true, excepciones: exc.checked });
          E.toast('Directriz agregada a ' + r.equipos + ' equipo(s) y ' + r.personas + ' persona(s).');
          if (r.omitidos.length) setTimeout(() => E.modal({ titulo: 'No se modificaron', cuerpo: h('ul', { class: 'lista-simple' }, r.omitidos.map(x => h('li', null, x))) }), 50);
          A.refrescar();
        }
      }]
    });
  }

  function crearDesdeEquipo(cont, per, p, tipo) {
    const plan = p.d.equipo_id && E.db.planes.get(E.idPlan(per, p.d.equipo_id, tipo));
    const t = tipo === 'edd' ? 'plan EDD' : 'métricos';
    cont.append(U.vacio('Sin ' + t + ' en ' + E.periodo.nombre(per), plan ? 'Su equipo tiene un plan común para este mes.' : 'Su equipo no tiene ' + t + ' comunes para este mes.',
      plan ? U.btn('Crear con el plan del equipo', async () => {
        const rec = tipo === 'edd' ? O.nuevaEval(per, p, plan.d.items.map(x => O.itemEdd(x, 'equipo'))) : O.nuevoMet(per, p, plan.d.items.map(x => O.itemMet(x, 'equipo')));
        await E.guardar(tipo === 'edd' ? 'evaluaciones' : 'metricos', [rec], 'crear desde plan de equipo'); A.refrescar();
      }, 'primario', { disabled: O.mesCerrado(per) }) : null,
      U.btn('Crear plan individual', async () => {
        const rec = tipo === 'edd' ? O.nuevaEval(per, p, []) : O.nuevoMet(per, p, []);
        rec.d.excepcion = !!plan;
        await E.guardar(tipo === 'edd' ? 'evaluaciones' : 'metricos', [rec], 'crear plan individual'); A.refrescar();
      }, plan ? '' : 'primario', { disabled: O.mesCerrado(per) })));
  }

  function previa(cont, generar, opciones) {
    const caja = h('div', { class: 'vista-previa' });
    let version = opciones.version;
    const marco = h('div', { class: 'cargando' }, 'Generando vista previa…');
    const tg = h('div', { class: 'toggle' }, opciones.versiones.map(v => h('button', { type: 'button', class: v.k === version ? 'sel' : null, onclick: e => { version = v.k; tg.querySelectorAll('button').forEach(b => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); pintar(); } }, v.t)));
    let canvas = null;
    const pintar = async () => { try { canvas = await generar(version); marco.innerHTML = ''; marco.className = ''; marco.append(h('img', { src: canvas.toDataURL('image/png'), alt: 'Vista previa ' + version })); } catch (e) { marco.textContent = 'No se pudo generar la imagen: ' + e.message; } };
    caja.append(h('div', { class: 'hoja-cab' }, tg, h('div', { class: 'acciones' },
      U.btn('Copiar imagen', async () => { await R.copiar(canvas); E.toast('Imagen copiada. Pégala en WhatsApp.'); }, 'mini'),
      U.btn('Descargar', async () => E.descargar(await R.blob(canvas), opciones.nombre(version) + '.png'), 'mini'),
      opciones.extra || null)), marco);
    cont.append(caja); pintar();
    return { refrescar: pintar };
  }

  // ------------------------------------------------------------------ EDD
  function tabEdd(cont, per, p) {
    const cfg = E.conf();
    const rec = E.evaluacion(per, p.id);
    if (!rec) return crearDesdeEquipo(cont, per, p, 'edd');
    const w = E.copiaRec(rec);
    const bloqueado = O.mesCerrado(per) || !!w.d.cierre;
    const plan = p.d.equipo_id && E.db.planes.get(E.idPlan(per, p.d.equipo_id, 'edd'));
    const izq = h('div', { class: 'hoja' }), der = h('div');
    cont.append(h('div', { class: 'dos' }, izq, der));
    let sucio = false;
    const marcar = () => { sucio = true; estadoGuardado.textContent = 'Cambios sin guardar'; estadoGuardado.className = 'chip proceso'; vp.refrescar(); };
    const estadoGuardado = h('span', { class: 'chip borrador' }, 'Guardado');
    const lista = h('div');
    const pintarItems = () => {
      lista.innerHTML = '';
      w.d.items.forEach((it, i) => {
        const ta = h('textarea', { class: 'campo', rows: 2, disabled: bloqueado }, it.texto);
        ta.addEventListener('input', () => { it.texto = ta.value; if (it.origen === 'equipo') { it.origen = 'individual'; origen.textContent = 'Individual (modificada)'; origen.className = 'origen'; } marcar(); });
        const origen = h('span', { class: 'origen' + (it.origen === 'equipo' ? ' eq' : '') }, it.origen === 'equipo' ? 'Del plan del equipo' : 'Individual');
        const seg = h('div', { class: 'segmento', role: 'group', 'aria-label': 'Resultado de la directriz ' + (i + 1) },
          [[null, 'Sin calificar', 'nada'], ['Cumple', 'Cumple', 'Cumple'], ['No Cumple', 'No cumple', 'NoCumple']].map(([v, t, c]) => h('button', {
            type: 'button', disabled: bloqueado, class: (it.resultado || null) === v ? 'sel-' + c : null, 'aria-pressed': (it.resultado || null) === v ? 'true' : 'false',
            onclick: () => { it.resultado = v; pintarItems(); marcar(); },
          }, t)));
        lista.append(h('div', { class: 'item' }, h('span', { class: 'n' }, i + 1), h('div', null, ta, h('div', { class: 'item-pie' }, h('div', { class: 'acciones' }, origen), h('div', { class: 'acciones' }, seg,
          h('button', { class: 'btn mini fantasma', type: 'button', title: 'Quitar directriz', disabled: bloqueado, onclick: () => { w.d.items.splice(i, 1); pintarItems(); marcar(); } }, '✕'))))));
      });
      if (!w.d.items.length) lista.append(h('p', { class: 'muted' }, 'Sin directrices. Agrega al menos una.'));
    };
    pintarItems();
    const fin = U.select([{ v: '', t: 'Sin resultado todavía' }].concat(E.RESULTADOS.map(r => ({ v: r, t: r }))), w.d.resultado_final || '', v => { w.d.resultado_final = v || null; marcar(); }, { disabled: bloqueado });
    const com = h('textarea', { class: 'campo', rows: 4, disabled: bloqueado, placeholder: 'Comentarios que respaldan el resultado (se pueden ir agregando en las reuniones semanales)' }, w.d.comentarios || '');
    com.addEventListener('input', () => { w.d.comentarios = com.value; marcar(); });
    const aut = U.select(U.opcionesAutoriza(), w.d.autorizado_por || '', v => { w.d.autorizado_por = v || null; marcar(); }, { disabled: bloqueado });
    const est = E.calc.estadoEdd(rec);
    izq.append(h('div', { class: 'hoja-cab' }, h('div', null, h('h2', null, 'Plan de trabajo'), h('p', { class: 'muted peq' }, w.d.items.length + ' directriz(es) · el mes tiene ' + ((E.db.periodos.get(per).d.num_planes) || 5) + ' planes')), h('div', { class: 'acciones' }, U.chip(est), estadoGuardado)));
    if (w.d.excepcion) izq.append(h('div', { class: 'aviso info' }, 'Excepción individual: este plan no sigue completo el plan común del equipo, por eso no se sobrescribe al aplicar el plan del equipo.'));
    if (w.d.plan_inicial) {
      const cambio = JSON.stringify(w.d.plan_inicial.items) !== JSON.stringify(rec.d.items.map(i => i.texto));
      izq.append(h('p', { class: 'muted peq' }, 'Plan inicial publicado por ' + w.d.plan_inicial.por + ' el ' + E.fechaHora(w.d.plan_inicial.fecha) + '.' + (cambio ? ' El plan cambió después de publicarse; la versión inicial se conserva.' : '')));
    } else izq.append(h('div', { class: 'aviso warn' }, 'El plan todavía no se ha publicado como versión inicial.'));
    izq.append(lista, h('button', { class: 'btn mini', type: 'button', disabled: bloqueado || w.d.items.length >= cfg.planes_max, onclick: () => { w.d.items.push(O.itemEdd({ texto: '' })); pintarItems(); marcar(); } }, '+ Agregar directriz individual'));
    izq.append(h('div', { class: 'rejilla', style: { marginTop: '16px' } },
      U.campo('Resultado final', fin, 'Lo decide el supervisor; no se calcula a partir de las directrices.'),
      U.campo('Autoriza el resultado', aut)));
    izq.append(h('div', { style: { marginTop: '12px' } }, U.campo('Comentarios', com)));
    if (w.d.cierre) izq.append(h('div', { class: 'aviso ok' }, 'Evaluación autorizada por ' + (w.d.autorizado_por || '—') + ' · registrada por ' + w.d.cierre.registrado_por + ' el ' + E.fechaHora(w.d.cierre.fecha) + '.'));
    (w.d.reaperturas || []).forEach(r => izq.append(h('p', { class: 'muted peq' }, 'Reabierta por ' + r.por + ' el ' + E.fechaHora(r.fecha) + ': ' + r.motivo)));
    const guardar = async (motivo) => {
      w.d.items.forEach(it => { it.texto = (it.texto || '').trim(); });
      if (w.d.items.some(it => !it.texto)) throw new Error('Hay directrices vacías. Escribe el texto o quítalas.');
      if (w.d.items.length > cfg.planes_max) throw new Error('Máximo ' + cfg.planes_max + ' directrices.');
      w.d.excepcion = !!(plan && !plan.d.items.every(t => w.d.items.some(x => x.id === t.id && x.texto === t.texto && x.origen === 'equipo')));
      await E.guardar('evaluaciones', [w], motivo);
    };
    izq.append(h('div', { class: 'acciones', style: { marginTop: '14px' } },
      U.btn('Guardar cambios', async () => { await guardar(); sucio = false; E.toast('Evaluación guardada.'); A.refrescar(); }, 'primario', { disabled: bloqueado }),
      !w.d.plan_inicial ? U.btn('Publicar plan inicial', async () => {
        w.d.plan_inicial = { items: w.d.items.map(i => i.texto.trim()), por: E.api.usuario, fecha: E.hoyISO() };
        await guardar('publicar plan inicial'); E.toast('Plan inicial publicado.'); A.refrescar();
      }, '', { disabled: bloqueado }) : null,
      !w.d.cierre ? U.btn('Autorizar y cerrar', async () => {
        const pend = E.calc.edd(w).pendientes;
        if (pend.length) { E.modal({ titulo: 'Falta información para cerrar', cuerpo: h('ul', { class: 'lista-simple' }, pend.map(x => h('li', null, x))) }); return; }
        if (!await E.confirmar('Autorizar evaluación', 'Resultado final: ' + w.d.resultado_final + '. Autoriza: ' + w.d.autorizado_por + '. Después de cerrar solo se puede cambiar reabriendo con un motivo.', 'Autorizar y cerrar')) return;
        if (!w.d.plan_inicial) w.d.plan_inicial = { items: w.d.items.map(i => i.texto), por: E.api.usuario, fecha: E.hoyISO(), nota: 'Publicado al cerrar' };
        w.d.cierre = { fecha: E.hoyISO(), registrado_por: E.api.usuario };
        await guardar('autorizar y cerrar evaluación'); E.toast('Evaluación autorizada y cerrada.'); A.refrescar();
      }, 'acento', { disabled: O.mesCerrado(per) }) : U.btn('Reabrir', async () => {
        const motivo = await E.pedirTexto('Reabrir evaluación', 'Motivo', { requerido: true, boton: 'Reabrir' }); if (!motivo) return;
        w.d.cierre = null; w.d.reaperturas = (w.d.reaperturas || []).concat([{ por: E.api.usuario, fecha: E.hoyISO(), motivo }]);
        await E.guardar('evaluaciones', [w], 'reabrir: ' + motivo); A.refrescar();
      }, 'peligro', { disabled: O.mesCerrado(per) })));
    const tieneRes = w.d.items.some(i => i.resultado) || w.d.resultado_final;
    const vp = previa(der, v => R.edd(R.datosEdd(per, p, v, w)), {
      version: tieneRes ? 'final' : 'inicial', versiones: [{ k: 'inicial', t: 'EDD inicial' }, { k: 'final', t: 'EDD final' }],
      nombre: v => 'EDD_' + (v === 'inicial' ? 'inicial' : 'final') + '_' + E.periodo.hoja(per) + '_' + U.nombreArchivo(p.d.nombre),
    });
    g.onbeforeunload = () => sucio ? true : undefined;
  }

  // ------------------------------------------------------------------ Métricos
  function tabMet(cont, per, p) {
    const cfg = E.conf();
    const rec = E.metricos(per, p.id);
    if (!rec) return crearDesdeEquipo(cont, per, p, 'met');
    const w = E.copiaRec(rec);
    const bloqueado = O.mesCerrado(per) || !!w.d.cierre;
    const izq = h('div', { class: 'hoja' }), der = h('div', { style: { maxWidth: '980px' } });
    cont.append(izq, der);
    const estadoGuardado = h('span', { class: 'chip borrador' }, 'Guardado');
    const resumen = h('div');
    const tabla = h('div');
    const marcar = () => { estadoGuardado.textContent = 'Cambios sin guardar'; estadoGuardado.className = 'chip proceso'; pintarResumen(); vp.refrescar(); };
    const comisiona = E.comisiona(p);
    const baseTxt = p.d.base_comision != null && p.d.base_comision !== '' ? 'base personal' : 'base predeterminada';
    const r0 = E.calc.metricos(w, p, cfg);
    izq.append(h('div', { class: 'hoja-cab' }, h('div', null, h('h2', null, 'Métricos y comisión'), h('p', { class: 'muted peq' }, 'Base de comisión: ' + E.q(r0.base) + ' (' + (w.d.cierre ? 'guardada al cerrar' : baseTxt) + '). La base es el 100 % de la comisión.')), h('div', { class: 'acciones' }, U.chip(E.calc.estadoMet(rec)), estadoGuardado)));
    if (!comisiona) izq.append(h('div', { class: 'aviso info' }, 'El equipo de esta persona no está marcado como "recibe comisión": sus métricos se registran, pero no entran en el consolidado de pago.'));
    if (w.d.excepcion || w.d.items.some(i => i.origen === 'individual')) izq.append(h('div', { class: 'aviso info' }, 'Tiene métricos individuales (excepción al plan del equipo).'));
    if (w.d.plan_inicial) izq.append(h('p', { class: 'muted peq' }, 'Plan inicial publicado por ' + w.d.plan_inicial.por + ' el ' + E.fechaHora(w.d.plan_inicial.fecha) + '.'));
    else izq.append(h('div', { class: 'aviso warn' }, 'Los métricos todavía no se han publicado como versión inicial.'));
    const pintarTabla = () => {
      tabla.innerHTML = '';
      const r = E.calc.metricos(w, p, cfg);
      const tarjetas = w.d.items.map((it, i) => {
        const ri = r.items[i] || {};
        const nom = h('textarea', { class: 'campo', rows: 2, disabled: bloqueado, 'aria-label': 'Métrico ' + (i + 1) }, it.nombre); nom.addEventListener('input', () => { it.nombre = nom.value; if (it.origen === 'equipo') it.origen = 'individual'; marcar(); });
        const meta = h('input', { class: 'campo', value: it.meta || '', placeholder: 'Meta', disabled: bloqueado }); meta.addEventListener('input', () => { it.meta = meta.value; marcar(); });
        const peso = h('input', { class: 'campo num', type: 'number', min: 0, max: 100, step: '0.5', value: it.peso == null ? '' : it.peso, disabled: bloqueado, 'data-peso': '1' }); peso.addEventListener('input', () => { it.peso = E.num(peso.value); if (it.origen === 'equipo') it.origen = 'individual'; marcar(); });
        const res = h('input', { class: 'campo', value: it.resultado || '', placeholder: 'Resultado obtenido', disabled: bloqueado }); res.addEventListener('input', () => { it.resultado = res.value; marcar(); });
        const cum = h('input', { class: 'campo num', type: 'number', min: 0, max: 100, step: '1', value: it.cumplimiento == null ? '' : it.cumplimiento, placeholder: '0–100', disabled: bloqueado });
        cum.addEventListener('change', () => { const v = E.num(cum.value); it.cumplimiento = v == null ? null : Math.max(0, Math.min(100, v)); if (v != null && (v < 0 || v > 100)) E.toast('El cumplimiento va de 0 a 100. La regla no define pago por sobrecumplimiento.', 'warn'); if (it.cumplimiento === 100 || it.cumplimiento == null) it.reduccion = null; pintarTabla(); marcar(); });
        const m = E.num(String(it.meta || '').replace(/[^\d.,]/g, '')), o = E.num(String(it.resultado || '').replace(/[^\d.,]/g, ''));
        const sug = m && o != null ? Math.min(100, E.r2(o / m * 100)) : null;
        const notas = h('input', { class: 'campo', value: it.notas || '', placeholder: 'Notas', disabled: bloqueado }); notas.addEventListener('input', () => { it.notas = notas.value; marcar(); });
        const resp = U.select([{ v: '', t: 'Supervisor responsable' }].concat(U.opcionesAutoriza().slice(1)), it.responsable || '', v => { it.responsable = v; marcar(); }, { disabled: bloqueado, 'aria-label': 'Supervisor responsable' });
        const barra = h('div', { class: 'progreso' }, h('i', { style: { width: (it.cumplimiento == null ? 0 : it.cumplimiento) + '%', background: it.cumplimiento == null ? '#cfd8e3' : it.cumplimiento >= 100 ? 'var(--ok)' : it.cumplimiento > 0 ? '#e0a100' : 'var(--err)' } }));
        const card = h('div', { class: 'met-card' },
          h('div', { class: 'cab-m' }, h('span', { class: 'origen' + (it.origen === 'equipo' ? ' eq' : '') }, 'Métrico ' + (i + 1) + ' · ' + (it.origen === 'equipo' ? 'del equipo' : 'individual')),
            h('button', { class: 'btn mini fantasma', type: 'button', title: 'Quitar métrico', disabled: bloqueado, onclick: () => { w.d.items.splice(i, 1); pintarTabla(); marcar(); } }, '✕')),
          nom,
          h('div', { class: 'fila' }, U.campo('Meta', meta), U.campo('Ponderación %', peso)),
          h('div', { class: 'fila' }, U.campo('Resultado', res), U.campo('Cumplimiento %', cum, sug != null && !bloqueado && it.cumplimiento == null ? h('a', { href: '#', onclick: e => { e.preventDefault(); it.cumplimiento = sug; pintarTabla(); marcar(); } }, 'Usar ' + sug + '% (resultado ÷ meta)') : null)),
          barra,
          h('div', { class: 'pago' }, ri.pago != null ? E.q(ri.pago) : h('span', { style: { color: 'var(--gris-2)', fontSize: '15px' } }, 'Pendiente'), h('small', null, '  de ' + E.q(ri.monto) + ' posibles')),
          h('div', { class: 'fila' }, notas, resp));
        if (it.cumplimiento != null && it.cumplimiento < 100) {
          it.reduccion = it.reduccion || { por: '', motivo: '' };
          const por = U.select(U.opcionesAutoriza(), it.reduccion.por || '', v => { it.reduccion.por = v; marcar(); }, { disabled: bloqueado, 'aria-label': 'Supervisor que autoriza la reducción' });
          const mot = h('input', { class: 'campo', value: it.reduccion.motivo || '', placeholder: 'Motivo de la reducción', disabled: bloqueado }); mot.addEventListener('input', () => { it.reduccion.motivo = mot.value; marcar(); });
          card.append(h('div', { class: 'reduc' }, h('span', { class: 'peq' }, h('b', null, 'Reducción a ' + it.cumplimiento + '%'), ' — la autoriza el supervisor'), por, mot, it.reduccion.fecha ? h('span', { class: 'muted peq' }, 'Registrada el ' + E.fechaHora(it.reduccion.fecha)) : null));
        }
        return card;
      });
      tabla.append(tarjetas.length ? h('div', { class: 'met-grid' }, tarjetas) : h('div', { class: 'vacio' }, h('div', { class: 'vacio-ico' }, '◉'), h('b', null, 'Sin métricos para este gestor'), h('p', { class: 'peq' }, 'Agrega una meta, asígnale una ponderación y captura el cumplimiento al cierre.')));
      tabla.append(h('button', { class: 'btn mini', type: 'button', style: { marginTop: '12px' }, disabled: bloqueado || w.d.items.length >= cfg.met_max, onclick: () => { w.d.items.push(O.itemMet({ nombre: '', peso: null })); pintarTabla(); marcar(); } }, '＋ Agregar métrico individual'));
    };
    const pintarResumen = () => {
      resumen.innerHTML = '';
      const r = E.calc.metricos(w, p, cfg);
      if (typeof franja !== 'undefined') {
        const pond = E.r2(r.items.reduce((a, it) => a + (Number(it.peso) || 0) * (it.cumplimiento == null ? 0 : it.cumplimiento) / 100, 0));
        franja.innerHTML = '';
        franja.append(h('div', null, h('span', null, 'Base 100 %'), h('b', null, E.q(r.base))), h('div', null, h('span', null, 'Cumplimiento ponderado'), h('b', null, pond + '%')), h('div', null, h('span', null, r.elegible ? 'Pago final (con garantía)' : 'Pago estimado'), h('b', { class: 'verde' }, E.q(r.final))));
      }
      const ok = Math.abs(r.suma - 100) < 0.001;
      resumen.append(h('div', { class: 'hoja-cab', style: { marginTop: '14px' } }, h('h3', null, 'Cálculo'), h('span', { class: 'suma ' + (ok ? 'ok' : 'mal') }, 'Ponderaciones: ' + r.suma + '%')));
      resumen.append(h('div', { class: 'formula' }, r.items.map((it, i) => h('div', null, (i + 1) + '. ' + E.q(r.base) + ' × ' + E.pct(it.peso) + ' × ' + (it.cumplimiento == null ? '—' : it.cumplimiento + '%') + ' = ' + (it.pago == null ? 'pendiente' : E.q(it.pago))))));
      const tot = h('div', { class: 'totales' }, h('div', null, h('span', null, 'Pago calculado'), h('span', null, E.q(r.calculado))));
      if (r.elegible) { tot.append(h('div', null, h('span', null, 'Mínimo garantizado (' + cfg.garantia_pct + ' %)'), h('span', null, E.q(r.minimo))), h('div', null, h('span', null, 'Garantía aplicada'), h('span', null, E.q(r.garantiaAplicada)))); }
      tot.append(h('div', { class: 'total' }, h('span', null, 'Total a pagar'), h('span', null, E.q(r.final))));
      resumen.append(tot);
      const g2 = r.garantia;
      const relevante = g2.requiereConfirmar || g2.periodos.some(x => x >= per);
      const txtG = g2.sinFecha ? 'Sin fecha de ingreso: no se puede saber si aplica la garantía. '
        : relevante ? 'Ingreso: ' + E.fechaCorta(p.d.fecha_ingreso) + '. Garantía mínima en ' + g2.periodos.map(E.periodo.nombre).join(' y ') + (g2.confirmada ? ' (confirmado por ' + g2.confirmado_por + '). ' : ' (propuesta, falta confirmar). ')
        : 'Ingreso: ' + E.fechaCorta(p.d.fecha_ingreso) + '. La garantía de ingreso no aplica en ' + E.periodo.nombre(per) + (g2.periodos.length ? ' (correspondió a ' + g2.periodos.map(E.periodo.nombre).join(' y ') + ').' : '.');
      resumen.append(h('p', { class: 'muted peq' }, txtG, comisiona && !w.d.cierre && relevante ? h('a', { href: '#', onclick: e => { e.preventDefault(); O.modalGarantia(p, per); } }, g2.confirmada ? 'Revisar garantía' : 'Confirmar garantía') : null));
      if (r.errores.length) resumen.append(h('div', { class: 'aviso err' }, h('b', null, 'Corrige antes de guardar:'), h('ul', null, r.errores.map(x => h('li', null, x)))));
      else if (r.pendientes.length && !w.d.cierre) resumen.append(h('div', { class: 'aviso warn' }, h('b', null, 'Pendiente para cerrar:'), h('ul', null, r.pendientes.map(x => h('li', null, x)))));
      if (w.d.cierre) resumen.append(h('div', { class: 'aviso ok' }, 'Métricos cerrados por ' + w.d.cierre.por + ' el ' + E.fechaHora(w.d.cierre.fecha) + '. Total a pagar ' + E.q(w.d.cierre.final) + '.'));
    };
    const franja = h('div', { class: 'met-strip', style: { margin: '4px 0 16px', padding: '14px 16px', background: '#f7f9fc', borderRadius: '12px' } });
    pintarTabla(); izq.append(franja, tabla, resumen); pintarResumen();
    (w.d.reaperturas || []).forEach(x => izq.append(h('p', { class: 'muted peq' }, 'Reabierto por ' + x.por + ' el ' + E.fechaHora(x.fecha) + ': ' + x.motivo)));
    const validar = () => {
      w.d.items.forEach(it => { it.nombre = (it.nombre || '').trim(); });
      if (w.d.items.some(it => !it.nombre)) throw new Error('Hay métricos sin nombre.');
      const s = E.calc.sumaPesos(w.d.items);
      if (w.d.items.length && (Math.abs(s - 100) > 0.001 || w.d.items.some(it => it.peso == null || it.peso <= 0))) {
        tabla.querySelectorAll('[data-peso]').forEach(x => x.classList.add('err'));
        throw new Error('Las ponderaciones suman ' + s + '%. Deben sumar exactamente 100% para guardar. Corrige los campos marcados.');
      }
      w.d.items.forEach(it => {
        if (it.reduccion && (it.cumplimiento == null || it.cumplimiento >= 100)) it.reduccion = null;
        if (it.reduccion && it.reduccion.por && it.reduccion.motivo && !it.reduccion.fecha) it.reduccion.fecha = E.hoyISO();
      });
      const plan = p.d.equipo_id && E.db.planes.get(E.idPlan(per, p.d.equipo_id, 'met'));
      w.d.excepcion = !!(plan && w.d.items.some(i => i.origen === 'individual'));
    };
    izq.append(h('div', { class: 'acciones', style: { marginTop: '14px' } },
      U.btn('Guardar cambios', async () => { validar(); await E.guardar('metricos', [w]); E.toast('Métricos guardados.'); A.refrescar(); }, 'primario', { disabled: bloqueado }),
      !w.d.plan_inicial ? U.btn('Publicar plan inicial', async () => {
        validar(); w.d.plan_inicial = { items: w.d.items.map(i => ({ nombre: i.nombre, meta: i.meta, peso: i.peso })), base: E.calc.base(w, p, cfg), por: E.api.usuario, fecha: E.hoyISO() };
        await E.guardar('metricos', [w], 'publicar plan inicial'); E.toast('Plan inicial de métricos publicado.'); A.refrescar();
      }, '', { disabled: bloqueado }) : null,
      !w.d.cierre ? U.btn('Cerrar métricos', async () => {
        validar();
        const r = E.calc.metricos(w, p, cfg);
        const falta = r.errores.concat(r.pendientes);
        if (falta.length) { E.modal({ titulo: 'Falta información para cerrar', cuerpo: h('ul', { class: 'lista-simple' }, falta.map(x => h('li', null, x))) }); return; }
        if (!await E.confirmar('Cerrar métricos', 'Pago calculado ' + E.q(r.calculado) + (r.elegible ? ', garantía aplicada ' + E.q(r.garantiaAplicada) : '') + ', total a pagar ' + E.q(r.final) + '. Se guarda este cálculo con tu nombre y la fecha.', 'Cerrar métricos')) return;
        if (!w.d.plan_inicial) w.d.plan_inicial = { items: w.d.items.map(i => ({ nombre: i.nombre, meta: i.meta, peso: i.peso })), base: r.base, por: E.api.usuario, fecha: E.hoyISO(), nota: 'Publicado al cerrar' };
        w.d.cierre = { base: r.base, calculado: r.calculado, minimo: r.minimo, elegible: r.elegible, garantia: r.garantiaAplicada, final: r.final, por: E.api.usuario, fecha: E.hoyISO() };
        await E.guardar('metricos', [w], 'cerrar métricos'); E.toast('Métricos cerrados.'); A.refrescar();
      }, 'acento', { disabled: O.mesCerrado(per) }) : U.btn('Reabrir', async () => {
        const motivo = await E.pedirTexto('Reabrir métricos', 'Motivo', { requerido: true, boton: 'Reabrir' }); if (!motivo) return;
        w.d.cierre = null; w.d.reaperturas = (w.d.reaperturas || []).concat([{ por: E.api.usuario, fecha: E.hoyISO(), motivo }]);
        await E.guardar('metricos', [w], 'reabrir: ' + motivo); A.refrescar();
      }, 'peligro', { disabled: O.mesCerrado(per) })));
    const vp = previa(der, v => R.metricos(R.datosMet(per, p, v, w)), {
      version: w.d.items.some(i => i.cumplimiento != null) ? 'final' : 'inicial', versiones: [{ k: 'inicial', t: 'Métricos iniciales' }, { k: 'final', t: 'Métricos finales' }],
      nombre: v => 'Metricos_' + v + '_' + E.periodo.hoja(per) + '_' + U.nombreArchivo(p.d.nombre),
      extra: U.btn('Imagen EDD + métricos', async () => {
        const v = w.d.items.some(i => i.cumplimiento != null) ? 'final' : 'inicial';
        const c = R.unir([await R.edd(R.datosEdd(per, p, v)), await R.metricos(Object.assign(R.datosMet(per, p, v, w), { sinCabecera: true }))]);
        O.modalImagen(c, 'EDD_y_metricos_' + v + '_' + E.periodo.hoja(per) + '_' + U.nombreArchivo(p.d.nombre));
      }, 'mini'),
    });
  }
  O.modalImagen = function (c, nombre) {
    E.modal({ titulo: 'Imagen combinada', ancho: '900px', cuerpo: h('img', { src: c.toDataURL('image/png'), alt: 'Imagen combinada', style: { width: '100%', border: '1px solid var(--linea)', borderRadius: '8px' } }),
      acciones: [{ label: 'Cerrar' }, { label: 'Descargar', onClick: async () => { E.descargar(await R.blob(c), nombre + '.png'); return false; } }, { label: 'Copiar imagen', tipo: 'primario', onClick: async () => { await R.copiar(c); E.toast('Imagen copiada.'); return false; } }] });
  };

  // ------------------------------------------------------------------ Mensaje
  O.imagenCompartir = async function (per, p, tipo, que) {
    const v = tipo === 'final' ? 'final' : 'inicial';
    const partes = [];
    if ((que === 'edd' || que === 'ambas') && E.evaluacion(per, p.id)) partes.push(await R.edd(R.datosEdd(per, p, v)));
    if ((que === 'met' || que === 'ambas') && E.metricos(per, p.id)) partes.push(await R.metricos(Object.assign(R.datosMet(per, p, v), { sinCabecera: partes.length > 0 })));
    return partes.length ? (partes.length > 1 ? R.unir(partes) : partes[0]) : null;
  };
  O.registrarEnvio = async function (per, p, tipo) {
    const ev = E.evaluacion(per, p.id); if (!ev) return;
    const r = E.copiaRec(ev); r.d.whatsapp = (r.d.whatsapp || []).concat([{ tipo, por: E.api.usuario, fecha: E.hoyISO() }]);
    try { await E.guardar('evaluaciones', [r], 'mensaje de WhatsApp preparado'); } catch (e) { console.warn(e); }
  };
  O.panelMensaje = function (per, p, opciones) {
    opciones = opciones || {};
    const ev = E.evaluacion(per, p.id);
    let tipo = opciones.tipo || (ev && ev.d.cierre ? 'final' : 'inicial');
    const caja = h('div');
    const tel = h('input', { class: 'campo', value: p.d.telefono_wa || '', placeholder: '+502 5555 5555' });
    const txt = h('textarea', { class: 'campo', rows: 14 });
    const que = U.select([{ v: 'ambas', t: 'EDD y métricos (una imagen)' }, { v: 'edd', t: 'Solo EDD' }, { v: 'met', t: 'Solo métricos' }, { v: 'no', t: 'Sin imagen' }], 'ambas');
    const regen = () => { txt.value = E.mensajeWA(tipo, per, p); };
    const tg = h('div', { class: 'toggle' }, [['inicial', 'Plan del mes (inicio)'], ['final', 'Resultado (cierre)']].map(([k, t]) => h('button', { type: 'button', class: k === tipo ? 'sel' : null, onclick: e => { tipo = k; tg.querySelectorAll('button').forEach(b => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); regen(); } }, t)));
    regen();
    const digitos = () => E.telefonoDigitos(tel.value);
    caja.append(h('div', { class: 'hoja-cab' }, tg, h('span', { class: 'muted peq' }, 'El texto se puede editar antes de enviarlo.')),
      tipo === 'final' && ev && !ev.d.cierre ? h('div', { class: 'aviso warn' }, 'La evaluación de este mes aún no está autorizada.') : null,
      h('div', { class: 'rejilla' }, U.campo('Teléfono de WhatsApp', tel, 'Con código de país. Se guarda en el padrón.'), U.campo('Imagen', que)),
      h('div', { style: { marginTop: '10px' } }, U.campo('Mensaje', txt)),
      h('div', { class: 'acciones', style: { marginTop: '12px' } },
        U.btn('Guardar teléfono', async () => { const r = E.copiaRec(p); r.d.telefono_wa = tel.value.trim(); await E.guardar('personas', [r], 'teléfono WhatsApp'); E.toast('Teléfono guardado.'); }, ''),
        U.btn('Copiar mensaje', () => U.copiarTexto(txt.value)),
        U.btn('Copiar imagen', async () => { const c = await O.imagenCompartir(per, p, tipo, que.value); if (!c) throw new Error('No hay imagen para esta persona.'); await R.copiar(c); E.toast('Imagen copiada.'); }),
        navigator.canShare ? U.btn('Compartir (celular)', async () => {
          const c = que.value === 'no' ? null : await O.imagenCompartir(per, p, tipo, que.value);
          const files = c ? [new File([await R.blob(c)], 'EDD_' + E.periodo.hoja(per) + '.png', { type: 'image/png' })] : [];
          if (files.length && !navigator.canShare({ files })) throw new Error('Este dispositivo no permite compartir imágenes desde el navegador.');
          await navigator.share(files.length ? { files, text: txt.value } : { text: txt.value }); O.registrarEnvio(per, p, tipo);
        }) : null,
        U.btn('Abrir WhatsApp', async () => {
          if (!digitos()) { tel.classList.add('err'); throw new Error('Escribe el teléfono de WhatsApp.'); }
          if (que.value !== 'no') { try { const c = await O.imagenCompartir(per, p, tipo, que.value); if (c) { await R.copiar(c); E.toast('Imagen copiada: pégala en el chat después del texto.'); } } catch (e) { E.toast('No se pudo copiar la imagen: ' + e.message, 'warn'); } }
          g.open('https://wa.me/' + digitos() + '?text=' + encodeURIComponent(txt.value), '_blank', 'noopener');
          O.registrarEnvio(per, p, tipo);
        }, 'primario')));
    if (ev && (ev.d.whatsapp || []).length) caja.append(h('p', { class: 'muted peq' }, 'Mensajes preparados: ' + ev.d.whatsapp.map(x => (x.tipo === 'final' ? 'resultado' : 'plan') + ' por ' + x.por + ' el ' + E.fechaHora(x.fecha)).join('; ') + '.'));
    return caja;
  };
  function tabMsg(cont, per, p) {
    cont.append(h('div', { class: 'hoja' }, h('h2', null, 'Mensaje para WhatsApp Business'), h('p', null, 'WhatsApp no permite adjuntar imágenes desde un enlace: al abrirlo, la imagen queda copiada para pegarla en el chat. En el celular, "Compartir" envía texto e imagen juntos.'), O.panelMensaje(per, p)));
  }

  // ------------------------------------------------------------------ Cambios
  const NOMBRES = { items: 'plan', resultado_final: 'resultado final', comentarios: 'comentarios', autorizado_por: 'autoriza', cierre: 'cierre', plan_inicial: 'plan inicial', excepcion: 'excepción', reaperturas: 'reapertura', whatsapp: 'mensaje de WhatsApp', snapshot: 'datos de la persona', base_comision: 'base de comisión', equipo_id: 'equipo', activo: 'activo', telefono_wa: 'teléfono', fecha_ingreso: 'fecha de ingreso', garantia: 'garantía', nombre: 'nombre', codigo: 'código', rol: 'rol', supervisor_id: 'supervisor', notas: 'notas', agente: 'agente' };
  O.resumenCambio = (a, b) => {
    if (!a) return 'Registro creado';
    if (!b) return 'Registro eliminado';
    const k = [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(x => JSON.stringify(a[x]) !== JSON.stringify(b[x]));
    return k.length ? 'Cambió: ' + k.map(x => NOMBRES[x] || x).join(', ') : 'Sin cambios de contenido';
  };
  function tabCambios(cont, per, p) {
    const caja = h('div', { class: 'hoja' }, h('h2', null, 'Historial de cambios de ' + E.periodo.nombre(per)), h('p', null, 'Cada guardado queda registrado con quién, cuándo y qué cambió.'));
    const cuerpo = h('div', { class: 'cargando' }, 'Cargando…'); caja.append(cuerpo); cont.append(caja);
    E.api.auditoria(null, [E.idEval(per, p.id), p.id]).then(lista => {
      cuerpo.className = ''; cuerpo.innerHTML = '';
      cuerpo.append(U.tabla([{ t: 'Fecha' }, { t: 'Usuario' }, { t: 'Registro' }, { t: 'Acción' }, { t: 'Detalle' }], lista.map(x => h('tr', null,
        h('td', null, E.fechaHora(x.ts)), h('td', null, x.usuario || '—'), h('td', null, { evaluaciones: 'EDD', metricos: 'Métricos', personas: 'Padrón' }[x.tabla] || x.tabla),
        h('td', null, x.accion), h('td', null, O.resumenCambio(x.antes, x.despues))))));
    }).catch(e => { cuerpo.textContent = e.hint || e.message; });
  }
})(window);
