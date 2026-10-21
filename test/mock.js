// Simulador en memoria de las funciones RPC de Supabase (misma semántica que la migración SQL)
(function () {
  const T = ['config','equipos','personas','periodos','planes','evaluaciones','metricos','importaciones'];
  const db = {}; T.forEach(t => db[t] = new Map()); const aud = []; let ses = null; let clave = 'CLAVE-PRUEBA';
  const err = (code, hint) => { const e = new EDD.ApiError(code, hint); throw e; };
  const sesion = tok => { if (!ses || ses.token !== tok) err('EDD_SESION', 'La sesión venció'); return ses; };
  const suma = items => (items || []).reduce((s, i) => s + (Number(i.peso) || 0), 0);
  window.__mockDb = db; window.__mockAud = aud;
  EDD.api.transporte = async (fn, a) => {
    await new Promise(r => setTimeout(r, 5));
    a = JSON.parse(JSON.stringify(a || {}));
    switch (fn) {
      case 'edd_login': if (!a.p_usuario) err('EDD_USUARIO','Escribe tu nombre'); if (a.p_clave !== clave) err('EDD_CLAVE','La clave de acceso no es correcta.'); ses = { token: 'tok' + Date.now(), rol: 'editor', usuario: a.p_usuario }; return { token: ses.token, rol: 'editor', usuario: a.p_usuario, expira: new Date(Date.now() + 864e5).toISOString() };
      case 'edd_logout': ses = null; return null;
      case 'edd_cargar': { sesion(a.p_token); const r = {}; ['config','equipos','personas','periodos','planes','evaluaciones','metricos'].forEach(t => r[t] = [...db[t].values()].map(x => JSON.parse(JSON.stringify(x)))); r.sesion = { rol: 'editor', usuario: ses.usuario }; return r; }
      case 'edd_guardar': {
        const s = sesion(a.p_token); const t = a.p_tabla; if (!T.includes(t)) err('EDD_TABLA');
        const out = [];
        for (const r of a.p_registros) {
          if ((t === 'metricos' || (t === 'planes' && r.data.tipo === 'met')) && (r.data.items || []).length && Math.abs(suma(r.data.items) - 100) > 0.001) err('EDD_PESOS', 'Las ponderaciones suman ' + suma(r.data.items) + '%; deben sumar 100%.');
          if (t === 'personas' && r.data.codigo != null && [...db.personas.values()].some(x => x.id !== r.id && String(x.data.codigo) === String(r.data.codigo))) err('EDD_DUPLICADO', 'Ya existe otra persona con el código ' + r.data.codigo);
          const old = db[t].get(r.id);
          if (old) { if (r.version != null && r.version !== old.version) err('EDD_CONFLICTO','Otra persona modificó este registro'); if (JSON.stringify(old.data) === JSON.stringify(r.data)) { out.push({ id: r.id, version: old.version, sin_cambios: true }); continue; } }
          else if (r.version) err('EDD_CONFLICTO','El registro ya no existe');
          const v = old ? old.version + 1 : 1; const now = new Date().toISOString();
          db[t].set(r.id, { id: r.id, data: r.data, version: v, updated_at: now, updated_by: s.usuario });
          aud.push({ id: aud.length + 1, ts: now, tabla: t, registro_id: r.id, accion: a.p_motivo || (old ? 'actualizar' : 'crear'), usuario: s.usuario, rol: 'editor', antes: old ? old.data : null, despues: r.data });
          out.push({ id: r.id, version: v, updated_at: now, updated_by: s.usuario });
        }
        return out;
      }
      case 'edd_eliminar': { sesion(a.p_token); if (!['planes','equipos','periodos','importaciones'].includes(a.p_tabla)) err('EDD_NO_ELIMINABLE','No se elimina'); if (a.p_tabla === 'equipos' && [...db.personas.values()].some(p => p.data.equipo_id === a.p_id)) err('EDD_EN_USO','El equipo tiene personas'); db[a.p_tabla].delete(a.p_id); return { id: a.p_id, eliminado: true }; }
      case 'edd_auditoria_ver': { sesion(a.p_token); return aud.filter(x => (!a.p_tabla || x.tabla === a.p_tabla) && (!a.p_ids || a.p_ids.includes(x.registro_id))).slice().reverse().slice(0, a.p_limite || 300); }
      case 'edd_importaciones_ver': sesion(a.p_token); return [...db.importaciones.values()];
      case 'edd_cambiar_clave': sesion(a.p_token); if (a.p_actual !== clave) err('EDD_CLAVE','La clave actual no es correcta.'); if ((a.p_nueva||'').length < 8) err('EDD_CLAVE_CORTA','Mínimo 8'); clave = a.p_nueva; return { ok: true };
    }
    err('NO_IMPLEMENTADO', fn);
  };
})();
