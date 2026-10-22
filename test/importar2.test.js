global.window = globalThis;
global.XLSX = require('xlsx'); global.JSZip = require('jszip');
require('../public/edd/core.js'); require('../public/edd/excel.js'); require('../public/edd/importar.js');
const E = globalThis.EDD, fs = require('fs');
const up = '/mnt/user-data/uploads/';
const file = n => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync(up + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
(async () => {
  const leidos = [];
  for (const n of fs.readdirSync(up).filter(n => n.endsWith('.xlsx') && n !== 'Formato_EDD.xlsx')) leidos.push(await E.excel.leer(file(n)));
  console.log(leidos.map(a => a.tipo).reduce((o, t) => (o[t] = (o[t] || 0) + 1, o), {}));
  E.api.usuario = 'Prueba';
  const prop = await E.importar.analizar(leidos, { periodo: '2026-10' });
  console.log('plantilla maestra:', prop.plantilla.archivo, prop.plantilla.hojaMes);
  prop.dudas.forEach(d => console.log('[' + d.tipo + '] ' + d.area + ' · ' + d.titulo + (d.tipo === 'aviso' ? '\n      ' + d.detalle.slice(0, 260) : '')));
  prop.personas.filter(p => p.historial).forEach(p => console.log('  ', p.codigo, p.nombre.slice(0, 24).padEnd(24), Object.entries(p.historial).map(([m, h]) => E.periodo.corto(m) + ':' + (h.valor || '').slice(0, 7) + (h.excluido ? '(EXCL)' : '') + (h.conflicto ? '(CONF)' : '') + (!h.opciones.resumen ? '(solo hoja)' : '')).join(' ')));
  prop.dudas.filter(d => d.tipo === 'decision').forEach(d => { d.valor = d.id === 'historial' ? 'incluir' : d.opciones[0].valor; E.importar.aplicarDecision(prop, d); });
  const reg = E.importar.construirRegistros(prop);
  console.log('con historial previo:', reg.personas.filter(p => p.d.historial_previo).length, JSON.stringify(reg.personas.find(p => p.id === 'p-15547').d.historial_previo));
})().catch(e => { console.error(e); process.exit(1); });
