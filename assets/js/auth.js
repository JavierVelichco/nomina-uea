const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');

(async () => {
  if (!window.APP_CONFIGURED) {
    showMessage(message, 'Falta configurar Supabase en assets/js/config.js.', 'error');
    return;
  }
  const { data } = await db.auth.getSession();
  if (data.session) location.href = 'dashboard.html';
})();

form.addEventListener('submit', async event => {
  event.preventDefault();
  showMessage(message, 'Ingresando…');
  if (!window.APP_CONFIGURED) {
    showMessage(message, 'Primero configurá Supabase.', 'error');
    return;
  }
  const emailValue = form.elements.email.value.trim();
  const passwordValue = form.elements.password.value;
  const { error } = await db.auth.signInWithPassword({
    email: emailValue,
    password: passwordValue
  });
  if (error) {
    showMessage(message, `No se pudo ingresar: ${error.message}`, 'error');
    return;
  }
  location.href = 'dashboard.html';
});
