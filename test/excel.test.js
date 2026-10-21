global.window = globalThis;
global.XLSX = require('xlsx');
global.JSZip = require('jszip');
require('../public/edd/core.js'); require('../public/edd/excel.js');
const E = globalThis.EDD, fs = require('fs'), path = require('path');
const up = '/mnt/user-data/uploads/';
const file = n => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync(up + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
(async () => {
  const arch = {};
  for (const n of fs.readdirSync(up)) { const a = await E.excel.leer(file(n)); arch[n] = a; console.log(n, '→', a.tipo); }
  const pad = E.excel.parsePadron(arch['Formato_EDD.xlsx']);
  console.log('mapeo', pad.mapeo.map(m => m.campo + ':' + m.columna).join(' '));
  console.log('personas', pad.personas.length, 'apodos', pad.apodos.slice(0, 3));
  const giselle = pad.personas.find(p => p.codigo === 15872); console.log('giselle', giselle.ingreso, giselle.ingresoPrevio, giselle.telefono, giselle.edd.length);
  const dah = pad.personas.find(p => p.codigo === 13664); console.log('dahirin', dah.telefono, dah.mtr, dah.ingreso);
  const m1 = E.excel.parseMetricos(arch['Métricos_Team_Chevere.xlsx']);
  console.log('chev', m1.equipoArchivo, m1.columnasNoImportadas, m1.resumen.length, JSON.stringify(m1.hojas.find(h => h.codigo === 15549)));
  const m2 = E.excel.parseMetricos(arch['Métricos_Team_Los_Imparables.xlsx']);
  console.log('imp', m2.equipoArchivo, m2.resumen.map(r => r.codigo + ':' + r.base).join(','), JSON.stringify(m2.hojas[0].items));
  const tplA = await E.excel.analizarPlantilla(arch['15547_-_Heidi_Adelaida_Morales_Salguero_MC.xlsx']);
  console.log('plantilla', JSON.stringify(tplA));
  const limpia = await E.excel.limpiarPlantilla(arch['15547_-_Heidi_Adelaida_Morales_Salguero_MC.xlsx'].buf);
  console.log('limpia', limpia.base64.length, 'logo', (limpia.logo || '').slice(0, 30), limpia.hojaMes);
  fs.writeFileSync('/home/claude/x/plantilla_limpia.xlsx', Buffer.from(limpia.base64, 'base64'));
  console.log('meses resumen', (await E.excel.mesesDePlantilla(limpia.base64)).slice(0, 5));
  const heidi = pad.personas.find(p => p.codigo === 15547);
  const hojas = [
    { periodo: '2026-10', items: heidi.edd.map((t, i) => ({ texto: t, resultado: i === 2 ? 'No Cumple' : 'Cumple' })), final: 'Alcanza Expectativas', comentarios: 'Buen mes. Sigue así con los RECs.', confirmado: true },
    { periodo: '2026-11', items: [1,2,3,4,5,6].map(i => ({ texto: 'Directriz número ' + i + ' de prueba para noviembre', resultado: i % 2 ? 'Cumple' : null })), final: '', comentarios: '', confirmado: false },
  ];
  const blob = await E.excel.generarLibro(limpia.base64, { codigo: 15547, nombre: heidi.nombre, rol: heidi.puesto }, hojas);
  fs.writeFileSync('/home/claude/x/salida_heidi.xlsx', Buffer.from(await blob.arrayBuffer()));
  console.log('OK generado');
})().catch(e => { console.error(e); process.exit(1); });
