-- Nómina UEA v0.2
-- Ejecutar TODO este archivo en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar sobre una base nueva. Si ya instalaste v0.1, conserva empleados y presentismo.

create extension if not exists pgcrypto;

create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  legajo text not null unique,
  nombre text not null,
  apellido text not null,
  cuil text not null unique,
  sexo text check (sexo in ('F','M','X') or sexo is null),
  fecha_nacimiento date,
  en_convenio boolean,
  categoria text,
  telefono_corporativo text,
  notebook boolean,
  mail_corporativo text,
  superior_inmediato text,
  responsable_comite text,
  direccion_organizacional text,
  gerencia text,
  sector text,
  centro_costo text,
  sucursal_provincia text,
  sucursal_ciudad text,
  lugar_trabajo text,
  sucursal_cp text,
  fecha_ingreso date,
  fecha_ingreso_anterior date,
  agente_seguro_social text,
  prepaga text,
  plan_prepaga text,
  fecha_baja_prepaga date,
  integrantes_grupo integer check (integrantes_grupo >= 0 or integrantes_grupo is null),
  fecha_egreso date,
  motivo_egreso text,
  empresa text,
  observaciones text,
  temas_pendientes text,
  telefono_particular text,
  mail_personal text,
  banco text,
  domicilio_calle text,
  domicilio_numero text,
  domicilio_piso text,
  domicilio_departamento text,
  domicilio_localidad text,
  domicilio_cp text,
  domicilio_provincia text,
  hora_entrada time,
  hora_salida time,
  hora_entrada_especial time,
  hora_salida_especial time,
  activo boolean not null default true,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.presentismo (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  fecha date not null,
  estado text not null check (estado in ('presente','ausente','tarde','licencia','vacaciones','franco','feriado','retiro_anticipado')),
  hora_entrada_real time,
  hora_salida_real time,
  minutos_tarde integer default 0 check (minutos_tarde >= 0),
  observacion text,
  justificativo_url text,
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empleado_id, fecha)
);

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'consulta' check (rol in ('administrador','operador','consulta')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists empleados_updated_at on public.empleados;
create trigger empleados_updated_at before update on public.empleados
for each row execute function public.set_updated_at();

drop trigger if exists presentismo_updated_at on public.presentismo;
create trigger presentismo_updated_at before update on public.presentismo
for each row execute function public.set_updated_at();

drop trigger if exists perfiles_updated_at on public.perfiles;
create trigger perfiles_updated_at before update on public.perfiles
for each row execute function public.set_updated_at();

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), 'consulta')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_usuario();

-- Crea perfiles para usuarios que ya existían antes de ejecutar este archivo.
insert into public.perfiles (id, nombre, rol)
select id, coalesce(raw_user_meta_data->>'nombre', email), 'consulta'
from auth.users
on conflict (id) do nothing;

create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select rol from public.perfiles where id = auth.uid() and activo = true), 'consulta');
$$;

grant execute on function public.rol_actual() to authenticated;

alter table public.empleados enable row level security;
alter table public.presentismo enable row level security;
alter table public.perfiles enable row level security;

-- Perfiles: cada usuario ve su perfil; administradores ven y editan todos.
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
for select to authenticated
using (id = auth.uid() or public.rol_actual() = 'administrador');

drop policy if exists perfiles_update_admin on public.perfiles;
create policy perfiles_update_admin on public.perfiles
for update to authenticated
using (public.rol_actual() = 'administrador')
with check (public.rol_actual() = 'administrador');

-- Empleados: todos los usuarios activos pueden consultar.
drop policy if exists empleados_select_authenticated on public.empleados;
drop policy if exists empleados_insert_authenticated on public.empleados;
drop policy if exists empleados_update_authenticated on public.empleados;
drop policy if exists empleados_select on public.empleados;
create policy empleados_select on public.empleados
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists empleados_insert on public.empleados;
create policy empleados_insert on public.empleados
for insert to authenticated
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists empleados_update on public.empleados;
create policy empleados_update on public.empleados
for update to authenticated
using (public.rol_actual() in ('administrador','operador'))
with check (public.rol_actual() in ('administrador','operador'));

-- Presentismo: consulta para usuarios activos; edición para administrador/operador.
drop policy if exists presentismo_select_authenticated on public.presentismo;
drop policy if exists presentismo_insert_authenticated on public.presentismo;
drop policy if exists presentismo_update_authenticated on public.presentismo;
drop policy if exists presentismo_select on public.presentismo;
create policy presentismo_select on public.presentismo
for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = auth.uid() and p.activo));

drop policy if exists presentismo_insert on public.presentismo;
create policy presentismo_insert on public.presentismo
for insert to authenticated
with check (public.rol_actual() in ('administrador','operador'));

drop policy if exists presentismo_update on public.presentismo;
create policy presentismo_update on public.presentismo
for update to authenticated
using (public.rol_actual() in ('administrador','operador'))
with check (public.rol_actual() in ('administrador','operador'));

create index if not exists empleados_apellido_idx on public.empleados (apellido);
create index if not exists empleados_activo_idx on public.empleados (activo);
create index if not exists presentismo_fecha_idx on public.presentismo (fecha);
create index if not exists presentismo_empleado_idx on public.presentismo (empleado_id);

-- IMPORTANTE: luego de crear tu primer usuario en Authentication > Users,
-- convertí ese usuario en administrador ejecutando esta consulta y reemplazando el email:
-- update public.perfiles
-- set rol = 'administrador'
-- where id = (select id from auth.users where email = 'TU_EMAIL@EJEMPLO.COM');
