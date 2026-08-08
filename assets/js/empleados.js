const body = document.querySelector('#employees-body');
const message = document.querySelector('#employees-message');
const newButton = document.querySelector('#new-employee');

const PAGE_SIZE = 50;

let profile = null;
let visibleRows = [];
let currentPage = 1;
let totalResults = 0;
let searchTimer = null;

function getFilters() {
  return {
    q: document.querySelector('#search').value.trim(),
    status: document.querySelector('#status-filter').value
  };
}

function applyStatus(query, status) {
  if (status === 'active') return query.eq('activo', true);
  if (status === 'inactive') return query.eq('activo', false);
  return query;
}

function applySearch(query, q) {
  if (!q) return query;

  // Evita que caracteres propios de la sintaxis de PostgREST rompan el filtro.
  const safe = q.replace(/[(),]/g, ' ').trim();
  if (!safe) return query;

  return query.or(
    `legajo.ilike.%${safe}%,apellido.ilike.%${safe}%,nombre.ilike.%${safe}%,cuil.ilike.%${safe}%,gerencia.ilike.%${safe}%,sector.ilike.%${safe}%`
  );
}

async function loadGlobalCounts() {
  const [activeRes, inactiveRes] = await Promise.all([
    db.from('empleados').select('id', { count: 'exact', head: true }).eq('activo', true),
    db.from('empleados').select('id', { count: 'exact', head: true }).eq('activo', false)
  ]);

  const error = activeRes.error || inactiveRes.error;
  if (error) throw error;

  document.querySelector('#stat-active').textContent = activeRes.count ?? 0;
  document.querySelector('#stat-inactive').textContent = inactiveRes.count ?? 0;
}

async function loadEmployees({ resetPage = false } = {}) {
  if (resetPage) currentPage = 1;

  showMessage(message, 'Cargando…');

  try {
    const { q, status } = getFilters();
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db
      .from('empleados')
      .select(
        'id,legajo,nombre,apellido,cuil,categoria,gerencia,sector,fecha_ingreso,activo',
        { count: 'exact' }
      );

    query = applyStatus(query, status);
    query = applySearch(query, q);

    const { data, error, count } = await query
      .order('apellido', { ascending: true })
      .order('nombre', { ascending: true })
      .range(from, to);

    if (error) throw error;

    totalResults = count ?? 0;

    // Si una baja/importación dejó la página actual fuera de rango,
    // volvemos automáticamente a la última página válida.
    const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
    if (currentPage > totalPages) {
      currentPage = totalPages;
      return loadEmployees();
    }

    visibleRows = data || [];
    document.querySelector('#stat-results').textContent = totalResults;

    renderRows();
    renderPagination();
    await loadGlobalCounts();

    showMessage(message, '');
  } catch (error) {
    showMessage(message, `Error: ${error.message}`, 'error');
  }
}

function renderRows() {
  body.innerHTML = visibleRows.length ? visibleRows.map(e => `
    <tr>
      <td>${escapeHtml(e.legajo)}</td>
      <td><strong>${escapeHtml(e.apellido)}, ${escapeHtml(e.nombre)}</strong><br><small>${escapeHtml(e.categoria || '')}</small></td>
      <td>${escapeHtml(e.cuil)}</td>
      <td>${escapeHtml(e.gerencia || '—')}<br><small>${escapeHtml(e.sector || '')}</small></td>
      <td>${formatDate(e.fecha_ingreso)}</td>
      <td><span class="badge ${e.activo ? 'ok' : 'off'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td><a class="btn small secondary" href="empleado-form.html?id=${encodeURIComponent(e.id)}">Abrir</a></td>
    </tr>`).join('') :
    '<tr><td colspan="7" class="empty-row">No hay empleados para mostrar.</td></tr>';
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const from = totalResults === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, totalResults);

  document.querySelector('#page-info').textContent =
    totalResults === 0
      ? 'Sin resultados'
      : `Mostrando ${from}–${to} de ${totalResults} · Página ${currentPage} de ${totalPages}`;

  const prev = document.querySelector('#page-prev');
  const next = document.querySelector('#page-next');

  prev.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPages;
}

(async () => {
  profile = await loadCurrentProfile();
  if (!profile) return;

  document.querySelector('#current-role').textContent = `Rol: ${profile.rol}`;
  if (profile.rol === 'consulta') newButton?.classList.add('hidden');

  await loadEmployees();
})();

document.querySelector('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadEmployees({ resetPage: true }), 300);
});

document.querySelector('#status-filter').addEventListener('change', () => {
  loadEmployees({ resetPage: true });
});

document.querySelector('#refresh').addEventListener('click', () => {
  loadEmployees();
});

document.querySelector('#page-prev').addEventListener('click', () => {
  if (currentPage <= 1) return;
  currentPage -= 1;
  loadEmployees();
});

document.querySelector('#page-next').addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  if (currentPage >= totalPages) return;
  currentPage += 1;
  loadEmployees();
});

// Se mantiene esta interfaz porque import-export.js ya la utiliza.
// "Resultados visibles" significa las filas de la página actual.
window.getVisibleEmployeeIds = () => visibleRows.map(e => e.id);
window.reloadEmployeesAfterImport = () => loadEmployees({ resetPage: true });
