global.window = globalThis;
global.XLSX = require('xlsx'); global.JSZip = require('jszip');
require('../public/edd/core.js'); require('../public/edd/excel.js'); require('../public/edd/importar.js');
const E = globalThis.EDD, fs = require('fs');
const up = '/mnt/user-data/uploads/';
const file = n => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync(up + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
(async () => {
  const nombres = fs.readdirSync(up).filter(n => n.endsWith('.xlsx') && n !== 'Formato_EDD.xlsx' && n !== '15547_-_Heidi_Adelaida_Morales_Salguero_MC.xlsx').sort();
  const leidos = []; for (const n of nombres) leidos.push(await E.excel.leer(file(n)));
  E.api.usuario = 'Importación asistida';
  E.db.periodos.set('2027-10', { id: '2027-10', d: {} });
  const prop = await E.importar.analizar(leidos, { periodo: '2026-10' });
  const elegir = { 'activos': 'si', 'historial': 'incluir' };
  prop.dudas.filter(d => d.tipo === 'decision').forEach(d => {
    let v = elegir[d.id];
    if (d.id.startsWith('sup:')) v = 'pendiente';
    if (d.id.startsWith('equipo:')) v = 'sin';
    if (d.id.startsWith('base:')) v = d.opciones[0].valor; // valor del archivo
    if (d.id.startsWith('fecha:')) v = 'previa';
    if (d.id.startsWith('hist:')) v = 'resumen';
    if (v === undefined) throw new Error('Sin decisión para ' + d.id);
    d.valor = v; E.importar.aplicarDecision(prop, d);
    console.log('DECISIÓN', d.id, '→', (d.opciones.find(o => o.valor === v) || {}).etiqueta || v);
  });
  console.log('pendientes', E.importar.pendientes(prop).length);
  const reg = E.importar.construirRegistros(prop);
  const ahora = E.hoyISO();
  const out = {
    config: [{ id: 'general', d: Object.assign({}, E.DEF) }],
    equipos: reg.equipos, personas: reg.personas, periodos: reg.periodo ? [reg.periodo] : [], planes: reg.planes, evaluaciones: reg.evals, metricos: reg.mets,
    importaciones: [{ id: 'imp-' + Date.now(), d: { fecha: ahora, usuario: 'Importación asistida (a pedido de Daniel Monge)', periodo: prop.periodo, archivos: prop.archivos, resumen: { personas: reg.personas.length, equipos: reg.equipos.length, planes: reg.planes.length, evaluaciones: reg.evals.length, metricos: reg.mets.length },
      decisiones: prop.dudas.filter(d => d.tipo === 'decision').map(d => ({ titulo: d.titulo, eleccion: (d.opciones.find(o => o.valor === d.valor) || {}).etiqueta || d.valor })), avisos: prop.dudas.filter(d => d.tipo === 'aviso').map(d => d.titulo) } }],
  };
  for (const [t, recs] of Object.entries(out)) {
    const json = JSON.stringify(recs.map(r => ({ id: r.id, data: r.d })));
    fs.writeFileSync('/home/claude/x/seed_' + t + '.json', json);
    console.log(t, recs.length, json.length);
  }
  console.log('equipos', reg.equipos.map(e => e.id + ' sup=' + e.d.supervisor_id + ' com=' + e.d.comisiona).join(' | '));
  console.log('con historial', reg.personas.filter(p => p.d.historial_previo).length, 'bases', reg.personas.filter(p => p.d.base_comision != null).map(p => p.d.nombre + ':' + p.d.base_comision).join(', '));
  console.log('sin equipo', reg.personas.filter(p => !p.d.equipo_id).map(p => p.d.nombre).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
