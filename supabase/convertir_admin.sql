-- Reemplazá el email por el usuario que creaste en Authentication > Users.
update public.perfiles
set rol = 'administrador'
where id = (
  select id from auth.users where email = 'TU_EMAIL@EJEMPLO.COM'
);

-- Comprobación:
select p.nombre, p.rol, p.activo
from public.perfiles p
join auth.users u on u.id = p.id
where u.email = 'TU_EMAIL@EJEMPLO.COM';
