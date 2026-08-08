const dateInput = document.querySelector('#attendance-date');
const body = document.querySelector('#attendance-body');
const message = document.querySelector('#attendance-message');
const saveButton = document.querySelector('#save-attendance');
let employees = [];
let profile = null;

const states = [
  ['presente', 'Presente'], ['ausente', 'Ausente'], ['tarde', 'Tarde'],
  ['licencia', 'Licencia'], ['vacaciones', 'Vacaciones'], ['franco', 'Franco'],
  ['feriado', 'Feriado'], ['retiro_anticipado', 'Retiro anticipado']
];

function stateOptions(selected = '') {
  return states.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
}

async function loadDay() {
  showMessage(message, 'Cargando…');
  const date = dateInput.value;
  const [{ data: employeeData, error: employeeError }, { data: attendanceData, error: attendanceError }] = await Promise.all([
    db.from('empleados').select('id,legajo,apellido,nombre,hora_entrada,hora_salida').eq('activo', true).order('apellido').order('nombre'),
    db.from('presentismo').select('*').eq('fecha', date)
  ]);

  if (employeeError || attendanceError) {
    showMessage(message, `Error: ${(employeeError || attendanceError).message}`, 'error');
    return;
  }

  employees = employeeData || [];
  const byEmployee = new Map((attendanceData || []).map(x => [x.empleado_id, x]));
  body.innerHTML = employees.length ? employees.map(e => {
    const a = byEmployee.get(e.id) || {};
    return `<tr data-employee-id="${e.id}">
      <td>${escapeHtml(e.legajo)}</td>
      <td><strong>${escapeHtml(e.apellido)}, ${escapeHtml(e.nombre)}</strong></td>
      <td><select class="attendance-state">${stateOptions(a.estado || 'presente')}</select></td>
      <td><input class="attendance-in" type="time" value="${escapeHtml(a.hora_entrada_real || '')}"></td>
      <td><input class="attendance-out" type="time" value="${escapeHtml(a.hora_salida_real || '')}"></td>
      <td><input class="attendance-notes" value="${escapeHtml(a.observacion || '')}" placeholder="Observación"></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-row">No hay empleados activos.</td></tr>';

  if (profile?.rol === 'consulta') {
    body.querySelectorAll('input,select').forEach(el => el.disabled = true);
    saveButton.classList.add('hidden');
  }
  showMessage(message, `${employees.length} empleados cargados.`);
}

saveButton.addEventListener('click', async () => {
  if (profile?.rol === 'consulta') return;
  showMessage(message, 'Guardando presentismo…');
  const rows = [...body.querySelectorAll('tr[data-employee-id]')].map(row => ({
    empleado_id: row.dataset.employeeId,
    fecha: dateInput.value,
    estado: row.querySelector('.attendance-state').value,
    hora_entrada_real: row.querySelector('.attendance-in').value || null,
    hora_salida_real: row.querySelector('.attendance-out').value || null,
    observacion: row.querySelector('.attendance-notes').value.trim() || null
  }));
  const { error } = await db.from('presentismo').upsert(rows, { onConflict: 'empleado_id,fecha' });
  if (error) showMessage(message, `Error: ${error.message}`, 'error');
  else showMessage(message, 'Presentismo guardado.', 'success');
});

dateInput.addEventListener('change', loadDay);

(async () => {
  profile = await loadCurrentProfile();
  if (!profile) return;
  dateInput.value = new Date().toISOString().slice(0, 10);
  await loadDay();
})();
