-- Nómina UEA · Migración 001
-- Módulo Novedades / Ausentismo
-- Ejecutar UNA sola vez en Supabase > SQL Editor > New query.
-- No elimina ni modifica la tabla public.presentismo existente.

create table if not exists public.tipos_novedad (
  codigo text primary key,
  nombre text not null,
  requiere_subtipo boolean not null default false,
  activo boolean not null default true,
  orden integer not null default 100
);

insert into public.tipos_novedad (codigo, nombre, requiere_subtipo, orden)
values
  ('E',   'Enfermedad', false, 10),
  ('LA',  'Licencia anual / Vacaciones', false, 20),
  ('NM',  'National Med', false, 30),
  ('ART', 'ART', false, 40),
  ('LE',  'Licencia especial', true, 50),
  ('AC',  'Ausente con aviso', false, 60),
  ('AS',  'Ausente sin aviso', false, 70)
on conflict (codigo) do update
set nombre = excluded.nombre,
    requiere_subtipo = excluded.requiere_subtipo,
    orden = excluded.orden;

create table if not exists public.novedades (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  tipo_codigo text not null references public.tipos_novedad(codigo),
  subtipo text,
  fecha_desde date not null,
  fecha_hasta date not null,
  jornadas integer check (jornadas is null or jornadas >= 0),
  origen text,
  fecha_evento date,
  fecha_atencion date,
  proxima_revision date,
  observacion text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint novedades_fechas_check check (fecha_hasta >= fecha_desde)
);

create table if not exists public.feriados (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  descripcion text not null,
  activo boolean not null default true,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

drop trigger if exists novedades_updated_at on public.novedades;
create trigger novedades_updated_at before update on public.novedades
for each row execute function public.set_updated_at();

drop trigger if exists feriados_updated_at on public.feriados;
create trigger feriados_updated_at before update on public.feriados
for each row execute function public.set_updated_at();

alter table public.tipos_novedad enable row level security;
alter table public.novedades enable row level security;
alter table public.feriados enable row level security;

drop policy if exists tipos_novedad_select on public.tipos_novedad;
create policy tipos_novedad_select on public.tipos_novedad
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists tipos_novedad_write on public.tipos_novedad;
create policy tipos_novedad_write on public.tipos_novedad
for all to authenticated
using (public.rol_actual() = 'administrador')
with check (public.rol_actual() = 'administrador');

drop policy if exists novedades_select on public.novedades;
create policy novedades_select on public.novedades
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists novedades_insert on public.novedades;
create policy novedades_insert on public.novedades
for insert to authenticated
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists novedades_update on public.novedades;
create policy novedades_update on public.novedades
for update to authenticated
using (public.rol_actual() in ('administrador','operador'))
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists novedades_delete on public.novedades;
create policy novedades_delete on public.novedades
for delete to authenticated
using (public.rol_actual() = 'administrador');

drop policy if exists feriados_select on public.feriados;
create policy feriados_select on public.feriados
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists feriados_insert on public.feriados;
create policy feriados_insert on public.feriados
for insert to authenticated
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists feriados_update on public.feriados;
create policy feriados_update on public.feriados
for update to authenticated
using (public.rol_actual() in ('administrador','operador'))
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists feriados_delete on public.feriados;
create policy feriados_delete on public.feriados
for delete to authenticated
using (public.rol_actual() = 'administrador');

create index if not exists novedades_empleado_idx on public.novedades (empleado_id);
create index if not exists novedades_desde_idx on public.novedades (fecha_desde);
create index if not exists novedades_hasta_idx on public.novedades (fecha_hasta);
create index if not exists novedades_tipo_idx on public.novedades (tipo_codigo);
create index if not exists feriados_fecha_idx on public.feriados (fecha);
