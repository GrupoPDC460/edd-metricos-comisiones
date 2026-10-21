-- =============================================================================
-- EDD · Evaluaciones de desempeño, métricos y comisiones — módulo independiente edd_
-- Proyecto Supabase: intranet-creditos-cobros
--
-- Seguridad: todas las tablas tienen RLS activo y NINGUNA política para anon /
-- authenticated: nadie puede leerlas ni escribirlas directamente con la llave
-- pública. Todo el acceso pasa por funciones SECURITY DEFINER que exigen una
-- sesión creada con la clave de acceso del equipo (edd_login).
-- Roles preparados: editor (v1: todos consultan y editan), supervisor y consulta.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.edd_acceso (
  id uuid primary key default gen_random_uuid(),
  etiqueta text not null,
  rol text not null default 'editor' check (rol in ('editor','supervisor','consulta')),
  clave_hash text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.edd_sesiones (
  token text primary key,
  acceso_id uuid not null references public.edd_acceso(id) on delete cascade,
  rol text not null,
  usuario text,
  created_at timestamptz not null default now(),
  expira timestamptz not null
);

do $$
declare t text;
begin
  foreach t in array array['edd_config','edd_equipos','edd_personas','edd_periodos',
                           'edd_planes','edd_evaluaciones','edd_metricos','edd_importaciones'] loop
    execute format($f$
      create table if not exists public.%I (
        id text primary key,
        data jsonb not null default '{}'::jsonb,
        version integer not null default 1,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        updated_by text
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create table if not exists public.edd_auditoria (
  id bigserial primary key,
  ts timestamptz not null default now(),
  tabla text not null,
  registro_id text not null,
  accion text not null,
  usuario text,
  rol text,
  antes jsonb,
  despues jsonb
);

alter table public.edd_acceso    enable row level security;
alter table public.edd_sesiones  enable row level security;
alter table public.edd_auditoria enable row level security;
revoke all on public.edd_acceso, public.edd_sesiones, public.edd_auditoria from anon, authenticated;

create unique index if not exists edd_personas_codigo_uq
  on public.edd_personas ((data->>'codigo')) where coalesce(data->>'codigo','') <> '';
create index if not exists edd_evaluaciones_periodo_ix on public.edd_evaluaciones ((data->>'periodo_id'));
create index if not exists edd_metricos_periodo_ix     on public.edd_metricos ((data->>'periodo_id'));
create index if not exists edd_planes_periodo_ix       on public.edd_planes ((data->>'periodo_id'));
create index if not exists edd_auditoria_reg_ix        on public.edd_auditoria (tabla, registro_id, ts desc);

comment on table public.edd_personas is 'EDD: padrón de gestores (documento JSON por persona). Módulo independiente edd_.';
comment on table public.edd_auditoria is 'EDD: historial de cambios (antes/después) de todos los registros del módulo.';

-- ---------------------------------------------------------------------------
-- Utilidades internas (no expuestas)
-- ---------------------------------------------------------------------------
create or replace function public.edd__sesion(p_token text)
returns public.edd_sesiones
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones;
begin
  select * into s from public.edd_sesiones where token = p_token and expira > now();
  if not found then
    raise exception 'EDD_SESION' using hint = 'La sesión venció o no es válida. Vuelve a ingresar la clave.';
  end if;
  return s;
end $$;

-- Matriz de permisos. v1: solo existe el rol editor (todos consultan y editan).
-- supervisor y consulta quedan definidos para activarlos después.
create or replace function public.edd__puede(p_rol text, p_accion text)
returns boolean language sql immutable as $$
  select case p_rol
    when 'editor'     then true
    when 'supervisor' then p_accion in ('leer','escribir')
    when 'consulta'   then p_accion = 'leer'
    else false end
$$;

create or replace function public.edd__tabla(p_tabla text)
returns text language plpgsql immutable as $$
begin
  if p_tabla not in ('config','equipos','personas','periodos','planes','evaluaciones','metricos','importaciones') then
    raise exception 'EDD_TABLA' using hint = 'Tabla no permitida: ' || coalesce(p_tabla,'(vacía)');
  end if;
  return 'edd_' || p_tabla;
end $$;

-- Suma de ponderaciones de una lista de métricos (null si no hay métricos)
create or replace function public.edd__suma_pesos(p_items jsonb)
returns numeric language sql immutable as $$
  select case when p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
              then null
              else (select coalesce(sum(nullif(e->>'peso','')::numeric),0) from jsonb_array_elements(p_items) e) end
$$;

-- ---------------------------------------------------------------------------
-- API pública (RPC)
-- ---------------------------------------------------------------------------
create or replace function public.edd_login(p_clave text, p_usuario text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare a public.edd_acceso; tok text; vence timestamptz;
begin
  if coalesce(trim(p_usuario),'') = '' then
    raise exception 'EDD_USUARIO' using hint = 'Escribe tu nombre para registrar quién hace los cambios.';
  end if;
  select * into a from public.edd_acceso
   where activo and clave_hash = extensions.crypt(coalesce(p_clave,''), clave_hash)
   limit 1;
  if not found then
    perform pg_sleep(0.7);
    raise exception 'EDD_CLAVE' using hint = 'La clave de acceso no es correcta.';
  end if;
  delete from public.edd_sesiones where expira < now();
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  vence := now() + interval '12 hours';
  insert into public.edd_sesiones(token, acceso_id, rol, usuario, expira)
       values (tok, a.id, a.rol, left(trim(p_usuario), 80), vence);
  return jsonb_build_object('token', tok, 'rol', a.rol, 'usuario', left(trim(p_usuario),80), 'expira', vence);
end $$;

create or replace function public.edd_logout(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.edd_sesiones where token = p_token;
$$;

create or replace function public.edd_cargar(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones; res jsonb := '{}'::jsonb; t text; parte jsonb;
begin
  s := public.edd__sesion(p_token);
  if not public.edd__puede(s.rol, 'leer') then raise exception 'EDD_PERMISO'; end if;
  foreach t in array array['config','equipos','personas','periodos','planes','evaluaciones','metricos'] loop
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''data'',data,''version'',version,''updated_at'',updated_at,''updated_by'',updated_by) order by id), ''[]''::jsonb) from public.%I',
      'edd_' || t) into parte;
    res := res || jsonb_build_object(t, parte);
  end loop;
  return res || jsonb_build_object('sesion', jsonb_build_object('rol', s.rol, 'usuario', s.usuario, 'expira', s.expira));
end $$;

-- Guarda (crea o actualiza) uno o varios documentos de una tabla.
-- Cada registro: { id, data, version }  · version = la que tenía el cliente (control de concurrencia).
create or replace function public.edd_guardar(p_token text, p_tabla text, p_registros jsonb, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.edd_sesiones; tbl text; r jsonb; v_id text; v_data jsonb; v_ver int;
  old_data jsonb; old_ver int; nueva_ver int; salida jsonb := '[]'::jsonb; suma numeric;
begin
  s := public.edd__sesion(p_token);
  if not public.edd__puede(s.rol, 'escribir') then
    raise exception 'EDD_PERMISO' using hint = 'Tu rol no permite editar.';
  end if;
  tbl := public.edd__tabla(p_tabla);
  if p_registros is null or jsonb_typeof(p_registros) <> 'array' then
    raise exception 'EDD_FORMATO' using hint = 'Se esperaba una lista de registros.';
  end if;

  for r in select value from jsonb_array_elements(p_registros) loop
    v_id   := nullif(trim(r->>'id'), '');
    v_data := r->'data';
    v_ver  := nullif(r->>'version', '')::int;
    old_data := null; old_ver := null;
    if v_id is null or v_data is null or jsonb_typeof(v_data) <> 'object' then
      raise exception 'EDD_FORMATO' using hint = 'Registro sin id o sin datos.';
    end if;

    -- Regla de negocio: las ponderaciones de un plan de métricos deben sumar 100 %
    if p_tabla = 'metricos' or (p_tabla = 'planes' and v_data->>'tipo' = 'met') then
      suma := public.edd__suma_pesos(v_data->'items');
      if suma is not null and abs(suma - 100) > 0.001 then
        raise exception 'EDD_PESOS' using hint = format('Las ponderaciones suman %s%%; deben sumar 100%%.', trim(to_char(suma, 'FM9990.99')));
      end if;
    end if;

    execute format('select data, version from public.%I where id = $1 for update', tbl)
       into old_data, old_ver using v_id;

    begin
      if old_ver is not null then
        if v_ver is not null and v_ver <> old_ver then
          raise exception 'EDD_CONFLICTO' using hint = 'Otra persona modificó este registro mientras lo editabas. Recarga para ver la versión actual.';
        end if;
        if old_data = v_data then
          salida := salida || jsonb_build_array(jsonb_build_object('id', v_id, 'version', old_ver, 'sin_cambios', true));
          continue;
        end if;
        nueva_ver := old_ver + 1;
        execute format('update public.%I set data = $2, version = $3, updated_at = now(), updated_by = $4 where id = $1', tbl)
          using v_id, v_data, nueva_ver, s.usuario;
        insert into public.edd_auditoria(tabla, registro_id, accion, usuario, rol, antes, despues)
             values (p_tabla, v_id, coalesce(nullif(trim(p_motivo), ''), 'actualizar'), s.usuario, s.rol, old_data, v_data);
      else
        if v_ver is not null and v_ver > 0 then
          raise exception 'EDD_CONFLICTO' using hint = 'El registro ya no existe. Recarga los datos.';
        end if;
        nueva_ver := 1;
        execute format('insert into public.%I(id, data, version, updated_by) values ($1, $2, 1, $3)', tbl)
          using v_id, v_data, s.usuario;
        insert into public.edd_auditoria(tabla, registro_id, accion, usuario, rol, antes, despues)
             values (p_tabla, v_id, coalesce(nullif(trim(p_motivo), ''), 'crear'), s.usuario, s.rol, null, v_data);
      end if;
    exception when unique_violation then
      raise exception 'EDD_DUPLICADO' using hint = 'Ya existe otra persona con el código ' || coalesce(v_data->>'codigo', v_id) || '.';
    end;

    salida := salida || jsonb_build_array(jsonb_build_object('id', v_id, 'version', nueva_ver, 'updated_at', now(), 'updated_by', s.usuario));
  end loop;

  update public.edd_sesiones set expira = greatest(expira, now() + interval '12 hours') where token = p_token;
  return salida;
end $$;

-- Elimina un documento. Personas, evaluaciones y métricos NO se eliminan (se desactivan / reabren),
-- para no perder historial.
create or replace function public.edd_eliminar(p_token text, p_tabla text, p_id text, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones; tbl text; old_data jsonb; n int;
begin
  s := public.edd__sesion(p_token);
  if not public.edd__puede(s.rol, 'escribir') then raise exception 'EDD_PERMISO'; end if;
  if p_tabla not in ('planes','equipos','periodos','importaciones') then
    raise exception 'EDD_NO_ELIMINABLE' using hint = 'Este tipo de registro no se elimina; se desactiva para conservar el historial.';
  end if;
  tbl := public.edd__tabla(p_tabla);
  if p_tabla = 'equipos' then
    select count(*) into n from public.edd_personas where data->>'equipo_id' = p_id;
    if n > 0 then raise exception 'EDD_EN_USO' using hint = format('El equipo tiene %s persona(s) asignada(s).', n); end if;
  elsif p_tabla = 'periodos' then
    select (select count(*) from public.edd_evaluaciones where data->>'periodo_id' = p_id)
         + (select count(*) from public.edd_metricos where data->>'periodo_id' = p_id) into n;
    if n > 0 then raise exception 'EDD_EN_USO' using hint = format('El periodo ya tiene %s registro(s) de evaluación o métricos.', n); end if;
  end if;
  execute format('delete from public.%I where id = $1 returning data', tbl) into old_data using p_id;
  if old_data is null then raise exception 'EDD_NO_EXISTE'; end if;
  insert into public.edd_auditoria(tabla, registro_id, accion, usuario, rol, antes, despues)
       values (p_tabla, p_id, coalesce(nullif(trim(p_motivo), ''), 'eliminar'), s.usuario, s.rol, old_data, null);
  return jsonb_build_object('id', p_id, 'eliminado', true);
end $$;

create or replace function public.edd_auditoria_ver(p_token text, p_tabla text default null, p_ids text[] default null, p_limite int default 300)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones; res jsonb;
begin
  s := public.edd__sesion(p_token);
  if not public.edd__puede(s.rol, 'leer') then raise exception 'EDD_PERMISO'; end if;
  select coalesce(jsonb_agg(x order by x->>'ts' desc), '[]'::jsonb) into res from (
    select jsonb_build_object('id', id, 'ts', ts, 'tabla', tabla, 'registro_id', registro_id, 'accion', accion,
                              'usuario', usuario, 'rol', rol, 'antes', antes, 'despues', despues) x
      from public.edd_auditoria
     where (p_tabla is null or tabla = p_tabla)
       and (p_ids is null or registro_id = any(p_ids))
     order by ts desc
     limit least(greatest(coalesce(p_limite, 300), 1), 1000)) q;
  return res;
end $$;

create or replace function public.edd_importaciones_ver(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones; res jsonb;
begin
  s := public.edd__sesion(p_token);
  if not public.edd__puede(s.rol, 'leer') then raise exception 'EDD_PERMISO'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'data', data, 'updated_at', updated_at, 'updated_by', updated_by) order by created_at desc), '[]'::jsonb)
    into res from public.edd_importaciones;
  return res;
end $$;

create or replace function public.edd_cambiar_clave(p_token text, p_actual text, p_nueva text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.edd_sesiones; a public.edd_acceso;
begin
  s := public.edd__sesion(p_token);
  if s.rol <> 'editor' then raise exception 'EDD_PERMISO'; end if;
  select * into a from public.edd_acceso where id = s.acceso_id;
  if a.clave_hash <> extensions.crypt(coalesce(p_actual, ''), a.clave_hash) then
    perform pg_sleep(0.7);
    raise exception 'EDD_CLAVE' using hint = 'La clave actual no es correcta.';
  end if;
  if length(coalesce(p_nueva, '')) < 8 then
    raise exception 'EDD_CLAVE_CORTA' using hint = 'La nueva clave debe tener al menos 8 caracteres.';
  end if;
  update public.edd_acceso set clave_hash = extensions.crypt(p_nueva, extensions.gen_salt('bf')) where id = a.id;
  delete from public.edd_sesiones where acceso_id = a.id and token <> p_token;
  insert into public.edd_auditoria(tabla, registro_id, accion, usuario, rol) values ('acceso', a.id::text, 'cambiar_clave', s.usuario, s.rol);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke execute on function public.edd__sesion(text)            from public, anon, authenticated;
revoke execute on function public.edd__puede(text, text)       from public, anon, authenticated;
revoke execute on function public.edd__tabla(text)             from public, anon, authenticated;
revoke execute on function public.edd__suma_pesos(jsonb)       from public, anon, authenticated;
revoke execute on function public.edd_login(text, text)                         from public;
revoke execute on function public.edd_logout(text)                              from public;
revoke execute on function public.edd_cargar(text)                              from public;
revoke execute on function public.edd_guardar(text, text, jsonb, text)          from public;
revoke execute on function public.edd_eliminar(text, text, text, text)          from public;
revoke execute on function public.edd_auditoria_ver(text, text, text[], int)    from public;
revoke execute on function public.edd_importaciones_ver(text)                   from public;
revoke execute on function public.edd_cambiar_clave(text, text, text)           from public;
grant execute on function public.edd_login(text, text)                          to anon, authenticated;
grant execute on function public.edd_logout(text)                               to anon, authenticated;
grant execute on function public.edd_cargar(text)                               to anon, authenticated;
grant execute on function public.edd_guardar(text, text, jsonb, text)           to anon, authenticated;
grant execute on function public.edd_eliminar(text, text, text, text)           to anon, authenticated;
grant execute on function public.edd_auditoria_ver(text, text, text[], int)     to anon, authenticated;
grant execute on function public.edd_importaciones_ver(text)                    to anon, authenticated;
grant execute on function public.edd_cambiar_clave(text, text, text)            to anon, authenticated;

-- La clave de acceso inicial NO se guarda en el repositorio. Se crea aparte con:
--   insert into public.edd_acceso(etiqueta, rol, clave_hash)
--   values ('Equipo de supervisión', 'editor', extensions.crypt('<clave>', extensions.gen_salt('bf')));
