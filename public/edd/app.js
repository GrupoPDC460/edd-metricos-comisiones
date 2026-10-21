/* app.js — sesión, enrutador y carril de meses */
(function (g) {
  'use strict';
  const E = g.EDD, h = E.h, U = E.ui;
  const A = E.app = E.app || {};
  Object.assign(A, { periodo: null, filtros: { equipo: '', supervisor: '', q: '' }, ruta: [] });
  A.vistas = A.vistas || {};
  const $ = id => document.getElementById(id);
  const CLAVE = 'edd_sesion_v1';

  A.guardarSesion = s => { try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch (e) { } };
  A.leerSesion = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch (e) { return null; } };

  A.mostrarLogin = function (msg) {
    $('app').hidden = true; $('login').hidden = false;
    const err = $('loginError'); err.hidden = !msg; err.textContent = msg || '';
    const s = A.leerSesion(); if (s && s.usuario) $('loginNombre').value = s.usuario;
    setTimeout(() => ($('loginNombre').value ? $('loginClave') : $('loginNombre')).focus(), 50);
  };
  A.sesionVencida = function () {
    E.api.token = null; const s = A.leerSesion(); if (s) { delete s.token; A.guardarSesion(s); }
    A.mostrarLogin('Tu sesión venció. Ingresa la clave de nuevo; no se perdió lo que ya estaba guardado.');
  };
  A.entrar = async function (s) {
    E.api.token = s.token; E.api.usuario = s.usuario; E.api.rol = s.rol;
    await E.cargar();
    $('login').hidden = true; $('app').hidden = false;
    $('quien').textContent = s.usuario + ' · ' + (s.rol === 'editor' ? 'puede consultar y editar' : s.rol);
    const pers = E.periodos(); const guardado = localStorage.getItem('edd_periodo');
    A.periodo = pers.some(p => p.id === guardado) ? guardado : (pers.length ? A.periodoActual(pers) : null);
    if (!location.hash || location.hash === '#') location.hash = E.db.personas.size ? '#/panel' : '#/importar';
    A.render();
  };
  A.periodoActual = pers => {
    const hoy = new Date(); const id = E.periodo.id(hoy.getFullYear(), hoy.getMonth() + 1);
    return (pers.find(p => p.id === id) || pers[pers.length - 1]).id;
  };
  A.setPeriodo = id => { A.periodo = id; try { localStorage.setItem('edd_periodo', id); } catch (e) { } A.render(); };

  A.carril = function () {
    const c = $('carril'); c.innerHTML = '';
    E.periodos().forEach(p => {
      const evs = [...E.db.evaluaciones.values()].filter(e => e.d.periodo_id === p.id);
      const cerr = evs.filter(e => e.d.cierre).length;
      const est = p.d.estado === 'cerrado' ? 'Cerrado' : (evs.length ? cerr + '/' + evs.length + ' EDD' : 'Sin planes');
      c.append(h('button', { type: 'button', class: 'mes' + (p.id === A.periodo ? ' sel' : ''), title: E.periodo.nombre(p.id), onclick: () => A.setPeriodo(p.id), 'aria-pressed': p.id === A.periodo ? 'true' : 'false' },
        E.periodo.corto(p.id), h('small', null, est)));
    });
    c.append(h('button', { type: 'button', class: 'mes nuevo', onclick: () => A.nuevoMes() }, '+ Nuevo mes'));
  };

  A.nuevoMes = function () {
    const pers = E.periodos(); const cfg = E.conf();
    const sig = pers.length ? E.periodo.sumar(pers[pers.length - 1].id, 1) : cfg.periodo_inicial;
    const anterior = pers.length ? pers[pers.length - 1] : null;
    const opciones = []; for (let i = -1; i < 14; i++) { const id = E.periodo.sumar(sig, i); if (id >= cfg.periodo_inicial && !E.db.periodos.get(id)) opciones.push({ v: id, t: E.periodo.nombre(id) }); }
    const sel = U.select(opciones, sig);
    const num = h('input', { class: 'campo num', type: 'number', min: 1, max: cfg.planes_max, value: anterior ? anterior.d.num_planes || 5 : 5 });
    const copiar = h('input', { type: 'checkbox', checked: !!anterior });
    E.modal({
      titulo: 'Nuevo mes', cuerpo: h('div', { class: 'rejilla' },
        U.campo('Mes', sel), U.campo('Cantidad de planes de trabajo', num, 'Normalmente entre 4 y 6.'),
        anterior ? h('label', { class: 'check', style: { gridColumn: '1/-1' } }, copiar, 'Copiar los planes de cada equipo de ' + E.periodo.nombre(anterior.id) + ' (solo las directrices y métricos, sin resultados)') : null,
        h('p', { class: 'muted peq', style: { gridColumn: '1/-1' } }, 'Un mes nuevo no reemplaza los anteriores: cada mes guarda sus propios planes, resultados y aprobaciones.')),
      acciones: [{ label: 'Cancelar' }, {
        label: 'Crear mes', tipo: 'primario', onClick: async () => {
          const id = sel.value; if (!id) return false;
          const n = Math.max(1, Math.min(cfg.planes_max, Number(num.value) || 5));
          await E.guardar('periodos', [{ id, d: { nombre: E.periodo.nombre(id), num_planes: n, estado: 'abierto', creado_por: E.api.usuario, creado: E.hoyISO() } }], 'crear mes');
          if (anterior && copiar.checked) {
            const copias = [...E.db.planes.values()].filter(p => p.d.periodo_id === anterior.id).map(p => ({
              id: E.idPlan(id, p.d.equipo_id, p.d.tipo), d: { periodo_id: id, equipo_id: p.d.equipo_id, tipo: p.d.tipo, items: p.d.items.map(it => Object.assign({}, it, { id: (p.d.tipo === 'edd' ? 'e' : 'm') + E.uid() })), copiado_de: anterior.id },
            }));
            await E.guardar('planes', copias, 'copiar planes de ' + anterior.id);
          }
          E.toast('Mes creado: ' + E.periodo.nombre(id) + '.'); A.setPeriodo(id); location.hash = '#/planes';
        }
      }]
    });
  };

  A.render = function () {
    if ($('app').hidden) return;
    A.carril();
    const partes = (location.hash || '#/panel').slice(2).split('/').map(decodeURIComponent);
    A.ruta = partes;
    const nombre = partes[0] || 'panel';
    document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('activo', a.dataset.r === nombre || (nombre === 'ficha' && a.dataset.r === 'panel')));
    $('lateral').classList.remove('abierto');
    g.onbeforeunload = null;
    const vista = $('vista'); vista.innerHTML = '';
    const fn = A.vistas[nombre] || A.vistas.panel;
    try { const r = fn(vista, partes.slice(1)); if (r && r.catch) r.catch(E.errorToast); } catch (e) { E.errorToast(e); }
    requestAnimationFrame(() => U.ajustarTextareas(vista));
  };
  A.refrescar = () => { const y = g.scrollY; A.render(); requestAnimationFrame(() => g.scrollTo(0, y)); };
  A.recargar = async () => { await E.cargar(); A.refrescar(); E.toast('Datos actualizados.'); };

  function iniciar() {
    $('loginForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      const btn = $('loginBtn'); btn.disabled = true; $('loginError').hidden = true;
      try {
        const r = await E.api.login($('loginClave').value, $('loginNombre').value.trim());
        const s = { token: r.token, usuario: r.usuario, rol: r.rol, expira: r.expira };
        A.guardarSesion(s); $('loginClave').value = '';
        await A.entrar(s);
      } catch (e) {
        const err = $('loginError'); err.hidden = false; err.textContent = e.hint || e.message;
      } finally { btn.disabled = false; }
    });
    $('salirBtn').addEventListener('click', async () => {
      try { await E.api.logout(); } catch (e) { }
      const s = A.leerSesion() || {}; delete s.token; A.guardarSesion(s); E.api.token = null; A.mostrarLogin();
    });
    $('recargarBtn').addEventListener('click', () => A.recargar().catch(E.errorToast));
    $('menuBtn').addEventListener('click', () => $('lateral').classList.toggle('abierto'));
    g.addEventListener('hashchange', () => A.render());
    const s = A.leerSesion();
    if (s && s.token && (!s.expira || new Date(s.expira) > new Date())) A.entrar(s).catch(e => { if (e.code !== 'EDD_SESION') E.errorToast(e); A.mostrarLogin(e.code === 'EDD_SESION' ? 'Tu sesión venció. Ingresa la clave de nuevo.' : null); });
    else A.mostrarLogin();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window);
