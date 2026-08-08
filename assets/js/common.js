window.escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[c]));

window.formatDate = value => value
  ? new Intl.DateTimeFormat('es-AR').format(new Date(`${value}T00:00:00`))
  : '—';

window.showMessage = (node, text, kind = '') => {
  if (!node) return;
  node.textContent = text;
  node.className = `message ${kind}`.trim();
};

window.requireSession = async () => {
  if (!window.APP_CONFIGURED) {
    alert('Falta configurar Supabase en assets/js/config.js');
    location.href = 'index.html';
    return null;
  }
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) {
    location.href = 'index.html';
    return null;
  }
  return data.session;
};

window.loadCurrentProfile = async () => {
  const session = await requireSession();
  if (!session) return null;
  const { data, error } = await db
    .from('perfiles')
    .select('id,nombre,rol,activo')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error) console.warn(error.message);
  return data || { id: session.user.id, nombre: session.user.email, rol: 'consulta', activo: true };
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#logout')?.addEventListener('click', async () => {
    await db.auth.signOut();
    location.href = 'index.html';
  });
});
