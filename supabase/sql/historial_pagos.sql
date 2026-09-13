-- ============================================================
-- SWEET CAKES - HISTORIAL DE PAGOS
-- Ejecutar en Supabase > SQL Editor > New query
--
-- Objetivos:
--   * registrar cada abono/pago como movimiento independiente
--   * conservar public.encargos.abono como total acumulado compatible
--   * migrar los abonos existentes sin perder información
--   * permitir anular movimientos sin borrar el historial
-- ============================================================

-- 1) Tabla de movimientos de pago.
create table if not exists public.encargo_pagos (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  fecha_pago date not null default current_date,
  metodo_pago text not null default 'No especificado',
  nota text,
  anulado boolean not null default false,
  anulado_at timestamptz,
  anulado_por uuid references auth.users(id) on delete set null,
  motivo_anulacion text,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists encargo_pagos_encargo_fecha_idx
  on public.encargo_pagos(encargo_id, fecha_pago desc, created_at desc);

-- 2) Impide que un pago activo haga superar el precio cotizado.
create or replace function public.validar_pago_encargo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio numeric(12,2);
  v_otros_pagos numeric(12,2);
begin
  if new.anulado then
    return new;
  end if;

  select coalesce(precio_cotizado, 0)::numeric(12,2)
    into v_precio
  from public.encargos
  where id = new.encargo_id;

  if v_precio is null then
    raise exception 'No se encontró el encargo asociado al pago.';
  end if;

  select coalesce(sum(monto), 0)::numeric(12,2)
    into v_otros_pagos
  from public.encargo_pagos
  where encargo_id = new.encargo_id
    and anulado = false
    and (tg_op = 'INSERT' or id <> new.id);

  if v_otros_pagos + new.monto > v_precio + 0.005 then
    raise exception 'El pago supera el saldo pendiente del pedido.';
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_validar_pago on public.encargo_pagos;
create trigger sweetcakes_validar_pago
before insert or update of monto, encargo_id, anulado
on public.encargo_pagos
for each row execute function public.validar_pago_encargo();

-- 3) Mantiene encargos.abono sincronizado con los movimientos activos.
create or replace function public.sincronizar_abono_encargo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encargo_id uuid;
begin
  if tg_op = 'DELETE' then
    v_encargo_id := old.encargo_id;
  else
    v_encargo_id := new.encargo_id;
  end if;

  update public.encargos
  set abono = coalesce((
    select sum(p.monto)
    from public.encargo_pagos p
    where p.encargo_id = v_encargo_id
      and p.anulado = false
  ), 0)
  where id = v_encargo_id;

  if tg_op = 'UPDATE' and old.encargo_id is distinct from new.encargo_id then
    update public.encargos
    set abono = coalesce((
      select sum(p.monto)
      from public.encargo_pagos p
      where p.encargo_id = old.encargo_id
        and p.anulado = false
    ), 0)
    where id = old.encargo_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_sincronizar_abono on public.encargo_pagos;
create trigger sweetcakes_sincronizar_abono
after insert or update or delete on public.encargo_pagos
for each row execute function public.sincronizar_abono_encargo();

-- 4) Todo pedido nuevo que llegue con un abono inicial crea su movimiento.
-- Esto mantiene compatibilidad con el formulario actual de Nuevo Encargo.
create or replace function public.crear_pago_inicial_encargo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.abono, 0) > 0 then
    insert into public.encargo_pagos (
      encargo_id,
      monto,
      fecha_pago,
      metodo_pago,
      nota,
      creado_por
    ) values (
      new.id,
      new.abono,
      current_date,
      'No especificado',
      'Abono inicial',
      new.creado_por
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sweetcakes_pago_inicial on public.encargos;
create trigger sweetcakes_pago_inicial
after insert on public.encargos
for each row execute function public.crear_pago_inicial_encargo();

-- 5) Evita reducir el precio por debajo de lo ya cobrado.
create or replace function public.validar_precio_vs_pagado()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.precio_cotizado, 0) + 0.005 < coalesce(old.abono, 0) then
    raise exception 'El precio cotizado no puede ser menor que el total ya pagado.';
  end if;
  return new;
end;
$$;

drop trigger if exists sweetcakes_validar_precio_vs_pagado on public.encargos;
create trigger sweetcakes_validar_precio_vs_pagado
before update of precio_cotizado on public.encargos
for each row execute function public.validar_precio_vs_pagado();

-- 6) Migra los abonos históricos. Solo crea un movimiento si ese pedido
-- todavía no tiene historial, por lo que el script puede ejecutarse otra vez.
insert into public.encargo_pagos (
  encargo_id,
  monto,
  fecha_pago,
  metodo_pago,
  nota,
  creado_por,
  created_at
)
select
  e.id,
  e.abono::numeric(12,2),
  coalesce(e.created_at::date, current_date),
  'No especificado',
  'Abono existente antes del historial de pagos',
  e.creado_por,
  coalesce(e.created_at, now())
from public.encargos e
where coalesce(e.abono, 0) > 0
  and not exists (
    select 1
    from public.encargo_pagos p
    where p.encargo_id = e.id
  );

-- 7) Recalcula el campo compatible "abono" con la fuente nueva.
update public.encargos e
set abono = coalesce((
  select sum(p.monto)
  from public.encargo_pagos p
  where p.encargo_id = e.id
    and p.anulado = false
), 0);

-- 8) Permisos y RLS.
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

-- No se concede DELETE a la app. Los errores se corrigen anulando el
-- movimiento para que el historial financiero no desaparezca.

-- 9) Comprobación final.
select
  (select count(*) from public.encargo_pagos) as movimientos_registrados,
  (select count(*) from public.encargo_pagos where anulado = false) as movimientos_activos,
  (select count(*) from public.encargo_pagos where anulado = true) as movimientos_anulados,
  (select count(*)
     from public.encargos e
    where abs(
      coalesce(e.abono, 0)::numeric
      - coalesce((select sum(p.monto) from public.encargo_pagos p where p.encargo_id = e.id and p.anulado = false), 0)::numeric
    ) > 0.005
  ) as pedidos_desincronizados;
