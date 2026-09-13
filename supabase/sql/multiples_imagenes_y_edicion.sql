-- ============================================================
-- SWEET CAKES - MULTIPLES IMAGENES POR PEDIDO
-- Ejecutar en Supabase > SQL Editor > New query
-- No elimina la columna imagen_referencia; la mantiene como respaldo.
-- ============================================================

-- 1) Tabla hija: hasta 5 referencias por encargo.
create table if not exists public.encargo_imagenes (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  ruta_storage text not null,
  orden integer not null default 0 check (orden >= 0),
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (encargo_id, ruta_storage)
);

create index if not exists encargo_imagenes_encargo_idx
  on public.encargo_imagenes(encargo_id, orden, created_at);

-- 2) Límite real de 5 imágenes también a nivel de base de datos.
create or replace function public.validar_maximo_imagenes_encargo()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.encargo_imagenes
    where encargo_id = new.encargo_id
  ) >= 5 then
    raise exception 'Un encargo puede tener como máximo 5 imágenes de referencia.';
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_maximo_imagenes on public.encargo_imagenes;
create trigger sweetcakes_maximo_imagenes
before insert on public.encargo_imagenes
for each row execute function public.validar_maximo_imagenes_encargo();

-- 3) Migrar la imagen antigua de cada pedido a la nueva tabla.
-- ON CONFLICT hace que pueda ejecutarse de nuevo sin duplicar.
insert into public.encargo_imagenes (encargo_id, ruta_storage, orden, creado_por)
select
  e.id,
  e.imagen_referencia,
  0,
  e.creado_por
from public.encargos e
where e.imagen_referencia is not null
  and btrim(e.imagen_referencia) <> ''
  and not exists (
    select 1
    from public.encargo_imagenes i
    where i.encargo_id = e.id
      and i.ruta_storage = e.imagen_referencia
  )
  and (
    select count(*)
    from public.encargo_imagenes i2
    where i2.encargo_id = e.id
  ) < 5
on conflict (encargo_id, ruta_storage) do nothing;

-- 4) Permisos y RLS de la tabla nueva.
grant select, insert, update, delete on public.encargo_imagenes to authenticated;
alter table public.encargo_imagenes enable row level security;

drop policy if exists sweetcakes_encargo_imagenes_ver on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_ver
on public.encargo_imagenes for select
to authenticated
using (true);

drop policy if exists sweetcakes_encargo_imagenes_crear on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_crear
on public.encargo_imagenes for insert
to authenticated
with check (true);

drop policy if exists sweetcakes_encargo_imagenes_actualizar on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_actualizar
on public.encargo_imagenes for update
to authenticated
using (true)
with check (true);

drop policy if exists sweetcakes_encargo_imagenes_borrar on public.encargo_imagenes;
create policy sweetcakes_encargo_imagenes_borrar
on public.encargo_imagenes for delete
to authenticated
using (true);

-- 5) Usuario activo de Sweet Cakes.
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
    ), false
  );
$$;

grant execute on function public.es_usuario_activo() to authenticated;

-- Permite retirar referencias desde la edición del pedido aunque la imagen
-- haya sido subida originalmente por otro miembro activo del equipo.
drop policy if exists sweetcakes_imagenes_borrar on storage.objects;
create policy sweetcakes_imagenes_borrar
on storage.objects for delete
to authenticated
using (
  bucket_id = 'encargos-imagenes'
  and public.es_usuario_activo()
);

-- 6) Comprobación final.
select
  (select count(*) from public.encargo_imagenes) as imagenes_registradas,
  (select count(*) from public.encargos where imagen_referencia is not null) as pedidos_legacy_con_imagen,
  (select count(*) from public.encargo_imagenes where orden < 0) as ordenes_invalidos,
  coalesce((select max(cantidad) from (
    select encargo_id, count(*) as cantidad
    from public.encargo_imagenes
    group by encargo_id
  ) conteos), 0) as maximo_imagenes_en_un_pedido;
