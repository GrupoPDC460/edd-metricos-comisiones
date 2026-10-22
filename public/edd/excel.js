/* excel.js — lectura de los archivos de origen (SheetJS) y manejo de la plantilla EDD original (JSZip).
 * La exportación trabaja sobre el XML de la plantilla: conserva estilos, bordes, celdas combinadas,
 * formato condicional (semáforo), validaciones, logo y hojas ocultas. Solo cambia datos y nombres de hoja. */
(function (g) {
  'use strict';
  const E = g.EDD;
  const X = E.excel = {};
  const XL = () => g.XLSX;
  const ZIP = () => g.JSZip;

  // ------------------------------------------------------------------ helpers XML
  const escX = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const unescX = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
  const attrs = tag => { const o = {}; tag.replace(/([\w:]+)="([^"]*)"/g, (m, k, v) => { o[k] = v; }); return o; };
  const colNum = c => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colLetra = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const splitRef = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: m[1], r: Number(m[2]) }; };
  X._h = { escX, unescX, attrs, colNum, colLetra };

  // Localiza el XML completo de una celda (autocerrada o con contenido)
  function buscarCelda(xml, ref) {
    const re = new RegExp('<c r="' + ref + '"(?=[\\s>/])[^>]*?(\\/>|>[\\s\\S]*?<\\/c>)');
    const m = re.exec(xml);
    return m ? { ini: m.index, fin: m.index + m[0].length, txt: m[0] } : null;
  }
  function estiloDe(celdaTxt) { const m = /\ss="(\d+)"/.exec(celdaTxt || ''); return m ? m[1] : null; }
  // Reemplaza o inserta una celda en su fila
  function ponerCelda(xml, ref, construir) {
    const actual = buscarCelda(xml, ref);
    if (actual) return xml.slice(0, actual.ini) + construir(estiloDe(actual.txt)) + xml.slice(actual.fin);
    const { c, r } = splitRef(ref);
    const reFila = new RegExp('<row r="' + r + '"[^>]*?(\\/>|>[\\s\\S]*?<\\/row>)');
    const mf = reFila.exec(xml);
    if (!mf) throw new Error('La plantilla no tiene la fila ' + r);
    let fila = mf[0];
    if (fila.endsWith('/>')) fila = fila.slice(0, -2) + '></row>';
    const nueva = construir(null);
    const celdas = [...fila.matchAll(/<c r="([A-Z]+)\d+"/g)];
    const sig = celdas.find(x => colNum(x[1]) > colNum(c));
    const pos = sig ? sig.index : fila.lastIndexOf('</row>');
    fila = fila.slice(0, pos) + nueva + fila.slice(pos);
    return xml.slice(0, mf.index) + fila + xml.slice(mf.index + mf[0].length);
  }
  const sAttr = s => s != null ? ' s="' + s + '"' : '';
  const cVacia = (ref) => s => '<c r="' + ref + '"' + sAttr(s) + '/>';
  const cTexto = (ref, texto) => s => texto == null || texto === '' ? '<c r="' + ref + '"' + sAttr(s) + '/>'
    : '<c r="' + ref + '"' + sAttr(s) + ' t="inlineStr"><is><t xml:space="preserve">' + escX(texto) + '</t></is></c>';
  const cNum = (ref, n) => s => '<c r="' + ref + '"' + sAttr(s) + '><v>' + n + '</v></c>';
  const cFormulaTexto = (ref, f, v) => s => '<c r="' + ref + '"' + sAttr(s) + ' t="str"><f>' + escX(f) + '</f><v>' + escX(v == null ? '' : v) + '</v></c>';
  // "Comentarios:" en negrita como en la plantilla original (texto enriquecido)
  const RPR_B = '<rPr><b/><sz val="11"/><color theme="1"/><rFont val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></rPr>';
  const RPR_N = '<rPr><sz val="11"/><color theme="1"/><rFont val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></rPr>';
  const cComentarios = (ref, texto) => s => '<c r="' + ref + '"' + sAttr(s) + ' t="inlineStr"><is><r>' + RPR_B + '<t>Comentarios</t></r><r>' + RPR_N + '<t xml:space="preserve">' + escX(':\n' + (texto || '')) + '</t></r></is></c>';

  async function leerZip(buf) { return ZIP().loadAsync(buf); }
  const leerTxt = (zip, p) => zip.file(p) ? zip.file(p).async('string') : Promise.resolve(null);
  const ruta = (base, target) => { // resuelve rutas relativas de relaciones
    if (target.startsWith('/')) return target.slice(1);
    const partes = base.split('/'); partes.pop();
    target.split('/').forEach(t => { if (t === '..') partes.pop(); else if (t !== '.') partes.push(t); });
    return partes.join('/');
  };
  const relsDe = p => { const i = p.lastIndexOf('/'); return p.slice(0, i) + '/_rels/' + p.slice(i + 1) + '.rels'; };
  function parseRels(xml) {
    return [...(xml || '').matchAll(/<Relationship\b[^>]*\/>/g)].map(m => attrs(m[0]));
  }
  async function hojasLibro(zip) {
    const wb = await leerTxt(zip, 'xl/workbook.xml');
    const rels = parseRels(await leerTxt(zip, 'xl/_rels/workbook.xml.rels'));
    return [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m => {
      const a = attrs(m[0]); const rel = rels.find(r => r.Id === a['r:id']);
      return { nombre: unescX(a.name), rid: a['r:id'], sheetId: a.sheetId, oculta: a.state === 'hidden' || a.state === 'veryHidden', ruta: rel ? ruta('xl/workbook.xml', rel.Target) : null, tag: m[0] };
    });
  }

  // ------------------------------------------------------------------ lectura de archivos (SheetJS)
  X.leer = async function (file) {
    const buf = await file.arrayBuffer();
    // sheetRows: las plantillas EDD declaran filas hasta la 1,048,576; leer solo las primeras evita minutos de espera
    const wb = XL().read(buf, { type: 'array', cellFormula: true, cellDates: false, cellNF: false, sheetRows: 600 });
    return { nombre: file.name, buf, wb, tipo: X.clasificar(wb) };
  };
  const valor = (ws, ref) => { const c = ws && ws[ref]; return c ? c.v : undefined; };
  const filas = ws => XL().utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
  X.clasificar = function (wb) {
    for (const n of wb.SheetNames) {
      const r = filas(wb.Sheets[n])[0] || [];
      const hs = r.map(E.norm);
      if (hs.includes('codigo de colaborador') && hs.includes('nombre completo')) return 'padron';
    }
    const res = wb.Sheets['Resumen'];
    if (res && E.norm(valor(res, 'A5')) === 'codigo' && wb.SheetNames.some(n => E.norm(valor(wb.Sheets[n], 'D11')) === 'resultado evaluacion')) return 'plantilla';
    if (res && wb.SheetNames.some(n => E.norm(valor(wb.Sheets[n], 'B2')) === 'actividad')) {
      const rs = filas(res);
      if (rs.some(f => (f || []).some(v => E.norm(v) === 'empleado'))) return 'metricos';
    }
    return null;
  };
  const fechaDeSerial = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') { const d = XL().SSF.parse_date_code(v); if (!d || d.y < 1950) return null; return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0'); }
    const s = String(v).trim(); const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m && Number(m[1]) >= 1950) return m[0];
    const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); if (m2 && Number(m2[3]) >= 1950) return m2[3] + '-' + m2[2].padStart(2, '0') + '-' + m2[1].padStart(2, '0');
    return null;
  };
  X.fechaDeSerial = fechaDeSerial;
  const texto = v => v == null || v === 0 || v === '0' ? '' : String(v).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
  const limpiarNombre = v => String(v || '').replace(/\s+/g, ' ').trim();
  const CODIGO_PAIS = { 'guatemala': '502', 'el salvador': '503', 'honduras': '504', 'nicaragua': '505', 'costa rica': '506', 'panama': '507', 'republica dominicana': '1' };

  X.parsePadron = function (archivo) {
    const wb = archivo.wb;
    const hoja = wb.SheetNames.find(n => { const r = filas(wb.Sheets[n])[0] || []; return r.map(E.norm).includes('codigo de colaborador'); });
    const rows = filas(wb.Sheets[hoja]);
    const enc = rows[0] || [];
    const idx = nombre => enc.findIndex(h => E.norm(h) === E.norm(nombre));
    const campos = [
      ['codigo', 'Código de Colaborador', 'Código del gestor'], ['nombre', 'Nombre Completo', 'Nombre'], ['puesto', 'Puesto', 'Rol (puesto)'],
      ['supervisor', 'Supervisor', 'Supervisor asignado para la EDD'], ['lider', 'Nombre de Lider', 'Líder (referencia)'],
      ['equipoCargo', 'Equipo a cargo', 'Identifica a quien tiene equipo'], ['estado', 'Estado', 'Estado activo'],
      ['ingreso', 'Fecha de ingreso', 'Fecha de ingreso (garantía)'], ['ingresoPrevio', 'Fecha de ingreso previo', 'Solo referencia si falta la fecha de ingreso'],
      ['pais', 'País', 'Código de país del teléfono'], ['corporativo', 'Corporativo', 'Teléfono de WhatsApp (corporativo)'], ['agente', 'Agente', 'Agente / extensión'],
    ];
    const mapeo = campos.map(([k, h, uso]) => { const i = idx(h); return { campo: k, encabezado: h, columna: i >= 0 ? XL().utils.encode_col(i) : null, uso, i }; });
    const ix = Object.fromEntries(mapeo.map(m => [m.campo, m.i]));
    const eddIx = enc.map((h, i) => ({ h, i })).filter(x => /^edd\s*\d+$/.test(E.norm(x.h)));
    const mtrIx = enc.map((h, i) => ({ h, i })).filter(x => /^mtr\s*\d/.test(E.norm(x.h)));
    eddIx.forEach(x => mapeo.push({ campo: 'edd', encabezado: String(x.h), columna: XL().utils.encode_col(x.i), uso: 'Directriz del plan de trabajo (EDD)', i: x.i }));
    mtrIx.forEach(x => mapeo.push({ campo: 'mtr', encabezado: String(x.h), columna: XL().utils.encode_col(x.i), uso: 'Métrico (texto); la ponderación viene del archivo de métricos', i: x.i }));
    const personas = [];
    for (let r = 1; r < rows.length; r++) {
      const f = rows[r] || []; const get = k => ix[k] >= 0 ? f[ix[k]] : null;
      const codigo = Number(get('codigo'));
      if (!codigo) continue;
      const pais = E.norm(get('pais'));
      const corp = String(get('corporativo') == null ? '' : get('corporativo')).replace(/\D/g, '');
      const cc = CODIGO_PAIS[pais] || (pais ? null : '502');
      personas.push({
        fila: r + 1, codigo, nombre: limpiarNombre(get('nombre')), puesto: limpiarNombre(get('puesto')),
        supervisorArchivo: limpiarNombre(get('supervisor')), lider: limpiarNombre(get('lider')),
        equipoCargo: /^s[ií]$/i.test(String(get('equipoCargo') || '').trim()),
        estado: limpiarNombre(get('estado')), ingreso: fechaDeSerial(get('ingreso')), ingresoPrevio: fechaDeSerial(get('ingresoPrevio')),
        pais: limpiarNombre(get('pais')), telefono: corp ? ((cc ? '+' + cc : '') + corp) : '', telefonoPaisDesconocido: !!corp && !cc,
        agente: limpiarNombre(get('agente')),
        edd: eddIx.map(x => texto(f[x.i])).filter(Boolean),
        mtr: mtrIx.map(x => texto(f[x.i])),
      });
    }
    // Apodos en otras hojas (p. ej. Hoja1: "Alexa" → número)
    const apodos = [];
    wb.SheetNames.filter(n => n !== hoja).forEach(n => filas(wb.Sheets[n]).forEach(f => {
      for (let c = 0; c + 1 < (f || []).length; c++) {
        const a = f[c], b = f[c + 1];
        if (typeof a === 'string' && /^[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,15}$/.test(a.trim()) && /^\d{8}$/.test(String(b || ''))) apodos.push({ hoja: n, apodo: a.trim(), numero: String(b) });
      }
    }));
    return { hoja, mapeo, personas, encabezadosMtr: mtrIx.map(x => String(x.h)), apodos, totalFilas: rows.length - 1 };
  };

  X.parseMetricos = function (archivo) {
    const wb = archivo.wb; const res = wb.Sheets['Resumen']; const rs = filas(res);
    let hr = rs.findIndex(f => (f || []).some(v => E.norm(v) === 'empleado'));
    const enc = rs[hr] || [];
    const ci = n => enc.findIndex(v => E.norm(v) === E.norm(n));
    const iEmp = ci('Empleado'), iTot = ci('Total'), iGar = ci('Garantizado');
    const otras = enc.map((v, i) => ({ v, i })).filter(x => x.v != null && ![iEmp, iTot, iGar].includes(x.i)).map(x => String(x.v));
    const equipoArchivo = archivo.nombre.replace(/\.xlsx?$/i, '').replace(/^m[eé]tricos[_\s-]*/i, '').replace(/_/g, ' ').trim();
    const resumen = [];
    for (let r = hr + 1; r < rs.length; r++) {
      const f = rs[r] || []; const emp = f[iEmp];
      if (!emp) continue;
      const m = /^\s*(\d{3,6})\s*-?\s*(.*)$/.exec(String(emp));
      if (!m) continue;
      const fila = r + 1;
      const celdasFormula = [];
      enc.forEach((h, i) => { const c = res[XL().utils.encode_cell({ r, c: i })]; if (c && c.f) celdasFormula.push({ col: String(h || ''), f: c.f }); });
      resumen.push({ codigo: Number(m[1]), nombre: limpiarNombre(m[2]), base: E.num(f[iTot]), garantizado: iGar >= 0 ? E.num(f[iGar]) : null, fila, formulas: celdasFormula });
    }
    const hojas = [];
    wb.SheetNames.filter(n => n !== 'Resumen').forEach(n => {
      const ws = wb.Sheets[n];
      if (E.norm(valor(ws, 'B2')) !== 'actividad') return;
      const codigo = Number(valor(ws, 'B1'));
      const items = []; const formulasRaras = [];
      const rango = XL().utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let r = 3; r <= rango.e.r; r++) {
        const b = valor(ws, 'B' + (r + 1));
        if (b && /total/i.test(String(b))) break;
        const c = ws['C' + (r + 1)], d = ws['D' + (r + 1)], e = ws['E' + (r + 1)];
        const peso = c && typeof c.v === 'number' ? c.v : null;
        if (peso === 1 && b) continue; // fila de "Cuenta por cobrar" (100 %)
        if (d && d.f && !/^\(?\s*\$?C\$?\d+\s*\*\s*\$?D\$?4\s*\)?$|^\(?\s*\$?D\$?4\s*\*\s*\$?C\$?\d+\s*\)?$/i.test(d.f.replace(/\s/g, ''))) formulasRaras.push('D' + (r + 1) + ': =' + d.f);
        if (peso == null && !(e && texto(e.v))) continue;
        items.push({ fila: r + 1, peso: peso == null ? null : E.r2(peso <= 1 ? peso * 100 : peso), entregable: e ? texto(e.v) : '' });
      }
      hojas.push({ hoja: n, codigo, items, formulasRaras });
    });
    return { archivo: archivo.nombre, equipoArchivo, columnasNoImportadas: otras, resumen, hojas };
  };

  // Analiza la plantilla EDD individual (sin modificarla)
  // Hojas con el diseño de "Plan de trabajo" (D11 = Resultado Evaluación) y cuál sirve de plantilla del mes
  function hojasPlan(wb, hs) {
    const cands = hs.filter(h => wb.Sheets[h.nombre] && E.norm(valor(wb.Sheets[h.nombre], 'D11')) === 'resultado evaluacion');
    const mes = cands.find(h => h.oculta && /^mes/i.test(h.nombre)) || cands.find(h => h.oculta) || cands.find(h => /^mes/i.test(h.nombre)) || cands[0] || null;
    return { cands, mes };
  }
  X.analizarPlantilla = async function (archivo) {
    const wb = archivo.wb; const zip = await leerZip(archivo.buf); const hs = await hojasLibro(zip);
    const res = wb.Sheets['Resumen'];
    const hp = hojasPlan(wb, hs);
    const mensuales = hp.cands.filter(h => h !== hp.mes).map(h => {
      const ws = wb.Sheets[h.nombre];
      const fecha = valor(ws, 'E5');
      const resultados = ['E6', 'E7', 'E8', 'E9', 'E10'].map(r => valor(ws, r)).filter(Boolean);
      return { nombre: h.nombre, fechaE5: typeof fecha === 'number' ? fechaDeSerial(fecha) : null, final: valor(ws, 'E11') || null, resultados: resultados.length };
    });
    const plantillaMes = hp.mes;
    return {
      archivo: archivo.nombre, hojas: hs.map(h => ({ nombre: h.nombre, oculta: h.oculta })),
      resumen: { codigo: valor(res, 'A6'), nombreGuardado: valor(res, 'B6'), rolGuardado: valor(res, 'C6') },
      mensuales, plantillaMes: plantillaMes ? plantillaMes.nombre : null, plantillaOculta: !!(plantillaMes && plantillaMes.oculta),
      tieneVinculoExterno: !!zip.file('xl/externalLinks/externalLink1.xml') || Object.keys(zip.files).some(k => k.startsWith('xl/externalLinks/')),
      filasCriterios: 5,
    };
  };

  // Resultados de meses anteriores al inicio del sistema que trae un archivo EDD individual
  X.historialPrevio = function (archivo, periodoInicial) {
    const wb = archivo.wb; const res = wb.Sheets['Resumen'];
    const RES = E.RESULTADOS.map(E.norm);
    const valido = v => typeof v === 'string' && RES.includes(E.norm(v)) ? E.RESULTADOS[RES.indexOf(E.norm(v))] : null;
    const meses = {};
    const rango = XL().utils.decode_range(res['!ref'] || 'A1:A1');
    for (let c = 3; c <= rango.e.c; c++) {
      const h = valor(res, XL().utils.encode_cell({ r: 4, c }));
      const m = /^([a-z]{3})-(\d{2})$/i.exec(String(h || '').trim());
      if (!m) continue;
      const mi = E.MES_ABR.indexOf(m[1].toLowerCase()); if (mi < 0) continue;
      const id = E.periodo.id(2000 + Number(m[2]), mi + 1);
      if (id >= periodoInicial) continue;
      const v = valido(valor(res, XL().utils.encode_cell({ r: 5, c })));
      if (v) (meses[id] = meses[id] || {}).resumen = v;
    }
    wb.SheetNames.forEach(n => {
      const ws = wb.Sheets[n];
      if (E.norm(valor(ws, 'D11')) !== 'resultado evaluacion') return;
      const f = valor(ws, 'E5'); const v = valido(valor(ws, 'E11'));
      if (!v) return;
      const fecha = typeof f === 'number' ? fechaDeSerial(f) : null;
      if (!fecha) { (meses['?'] = meses['?'] || { sinFecha: [] }).sinFecha.push({ hoja: n, valor: v }); return; }
      const id = fecha.slice(0, 7);
      if (id >= periodoInicial) return;
      (meses[id] = meses[id] || {}).hoja = { nombre: n, valor: v };
    });
    const sinFecha = meses['?'] ? meses['?'].sinFecha : []; delete meses['?'];
    return { archivo: archivo.nombre, codigo: Number(valor(res, 'A6')) || Number((/^(\d{3,6})/.exec(archivo.nombre) || [])[1]) || null, nombreGuardado: valor(res, 'B6') || '', meses, sinFecha };
  };

  // ------------------------------------------------------------------ limpieza de la plantilla
  // Quita datos de la persona del archivo original, vínculos externos y hojas mensuales; deja la estructura.
  X.limpiarPlantilla = async function (buf) {
    const zip = await leerZip(buf);
    const hs = await hojasLibro(zip);
    const libro = XL().read(buf, { type: 'array', sheetRows: 12 });
    const resumen = hs.find(h => h.nombre === 'Resumen');
    const { cands, mes } = hojasPlan(libro, hs);
    if (!resumen || !mes) throw new Error('La plantilla no tiene la hoja "Resumen" y una hoja "Plan de trabajo" (Mes- Año).');
    const quitar = cands.filter(h => h !== mes);
    let wb = await leerTxt(zip, 'xl/workbook.xml');
    let wbRels = await leerTxt(zip, 'xl/_rels/workbook.xml.rels');
    let ct = await leerTxt(zip, '[Content_Types].xml');
    const quitarParte = p => { zip.remove(p); ct = ct.replace(new RegExp('<Override PartName="/' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*/>'), ''); };
    // 1) Hojas mensuales de la persona
    for (const h of quitar) {
      const rels = parseRels(await leerTxt(zip, relsDe(h.ruta)));
      for (const r of rels) {
        const destino = ruta(h.ruta, r.Target);
        if (/drawing/.test(r.Type)) { const dr = relsDe(destino); zip.remove(dr); quitarParte(destino); }
        else if (/printerSettings/.test(r.Type)) quitarParte(destino);
      }
      zip.remove(relsDe(h.ruta)); quitarParte(h.ruta);
      wb = wb.replace(h.tag, '');
      wbRels = wbRels.replace(new RegExp('<Relationship [^>]*Id="' + h.rid + '"[^>]*/>'), '');
    }
    // 2) Vínculos externos y cadena de cálculo
    for (const r of parseRels(wbRels)) {
      if (/externalLink|calcChain/.test(r.Type)) {
        const p = ruta('xl/workbook.xml', r.Target);
        zip.remove(relsDe(p)); quitarParte(p);
        wbRels = wbRels.replace(new RegExp('<Relationship [^>]*Id="' + r.Id + '"[^>]*/>'), '');
      }
    }
    if (!mes.oculta) { const tag2 = mes.tag.replace(/\s*\/>$/, ' state="hidden"/>'); wb = wb.replace(mes.tag, tag2); }
    wb = wb.replace(/<externalReferences>[\s\S]*?<\/externalReferences>/, '').replace(/<mc:AlternateContent[^>]*>\s*<mc:Choice Requires="x15">\s*<x15ac:absPath[\s\S]*?<\/mc:AlternateContent>/, '');
    wb = wb.replace(/<calcPr\b[^>]*\/>/, m => m.includes('fullCalcOnLoad') ? m : m.replace('/>', ' fullCalcOnLoad="1"/>'));
    // nombres definidos: solo se conservan los de hojas que quedan (se regeneran al exportar)
    wb = wb.replace(/<definedNames>[\s\S]*?<\/definedNames>/, '');
    // 3) Resumen: sin datos de la persona ni fórmulas a otros libros
    let rx = await leerTxt(zip, resumen.ruta);
    ['A6', 'B6', 'C6'].forEach(ref => { rx = ponerCelda(rx, ref, cVacia(ref)); });
    rx = rx.replace(/<row r="6"([^>]*)>([\s\S]*?)<\/row>/, (m, a, cuerpo) => '<row r="6"' + a + '>' + cuerpo.replace(/<c r="([A-Z]+)6"[^>]*?(\/>|>[\s\S]*?<\/c>)/g, (c, col) => colNum(col) >= 4 ? '<c r="' + col + '6"' + sAttr(estiloDe(c)) + '/>' : c) + '</row>');
    zip.file(resumen.ruta, rx);
    const relRes = parseRels(await leerTxt(zip, relsDe(resumen.ruta)));
    for (const r of relRes.filter(r => /table/.test(r.Type))) {
      const p = ruta(resumen.ruta, r.Target); let t = await leerTxt(zip, p);
      t = t.replace(/<calculatedColumnFormula>[^<]*(?:\[\d+\]|Mes- Año|Mes-\s*Año)[^<]*<\/calculatedColumnFormula>/g, '');
      zip.file(p, t);
    }
    // 4) Hoja plantilla del mes: sin criterios, resultados ni comentarios
    let mx = await leerTxt(zip, mes.ruta);
    ['D6', 'D7', 'D8', 'D9', 'D10', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11'].forEach(ref => { mx = ponerCelda(mx, ref, cVacia(ref)); });
    mx = ponerCelda(mx, 'D12', cComentarios('D12', ''));
    mx = mx.replace(/(<c r="A1"[^>]*>\s*<f>[^<]*<\/f>)\s*<v>[^<]*<\/v>/, '$1').replace(/(<c r="A1"[^>]*?)\st="str"/, '$1');
    mx = mx.replace(/(<c r="D5"[^>]*>\s*<f[^>]*>[^<]*<\/f>)\s*<v>[^<]*<\/v>/, '$1');
    mx = mx.replace(/\stabSelected="1"/g, '');
    zip.file(mes.ruta, mx);
    // 5) Valores guardados en hojas auxiliares
    for (const h of hs.filter(h => h.oculta && h !== mes && h.ruta)) {
      let s = await leerTxt(zip, h.ruta);
      if (s && /<f[ >]/.test(s)) { s = s.replace(/(<f[^>]*>[^<]*<\/f>)\s*<v>[^<]*<\/v>/g, '$1<v/>'); zip.file(h.ruta, s); }
    }
    // 6) Cadenas compartidas: solo las que siguen en uso
    wb = wb.replace(/firstSheet="\d+"/, 'firstSheet="1"').replace(/activeTab="\d+"/, 'activeTab="1"');
    zip.file('xl/workbook.xml', wb); zip.file('xl/_rels/workbook.xml.rels', wbRels); zip.file('[Content_Types].xml', ct);
    await compactarCadenas(zip);
    // 7) Metadatos: sin datos de autor de la persona
    let core = await leerTxt(zip, 'docProps/core.xml');
    if (core) zip.file('docProps/core.xml', core.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>Plataforma EDD</cp:lastModifiedBy>'));
    await actualizarAppXml(zip);
    const logo = await extraerLogo(zip, mes);
    const out = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
    return { base64: out, logo, hojaMes: mes.nombre };
  };

  async function compactarCadenas(zip) {
    const sstP = 'xl/sharedStrings.xml'; const sst = await leerTxt(zip, sstP); if (!sst) return;
    const items = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => m[0]);
    const hojas = Object.keys(zip.files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    const usados = new Map(); const textos = {};
    for (const p of hojas) {
      textos[p] = await leerTxt(zip, p);
      for (const m of textos[p].matchAll(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g)) { const i = Number(m[1]); if (!usados.has(i)) usados.set(i, null); }
    }
    const orden = [...usados.keys()].sort((a, b) => a - b); orden.forEach((i, k) => usados.set(i, k));
    for (const p of hojas) {
      zip.file(p, textos[p].replace(/(<c\b[^>]*\bt="s"[^>]*>\s*<v>)(\d+)(<\/v>)/g, (m, a, n, b) => a + usados.get(Number(n)) + b));
    }
    const cab = sst.slice(0, sst.indexOf('<sst')); const tagSst = /<sst\b[^>]*>/.exec(sst)[0];
    const nuevo = cab + tagSst.replace(/\scount="\d+"/, ' count="' + orden.length + '"').replace(/\suniqueCount="\d+"/, ' uniqueCount="' + orden.length + '"') + orden.map(i => items[i]).join('') + '</sst>';
    zip.file(sstP, nuevo);
  }
  async function actualizarAppXml(zip, nombresHojas, nombresDef) {
    const p = 'docProps/app.xml'; let app = await leerTxt(zip, p); if (!app) return;
    if (!nombresHojas) nombresHojas = (await hojasLibro(zip)).map(h => h.nombre);
    nombresDef = nombresDef || [];
    const hp = '<HeadingPairs><vt:vector size="' + (nombresDef.length ? 4 : 2) + '" baseType="variant"><vt:variant><vt:lpstr>Hojas de cálculo</vt:lpstr></vt:variant><vt:variant><vt:i4>' + nombresHojas.length + '</vt:i4></vt:variant>' +
      (nombresDef.length ? '<vt:variant><vt:lpstr>Rangos con nombre</vt:lpstr></vt:variant><vt:variant><vt:i4>' + nombresDef.length + '</vt:i4></vt:variant>' : '') + '</vt:vector></HeadingPairs>';
    const tp = '<TitlesOfParts><vt:vector size="' + (nombresHojas.length + nombresDef.length) + '" baseType="lpstr">' + nombresHojas.concat(nombresDef).map(n => '<vt:lpstr>' + escX(n) + '</vt:lpstr>').join('') + '</vt:vector></TitlesOfParts>';
    app = app.replace(/<HeadingPairs>[\s\S]*?<\/HeadingPairs>/, hp).replace(/<TitlesOfParts>[\s\S]*?<\/TitlesOfParts>/, tp);
    zip.file(p, app);
  }
  async function extraerLogo(zip, mes) {
    try {
      const rels = parseRels(await leerTxt(zip, relsDe(mes.ruta)));
      const dr = rels.find(r => /drawing/.test(r.Type)); if (!dr) return null;
      const drP = ruta(mes.ruta, dr.Target);
      const img = parseRels(await leerTxt(zip, relsDe(drP))).find(r => /image/.test(r.Type)); if (!img) return null;
      const imgP = ruta(drP, img.Target); const ext = imgP.split('.').pop().toLowerCase();
      if (!['png', 'jpg', 'jpeg'].includes(ext)) return null;
      return 'data:image/' + (ext === 'png' ? 'png' : 'jpeg') + ';base64,' + await zip.file(imgP).async('base64');
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------ exportación
  // Revisión previa: qué se conserva y qué no del formato original para estos datos.
  X.revisionPrevia = function (hojasDatos, plantillaInfo) {
    const avisos = [];
    const max = Math.max(0, ...hojasDatos.map(h => h.items.length));
    if (max > 5) avisos.push('La plantilla original tiene 5 filas de criterios. Para los meses con ' + max + ' directrices se inserta(n) ' + (max - 5) + ' fila(s) copiando el mismo formato (bordes, letra y semáforo).');
    const fuera = hojasDatos.filter(h => h.confirmado && !(plantillaInfo && (plantillaInfo.mesesResumen || []).includes(E.periodo.corto(h.periodo))));
    if (fuera.length) avisos.push('La hoja Resumen de la plantilla no tiene columna para ' + fuera.map(h => E.periodo.corto(h.periodo)).join(', ') + '; ese resultado no aparecerá en Resumen.');
    return avisos;
  };

  const ALTO_LINEA = 14.4;
  const lineas = (txt, cpl) => String(txt || '').split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / cpl)), 0);

  // Genera el libro de una persona. hojasDatos: [{periodo, items:[{texto, resultado}], final, comentarios, confirmado}]
  X.generarLibro = async function (tplBase64, persona, hojasDatos, previo) {
    const zip = await ZIP().loadAsync(tplBase64, { base64: true });
    const hs = await hojasLibro(zip);
    const resumen = hs.find(h => h.nombre === 'Resumen');
    const mes = hs.find(h => h.oculta && /mes/i.test(h.nombre)) || hs.find(h => h.oculta && h.nombre !== 'Resumen');
    let wb = await leerTxt(zip, 'xl/workbook.xml');
    let wbRels = await leerTxt(zip, 'xl/_rels/workbook.xml.rels');
    let ct = await leerTxt(zip, '[Content_Types].xml');
    const mesXml = await leerTxt(zip, mes.ruta);
    const mesRels = parseRels(await leerTxt(zip, relsDe(mes.ruta)));
    const relDibujo = mesRels.find(r => /drawing/.test(r.Type));
    const dibujoP = relDibujo ? ruta(mes.ruta, relDibujo.Target) : null;
    const dibujoXml = dibujoP ? await leerTxt(zip, dibujoP) : null;
    const dibujoRels = dibujoP ? await leerTxt(zip, relsDe(dibujoP)) : null;
    let maxSheet = Math.max(...Object.keys(zip.files).map(k => (/^xl\/worksheets\/sheet(\d+)\.xml$/.exec(k) || [0, 0])[1]).map(Number));
    let maxDraw = Math.max(0, ...Object.keys(zip.files).map(k => (/^xl\/drawings\/drawing(\d+)\.xml$/.exec(k) || [0, 0])[1]).map(Number));
    let maxRid = Math.max(...parseRels(wbRels).map(r => Number(String(r.Id).replace(/\D/g, '')) || 0));
    let maxSheetId = Math.max(...hs.map(h => Number(h.sheetId) || 0));
    const nuevas = [];
    const ordenadas = hojasDatos.slice().sort((a, b) => a.periodo.localeCompare(b.periodo));
    for (const hd of ordenadas) {
      const n = Math.max(5, hd.items.length); const extra = n - 5;
      const filaRes = 11 + extra, filaCom = 12 + extra;
      let s = mesXml;
      if (extra > 0) s = insertarFilasCriterio(s, extra);
      s = s.replace(/\stabSelected="1"/g, '').replace(/\sxr:uid="\{[^}]*\}"/g, '').replace(/topLeftCell="[A-Z]+\d+"/, 'topLeftCell="B1"');
      s = ponerCelda(s, 'E5', cNum('E5', E.periodo.serialExcel(hd.periodo)));
      s = s.replace(/(<c r="D5"[^>]*>\s*<f[^>]*>[^<]*<\/f>)(\s*<v>[^<]*<\/v>|<v\/>)?/, '$1<v>' + escX(persona.codigo == null ? '' : persona.codigo) + '</v>');
      for (let i = 0; i < n; i++) {
        const fila = 6 + i; const it = hd.items[i];
        s = ponerCelda(s, 'D' + fila, cTexto('D' + fila, it ? it.texto : ''));
        s = ponerCelda(s, 'E' + fila, cTexto('E' + fila, it && it.resultado ? it.resultado : ''));
        const alto = Math.max(15, Math.ceil(lineas(it ? it.texto : '', 38) * ALTO_LINEA * 10) / 10 + 0.4);
        s = s.replace(new RegExp('<row r="' + fila + '"([^>]*)>'), (m, a) => '<row r="' + fila + '"' + a.replace(/\sht="[^"]*"/, '').replace(/\scustomHeight="1"/, '') + ' ht="' + alto + '" customHeight="1">');
      }
      s = ponerCelda(s, 'E' + filaRes, cTexto('E' + filaRes, hd.final || ''));
      s = ponerCelda(s, 'D' + filaCom, cComentarios('D' + filaCom, hd.comentarios || ''));
      const altoCom = Math.max(157.2, (lineas(':\n' + (hd.comentarios || ''), 72) + 1) * ALTO_LINEA);
      s = s.replace(new RegExp('<row r="' + filaCom + '"([^>]*)>'), (m, a) => '<row r="' + filaCom + '"' + a.replace(/\sht="[^"]*"/, '') + ' ht="' + E.r2(altoCom) + '">');
      s = s.replace(/(<c r="A1"[^>]*>\s*<f>)([^<]*)(<\/f>)(<v>[^<]*<\/v>|<v\/>)?/, (m, a, f, b) => a + f + b + '<v>' + escX(hd.final || ' ') + '</v>').replace(/<c r="A1"([^>]*?)(\st="str")?>/, '<c r="A1"$1 t="str">');
      // archivos
      maxSheet++; maxRid++; maxSheetId++;
      const sheetP = 'xl/worksheets/sheet' + maxSheet + '.xml';
      let relsHoja = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
      s = s.replace(/<pageSetup([^>]*?)\sr:id="[^"]*"([^>]*)\/>/, '<pageSetup$1$2/>');
      if (dibujoXml) {
        maxDraw++;
        const dP = 'xl/drawings/drawing' + maxDraw + '.xml';
        zip.file(dP, dibujoXml); zip.file(relsDe(dP), dibujoRels);
        ct = ct.replace('</Types>', '<Override PartName="/' + dP + '" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
        relsHoja += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing' + maxDraw + '.xml"/>';
        s = s.replace(/<drawing r:id="[^"]*"\/>/, '<drawing r:id="rId1"/>');
      } else s = s.replace(/<drawing r:id="[^"]*"\/>/, '');
      relsHoja += '</Relationships>';
      zip.file(sheetP, s); zip.file(relsDe(sheetP), relsHoja);
      ct = ct.replace('</Types>', '<Override PartName="/' + sheetP + '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
      wbRels = wbRels.replace('</Relationships>', '<Relationship Id="rId' + maxRid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + maxSheet + '.xml"/></Relationships>');
      const nombreHoja = E.periodo.hoja(hd.periodo);
      wb = wb.replace('</sheets>', () => '<sheet name="' + escX(nombreHoja) + '" sheetId="' + maxSheetId + '" r:id="rId' + maxRid + '"/></sheets>');
      nuevas.push({ nombre: nombreHoja, filaCom, filaRes, hd });
    }
    // nombres definidos (área de impresión) y pestaña activa
    const todas = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m => unescX(attrs(m[0]).name));
    const defs = [];
    nuevas.forEach(nh => { const i = todas.indexOf(nh.nombre); defs.push({ i, t: "'" + nh.nombre.replace(/'/g, "''") + "'!$D$2:$F$" + nh.filaCom, nom: "'" + nh.nombre + "'!Área_de_impresión" }); });
    const iMes = todas.indexOf(mes.nombre);
    defs.push({ i: iMes, t: "'" + mes.nombre + "'!$D$2:$F$12", nom: "'" + mes.nombre + "'!Área_de_impresión" });
    defs.sort((a, b) => a.i - b.i);
    const dn = '<definedNames>' + defs.map(d => '<definedName name="_xlnm.Print_Area" localSheetId="' + d.i + '">' + escX(d.t) + '</definedName>').join('') + '</definedNames>';
    wb = wb.replace(/<definedNames>[\s\S]*?<\/definedNames>/, '');
    wb = wb.replace('</sheets>', () => '</sheets>' + dn);
    const activa = nuevas.length ? todas.indexOf(nuevas[nuevas.length - 1].nombre) : todas.indexOf('Resumen');
    wb = wb.replace(/activeTab="\d+"/, 'activeTab="' + activa + '"');
    if (!/activeTab=/.test(wb)) wb = wb.replace(/<workbookView\b/, '<workbookView activeTab="' + activa + '"');
    if (nuevas.length) {
      const ult = nuevas[nuevas.length - 1];
      const relU = parseRels(wbRels).find(r => r.Target.endsWith('sheet' + maxSheet + '.xml'));
      if (relU) { const p = 'xl/' + relU.Target; let x = await leerTxt(zip, p); x = x.replace(/<sheetView\b/, '<sheetView tabSelected="1"'); zip.file(p, x); }
      void ult;
    } else {
      let x = await leerTxt(zip, resumen.ruta); x = x.replace(/<sheetView\b(?![^>]*tabSelected)/, '<sheetView tabSelected="1"'); zip.file(resumen.ruta, x);
    }
    // Resumen
    let rx = await leerTxt(zip, resumen.ruta);
    rx = ponerCelda(rx, 'A6', cNum('A6', persona.codigo == null ? '' : persona.codigo));
    if (persona.codigo == null) rx = ponerCelda(rx, 'A6', cVacia('A6'));
    rx = ponerCelda(rx, 'B6', cTexto('B6', persona.nombre));
    rx = ponerCelda(rx, 'C6', cTexto('C6', persona.rol || ''));
    const cabeceras = await mesesResumen(zip, rx);
    Object.entries(previo || {}).forEach(([per, x]) => {
      const col = cabeceras[E.periodo.corto(per)];
      if (col && x && x.resultado && !nuevas.some(nh => nh.hd.periodo === per)) rx = ponerCelda(rx, col + '6', cTexto(col + '6', x.resultado));
    });
    for (const nh of nuevas) {
      if (!nh.hd.confirmado || !nh.hd.final) continue;
      const col = cabeceras[E.periodo.corto(nh.hd.periodo)];
      if (!col) continue;
      rx = ponerCelda(rx, col + '6', cFormulaTexto(col + '6', "'" + nh.nombre + "'!E" + nh.filaRes, nh.hd.final));
    }
    zip.file(resumen.ruta, rx);
    zip.file('xl/workbook.xml', wb); zip.file('xl/_rels/workbook.xml.rels', wbRels); zip.file('[Content_Types].xml', ct);
    await actualizarAppXml(zip, todas, defs.map(d => d.nom));
    let core = await leerTxt(zip, 'docProps/core.xml');
    if (core) zip.file('docProps/core.xml', core.replace(/<dcterms:modified([^>]*)>[^<]*</, '<dcterms:modified$1>' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '<'));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  };
  X.generarLibroNode = async function (tplBase64, persona, hojasDatos) { // para pruebas
    const blob = await X.generarLibro(tplBase64, persona, hojasDatos); return blob;
  };

  // Mapa "oct-26" → columna, leyendo la fila 5 de Resumen
  async function mesesResumen(zip, rx) {
    const sst = await leerTxt(zip, 'xl/sharedStrings.xml');
    const items = sst ? [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unescX(m[1].replace(/<[^>]+>/g, ''))) : [];
    const fila = (/<row r="5"[^>]*>([\s\S]*?)<\/row>/.exec(rx) || [])[1] || '';
    const mapa = {};
    for (const m of fila.matchAll(/<c r="([A-Z]+)5"([^>]*)>(?:<v>([^<]*)<\/v>|<is>[\s\S]*?<\/is>)?<\/c>/g)) {
      const t = /t="s"/.test(m[2]) ? items[Number(m[3])] : m[3];
      if (t && /^[a-z]{3}-\d{2}$/i.test(t.trim())) mapa[t.trim().toLowerCase()] = m[1];
    }
    return mapa;
  }
  X.mesesDePlantilla = async function (tplBase64) {
    const zip = await ZIP().loadAsync(tplBase64, { base64: true });
    const hs = await hojasLibro(zip); const r = hs.find(h => h.nombre === 'Resumen');
    return Object.keys(await mesesResumen(zip, await leerTxt(zip, r.ruta)));
  };

  // Inserta filas de criterio (copiando el estilo de la fila 9) y desplaza resultado y comentarios
  function insertarFilasCriterio(s, extra) {
    const reFila = r => new RegExp('<row r="' + r + '"[^>]*>[\\s\\S]*?<\\/row>');
    const fila9 = reFila(9).exec(s)[0];
    // desplazar filas 11..20 hacia abajo (de abajo hacia arriba)
    for (let r = 20; r >= 11; r--) {
      const m = reFila(r).exec(s); if (!m) continue;
      const nr = r + extra;
      const nueva = m[0].replace('<row r="' + r + '"', '<row r="' + nr + '"').replace(new RegExp('<c r="([A-Z]+)' + r + '"', 'g'), '<c r="$1' + nr + '"');
      s = s.slice(0, m.index) + nueva + s.slice(m.index + m[0].length);
    }
    // la fila 10 conserva su borde inferior: se mueve al final de los criterios, y se insertan copias de la 9
    const m10 = reFila(10).exec(s);
    const ultima = 10 + extra;
    const fila10 = m10[0].replace('<row r="10"', '<row r="' + ultima + '"').replace(/<c r="([A-Z]+)10"/g, '<c r="$1' + ultima + '"');
    let inserto = '';
    for (let k = 0; k < extra; k++) {
      const r = 10 + k;
      inserto += fila9.replace('<row r="9"', '<row r="' + r + '"').replace(/<c r="([A-Z]+)9"/g, '<c r="$1' + r + '"');
    }
    s = s.slice(0, m10.index) + inserto + fila10 + s.slice(m10.index + m10[0].length);
    const desp = ref => ref.replace(/([A-Z]+)(\d+)/g, (m, c, r) => Number(r) >= 10 && Number(r) <= 20 ? c + (Number(r) + extra) : m);
    s = s.replace(/<mergeCell ref="([^"]+)"\/>/g, (m, ref) => '<mergeCell ref="' + desp(ref) + '"/>');
    s = s.replace(/sqref="([^"]+)"/g, (m, ref) => 'sqref="' + desp(ref) + '"');
    s = s.replace(/(SEARCH\("[^"]+",E)(\d+)\)/g, (m, a, r) => a + (Number(r) >= 10 ? Number(r) + extra : r) + ')');
    s = s.replace(/(<c r="A1"[^>]*>\s*<f>IF\(E)(\d+)(=" ",\" \",E)(\d+)\)/, (m, a, r1, b, r2) => a + (Number(r1) + extra) + b + (Number(r2) + extra) + ')');
    s = s.replace(/<dimension ref="[^"]*"\/>/, m => m);
    return s;
  }

  // Consolidado de comisiones en Excel (SheetJS)
  X.consolidado = function (filasDatos, titulo) {
    const ws = XL().utils.aoa_to_sheet(filasDatos);
    ws['!cols'] = filasDatos[0].map((h, i) => ({ wch: i === 1 ? 36 : Math.max(12, String(h).length + 2) }));
    const wb = XL().utils.book_new(); XL().utils.book_append_sheet(wb, ws, (titulo || 'Consolidado').slice(0, 31));
    const out = XL().write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
