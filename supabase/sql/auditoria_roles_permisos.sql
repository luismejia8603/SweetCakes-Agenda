-- ============================================================
-- SWEET CAKES - AUDITORIA DE ROLES Y PERMISOS
-- Ejecutar en Supabase > SQL Editor > New query
--
-- Matriz final:
--   Propietario: acceso total + usuarios
--   Encargado: operacion + editar pedido/precio + cancelar + anular pagos + eliminar pedidos
--   Empleado: crear/ver pedidos + Pendiente/Listo/Entregado + cobrar/pagos + imprimir
--   Auditoria: registra creador y ultima edicion de cada pedido
--
-- Una cuenta con activo = false conserva Auth, pero RLS bloquea la operacion.
-- ============================================================

-- 1) Normalizar los tres roles oficiales.
update public.perfiles
set rol = 'Encargado'
where rol = 'Administrador';

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('Propietario', 'Encargado', 'Empleado'));

-- 2) Funciones centrales de autorización.
create or replace function public.rol_sweetcakes_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol
  from public.perfiles
  where id = auth.uid()
    and activo = true
  limit 1;
$$;

create or replace function public.es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.perfiles
      where id = auth.uid()
        and activo = true
        and rol in ('Propietario', 'Encargado', 'Empleado')
    ), false
  );
$$;

create or replace function public.es_propietario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_sweetcakes_actual() = 'Propietario', false);
$$;

create or replace function public.es_encargado_o_propietario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_sweetcakes_actual() in ('Propietario', 'Encargado'), false);
$$;

grant execute on function public.rol_sweetcakes_actual() to authenticated;
grant execute on function public.es_usuario_activo() to authenticated;
grant execute on function public.es_propietario() to authenticated;
grant execute on function public.es_encargado_o_propietario() to authenticated;

-- 3) Proteger la cuenta propietaria para no dejar la app sin dueño activo.
create or replace function public.proteger_ultimo_propietario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  propietarios_activos integer;
begin
  if old.rol = 'Propietario'
     and old.activo = true
     and (new.rol is distinct from 'Propietario' or new.activo is distinct from true) then
    select count(*) into propietarios_activos
    from public.perfiles
    where rol = 'Propietario'
      and activo = true;

    if propietarios_activos <= 1 then
      raise exception 'No se puede desactivar o degradar al ultimo Propietario activo.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_proteger_ultimo_propietario on public.perfiles;
create trigger sweetcakes_proteger_ultimo_propietario
before update of rol, activo on public.perfiles
for each row execute function public.proteger_ultimo_propietario();

-- 4) RLS de perfiles.
grant select, update on public.perfiles to authenticated;
alter table public.perfiles enable row level security;

drop policy if exists sweetcakes_perfiles_ver on public.perfiles;
create policy sweetcakes_perfiles_ver
on public.perfiles for select
to authenticated
using (id = auth.uid() or public.es_usuario_activo() or public.es_propietario());

drop policy if exists sweetcakes_perfiles_actualizar on public.perfiles;
create policy sweetcakes_perfiles_actualizar
on public.perfiles for update
to authenticated
using (public.es_propietario())
with check (public.es_propietario());

-- 5) Autoria de pedidos: quien lo creo y quien hizo la ultima edicion
-- de datos del encargo. Los cambios operativos de estado/pago no cuentan
-- como edicion del contenido del pedido.
alter table public.encargos
  add column if not exists editado_por uuid references auth.users(id) on delete set null;

alter table public.encargos
  add column if not exists editado_at timestamptz;

create index if not exists encargos_creado_por_idx on public.encargos(creado_por);
create index if not exists encargos_editado_por_idx on public.encargos(editado_por);

create or replace function public.registrar_autoria_encargo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Las operaciones internas (service role / funciones SECURITY DEFINER)
  -- conservan la autoria existente.
  if auth.uid() is null or current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Evita que un cliente suplante al creador enviando otro UUID.
    new.creado_por := auth.uid();
    return new;
  end if;

  -- El creador original nunca cambia.
  new.creado_por := old.creado_por;

  -- Solo las modificaciones de los datos reales del encargo cuentan
  -- como una edicion. Estado, abono y updated_at quedan fuera.
  if row(
    new.nombre_cliente,
    new.telefono,
    new.fecha_entrega,
    new.hora_entrega,
    new.sabor_torta,
    new.sabor_relleno,
    new.chantilly,
    new.imagen_referencia,
    new.dedicatoria,
    new.observaciones,
    new.precio_cotizado
  ) is distinct from row(
    old.nombre_cliente,
    old.telefono,
    old.fecha_entrega,
    old.hora_entrega,
    old.sabor_torta,
    old.sabor_relleno,
    old.chantilly,
    old.imagen_referencia,
    old.dedicatoria,
    old.observaciones,
    old.precio_cotizado
  ) then
    new.editado_por := auth.uid();
    new.editado_at := now();
  else
    -- No permite alterar manualmente la autoria con una actualizacion
    -- que no sea una edicion real del pedido.
    new.editado_por := old.editado_por;
    new.editado_at := old.editado_at;
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_autoria_encargo on public.encargos;
create trigger sweetcakes_autoria_encargo
before insert or update on public.encargos
for each row execute function public.registrar_autoria_encargo();

-- 6) Pedidos: todos los usuarios activos operan, pero Empleado no puede
-- editar datos administrativos, precio, cancelar ni eliminar.
grant select, insert, update, delete on public.encargos to authenticated;
alter table public.encargos enable row level security;

drop policy if exists sweetcakes_encargos_ver on public.encargos;
create policy sweetcakes_encargos_ver
on public.encargos for select
to authenticated
using (public.es_usuario_activo());

drop policy if exists sweetcakes_encargos_crear on public.encargos;
create policy sweetcakes_encargos_crear
on public.encargos for insert
to authenticated
with check (public.es_usuario_activo());

drop policy if exists sweetcakes_encargos_actualizar on public.encargos;
create policy sweetcakes_encargos_actualizar
on public.encargos for update
to authenticated
using (public.es_usuario_activo())
with check (public.es_usuario_activo());

drop policy if exists sweetcakes_encargos_eliminar on public.encargos;
create policy sweetcakes_encargos_eliminar
on public.encargos for delete
to authenticated
using (public.es_encargado_o_propietario());

create or replace function public.proteger_actualizacion_encargo_por_rol()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol text;
begin
  -- Operaciones internas SECURITY DEFINER (por ejemplo sincronizar abono)
  -- no deben quedar bloqueadas por las restricciones de interfaz.
  if auth.uid() is null or current_user <> 'authenticated' then
    return new;
  end if;

  v_rol := public.rol_sweetcakes_actual();

  if v_rol is null then
    raise exception 'Tu cuenta no esta activa en Sweet Cakes.';
  end if;

  if v_rol = 'Empleado' then
    if new.estado_pedido = 'Cancelado' then
      raise exception 'El rol Empleado no puede cancelar pedidos.';
    end if;

    if new.estado_pedido = 'Entregado' and old.estado_pedido is distinct from 'Entregado' then
      if old.estado_pedido <> 'Listo' then
        raise exception 'El pedido debe estar Listo antes de marcarlo Entregado.';
      end if;
      if coalesce(new.abono, 0) + 0.005 < coalesce(new.precio_cotizado, 0) then
        raise exception 'El pedido debe estar totalmente pagado antes de marcarlo Entregado.';
      end if;
    end if;

    if (to_jsonb(new) - array['estado_pedido', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['estado_pedido', 'updated_at']) then
      raise exception 'El rol Empleado solo puede actualizar el estado operativo del pedido.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_proteger_actualizacion_encargo_por_rol on public.encargos;
create trigger sweetcakes_proteger_actualizacion_encargo_por_rol
before update on public.encargos
for each row execute function public.proteger_actualizacion_encargo_por_rol();

-- 7) Imagenes asociadas al pedido.
grant select, insert, update, delete on public.encargo_imagenes to authenticated;
alter table public.encargo_imagenes enable row level security;

drop policy if exists sweetcakes_encargo_imagenes_ver on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_ver
on public.encargo_imagenes for select
to authenticated
using (public.es_usuario_activo());

drop policy if exists sweetcakes_encargo_imagenes_crear on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_crear
on public.encargo_imagenes for insert
to authenticated
with check (
  public.es_usuario_activo()
  and (creado_por is null or creado_por = auth.uid())
);

drop policy if exists sweetcakes_encargo_imagenes_actualizar on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_actualizar
on public.encargo_imagenes for update
to authenticated
using (
  public.es_encargado_o_propietario()
  or (public.es_usuario_activo() and creado_por = auth.uid())
)
with check (
  public.es_encargado_o_propietario()
  or (public.es_usuario_activo() and creado_por = auth.uid())
);

drop policy if exists sweetcakes_encargo_imagenes_borrar on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_borrar
on public.encargo_imagenes for delete
to authenticated
using (
  public.es_encargado_o_propietario()
  or (public.es_usuario_activo() and creado_por = auth.uid())
);

-- 8) Storage privado: lectura para activos. Cada usuario puede limpiar sus
-- propias subidas; Encargado/Propietario pueden gestionar cualquier referencia.
drop policy if exists sweetcakes_imagenes_ver on storage.objects;
create policy sweetcakes_imagenes_ver
on storage.objects for select
to authenticated
using (
  bucket_id = 'encargos-imagenes'
  and public.es_usuario_activo()
);

drop policy if exists sweetcakes_imagenes_subir on storage.objects;
create policy sweetcakes_imagenes_subir
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'encargos-imagenes'
  and public.es_usuario_activo()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists sweetcakes_imagenes_actualizar on storage.objects;
create policy sweetcakes_imagenes_actualizar
on storage.objects for update
to authenticated
using (
  bucket_id = 'encargos-imagenes'
  and (
    public.es_encargado_o_propietario()
    or (public.es_usuario_activo() and (storage.foldername(name))[1] = auth.uid()::text)
  )
)
with check (
  bucket_id = 'encargos-imagenes'
  and (
    public.es_encargado_o_propietario()
    or (public.es_usuario_activo() and (storage.foldername(name))[1] = auth.uid()::text)
  )
);

drop policy if exists sweetcakes_imagenes_borrar on storage.objects;
create policy sweetcakes_imagenes_borrar
on storage.objects for delete
to authenticated
using (
  bucket_id = 'encargos-imagenes'
  and (
    public.es_encargado_o_propietario()
    or (public.es_usuario_activo() and (storage.foldername(name))[1] = auth.uid()::text)
  )
);

-- 9) Pagos: todos los usuarios activos pueden consultar y registrar cobros.
-- Solo Encargado/Propietario pueden cambiar movimientos existentes, salvo
-- que un Empleado esté completando el metodo del abono inicial que él creó.
grant select, insert, update on public.encargo_pagos to authenticated;
alter table public.encargo_pagos enable row level security;

drop policy if exists sweetcakes_pagos_ver on public.encargo_pagos;
create policy sweetcakes_pagos_ver
on public.encargo_pagos for select
to authenticated
using (public.es_usuario_activo());

drop policy if exists sweetcakes_pagos_registrar on public.encargo_pagos;
create policy sweetcakes_pagos_registrar
on public.encargo_pagos for insert
to authenticated
with check (
  public.es_usuario_activo()
  and (creado_por is null or creado_por = auth.uid())
);

drop policy if exists sweetcakes_pagos_actualizar on public.encargo_pagos;
create policy sweetcakes_pagos_actualizar
on public.encargo_pagos for update
to authenticated
using (public.es_usuario_activo())
with check (public.es_usuario_activo());

create or replace function public.proteger_actualizacion_pago_por_rol()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rol text;
begin
  if auth.uid() is null or current_user <> 'authenticated' then
    return new;
  end if;

  v_rol := public.rol_sweetcakes_actual();

  if v_rol is null then
    raise exception 'Tu cuenta no esta activa en Sweet Cakes.';
  end if;

  if v_rol = 'Empleado' then
    if old.creado_por is distinct from auth.uid() then
      raise exception 'El rol Empleado no puede modificar este movimiento.';
    end if;

    if (to_jsonb(new) - array['metodo_pago'])
       is distinct from
       (to_jsonb(old) - array['metodo_pago']) then
      raise exception 'El rol Empleado no puede anular ni modificar movimientos de pago.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_proteger_actualizacion_pago_por_rol on public.encargo_pagos;
create trigger sweetcakes_proteger_actualizacion_pago_por_rol
before update on public.encargo_pagos
for each row execute function public.proteger_actualizacion_pago_por_rol();

-- 10) Comprobacion final.
select
  (select count(*) from public.perfiles where rol = 'Propietario' and activo = true) as propietarios_activos,
  (select count(*) from public.perfiles where rol = 'Encargado' and activo = true) as encargados_activos,
  (select count(*) from public.perfiles where rol = 'Empleado' and activo = true) as empleados_activos,
  (select count(*) from public.perfiles where activo = false) as usuarios_inactivos,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'encargos' and column_name in ('creado_por', 'editado_por', 'editado_at')) as columnas_autoria,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'encargos' and policyname like 'sweetcakes_%') as politicas_encargos,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'encargo_pagos' and policyname like 'sweetcakes_%') as politicas_pagos;
