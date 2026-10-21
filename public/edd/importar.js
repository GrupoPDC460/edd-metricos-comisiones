/* importar.js — interpreta Formato EDD + archivos de métricos + plantilla, detecta dudas
 * y solo escribe en la base cuando el usuario confirma. */
(function (g) {
  'use strict';
  const E = g.EDD;
  const I = E.importar = {};

  // Estructura indicada por la gerencia. Es solo una propuesta inicial: se edita en la importación y en Padrón.
  I.ESTRUCTURA = [
    { id: 'eq-chevere', nombre: 'Team Chévere', supervisorBuscado: 'Michael Monge', comisiona: true, orden: 1 },
    { id: 'eq-imparables', nombre: 'Team Imparables', supervisorBuscado: 'Oliver Santos', comisiona: true, orden: 2 },
    { id: 'eq-jocelyn-santos', nombre: 'Equipo Jocelyn Santos', supervisorBuscado: 'Jocelyn Santos', comisiona: false, orden: 3 },
    { id: 'eq-gerardo-velasquez', nombre: 'Equipo Gerardo Velásquez', supervisorBuscado: 'Gerardo Velásquez', comisiona: false, orden: 4 },
  ];

  const tokens = s => E.norm(s).split(' ').filter(t => t.length > 1 && !['de', 'la', 'del', 'los', 'las'].includes(t));
  const contiene = (grande, chico) => { const g2 = tokens(grande); return tokens(chico).every(t => g2.includes(t)); };
  function lev(a, b) {
    const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // Candidatos de persona para un nombre de supervisor (exacto = todos los tokens presentes)
  function candidatos(nombre, personas) {
    const tk = tokens(nombre);
    return personas.map(p => {
      const pt = tokens(p.nombre);
      const exactos = tk.filter(t => pt.includes(t)).length;
      const parecidos = tk.filter(t => !pt.includes(t) && pt.some(x => x.length > 3 && lev(t, x) <= 2)).length;
      return { codigo: p.codigo, nombre: p.nombre, exacto: exactos === tk.length, puntaje: exactos * 2 + parecidos };
    }).filter(c => c.exacto || c.puntaje >= 2).sort((a, b) => b.puntaje - a.puntaje).slice(0, 4);
  }

  I.analizar = async function (leidos, opciones) {
    const cfg = E.conf();
    const periodo = (opciones && opciones.periodo) || cfg.periodo_inicial;
    const padF = leidos.filter(a => a.tipo === 'padron');
    const metF = leidos.filter(a => a.tipo === 'metricos');
    const tplF = leidos.filter(a => a.tipo === 'plantilla');
    if (padF.length !== 1) throw new Error(padF.length ? 'Sube un solo archivo de padrón (Formato EDD).' : 'Falta el archivo Formato EDD (padrón con la columna "Código de Colaborador").');
    const pad = E.excel.parsePadron(padF[0]);
    const mets = metF.map(E.excel.parseMetricos);
    const dudas = [];
    const aviso = (area, titulo, detalle, personas) => dudas.push({ id: 'a' + dudas.length, tipo: 'aviso', area, titulo, detalle, personas: personas || [] });
    const decision = (id, area, titulo, detalle, opciones, valor) => { const d = { id, tipo: 'decision', area, titulo, detalle, opciones, valor: valor == null ? null : valor }; dudas.push(d); return d; };

    // ---------------- plantilla
    let plantilla = null;
    if (tplF.length) {
      const an = await E.excel.analizarPlantilla(tplF[0]);
      const limpia = await E.excel.limpiarPlantilla(tplF[0].buf);
      const meses = await E.excel.mesesDePlantilla(limpia.base64);
      plantilla = { archivo: tplF[0].nombre, analisis: an, base64: limpia.base64, logo: limpia.logo, hojaMes: limpia.hojaMes, mesesResumen: meses };
      const per = pad.personas.find(p => p.codigo === Number(an.resumen.codigo));
      if (per && an.resumen.nombreGuardado && E.norm(an.resumen.nombreGuardado) !== E.norm(per.nombre))
        aviso('Plantilla', 'La hoja Resumen de la plantilla muestra otro nombre para el código ' + an.resumen.codigo,
          'Guardado: "' + an.resumen.nombreGuardado + '". En el padrón ese código es "' + per.nombre + '". El nombre venía de una fórmula a otro libro; en las exportaciones se escribe el nombre del padrón.');
      an.mensuales.forEach(m => {
        if (m.fechaE5) {
          const esperado = E.periodo.hoja(m.fechaE5.slice(0, 7));
          if (E.norm(esperado) !== E.norm(m.nombre)) aviso('Plantilla', 'La hoja "' + m.nombre + '" tiene la fecha ' + E.periodo.corto(m.fechaE5.slice(0, 7)), 'El nombre de la hoja no coincide con el mes de la celda E5. Esa hoja no se importa.');
        }
      });
      const evaluadas = an.mensuales.filter(m => m.final || m.resultados);
      if (evaluadas.length) aviso('Plantilla', 'La plantilla trae resultados de ' + evaluadas.map(m => m.nombre).join(', '), 'Son datos de una sola persona y de meses anteriores al inicio del sistema (' + E.periodo.nombre(cfg.periodo_inicial) + '). No se importan como historial; las hojas se quitan de la plantilla maestra.');
      if (an.tieneVinculoExterno) aviso('Plantilla', 'La plantilla tenía vínculos a "Formato EDD.xlsx"', 'Se quitan: el libro exportado lleva los datos escritos y no pedirá actualizar vínculos.');
    } else aviso('Plantilla', 'No subiste la plantilla EDD individual', 'Sin la plantilla no se puede exportar el Excel con el formato original. Puedes subirla después en Configuración.');

    // ---------------- personas
    const existentes = new Map(E.personas().filter(p => p.d.codigo != null).map(p => [Number(p.d.codigo), p]));
    const personas = pad.personas.map(p => ({
      codigo: p.codigo, id: 'p-' + p.codigo, nombre: p.nombre, rol: p.puesto, fila: p.fila,
      activo: /^activ/i.test(p.estado) ? true : (p.estado ? false : true), estadoArchivo: p.estado || '(vacío)',
      fecha_ingreso: p.ingreso, fecha_previa: p.ingresoPrevio, telefono: p.telefono, agente: p.agente,
      es_supervisor: p.equipoCargo, supervisorArchivo: p.supervisorArchivo, lider: p.lider,
      equipo_id: '', equipoFuente: '', base: null, baseArchivo: null, edd: p.edd.slice(), met: [], mtrTextos: p.mtr.filter(Boolean),
      existe: existentes.has(p.codigo), notas: [],
    }));
    const porCodigo = new Map(personas.map(p => [p.codigo, p]));

    // ---------------- equipos y supervisores
    const equiposDb = E.equipos();
    const equipos = (equiposDb.length ? equiposDb.map(e => ({ id: e.id, nombre: e.d.nombre, supervisorBuscado: E.nombrePersona(e.d.supervisor_id), supervisor_codigo: (E.persona(e.d.supervisor_id) || { d: {} }).d.codigo || null, comisiona: !!e.d.comisiona, orden: e.d.orden, existe: true }))
      : I.ESTRUCTURA.map(e => Object.assign({}, e, { supervisor_codigo: null, existe: false })));
    equipos.forEach(eq => {
      if (eq.existe) return;
      eq.candidatos = candidatos(eq.supervisorBuscado, pad.personas);
      const exactos = eq.candidatos.filter(c => c.exacto);
      if (exactos.length === 1) { eq.supervisor_codigo = exactos[0].codigo; eq.coincidencia = 'Coincide con "' + exactos[0].nombre + '"'; }
      else {
        const d = decision('sup:' + eq.id, 'Equipos', '¿Quién es "' + eq.supervisorBuscado + '" en el padrón?',
          'No hay una persona con ese nombre exacto en el Formato EDD. ' + (eq.candidatos.length ? 'Coincidencias parciales: ' + eq.candidatos.map(c => c.nombre + ' (' + c.codigo + ')').join(', ') + '.' : 'No hay coincidencias.'),
          eq.candidatos.map(c => ({ valor: String(c.codigo), etiqueta: c.nombre + ' (' + c.codigo + ')' })).concat([{ valor: 'pendiente', etiqueta: 'Dejar el equipo sin supervisor por ahora' }]));
        d.equipo = eq.id;
      }
    });
    const supervisorDeEquipo = eq => eq.supervisor_codigo ? porCodigo.get(Number(eq.supervisor_codigo)) : null;
    const equipoPorSupervisorTexto = txt => {
      if (!txt) return null;
      return equipos.find(eq => { const s = supervisorDeEquipo(eq); return s && contiene(s.nombre, txt); }) || null;
    };
    const equipoPorArchivo = nombreArchivo => equipos.find(eq => contiene(nombreArchivo, eq.nombre) || contiene(eq.nombre, nombreArchivo)) || null;
    mets.forEach(m => { m.equipo = equipoPorArchivo(m.equipoArchivo); });
    equipos.forEach(eq => { const s = supervisorDeEquipo(eq); if (s) s.es_supervisor = true; });

    // Pertenencia a archivos de métricos
    const enArchivos = new Map();
    mets.forEach(m => m.resumen.forEach(r => { const l = enArchivos.get(r.codigo) || []; l.push({ m, r }); enArchivos.set(r.codigo, l); }));

    personas.forEach(p => {
      const porSup = equipoPorSupervisorTexto(p.supervisorArchivo);
      const arch = enArchivos.get(p.codigo) || [];
      if (porSup) { p.equipo_id = porSup.id; p.equipoFuente = 'Columna "Supervisor" (' + p.supervisorArchivo + ')'; }
      else if (arch.length === 1 && arch[0].m.equipo) { p.equipo_id = arch[0].m.equipo.id; p.equipoFuente = 'Solo aparece en ' + arch[0].m.archivo; }
      if (porSup && arch.some(a => a.m.equipo && a.m.equipo.id !== porSup.id))
        aviso('Equipos', p.nombre + ' aparece en métricos de otro equipo', 'Por la columna Supervisor pertenece a ' + porSup.nombre + ', pero también aparece en ' + arch.filter(a => a.m.equipo && a.m.equipo.id !== porSup.id).map(a => a.m.archivo).join(', ') + '.', [p.codigo]);
      if (!porSup && arch.length > 1) {
        const d = decision('equipo:' + p.codigo, 'Equipos', p.nombre + ' aparece en ' + arch.length + ' archivos de métricos',
          'No tiene supervisor en el Formato EDD y figura en ' + arch.map(a => a.m.archivo).join(' y ') + '. Elige a qué equipo pertenece.',
          arch.filter(a => a.m.equipo).map(a => ({ valor: a.m.equipo.id, etiqueta: a.m.equipo.nombre })).concat([{ valor: '', etiqueta: 'Sin asignar por ahora' }]));
        d.codigo = p.codigo;
      }
    });
    const sinEquipo = personas.filter(p => !p.equipo_id && !p.es_supervisor && !equipos.some(eq => Number(eq.supervisor_codigo) === p.codigo));
    if (sinEquipo.length) aviso('Equipos', sinEquipo.length + ' persona(s) sin supervisor en el Formato EDD', 'Quedan "Sin asignar"; puedes asignarles equipo en la tabla de personas o después en Padrón. Se muestra su líder del archivo como referencia.', sinEquipo.map(p => p.codigo));
    personas.filter(p => !p.equipo_id && p.equipoFuente === '' && enArchivos.has(p.codigo) && enArchivos.get(p.codigo).length === 1).forEach(() => { });
    personas.filter(p => /^Solo aparece/.test(p.equipoFuente)).forEach(p => aviso('Equipos', p.nombre + ': equipo tomado del archivo de métricos', 'No tiene supervisor en el Formato EDD; se propone ' + (equipos.find(e => e.id === p.equipo_id) || {}).nombre + ' porque ' + p.equipoFuente.toLowerCase() + '. Confírmalo en la tabla.', [p.codigo]));

    // ---------------- bases de comisión
    const apodoPorNumero = new Map(pad.apodos.map(a => [a.numero, a.apodo]));
    personas.forEach(p => {
      const arch = enArchivos.get(p.codigo) || [];
      const bases = [...new Set(arch.map(a => a.r.base).filter(b => b != null))];
      if (!bases.length) return;
      p.baseArchivo = bases[0];
      if (bases.length > 1) {
        const d = decision('base:' + p.codigo, 'Comisión', p.nombre + ': bases distintas en los archivos', 'Los archivos indican ' + bases.map(E.q).join(' y ') + '.',
          bases.map(b => ({ valor: String(b), etiqueta: 'Usar ' + E.q(b) })).concat([{ valor: 'default', etiqueta: 'Usar la base predeterminada ' + E.q(cfg.base_default) }]));
        d.codigo = p.codigo;
      } else if (Math.abs(bases[0] - cfg.base_default) > 0.001) {
        const apodo = apodoPorNumero.get(E.telefonoDigitos(p.telefono).slice(-8));
        const d = decision('base:' + p.codigo, 'Comisión', p.nombre + (apodo ? ' ("' + apodo + '")' : '') + ': base de ' + E.q(bases[0]) + ' en el archivo',
          'La base predeterminada es ' + E.q(cfg.base_default) + '. ' + arch.map(a => a.m.archivo + ', columna Total').join('; ') + ' indica ' + E.q(bases[0]) + '.' + (apodo ? ' Identificada como "' + apodo + '" en la hoja ' + pad.apodos.find(a => a.apodo === apodo).hoja + ' por su número.' : ''),
          [{ valor: String(bases[0]), etiqueta: 'Usar ' + E.q(bases[0]) + ' (archivo)' }, { valor: 'default', etiqueta: 'Usar la base predeterminada ' + E.q(cfg.base_default) }]);
        d.codigo = p.codigo;
      }
      arch.forEach(a => { if (a.r.garantizado != null) p.notas.push('Garantizado ' + Math.round(a.r.garantizado * 100) + '% en ' + a.m.archivo); });
    });

    // ---------------- métricos por persona (texto del Formato + ponderación del archivo)
    const pesosPorEquipo = {};
    personas.forEach(p => {
      const arch = (enArchivos.get(p.codigo) || []);
      const hoja = arch.map(a => a.m.hojas.find(h => h.codigo === p.codigo)).find(Boolean);
      const textos = (pad.personas.find(x => x.codigo === p.codigo) || { mtr: [] }).mtr;
      if (!hoja) {
        if (p.mtrTextos.length) aviso('Métricos', p.nombre + ': tiene métricos en el Formato pero no aparece en un archivo de métricos', 'Sin ponderaciones no se pueden crear sus métricos; agrégalos en su ficha.', [p.codigo]);
        return;
      }
      hoja.items.forEach((it, k) => {
        if (!it.peso) return;
        const nombre = textos[k] || it.entregable;
        if (!nombre) return;
        p.met.push({ nombre, peso: it.peso });
      });
      if (hoja.formulasRaras.length) aviso('Métricos', p.nombre + ': fórmula distinta en su hoja de métricos', hoja.formulasRaras.join(' · ') + '. No se aplica; la regla del sistema es base × ponderación × cumplimiento.', [p.codigo]);
      if (!p.met.length) aviso('Métricos', p.nombre + ': aparece en ' + arch.map(a => a.m.archivo).join(', ') + ' pero sin descripción de métricos', 'El Formato EDD no tiene textos MTR para esta persona. Defínelos en su ficha.', [p.codigo]);
      const suma = E.calc.sumaPesos(p.met);
      if (p.met.length && Math.abs(suma - 100) > 0.001) { aviso('Métricos', p.nombre + ': las ponderaciones suman ' + suma + '%', 'No se importan sus métricos; corrígelos en su ficha.', [p.codigo]); p.met = []; }
      if (p.met.length && arch[0].m.equipo) { const k = arch[0].m.equipo.nombre; (pesosPorEquipo[k] = pesosPorEquipo[k] || new Set()).add(p.met.map(m => m.peso).join('/')); }
    });
    const resumenPesos = Object.entries(pesosPorEquipo).map(([k, v]) => k + ': ' + [...v].join(', ')).join(' · ');
    if (Object.keys(pesosPorEquipo).length > 1) aviso('Métricos', 'Las ponderaciones cambian por equipo', resumenPesos + '. Encabezados del Formato EDD: ' + pad.encabezadosMtr.join(', ') + '. Se usan las ponderaciones de cada archivo de métricos por persona.');
    mets.forEach(m => {
      if (m.columnasNoImportadas.length) aviso('Métricos', m.archivo + ': columnas que no se importan', m.columnasNoImportadas.join(', ') + '. Tienen valores de otro mes o cálculos del archivo; el sistema no inventa resultados de meses anteriores.');
      if (!m.equipo) aviso('Métricos', m.archivo + ': no se reconoce el equipo', 'El nombre del archivo no coincide con ningún equipo. Sus ponderaciones se usan igual por código de persona.');
    });
    equipos.filter(eq => eq.comisiona).forEach(eq => {
      const sinMet = personas.filter(p => p.equipo_id === eq.id && !p.met.length && p.activo);
      if (sinMet.length) aviso('Métricos', eq.nombre + ': ' + sinMet.length + ' persona(s) sin métricos', 'El equipo recibe comisión, pero no hay métricos con ponderación para: ' + sinMet.map(p => p.nombre).join(', ') + '.', sinMet.map(p => p.codigo));
    });

    // ---------------- fechas de ingreso
    personas.forEach(p => {
      if (p.fecha_ingreso) return;
      if (p.fecha_previa) {
        const d = decision('fecha:' + p.codigo, 'Garantía', p.nombre + ': sin fecha de ingreso', 'La columna "Fecha de ingreso" está vacía; "Fecha de ingreso previo" dice ' + E.fechaCorta(p.fecha_previa) + '. La fecha define los meses con garantía mínima.',
          [{ valor: 'previa', etiqueta: 'Usar ' + E.fechaCorta(p.fecha_previa) + ' como fecha de ingreso' }, { valor: 'vacia', etiqueta: 'Dejar sin fecha (se pedirá antes del cierre)' }]);
        d.codigo = p.codigo;
      } else if (p.equipo_id && (equipos.find(e => e.id === p.equipo_id) || {}).comisiona) aviso('Garantía', p.nombre + ': sin fecha de ingreso', 'No se puede saber si está en sus dos primeros meses. Complétala en Padrón.', [p.codigo]);
    });

    // ---------------- teléfonos
    const porTel = {};
    personas.forEach(p => { if (p.telefono) (porTel[p.telefono] = porTel[p.telefono] || []).push(p); });
    Object.entries(porTel).filter(([, l]) => l.length > 1).forEach(([t, l]) => aviso('WhatsApp', 'El número ' + t + ' está repetido', 'Lo tienen ' + l.map(p => p.nombre).join(' y ') + '. Corrige el que no corresponda en la tabla o en Padrón.', l.map(p => p.codigo)));
    const sinTel = personas.filter(p => !p.telefono && p.activo);
    if (sinTel.length) aviso('WhatsApp', sinTel.length + ' persona(s) sin teléfono corporativo', sinTel.map(p => p.nombre).join(', ') + '. El número personal del archivo no se importa.', sinTel.map(p => p.codigo));
    personas.filter(p => p.existe).length && aviso('Padrón', 'Personas que ya existen en el sistema', personas.filter(p => p.existe).map(p => p.nombre).join(', ') + '. No se modifican; solo se agregan las nuevas.', personas.filter(p => p.existe).map(p => p.codigo));
    const sinEstado = personas.filter(p => p.estadoArchivo === '(vacío)');
    decision('activos', 'Padrón', 'Confirma quién sigue activo',
      'El archivo no tiene fecha de corte. ' + personas.filter(p => /^activ/i.test(p.estadoArchivo)).length + ' de ' + personas.length + ' figuran "Activo"' + (sinEstado.length ? '; sin dato de estado: ' + sinEstado.map(p => p.nombre).join(', ') : '') + '. Revisa la columna "Activo" de la tabla y confirma.',
      [{ valor: 'si', etiqueta: 'Revisé la lista y está correcta' }]);

    personas.forEach(p => { p.supervisorEsperado = equipos.some(eq => Number(eq.supervisor_codigo) === p.codigo); });
    return { periodo, archivos: leidos.map(a => ({ nombre: a.nombre, tipo: a.tipo })), padron: pad, metricos: mets, plantilla, equipos, personas, dudas, publicarInicial: true };
  };

  // Aplica las decisiones elegidas sobre la propuesta (se llama al cambiar una opción)
  I.aplicarDecision = function (prop, d) {
    if (d.id.startsWith('sup:')) { const eq = prop.equipos.find(e => e.id === d.equipo); eq.supervisor_codigo = d.valor && d.valor !== 'pendiente' ? Number(d.valor) : null; }
    if (d.id.startsWith('equipo:')) { const p = prop.personas.find(x => x.codigo === d.codigo); p.equipo_id = d.valor || ''; p.equipoFuente = d.valor ? 'Decisión en la importación' : ''; }
    if (d.id.startsWith('base:')) { const p = prop.personas.find(x => x.codigo === d.codigo); p.base = d.valor && d.valor !== 'default' ? Number(d.valor) : null; }
    if (d.id.startsWith('fecha:')) { const p = prop.personas.find(x => x.codigo === d.codigo); p.fecha_ingreso = d.valor === 'previa' ? p.fecha_previa : null; }
  };
  I.pendientes = prop => prop.dudas.filter(d => d.tipo === 'decision' && (d.valor == null || d.valor === ''));

  // Detecta el plan común de un equipo: textos presentes en al menos 60 % de sus integrantes
  function comunes(listas, clave) {
    const n = listas.length; if (n < 2) return [];
    const cuenta = new Map(); const orden = [];
    listas.forEach(l => new Set(l.map(clave)).forEach(k => { if (!cuenta.has(k)) { cuenta.set(k, 0); orden.push(k); } cuenta.set(k, cuenta.get(k) + 1); }));
    return orden.filter(k => cuenta.get(k) >= Math.ceil(n * 0.6));
  }

  I.construirRegistros = function (prop) {
    const per = prop.periodo; const ahora = E.hoyISO(); const quien = E.api.usuario;
    const nuevas = prop.personas.filter(p => !p.existe);
    const idDe = cod => (E.db.personas.get('p-' + cod) || prop.personas.find(p => p.codigo === Number(cod))) ? 'p-' + cod : null;
    const equipos = prop.equipos.filter(e => !e.existe).map(e => ({ id: e.id, d: { nombre: e.nombre, supervisor_id: e.supervisor_codigo ? idDe(e.supervisor_codigo) : null, comisiona: !!e.comisiona, activo: true, orden: e.orden || 9 } }));
    const supervisores = new Set(prop.equipos.map(e => e.supervisor_codigo).filter(Boolean).map(Number));
    const personas = nuevas.map(p => ({
      id: p.id, d: {
        codigo: p.codigo, nombre: p.nombre, rol: p.rol || '', es_supervisor: !!(p.es_supervisor || supervisores.has(p.codigo)),
        equipo_id: p.equipo_id || null, supervisor_id: null, activo: !!p.activo, fecha_ingreso: p.fecha_ingreso || null,
        telefono_wa: p.telefono || '', agente: p.agente || '', base_comision: p.base == null ? null : p.base, notas: p.notas.join('. '),
        origen: { archivo: prop.archivos.find(a => a.tipo === 'padron').nombre, fila: p.fila, fecha: ahora },
      }
    }));
    const planes = [], evals = [], mets = [];
    const eqIds = [...new Set(prop.personas.map(p => p.equipo_id).filter(Boolean))];
    const conPlan = prop.personas.filter(p => p.activo && !(E.evaluacion(per, p.id)));
    const planComun = {};
    eqIds.forEach(eq => {
      const miembros = conPlan.filter(p => p.equipo_id === eq);
      const eddC = comunes(miembros.filter(p => p.edd.length).map(p => p.edd), t => E.norm(t));
      const metC = comunes(miembros.filter(p => p.met.length).map(p => p.met), m => E.norm(m.nombre) + '|' + m.peso);
      const eddItems = eddC.map(k => ({ id: 'e' + E.uid(), texto: miembros.flatMap(p => p.edd).find(t => E.norm(t) === k) }));
      let metItems = metC.map(k => { const m = miembros.flatMap(p => p.met).find(x => E.norm(x.nombre) + '|' + x.peso === k); return { id: 'm' + E.uid(), nombre: m.nombre, meta: '', peso: m.peso }; });
      if (metItems.length && Math.abs(E.calc.sumaPesos(metItems) - 100) > 0.001) metItems = [];
      planComun[eq] = { edd: eddItems, met: metItems };
      if (eddItems.length && !E.db.planes.get(E.idPlan(per, eq, 'edd'))) planes.push({ id: E.idPlan(per, eq, 'edd'), d: { periodo_id: per, equipo_id: eq, tipo: 'edd', items: eddItems, aplicado: { por: quien, fecha: ahora, origen: 'importación' } } });
      if (metItems.length && !E.db.planes.get(E.idPlan(per, eq, 'met'))) planes.push({ id: E.idPlan(per, eq, 'met'), d: { periodo_id: per, equipo_id: eq, tipo: 'met', items: metItems, aplicado: { por: quien, fecha: ahora, origen: 'importación' } } });
    });
    const snap = p => {
      const eq = prop.equipos.find(e => e.id === p.equipo_id);
      const sup = eq && eq.supervisor_codigo ? prop.personas.find(x => x.codigo === Number(eq.supervisor_codigo)) : null;
      return { codigo: p.codigo, nombre: p.nombre, rol: p.rol || '', equipo_id: p.equipo_id || null, equipo: eq ? eq.nombre : '', supervisor: sup ? sup.nombre : '' };
    };
    conPlan.forEach(p => {
      const pc = planComun[p.equipo_id] || { edd: [], met: [] };
      if (p.edd.length) {
        const usados = new Set();
        const items = [];
        pc.edd.forEach(t => { const k = E.norm(t.texto); const ok = p.edd.find(x => E.norm(x) === k); if (ok) { usados.add(k); items.push({ id: t.id, texto: ok, origen: 'equipo', resultado: null }); } });
        p.edd.forEach(t => { if (!usados.has(E.norm(t))) items.push({ id: 'e' + E.uid(), texto: t, origen: 'individual', resultado: null }); });
        const excepcion = pc.edd.length > 0 && items.filter(i => i.origen === 'equipo').length < pc.edd.length;
        evals.push({ id: E.idEval(per, p.id), d: {
          periodo_id: per, persona_id: p.id, snapshot: snap(p), items, excepcion, resultado_final: null, comentarios: '', autorizado_por: null, cierre: null,
          plan_inicial: prop.publicarInicial ? { items: items.map(i => i.texto), por: quien, fecha: ahora } : null, fuente: 'importación',
        } });
      }
      if (p.met.length && !E.metricos(per, p.id)) {
        const usados = new Set(); const items = [];
        pc.met.forEach(t => { const k = E.norm(t.nombre) + '|' + t.peso; const ok = p.met.find(x => E.norm(x.nombre) + '|' + x.peso === k); if (ok) { usados.add(k); items.push({ id: t.id, nombre: ok.nombre, meta: '', peso: ok.peso, resultado: '', cumplimiento: null, notas: '', responsable: '', reduccion: null, origen: 'equipo' }); } });
        p.met.forEach(m => { const k = E.norm(m.nombre) + '|' + m.peso; if (!usados.has(k)) items.push({ id: 'm' + E.uid(), nombre: m.nombre, meta: '', peso: m.peso, resultado: '', cumplimiento: null, notas: '', responsable: '', reduccion: null, origen: 'individual' }); });
        const excepcion = pc.met.length > 0 && items.some(i => i.origen === 'individual');
        mets.push({ id: E.idEval(per, p.id), d: {
          periodo_id: per, persona_id: p.id, snapshot: snap(p), items, excepcion, cierre: null, fuente: 'importación',
          plan_inicial: prop.publicarInicial ? { items: items.map(i => ({ nombre: i.nombre, meta: i.meta, peso: i.peso })), por: quien, fecha: ahora } : null,
        } });
      }
    });
    const maxItems = Math.max(5, ...evals.map(e => e.d.items.length));
    const periodo = E.db.periodos.get(per) ? null : { id: per, d: { nombre: E.periodo.nombre(per), num_planes: Math.min(maxItems, E.conf().planes_max), estado: 'abierto', creado_por: quien, creado: ahora } };
    return { equipos, personas, planes, evals, mets, periodo };
  };

  I.aplicar = async function (prop, progreso) {
    const pend = I.pendientes(prop);
    if (pend.length) throw new Error('Faltan ' + pend.length + ' decisión(es) por resolver.');
    const reg = I.construirRegistros(prop);
    const ahora = E.hoyISO(); const quien = E.api.usuario;
    const paso = t => progreso && progreso(t);
    if (!E.db.config.get('general')) { paso('Configuración'); await E.guardar('config', [{ id: 'general', d: Object.assign({}, E.DEF) }], 'importación'); }
    if (prop.plantilla) {
      paso('Plantilla EDD');
      const prev = E.db.config.get('plantilla');
      await E.guardar('config', [{ id: 'plantilla', v: prev ? prev.v : null, d: { archivo: prop.plantilla.archivo, base64: prop.plantilla.base64, logo: prop.plantilla.logo, hoja_mes: prop.plantilla.hojaMes, meses_resumen: prop.plantilla.mesesResumen, hojas: prop.plantilla.analisis.hojas, subida_por: quien, fecha: ahora } }], 'plantilla');
    }
    paso('Equipos'); await E.guardar('equipos', reg.equipos, 'importación');
    paso('Personas'); await E.guardar('personas', reg.personas, 'importación');
    if (reg.periodo) { paso('Periodo'); await E.guardar('periodos', [reg.periodo], 'importación'); }
    paso('Planes de equipo'); await E.guardar('planes', reg.planes, 'importación');
    paso('Evaluaciones EDD'); await E.guardar('evaluaciones', reg.evals, 'importación');
    paso('Métricos'); await E.guardar('metricos', reg.mets, 'importación');
    const resumen = { personas: reg.personas.length, equipos: reg.equipos.length, planes: reg.planes.length, evaluaciones: reg.evals.length, metricos: reg.mets.length };
    await E.guardar('importaciones', [{ id: 'imp-' + Date.now(), d: {
      fecha: ahora, usuario: quien, periodo: prop.periodo, archivos: prop.archivos, resumen,
      decisiones: prop.dudas.filter(d => d.tipo === 'decision').map(d => ({ titulo: d.titulo, eleccion: (d.opciones.find(o => o.valor === d.valor) || {}).etiqueta || d.valor })),
      avisos: prop.dudas.filter(d => d.tipo === 'aviso').map(d => d.titulo),
    } }], 'importación');
    return resumen;
  };
})(typeof window !== 'undefined' ? window : globalThis);
