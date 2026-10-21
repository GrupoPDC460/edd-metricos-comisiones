global.window = globalThis;
global.XLSX = require('xlsx'); global.JSZip = require('jszip');
require('../public/edd/core.js'); require('../public/edd/excel.js'); require('../public/edd/importar.js');
const E = globalThis.EDD, fs = require('fs');
const up = '/mnt/user-data/uploads/';
const file = n => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync(up + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
(async () => {
  const leidos = [];
  for (const n of fs.readdirSync(up).filter(n => n.endsWith('.xlsx'))) leidos.push(await E.excel.leer(file(n)));
  E.api.usuario = 'Prueba';
  const prop = await E.importar.analizar(leidos, { periodo: '2026-10' });
  console.log('EQUIPOS', prop.equipos.map(e => e.nombre + ' sup=' + e.supervisor_codigo + ' ' + (e.coincidencia || '') + ' cand=' + (e.candidatos || []).map(c => c.nombre).join('|')));
  prop.dudas.forEach(d => console.log('[' + d.tipo + '] ' + d.area + ' · ' + d.titulo + '\n      ' + d.detalle + (d.opciones ? '\n      opciones: ' + d.opciones.map(o => o.etiqueta).join(' / ') : '')));
  console.log('PERSONAS'); prop.personas.forEach(p => console.log(' ', p.codigo, p.nombre.padEnd(38), (p.equipo_id || '-').padEnd(14), p.activo, p.fecha_ingreso, p.telefono, 'edd', p.edd.length, 'met', p.met.map(m => m.peso).join('/'), p.es_supervisor ? 'SUP' : ''));
  // resolver decisiones de prueba
  prop.dudas.filter(d => d.tipo === 'decision').forEach(d => { d.valor = d.opciones[0].valor; E.importar.aplicarDecision(prop, d); });
  const reg = E.importar.construirRegistros(prop);
  console.log('REG', reg.equipos.length, reg.personas.length, reg.planes.map(p => p.id + ':' + p.d.items.length), reg.evals.length, reg.mets.length, reg.periodo && reg.periodo.d);
  reg.evals.filter(e => e.d.excepcion).forEach(e => console.log('  excepción EDD', e.d.snapshot.nombre, e.d.items.map(i => i.origen[0]).join('')));
  reg.mets.filter(e => e.d.excepcion).forEach(e => console.log('  excepción MET', e.d.snapshot.nombre));
  console.log(JSON.stringify(reg.evals.find(e => e.d.persona_id === 'p-15549').d.items.map(i => i.origen + ':' + i.texto.slice(0, 40))));
  fs.writeFileSync('/home/claude/x/propuesta.json', JSON.stringify({ reg }, null, 0));
})().catch(e => { console.error(e); process.exit(1); });
