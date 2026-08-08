const form = document.querySelector('#employee-form');
const msg = document.querySelector('#form-message');
const deactivate = document.querySelector('#deactivate');
const reactivate = document.querySelector('#reactivate');
const saveButton = document.querySelector('#save-employee');
const id = new URLSearchParams(location.search).get('id');
const boolFields = ['en_convenio', 'notebook'];
const intFields = ['integrantes_grupo'];
let profile = null;
let employee = null;

function payload() {
  const fd = new FormData(form);
  const out = {};
  for (const [key, raw] of fd.entries()) {
    let value = typeof raw === 'string' ? raw.trim() : raw;
    if (value === '') value = null;
    if (boolFields.includes(key) && value !== null) value = value === 'true';
    if (intFields.includes(key) && value !== null) value = Number(value);
    out[key] = value;
  }
  return out;
}

function setReadOnly() {
  const readOnly = profile?.rol === 'consulta';
  if (!readOnly) return;
  [...form.elements].forEach(el => el.disabled = true);
  saveButton.classList.add('hidden');
  deactivate.classList.add('hidden');
  reactivate.classList.add('hidden');
  showMessage(msg, 'Modo solo consulta.');
}

async function load() {
  profile = await loadCurrentProfile();
  if (!profile) return;

  if (!id) {
    if (profile.rol === 'consulta') {
      location.href = 'empleados.html';
      return;
    }
    return;
  }

  document.querySelector('#form-title').textContent = 'Editar empleado';
  const { data, error } = await db.from('empleados').select('*').eq('id', id).single();
  if (error) {
    showMessage(msg, `Error: ${error.message}`, 'error');
    return;
  }
  employee = data;
  [...form.elements].forEach(el => {
    if (!el.name) return;
    const value = data[el.name];
    if (value === true) el.value = 'true';
    else if (value === false) el.value = 'false';
    else el.value = value ?? '';
  });

  if (data.activo) deactivate.classList.remove('hidden');
  else reactivate.classList.remove('hidden');
  setReadOnly();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (profile?.rol === 'consulta') return;
  showMessage(msg, 'Guardando…');
  const data = payload();
  const result = id
    ? await db.from('empleados').update(data).eq('id', id).select().single()
    : await db.from('empleados').insert(data).select().single();

  if (result.error) {
    showMessage(msg, `Error: ${result.error.message}`, 'error');
    return;
  }
  showMessage(msg, 'Guardado correctamente.', 'success');
  if (!id) location.href = `empleado-form.html?id=${result.data.id}`;
});

deactivate.addEventListener('click', async () => {
  if (!confirm('¿Dar de baja a este empleado? No se eliminará su historial.')) return;
  const { error } = await db.from('empleados').update({
    activo: false,
    fecha_egreso: form.elements.fecha_egreso.value || new Date().toISOString().slice(0, 10)
  }).eq('id', id);
  if (error) showMessage(msg, `Error: ${error.message}`, 'error');
  else location.reload();
});

reactivate.addEventListener('click', async () => {
  if (!confirm('¿Reactivar a este empleado?')) return;
  const { error } = await db.from('empleados').update({ activo: true }).eq('id', id);
  if (error) showMessage(msg, `Error: ${error.message}`, 'error');
  else location.reload();
});

load();
