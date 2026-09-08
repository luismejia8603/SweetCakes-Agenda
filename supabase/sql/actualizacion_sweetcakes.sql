-- ============================================================
-- SWEET CAKES - ACTUALIZACION DE BASE DE DATOS
-- Ejecutar UNA sola vez en Supabase > SQL Editor > New query
-- ============================================================

-- 1) PERFILES Y ROLES
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  usuario text,
  rol text not null default 'Empleado',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.perfiles add column if not exists nombre text default '';
alter table public.perfiles add column if not exists usuario text;
alter table public.perfiles add column if not exists rol text default 'Empleado';
alter table public.perfiles add column if not exists activo boolean default true;
alter table public.perfiles add column if not exists created_at timestamptz default now();

-- Completa usuario/nombre de cuentas antiguas si faltan.
insert into public.perfiles (id, nombre, usuario, rol, activo)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), split_part(coalesce(u.email, ''), '@', 1), 'Usuario'),
  nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
  coalesce(nullif(u.raw_user_meta_data ->> 'rol', ''), 'Empleado'),
  true
from auth.users u
where not exists (select 1 from public.perfiles p where p.id = u.id);

update public.perfiles p
set usuario = split_part(u.email, '@', 1)
from auth.users u
where p.id = u.id
  and (p.usuario is null or btrim(p.usuario) = '');

-- Permite los roles actuales y los nuevos.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.perfiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table public.perfiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('Propietario', 'Encargado', 'Empleado', 'Administrador'));

update public.perfiles
set rol = 'Empleado'
where rol is null
   or rol not in ('Propietario', 'Encargado', 'Empleado', 'Administrador');

-- Si todavía no existe ningún Propietario, la cuenta de Auth más antigua
-- se convierte en Propietario. Esto evita dejar la administración bloqueada.
do $$
begin
  if not exists (select 1 from public.perfiles where rol = 'Propietario') then
    update public.perfiles
    set rol = 'Propietario'
    where id = (
      select id from auth.users order by created_at asc limit 1
    );
  end if;
end $$;

-- Crea/actualiza automáticamente el perfil cuando una cuenta se crea
-- desde la Edge Function.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, usuario, rol, activo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    coalesce(nullif(new.raw_user_meta_data ->> 'usuario', ''), split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'rol', ''), 'Empleado'),
    true
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    usuario = excluded.usuario,
    rol = excluded.rol,
    activo = true;
  return new;
end;
$$;

drop trigger if exists sweetcakes_crear_perfil on auth.users;
create trigger sweetcakes_crear_perfil
after insert on auth.users
for each row execute function public.crear_perfil_nuevo_usuario();

-- Función reutilizable para verificar el rol del propietario.
create or replace function public.es_propietario()
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
        and rol = 'Propietario'
        and activo = true
    ), false
  );
$$;

grant execute on function public.es_propietario() to authenticated;

grant usage on schema public to authenticated;
grant select, update on public.perfiles to authenticated;

alter table public.perfiles enable row level security;

drop policy if exists sweetcakes_perfiles_ver on public.perfiles;
create policy sweetcakes_perfiles_ver
on public.perfiles for select
to authenticated
using (id = auth.uid() or public.es_propietario());

drop policy if exists sweetcakes_perfiles_actualizar on public.perfiles;
create policy sweetcakes_perfiles_actualizar
on public.perfiles for update
to authenticated
using (public.es_propietario())
with check (public.es_propietario());

-- 2) MEJORAS DE LA TABLA ENCARGOS
alter table public.encargos add column if not exists imagen_referencia text;
alter table public.encargos add column if not exists creado_por uuid references auth.users(id) on delete set null;
alter table public.encargos add column if not exists created_at timestamptz default now();
alter table public.encargos add column if not exists updated_at timestamptz default now();

-- Mantiene los cuatro estados oficiales del proyecto.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.encargos'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado_pedido%'
  loop
    execute format('alter table public.encargos drop constraint %I', c.conname);
  end loop;
end $$;

update public.encargos
set estado_pedido = 'Pendiente'
where estado_pedido is null
   or estado_pedido not in ('Pendiente', 'Listo', 'Entregado', 'Cancelado');

alter table public.encargos
  add constraint encargos_estado_pedido_check
  check (estado_pedido in ('Pendiente', 'Listo', 'Entregado', 'Cancelado'));

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sweetcakes_encargos_updated_at on public.encargos;
create trigger sweetcakes_encargos_updated_at
before update on public.encargos
for each row execute function public.actualizar_updated_at();

create index if not exists encargos_fecha_entrega_idx on public.encargos(fecha_entrega);
create index if not exists encargos_estado_idx on public.encargos(estado_pedido);
create index if not exists encargos_created_at_idx on public.encargos(created_at desc);

grant select, insert, update, delete on public.encargos to authenticated;

alter table public.encargos enable row level security;

-- Estas políticas conviven con las que ya tenías. Todos los usuarios activos
-- de la app pueden trabajar pedidos; solo Propietario puede borrar mediante
-- esta política.
drop policy if exists sweetcakes_encargos_ver on public.encargos;
create policy sweetcakes_encargos_ver
on public.encargos for select
to authenticated
using (true);

drop policy if exists sweetcakes_encargos_crear on public.encargos;
create policy sweetcakes_encargos_crear
on public.encargos for insert
to authenticated
with check (true);

drop policy if exists sweetcakes_encargos_actualizar on public.encargos;
create policy sweetcakes_encargos_actualizar
on public.encargos for update
to authenticated
using (true)
with check (true);

drop policy if exists sweetcakes_encargos_eliminar on public.encargos;
create policy sweetcakes_encargos_eliminar
on public.encargos for delete
to authenticated
using (public.es_propietario());

-- 3) STORAGE PRIVADO PARA IMAGENES DE REFERENCIA
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'encargos-imagenes',
  'encargos-imagenes',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sweetcakes_imagenes_ver on storage.objects;
create policy sweetcakes_imagenes_ver
on storage.objects for select
to authenticated
using (bucket_id = 'encargos-imagenes');

drop policy if exists sweetcakes_imagenes_subir on storage.objects;
create policy sweetcakes_imagenes_subir
on storage.objects for insert
to authenticated
with check (bucket_id = 'encargos-imagenes');

drop policy if exists sweetcakes_imagenes_actualizar on storage.objects;
create policy sweetcakes_imagenes_actualizar
on storage.objects for update
to authenticated
using (bucket_id = 'encargos-imagenes')
with check (bucket_id = 'encargos-imagenes');

drop policy if exists sweetcakes_imagenes_borrar on storage.objects;
create policy sweetcakes_imagenes_borrar
on storage.objects for delete
to authenticated
using (bucket_id = 'encargos-imagenes' and public.es_propietario());

-- 4) COMPROBACION RAPIDA
select
  (select count(*) from public.perfiles) as perfiles,
  (select count(*) from public.perfiles where rol = 'Propietario') as propietarios,
  (select count(*) from storage.buckets where id = 'encargos-imagenes') as bucket_imagenes;
