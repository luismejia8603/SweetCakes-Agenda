-- ============================================================
-- SWEET CAKES - GOOGLE CALENDAR AUTOMATICO
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Datos de sincronización visibles en los pedidos.
alter table public.encargos add column if not exists google_event_id text;
alter table public.encargos add column if not exists google_event_url text;
alter table public.encargos add column if not exists google_calendar_synced_at timestamptz;
alter table public.encargos add column if not exists google_calendar_sync_error text;

create index if not exists encargos_google_event_id_idx
  on public.encargos(google_event_id)
  where google_event_id is not null;

-- Tokens OAuth. RLS está activado y NO hay políticas para usuarios normales.
-- Solo la Edge Function usa la clave secreta del servidor para leer esta tabla.
create table if not exists public.google_calendar_conexiones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_conexiones enable row level security;
revoke all on table public.google_calendar_conexiones from anon, authenticated;

-- Estados OAuth de corta duración para proteger el callback contra CSRF.
create table if not exists public.google_calendar_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_url text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.google_calendar_oauth_states enable row level security;
revoke all on table public.google_calendar_oauth_states from anon, authenticated;

-- Comprobación rápida.
select
  (select count(*) from information_schema.columns
   where table_schema = 'public'
     and table_name = 'encargos'
     and column_name in (
       'google_event_id',
       'google_event_url',
       'google_calendar_synced_at',
       'google_calendar_sync_error'
     )) as columnas_google_en_encargos,
  to_regclass('public.google_calendar_conexiones') is not null as tabla_conexiones,
  to_regclass('public.google_calendar_oauth_states') is not null as tabla_oauth_states;
