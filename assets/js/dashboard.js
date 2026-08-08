const dashboardMessage = document.querySelector('#dashboard-message');

function startOfMonthISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

async function loadDashboard() {
  const profile = await loadCurrentProfile();
  if (!profile) return;

  document.querySelector('#user-name').textContent = profile.nombre || 'Usuario';
  document.querySelector('#current-role').textContent = `Rol: ${profile.rol}`;
  if (profile.rol === 'consulta') document.querySelector('#quick-new')?.classList.add('hidden');

  showMessage(dashboardMessage, 'Cargando información…');

  const [allRes, activeRes, inactiveRes, monthRes, latestRes] = await Promise.all([
    db.from('empleados').select('*', { count: 'exact', head: true }),
    db.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', true),
    db.from('empleados').select('*', { count: 'exact', head: true }).eq('activo', false),
    db.from('empleados').select('*', { count: 'exact', head: true }).gte('fecha_ingreso', startOfMonthISO()),
    db.from('empleados').select('id,legajo,nombre,apellido,sector,fecha_ingreso').not('fecha_ingreso','is',null).order('fecha_ingreso',{ascending:false}).limit(5)
  ]);

  const error = [allRes, activeRes, inactiveRes, monthRes, latestRes].find(r => r.error)?.error;
  if (error) {
    showMessage(dashboardMessage, `Error al cargar el dashboard: ${error.message}`, 'error');
    return;
  }

  document.querySelector('#dash-total').textContent = allRes.count ?? 0;
  document.querySelector('#dash-active').textContent = activeRes.count ?? 0;
  document.querySelector('#dash-inactive').textContent = inactiveRes.count ?? 0;
  document.querySelector('#dash-new').textContent = monthRes.count ?? 0;

  const latestBody = document.querySelector('#latest-body');
  const rows = latestRes.data || [];
  latestBody.innerHTML = rows.length ? rows.map(e => `
    <tr>
      <td>${escapeHtml(e.legajo)}</td>
      <td><a href="empleado-form.html?id=${encodeURIComponent(e.id)}"><strong>${escapeHtml(e.apellido)}, ${escapeHtml(e.nombre)}</strong></a></td>
      <td>${escapeHtml(e.sector || '—')}</td>
      <td>${formatDate(e.fecha_ingreso)}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty-row">Todavía no hay empleados cargados.</td></tr>';

  showMessage(dashboardMessage, '');
}

loadDashboard();
