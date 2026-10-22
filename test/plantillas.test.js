global.window = globalThis;
global.XLSX = require('xlsx'); global.JSZip = require('jszip');
require('../public/edd/core.js'); require('../public/edd/excel.js');
const E = globalThis.EDD, fs = require('fs');
const up = '/mnt/user-data/uploads/';
const file = n => ({ name: n, arrayBuffer: async () => { const b = fs.readFileSync(up + n); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
(async () => {
  const fsx = fs.readdirSync(up).filter(n => /^1\d+_-_.*\.xlsx$/.test(n)).sort();
  for (const n of fsx) {
    const a = await E.excel.leer(file(n));
    const an = await E.excel.analizarPlantilla(a);
    const hp = E.excel.historialPrevio(a, '2026-10');
    let ok = 'ok';
    try { const l = await E.excel.limpiarPlantilla(a.buf); fs.writeFileSync('/home/claude/x/tpl_' + n.slice(0, 5) + '.xlsx', Buffer.from(l.base64, 'base64'));
      const blob = await E.excel.generarLibro(l.base64, { codigo: 99999, nombre: 'Persona Prueba', rol: 'Rol prueba' }, [{ periodo: '2026-10', items: [{ texto: 'Rendición de cuentas al 100%', resultado: 'Cumple' }, { texto: 'Nota de calidad 80%', resultado: 'No Cumple' }], final: 'Necesita Mejorar', comentarios: 'Prueba', confirmado: true }], { '2026-08': { resultado: 'Alcanza Expectativas' }, '2026-09': { resultado: 'Excede Expectativas' } });
      fs.writeFileSync('/home/claude/x/gen_' + n.slice(0, 5) + '.xlsx', Buffer.from(await blob.arrayBuffer()));
    } catch (e) { ok = 'ERROR ' + e.message; }
    console.log(n.slice(0, 32).padEnd(32), a.tipo, 'mes=' + an.plantillaMes + (an.plantillaOculta ? '(h)' : '(v)'), 'otras=' + an.mensuales.map(m => m.nombre).join('|'), 'hist=' + JSON.stringify(Object.fromEntries(Object.entries(hp.meses).map(([k, v]) => [k, (v.resumen || '-').slice(0, 7) + '/' + (v.hoja ? v.hoja.valor.slice(0, 7) : '-')]))), hp.sinFecha.length ? 'sinFecha=' + hp.sinFecha.map(x => x.hoja).join(',') : '', ok);
  }
})().catch(e => { console.error(e); process.exit(1); });
