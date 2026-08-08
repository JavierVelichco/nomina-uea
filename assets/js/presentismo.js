
const PAGE_SIZE = 50;
const BATCH_SIZE = 900;

let profile = null;
let selectedEmployee = null;
let employeeSearchTimer = null;
let listSearchTimer = null;
let noveltyPage = 1;
let noveltyCount = 0;
let noveltyTypes = [];
let currentReport = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function localISO(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso, amount) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localISO(d);
}

function inclusiveDays(from, to) {
  if (!from || !to) return '';
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (b < a) return '';
  return Math.floor((b - a) / 86400000) + 1;
}

function statusForPeriod(from, to) {
  const today = localISO();
  if (from > today) return ['futura', 'Futura'];
  if (to < today) return ['finalizada', 'Finalizada'];
  return ['vigente', 'Vigente'];
}

function formatEmployee(e) {
  return `${e.apellido || ''}, ${e.nombre || ''}`.trim();
}

function safeSearchTerm(value) {
  return String(value || '').replace(/[(),]/g, ' ').trim();
}

function setTab(name) {
  $$('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
  $$('.tab-content').forEach(el => el.classList.add('hidden'));
  $(`#tab-${name}`)?.classList.remove('hidden');
  if (name === 'consulta') loadNoveltyList();
  if (name === 'feriados') loadHolidays();
}

$$('.tab-button').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

async function loadTypes() {
  const { data, error } = await db.from('tipos_novedad').select('*').eq('activo', true).order('orden');
  if (error) throw error;
  noveltyTypes = data || [];

  const options = noveltyTypes.map(t => `<option value="${escapeHtml(t.codigo)}">${escapeHtml(t.codigo)} · ${escapeHtml(t.nombre)}</option>`).join('');
  $('#novelty-type').innerHTML = `<option value="">Seleccionar</option>${options}`;
  $('#novelty-filter-type').innerHTML = `<option value="">Todos</option>${options}`;
}

function toggleSubtype() {
  const type = noveltyTypes.find(t => t.codigo === $('#novelty-type').value);
  $('#subtype-wrap').classList.toggle('hidden', !type?.requiere_subtipo);
  if (!type?.requiere_subtipo) $('#novelty-subtype').value = '';
}

$('#novelty-type').addEventListener('change', toggleSubtype);

async function searchEmployees(term, target = 'employee-results') {
  const q = safeSearchTerm(term);
  const box = $(`#${target}`);
  if (!q) {
    box.innerHTML = '';
    return [];
  }

  let query = db.from('empleados')
    .select('id,legajo,nombre,apellido,cuil,sector,activo')
    .or(`legajo.ilike.%${q}%,cuil.ilike.%${q}%,apellido.ilike.%${q}%,nombre.ilike.%${q}%`)
    .order('apellido')
    .order('nombre')
    .limit(20);

  const { data, error } = await query;
  if (error) {
    box.innerHTML = `<div class="message error">${escapeHtml(error.message)}</div>`;
    return [];
  }
  return data || [];
}

$('#employee-search').addEventListener('input', () => {
  clearTimeout(employeeSearchTimer);
  employeeSearchTimer = setTimeout(async () => {
    const rows = await searchEmployees($('#employee-search').value);
    $('#employee-results').innerHTML = rows.map(e => `
      <button type="button" class="search-result" data-id="${e.id}">
        <strong>${escapeHtml(formatEmployee(e))}</strong>
        <small>Legajo ${escapeHtml(e.legajo)} · CUIL ${escapeHtml(e.cuil)} · ${escapeHtml(e.sector || 'Sin sector')}${e.activo ? '' : ' · INACTIVO'}</small>
      </button>`).join('') || '<div class="muted small-text">Sin resultados.</div>';

    $$('#employee-results .search-result').forEach(btn => btn.addEventListener('click', () => {
      const e = rows.find(x => x.id === btn.dataset.id);
      selectEmployee(e);
    }));
  }, 250);
});

function selectEmployee(e) {
  selectedEmployee = e;
  $('#employee-search').value = '';
  $('#employee-results').innerHTML = '';
  $('#selected-employee').classList.remove('hidden');
  $('#selected-employee').innerHTML = `
    <strong>${escapeHtml(formatEmployee(e))}</strong>
    <small>Legajo ${escapeHtml(e.legajo)} · CUIL ${escapeHtml(e.cuil)} · ${escapeHtml(e.sector || 'Sin sector')}</small>`;
  checkOverlap();
}

function resetNoveltyForm() {
  $('#novelty-id').value = '';
  $('#novelty-form').reset();
  $('#novelty-form-title').textContent = 'Nueva novedad';
  $('#cancel-edit').classList.add('hidden');
  $('#selected-employee').classList.add('hidden');
  $('#selected-employee').innerHTML = '';
  selectedEmployee = null;
  $('#overlap-warning').classList.add('hidden');
  $('#overlap-warning').textContent = '';
  toggleSubtype();
}

$('#cancel-edit').addEventListener('click', resetNoveltyForm);

['#date-from','#date-to'].forEach(sel => $(sel).addEventListener('change', () => {
  const suggested = inclusiveDays($('#date-from').value, $('#date-to').value);
  if (suggested && !$('#workdays').value) $('#workdays').value = suggested;
  checkOverlap();
}));

async function checkOverlap(ignoreId = null) {
  const employeeId = selectedEmployee?.id;
  const from = $('#date-from').value;
  const to = $('#date-to').value;
  const warning = $('#overlap-warning');

  if (!employeeId || !from || !to || to < from) {
    warning.classList.add('hidden');
    return;
  }

  let query = db.from('novedades')
    .select('id,tipo_codigo,fecha_desde,fecha_hasta')
    .eq('empleado_id', employeeId)
    .lte('fecha_desde', to)
    .gte('fecha_hasta', from);

  if (ignoreId) query = query.neq('id', ignoreId);

  const { data, error } = await query;
  if (error || !data?.length) {
    warning.classList.add('hidden');
    return;
  }

  warning.textContent = `Atención: existe ${data.length} novedad(es) que se superponen con este período: ` +
    data.map(x => `${x.tipo_codigo} ${formatDate(x.fecha_desde)}–${formatDate(x.fecha_hasta)}`).join(', ');
  warning.classList.remove('hidden');
}

$('#novelty-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (profile?.rol === 'consulta') return;

  if (!selectedEmployee) {
    showMessage($('#novelty-message'), 'Seleccioná un empleado.', 'error');
    return;
  }

  const from = $('#date-from').value;
  const to = $('#date-to').value;
  if (!from || !to || to < from) {
    showMessage($('#novelty-message'), 'Revisá las fechas desde/hasta.', 'error');
    return;
  }

  const payload = {
    empleado_id: selectedEmployee.id,
    tipo_codigo: $('#novelty-type').value,
    subtipo: $('#novelty-subtype').value || null,
    fecha_desde: from,
    fecha_hasta: to,
    jornadas: $('#workdays').value ? Number($('#workdays').value) : null,
    origen: $('#novelty-origin').value || null,
    fecha_evento: $('#event-date').value || null,
    fecha_atencion: $('#attention-date').value || null,
    proxima_revision: $('#review-date').value || null,
    observacion: $('#novelty-notes').value.trim() || null
  };

  if (!payload.tipo_codigo) {
    showMessage($('#novelty-message'), 'Seleccioná el tipo de novedad.', 'error');
    return;
  }

  const id = $('#novelty-id').value;
  showMessage($('#novelty-message'), id ? 'Actualizando…' : 'Guardando…');

  const response = id
    ? await db.from('novedades').update(payload).eq('id', id)
    : await db.from('novedades').insert(payload);

  if (response.error) {
    showMessage($('#novelty-message'), `Error: ${response.error.message}`, 'error');
    return;
  }

  showMessage($('#novelty-message'), id ? 'Novedad actualizada.' : 'Novedad guardada.', 'success');
  resetNoveltyForm();
});

function applyPeriodStatus(query, status) {
  const today = localISO();
  if (status === 'vigente') return query.lte('fecha_desde', today).gte('fecha_hasta', today);
  if (status === 'futura') return query.gt('fecha_desde', today);
  if (status === 'finalizada') return query.lt('fecha_hasta', today);
  return query;
}

async function employeeIdsMatching(term) {
  const q = safeSearchTerm(term);
  if (!q) return null;

  const ids = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('empleados')
      .select('id')
      .or(`legajo.ilike.%${q}%,cuil.ilike.%${q}%,apellido.ilike.%${q}%,nombre.ilike.%${q}%`)
      .range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    ids.push(...(data || []).map(x => x.id));
    if (!data || data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }
  return ids;
}

async function loadNoveltyList({ resetPage = false } = {}) {
  if (resetPage) noveltyPage = 1;
  showMessage($('#novelty-list-message'), 'Cargando…');

  try {
    const term = $('#novelty-search').value.trim();
    const ids = await employeeIdsMatching(term);
    if (ids && ids.length === 0) {
      noveltyCount = 0;
      $('#novelty-body').innerHTML = '<tr><td colspan="8" class="empty-row">No hay resultados.</td></tr>';
      renderNoveltyPagination();
      showMessage($('#novelty-list-message'), '');
      return;
    }

    const from = (noveltyPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = db.from('novedades')
      .select('id,empleado_id,tipo_codigo,subtipo,fecha_desde,fecha_hasta,jornadas,origen,fecha_evento,fecha_atencion,proxima_revision,observacion,empleados!inner(id,legajo,nombre,apellido,cuil,sector)', { count: 'exact' });

    const type = $('#novelty-filter-type').value;
    if (type) query = query.eq('tipo_codigo', type);
    if (ids) query = query.in('empleado_id', ids);
    query = applyPeriodStatus(query, $('#novelty-filter-status').value);

    const { data, error, count } = await query
      .order('fecha_desde', { ascending: false })
      .range(from, to);

    if (error) throw error;
    noveltyCount = count ?? 0;
    const rows = data || [];

    $('#novelty-body').innerHTML = rows.length ? rows.map(n => {
      const [status, statusLabel] = statusForPeriod(n.fecha_desde, n.fecha_hasta);
      const subtype = n.subtipo ? ` · ${escapeHtml(n.subtipo)}` : '';
      return `<tr>
        <td><strong>${escapeHtml(formatEmployee(n.empleados))}</strong><br><small>Legajo ${escapeHtml(n.empleados.legajo)} · ${escapeHtml(n.empleados.sector || '')}</small></td>
        <td><strong>${escapeHtml(n.tipo_codigo)}</strong>${subtype}</td>
        <td>${formatDate(n.fecha_desde)}</td>
        <td>${formatDate(n.fecha_hasta)}</td>
        <td>${n.jornadas ?? '—'}</td>
        <td>${escapeHtml(n.origen || '—')}</td>
        <td><span class="badge status-${status}">${statusLabel}</span></td>
        <td><button class="btn secondary small edit-novelty" type="button" data-id="${n.id}">Abrir</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" class="empty-row">No hay novedades para mostrar.</td></tr>';

    rows.forEach(n => {
      $(`.edit-novelty[data-id="${n.id}"]`)?.addEventListener('click', () => editNovelty(n));
    });

    renderNoveltyPagination();
    showMessage($('#novelty-list-message'), '');
  } catch (error) {
    showMessage($('#novelty-list-message'), `Error: ${error.message}`, 'error');
  }
}

function renderNoveltyPagination() {
  const pages = Math.max(1, Math.ceil(noveltyCount / PAGE_SIZE));
  if (noveltyPage > pages) noveltyPage = pages;
  const first = noveltyCount ? (noveltyPage - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(noveltyPage * PAGE_SIZE, noveltyCount);
  $('#novelty-page-info').textContent = noveltyCount ? `${first}–${last} de ${noveltyCount} · Página ${noveltyPage} de ${pages}` : 'Sin resultados';
  $('#novelty-prev').disabled = noveltyPage <= 1;
  $('#novelty-next').disabled = noveltyPage >= pages;
}

function editNovelty(n) {
  selectedEmployee = n.empleados;
  $('#selected-employee').classList.remove('hidden');
  $('#selected-employee').innerHTML = `<strong>${escapeHtml(formatEmployee(n.empleados))}</strong><small>Legajo ${escapeHtml(n.empleados.legajo)} · CUIL ${escapeHtml(n.empleados.cuil)} · ${escapeHtml(n.empleados.sector || 'Sin sector')}</small>`;

  $('#novelty-id').value = n.id;
  $('#novelty-type').value = n.tipo_codigo;
  toggleSubtype();
  $('#novelty-subtype').value = n.subtipo || '';
  $('#date-from').value = n.fecha_desde;
  $('#date-to').value = n.fecha_hasta;
  $('#workdays').value = n.jornadas ?? '';
  $('#novelty-origin').value = n.origen || '';
  $('#event-date').value = n.fecha_evento || '';
  $('#attention-date').value = n.fecha_atencion || '';
  $('#review-date').value = n.proxima_revision || '';
  $('#novelty-notes').value = n.observacion || '';
  $('#novelty-form-title').textContent = 'Editar novedad';
  $('#cancel-edit').classList.remove('hidden');
  setTab('carga');
  checkOverlap(n.id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#novelty-refresh').addEventListener('click', () => loadNoveltyList({ resetPage: true }));
$('#novelty-filter-type').addEventListener('change', () => loadNoveltyList({ resetPage: true }));
$('#novelty-filter-status').addEventListener('change', () => loadNoveltyList({ resetPage: true }));
$('#novelty-search').addEventListener('input', () => {
  clearTimeout(listSearchTimer);
  listSearchTimer = setTimeout(() => loadNoveltyList({ resetPage: true }), 300);
});
$('#novelty-prev').addEventListener('click', () => { if (noveltyPage > 1) { noveltyPage--; loadNoveltyList(); }});
$('#novelty-next').addEventListener('click', () => {
  const pages = Math.max(1, Math.ceil(noveltyCount / PAGE_SIZE));
  if (noveltyPage < pages) { noveltyPage++; loadNoveltyList(); }
});

async function fetchAll(table, select, configure = q => q) {
  const all = [];
  let start = 0;
  while (true) {
    let query = db.from(table).select(select);
    query = configure(query);
    const { data, error } = await query.range(start, start + BATCH_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < BATCH_SIZE) break;
    start += BATCH_SIZE;
  }
  return all;
}

function datesBetween(from, to) {
  const result = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) result.push(d);
  return result;
}

async function buildReport() {
  const from = $('#report-from').value;
  const to = $('#report-to').value;
  if (!from || !to || to < from) throw new Error('Revisá las fechas del reporte.');

  const dates = datesBetween(from, to);
  if (dates.length > 92) throw new Error('Para una vista legible, generá períodos de hasta 92 días.');

  showMessage($('#report-message'), 'Generando reporte…');

  const employeeScope = $('#report-scope').value;
  const [employees, novelties, holidays] = await Promise.all([
    fetchAll('empleados', 'id,legajo,nombre,apellido,cuil,sector,activo', q => {
      q = q.order('apellido').order('nombre');
      return employeeScope === 'active' ? q.eq('activo', true) : q;
    }),
    fetchAll('novedades', 'empleado_id,tipo_codigo,fecha_desde,fecha_hasta', q =>
      q.lte('fecha_desde', to).gte('fecha_hasta', from)
    ),
    fetchAll('feriados', 'fecha,descripcion,activo', q =>
      q.eq('activo', true).gte('fecha', from).lte('fecha', to)
    )
  ]);

  const holidayMap = new Map(holidays.map(h => [h.fecha, h.descripcion]));
  const byEmployee = new Map();
  novelties.forEach(n => {
    if (!byEmployee.has(n.empleado_id)) byEmployee.set(n.empleado_id, []);
    byEmployee.get(n.empleado_id).push(n);
  });

  const rows = employees.map(e => {
    const codes = {};
    const employeeNovelties = byEmployee.get(e.id) || [];
    dates.forEach(date => {
      const dayCodes = employeeNovelties
        .filter(n => n.fecha_desde <= date && n.fecha_hasta >= date)
        .map(n => n.tipo_codigo);

      if (holidayMap.has(date)) dayCodes.unshift('F');
      codes[date] = [...new Set(dayCodes)].join('+') || 'SN';
    });
    return { employee: e, codes };
  });

  currentReport = { from, to, dates, rows, holidays };

  $('#report-head').innerHTML = `<tr>
    <th>Legajo</th><th>Apellido</th><th>Nombre</th><th>CUIL</th><th>Sector</th>
    ${dates.map(d => `<th title="${d}">${d.slice(8,10)}/${d.slice(5,7)}</th>`).join('')}
  </tr>`;

  $('#report-body').innerHTML = rows.map(r => `<tr>
    <td>${escapeHtml(r.employee.legajo)}</td>
    <td>${escapeHtml(r.employee.apellido)}</td>
    <td>${escapeHtml(r.employee.nombre)}</td>
    <td>${escapeHtml(r.employee.cuil)}</td>
    <td>${escapeHtml(r.employee.sector || '')}</td>
    ${dates.map(d => `<td class="code-cell">${escapeHtml(r.codes[d])}</td>`).join('')}
  </tr>`).join('');

  $('#report-summary').innerHTML = `
    <span>${rows.length} empleados</span>
    <span>${dates.length} días</span>
    <span>${novelties.length} novedades involucradas</span>
    <span>${holidays.length} feriados</span>`;

  showMessage($('#report-message'), 'Reporte generado.', 'success');
  return currentReport;
}

$('#generate-report').addEventListener('click', async () => {
  try { await buildReport(); }
  catch (error) { showMessage($('#report-message'), `Error: ${error.message}`, 'error'); }
});

$('#export-report').addEventListener('click', async () => {
  try {
    const report = currentReport &&
      currentReport.from === $('#report-from').value &&
      currentReport.to === $('#report-to').value
      ? currentReport : await buildReport();

    const data = report.rows.map(r => {
      const row = {
        Legajo: r.employee.legajo,
        Apellido: r.employee.apellido,
        Nombre: r.employee.nombre,
        CUIL: r.employee.cuil,
        Sector: r.employee.sector || ''
      };
      report.dates.forEach(d => row[d] = r.codes[d]);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!freeze'] = { xSplit: 5, ySplit: 1 };
    ws['!cols'] = [
      {wch:12},{wch:20},{wch:20},{wch:18},{wch:24},
      ...report.dates.map(() => ({wch:11}))
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte diario');
    XLSX.writeFile(wb, `reporte_novedades_${report.from}_${report.to}.xlsx`);
  } catch (error) {
    showMessage($('#report-message'), `Error: ${error.message}`, 'error');
  }
});

$('#holiday-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (profile?.rol === 'consulta') return;

  const fecha = $('#holiday-date').value;
  const descripcion = $('#holiday-description').value.trim();
  if (!fecha || !descripcion) return;

  const { error } = await db.from('feriados').upsert(
    { fecha, descripcion, activo: true },
    { onConflict: 'fecha' }
  );

  if (error) showMessage($('#holiday-message'), `Error: ${error.message}`, 'error');
  else {
    showMessage($('#holiday-message'), 'Feriado guardado.', 'success');
    $('#holiday-form').reset();
    loadHolidays();
  }
});

async function loadHolidays() {
  const { data, error } = await db.from('feriados')
    .select('id,fecha,descripcion,activo')
    .eq('activo', true)
    .order('fecha', { ascending: false })
    .limit(200);

  if (error) {
    showMessage($('#holiday-message'), `Error: ${error.message}`, 'error');
    return;
  }

  $('#holiday-body').innerHTML = (data || []).length ? data.map(h => `
    <tr>
      <td>${formatDate(h.fecha)}</td>
      <td>${escapeHtml(h.descripcion)}</td>
      <td>${profile?.rol === 'administrador' ? `<button class="btn danger small delete-holiday" data-id="${h.id}" type="button">Eliminar</button>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="3" class="empty-row">No hay feriados cargados.</td></tr>';

  $$('.delete-holiday').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este feriado?')) return;
    const { error } = await db.from('feriados').delete().eq('id', btn.dataset.id);
    if (error) showMessage($('#holiday-message'), `Error: ${error.message}`, 'error');
    else loadHolidays();
  }));
}

function applyPermissions() {
  if (profile?.rol !== 'consulta') return;
  $('#novelty-form').querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
  $('#holiday-form').querySelectorAll('input,button').forEach(el => el.disabled = true);
}

(async () => {
  profile = await loadCurrentProfile();
  if (!profile) return;

  $('#current-role').textContent = `Rol: ${profile.rol}`;
  await loadTypes();

  const today = localISO();
  $('#date-from').value = today;
  $('#date-to').value = today;
  $('#report-from').value = `${today.slice(0,7)}-01`;
  $('#report-to').value = today;

  applyPermissions();
})();
