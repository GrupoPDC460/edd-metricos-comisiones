/* render.js — dibuja la EDD con la distribución del formato original y la tabla de métricos.
 * La misma imagen se usa como vista previa, para copiar, descargar y compartir por WhatsApp. */
(function (g) {
  'use strict';
  const E = g.EDD;
  const R = E.render = {};
  const NAVY = '#002060', TINTA = '#111111', GRIS = '#6B7686', LINEA = '#9AA3AF';
  const F_HOJA = '"Archivo Narrow", "Arial Narrow", Arial, sans-serif';
  const F_UI = '"Nunito Sans", "Nunito", Arial, sans-serif';
  const ESCALA = 2;
  let logoImg = null, logoSrc = null;

  R.prepararFuentes = async function () {
    if (!document.fonts) return;
    await Promise.all(['bold italic 16px "Archivo Narrow"', 'bold 16px "Archivo Narrow"', '16px "Archivo Narrow"', 'bold 16px "Nunito Sans"', '16px "Nunito Sans"', '800 16px "Nunito"']
      .map(f => document.fonts.load(f).catch(() => null)));
  };
  function logo() {
    const tpl = E.plantilla();
    const src = tpl && tpl.logo;
    if (!src) return Promise.resolve(null);
    if (logoImg && logoSrc === src) return Promise.resolve(logoImg);
    return new Promise(res => { const im = new Image(); im.onload = () => { logoImg = im; logoSrc = src; res(im); }; im.onerror = () => res(null); im.src = src; });
  }
  function lineas(ctx, texto, ancho) {
    const out = [];
    String(texto == null ? '' : texto).split('\n').forEach(par => {
      const palabras = par.split(/\s+/).filter(Boolean);
      if (!palabras.length) { out.push(''); return; }
      let l = '';
      palabras.forEach(w => {
        const t = l ? l + ' ' + w : w;
        if (ctx.measureText(t).width <= ancho || !l) l = t; else { out.push(l); l = w; }
      });
      out.push(l);
    });
    return out;
  }
  function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w * ESCALA; c.height = h * ESCALA; const x = c.getContext('2d'); x.scale(ESCALA, ESCALA); x.textBaseline = 'alphabetic'; return { c, x }; }
  // Dos pasadas: medir y dibujar con la misma función
  function componer(ancho, dibujar) {
    const m = lienzo(ancho, 10); const alto = dibujar(m.x, false);
    const d = lienzo(ancho, Math.ceil(alto)); d.x.fillStyle = '#FFFFFF'; d.x.fillRect(0, 0, ancho, alto); dibujar(d.x, true); return d.c;
  }
  function cabecera(ctx, pintar, y, ancho, info) {
    ctx.font = '800 22px "Nunito", ' + F_UI; ctx.fillStyle = NAVY;
    if (pintar) ctx.fillText(info.nombre || '', 24, y + 26);
    ctx.font = '14px ' + F_UI; ctx.fillStyle = GRIS;
    const sub = [info.codigo ? 'Código ' + info.codigo : null, info.equipo, info.supervisor ? 'Supervisor: ' + info.supervisor : null].filter(Boolean).join('   ·   ');
    if (pintar) ctx.fillText(sub, 24, y + 48);
    ctx.font = 'bold 13px ' + F_UI;
    const tag = info.etiqueta; const tw = ctx.measureText(tag).width + 22;
    if (pintar) {
      ctx.fillStyle = info.final ? NAVY : '#E6ECF5'; roundRect(ctx, ancho - 24 - tw, y + 10, tw, 26, 13); ctx.fill();
      ctx.fillStyle = info.final ? '#FFFFFF' : NAVY; ctx.fillText(tag, ancho - 24 - tw + 11, y + 28);
    }
    return y + 64;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function punteada(ctx, x1, y1, x2, y2) { ctx.save(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.setLineDash([1.5, 2.5]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); }
  function textoCentrado(ctx, ls, cx, y, alto) { ls.forEach((l, i) => ctx.fillText(l, cx - ctx.measureText(l).width / 2, y + alto * (i + 1) - alto * 0.28)); }

  // datos: {nombre, codigo, equipo, supervisor, periodo, items:[{texto, resultado}], final, comentarios, version:'inicial'|'final', estado}
  R.edd = async function (datos) {
    await R.prepararFuentes(); const lg = await logo();
    const ANCHO = 820, X0 = 24, W = ANCHO - 48, COLR = 240, COLL = W - COLR, XR = X0 + COLL;
    const esFinal = datos.version === 'final';
    return componer(ANCHO, (ctx, pintar) => {
      let y = cabecera(ctx, pintar, 8, ANCHO, {
        nombre: datos.nombre, codigo: datos.codigo, equipo: datos.equipo, supervisor: datos.supervisor, final: esFinal,
        etiqueta: (esFinal ? 'Evaluación final' : 'Plan inicial') + ' · ' + E.periodo.nombre(datos.periodo) + (datos.estadoTexto ? ' · ' + datos.estadoTexto : ''),
      });
      const yMarco = y;
      // encabezado: logo + título
      if (pintar && lg) { const h = 48, w = lg.width * h / lg.height; ctx.drawImage(lg, X0 + 14, y + 14, w, h); }
      else if (pintar) { ctx.font = '800 30px "Nunito", ' + F_UI; ctx.fillStyle = NAVY; ctx.fillText('pdc', X0 + 22, y + 52); }
      ctx.font = 'bold 30px ' + F_HOJA; ctx.fillStyle = TINTA;
      if (pintar) ctx.fillText('Plan de trabajo', X0 + 160, y + 50);
      y += 80;
      // mes
      if (pintar) {
        ctx.fillStyle = TINTA; ctx.fillRect(XR, y - 2, COLR, 2);
        ctx.fillStyle = NAVY; ctx.fillRect(XR, y, COLR, 30);
        ctx.font = 'bold 17px ' + F_HOJA; ctx.fillStyle = '#FFFFFF'; const t = E.periodo.corto(datos.periodo); ctx.fillText(t, XR + COLR / 2 - ctx.measureText(t).width / 2, y + 21);
      }
      y += 30;
      const n = Math.max(datos.items.length, 1);
      for (let i = 0; i < n; i++) {
        const it = datos.items[i] || { texto: '' };
        ctx.font = 'bold italic 16px ' + F_HOJA;
        const ls = lineas(ctx, it.texto, COLL - 24);
        const alto = Math.max(32, ls.length * 20 + 12);
        if (pintar) {
          punteada(ctx, X0, y, XR, y);
          const r = esFinal ? it.resultado : null;
          const col = r && E.COLOR[r];
          ctx.fillStyle = col ? col.bg : (esFinal ? '#F2F2F2' : '#FFFFFF'); ctx.fillRect(XR, y, COLR, alto);
          ctx.strokeStyle = '#333'; ctx.setLineDash([1.5, 2.5]); ctx.strokeRect(XR + 0.5, y + 0.5, COLR - 1, alto - 1); ctx.setLineDash([]);
          ctx.fillStyle = TINTA; textoCentrado(ctx, ls, X0 + COLL / 2, y + 6, 20);
          if (esFinal) {
            ctx.font = (r ? '' : 'italic ') + '14px ' + F_HOJA; ctx.fillStyle = col ? col.fg : GRIS;
            const t = r || 'Sin calificar'; ctx.fillText(t, XR + COLR / 2 - ctx.measureText(t).width / 2, y + alto / 2 + 5);
          }
        }
        y += alto;
      }
      // resultado
      const altoRes = 36;
      if (pintar) {
        punteada(ctx, X0, y, XR, y);
        ctx.font = 'bold 18px ' + F_HOJA; ctx.fillStyle = TINTA; const t = 'Resultado Evaluación';
        ctx.fillText(t, XR - 10 - ctx.measureText(t).width, y + 24);
        const r = esFinal ? datos.final : null; const col = r && E.COLOR[r];
        ctx.fillStyle = col ? col.bg : '#FFFFFF'; ctx.fillRect(XR, y + 2, COLR, altoRes - 4);
        ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.strokeRect(XR + 1, y + 3, COLR - 2, altoRes - 6); ctx.lineWidth = 1;
        if (esFinal) { ctx.font = (r ? '' : 'italic ') + '16px ' + F_HOJA; ctx.fillStyle = col ? col.fg : GRIS; const tt = r || 'Pendiente'; ctx.fillText(tt, XR + COLR / 2 - ctx.measureText(tt).width / 2, y + 24); }
      }
      y += altoRes;
      if (pintar) { ctx.fillStyle = TINTA; ctx.fillRect(X0, y, W, 2); }
      y += 4;
      ctx.font = '15px ' + F_HOJA;
      const com = esFinal ? (datos.comentarios || '') : '';
      const lsC = lineas(ctx, com, W - 20);
      const altoCom = Math.max(130, 30 + lsC.length * 19 + 12);
      if (pintar) {
        ctx.font = 'bold 15px ' + F_HOJA; ctx.fillStyle = TINTA; ctx.fillText('Comentarios', X0 + 8, y + 20);
        const w = ctx.measureText('Comentarios').width; ctx.font = '15px ' + F_HOJA; ctx.fillText(':', X0 + 8 + w, y + 20);
        lsC.forEach((l, i) => ctx.fillText(l, X0 + 8, y + 40 + i * 19));
      }
      y += altoCom;
      if (pintar) { ctx.strokeStyle = TINTA; ctx.lineWidth = 2.5; ctx.strokeRect(X0, yMarco, W, y - yMarco); ctx.lineWidth = 1; }
      y += 14;
      if (pintar) { ctx.font = '12px ' + F_UI; ctx.fillStyle = GRIS; ctx.fillText(esFinal ? (datos.pie || '') : 'Resultados en blanco: plan del inicio del mes, todavía sin evaluar.', X0, y + 4); }
      return y + 16;
    });
  };

  // datos: {nombre, codigo, equipo, supervisor, periodo, version, base, items:[{nombre, meta, peso, resultado, cumplimiento, pago}], calculado, minimo, elegible, garantiaAplicada, final}
  R.metricos = async function (datos) {
    await R.prepararFuentes();
    const esFinal = datos.version === 'final';
    const ANCHO = esFinal ? 920 : 820, X0 = 24, W = ANCHO - 48;
    const cols = esFinal
      ? [{ k: 'nombre', t: 'Métrico / entregable', w: 0 }, { k: 'meta', t: 'Meta', w: 130 }, { k: 'peso', t: 'Peso', w: 62, n: 1 }, { k: 'resultado', t: 'Resultado', w: 110 }, { k: 'cumplimiento', t: 'Cumpl.', w: 72, n: 1 }, { k: 'pago', t: 'Pago', w: 104, n: 1 }]
      : [{ k: 'nombre', t: 'Métrico / entregable', w: 0 }, { k: 'meta', t: 'Meta', w: 170 }, { k: 'peso', t: 'Peso', w: 70, n: 1 }, { k: 'monto', t: 'Monto al 100%', w: 120, n: 1 }];
    const fijo = cols.reduce((s, c) => s + c.w, 0); cols[0].w = W - fijo;
    const val = (it, c) => c.k === 'peso' ? E.pct(it.peso) : c.k === 'cumplimiento' ? E.pct(it.cumplimiento) : c.k === 'pago' ? E.q(it.pago) : c.k === 'monto' ? E.q(E.calc.pago(datos.base, it.peso, 100)) : (it[c.k] || '');
    return componer(ANCHO, (ctx, pintar) => {
      let y = datos.sinCabecera ? 8 : cabecera(ctx, pintar, 8, ANCHO, {
        nombre: datos.nombre, codigo: datos.codigo, equipo: datos.equipo, supervisor: datos.supervisor, final: esFinal,
        etiqueta: (esFinal ? 'Métricos · resultado' : 'Métricos · plan inicial') + ' · ' + E.periodo.nombre(datos.periodo) + (datos.estadoTexto ? ' · ' + datos.estadoTexto : ''),
      });
      // encabezado de tabla
      if (pintar) { ctx.fillStyle = NAVY; ctx.fillRect(X0, y, W, 32); }
      let x = X0; ctx.font = 'bold 14px ' + F_HOJA;
      cols.forEach(c => { if (pintar) { ctx.fillStyle = '#FFFFFF'; const tx = c.n ? x + c.w - 8 - ctx.measureText(c.t).width : x + 8; ctx.fillText(c.t, tx, y + 21); } x += c.w; });
      y += 32;
      datos.items.forEach((it, i) => {
        ctx.font = '15px ' + F_HOJA;
        const celdas = cols.map(c => lineas(ctx, val(it, c), c.w - 16));
        const alto = Math.max(30, Math.max(...celdas.map(l => l.length)) * 19 + 12);
        if (pintar) {
          ctx.fillStyle = i % 2 ? '#F3F6FB' : '#FFFFFF'; ctx.fillRect(X0, y, W, alto);
          let xx = X0;
          cols.forEach((c, k) => {
            if (c.k === 'cumplimiento' && it.cumplimiento != null) { ctx.fillStyle = it.cumplimiento >= 100 ? '#DCEFCB' : it.cumplimiento > 0 ? '#FFF3C4' : '#F9D2D2'; ctx.fillRect(xx, y, c.w, alto); }
            ctx.fillStyle = TINTA; ctx.font = (c.k === 'pago' ? 'bold ' : '') + '15px ' + F_HOJA;
            celdas[k].forEach((l, j) => { const tx = c.n ? xx + c.w - 8 - ctx.measureText(l).width : xx + 8; ctx.fillText(l, tx, y + 20 + j * 19); });
            xx += c.w;
          });
          ctx.strokeStyle = '#C9D1DC'; ctx.beginPath(); ctx.moveTo(X0, y + alto); ctx.lineTo(X0 + W, y + alto); ctx.stroke();
        }
        y += alto;
      });
      if (pintar) { ctx.strokeStyle = NAVY; ctx.lineWidth = 1.5; ctx.strokeRect(X0, y - (datos.items.length ? 0 : 0), W, 0.01); ctx.lineWidth = 1; }
      y += 14;
      const filas = [['Base de comisión (100 %)', E.q(datos.base), false]];
      if (esFinal) {
        filas.push(['Pago calculado por métricos', E.q(datos.calculado), false]);
        if (datos.elegible) { filas.push(['Mínimo garantizado (' + datos.garantiaPct + ' % de la base)', E.q(datos.minimo), false]); filas.push(['Garantía aplicada', E.q(datos.garantiaAplicada), false]); }
        filas.push(['Total a pagar', E.q(datos.final), true]);
      } else filas.push(['Pago posible con 100 % de cumplimiento', E.q(datos.base), true]);
      const AN = 360, XB = X0 + W - AN;
      filas.forEach(([t, v, b]) => {
        if (b) y += 8;
        if (pintar) {
          ctx.font = (b ? 'bold 17px ' : '15px ') + F_HOJA; ctx.fillStyle = b ? NAVY : TINTA;
          ctx.fillText(t, XB, y + 18); ctx.fillText(v, X0 + W - ctx.measureText(v).width, y + 18);
          if (b) { ctx.fillStyle = NAVY; ctx.fillRect(XB, y - 2, AN, 1.5); }
        }
        y += b ? 30 : 24;
      });
      y += 6;
      if (pintar) { ctx.font = '12px ' + F_UI; ctx.fillStyle = GRIS; ctx.fillText('Pago de cada métrico = base de comisión × ponderación × % de cumplimiento.' + (esFinal && datos.elegible ? ' Garantía de ingreso: se paga el mayor entre el cálculo y el mínimo.' : ''), X0, y + 4); }
      return y + 18;
    });
  };

  R.unir = function (canvases) {
    const w = Math.max(...canvases.map(c => c.width)); const h = canvases.reduce((s, c) => s + c.height, 0) + (canvases.length - 1) * 20 * ESCALA;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h);
    let y = 0; canvases.forEach(cv => { x.drawImage(cv, 0, y); y += cv.height + 20 * ESCALA; });
    return c;
  };
  R.blob = c => new Promise(res => c.toBlob(res, 'image/png'));
  R.copiar = async function (c) {
    if (!navigator.clipboard || !g.ClipboardItem) throw new Error('Tu navegador no permite copiar imágenes; usa Descargar.');
    await navigator.clipboard.write([new g.ClipboardItem({ 'image/png': R.blob(c) })]);
  };

  // Construye los datos para las imágenes desde los registros
  R.datosEdd = function (per, p, version, recTrabajo) {
    const ev = recTrabajo || E.evaluacion(per, p.id); const snap = ev ? ev.d.snapshot || E.snapshot(p) : E.snapshot(p);
    const inicial = version === 'inicial';
    const items = !ev ? [] : (inicial ? (ev.d.plan_inicial ? ev.d.plan_inicial.items.map(t => ({ texto: t })) : ev.d.items.map(i => ({ texto: i.texto }))) : ev.d.items);
    const est = E.calc.estadoEdd(ev);
    return {
      nombre: p.d.nombre, codigo: p.d.codigo, equipo: snap.equipo, supervisor: snap.supervisor, periodo: per, version, items,
      final: ev && ev.d.resultado_final, comentarios: ev && ev.d.comentarios,
      estadoTexto: inicial ? (ev && ev.d.plan_inicial ? '' : 'borrador') : (est.k === 'cerrado' ? '' : 'sin autorizar'),
      pie: ev && ev.d.cierre ? 'Autorizado por ' + (ev.d.autorizado_por || '') + ' el ' + E.fecha(ev.d.cierre.fecha) + '.' : 'Evaluación aún no autorizada.',
    };
  };
  R.datosMet = function (per, p, version, recTrabajo) {
    const mt = recTrabajo || E.metricos(per, p.id); const cfg = E.conf();
    const r = E.calc.metricos(mt, p, cfg); const snap = mt ? mt.d.snapshot || E.snapshot(p) : E.snapshot(p);
    const inicial = version === 'inicial';
    const items = inicial && mt && mt.d.plan_inicial ? mt.d.plan_inicial.items : r.items;
    return {
      nombre: p.d.nombre, codigo: p.d.codigo, equipo: snap.equipo, supervisor: snap.supervisor, periodo: per, version, base: r.base, items,
      calculado: r.calculado, minimo: r.minimo, elegible: r.elegible, garantiaAplicada: r.garantiaAplicada, final: r.final, garantiaPct: cfg.garantia_pct,
      estadoTexto: inicial ? (mt && mt.d.plan_inicial ? '' : 'borrador') : (mt && mt.d.cierre ? '' : 'sin cerrar'),
    };
  };
})(window);
