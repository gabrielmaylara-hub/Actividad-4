'use strict';

(() => {
  const { api, feedback, clearFeedback, setFormBusy } = window.ProductApp;
  const form = document.querySelector('#auth-form');
  const message = document.querySelector('#auth-feedback');
  const name = document.querySelector('#name');
  const email = document.querySelector('#email');
  const password = document.querySelector('#password');
  const submit = document.querySelector('#auth-submit');
  const loginTab = document.querySelector('#login-tab');
  const registerTab = document.querySelector('#register-tab');
  let mode = 'login';
  let busy = false;

  function setMode(nextMode) {
    if (busy) return;
    mode = nextMode;
    const register = mode === 'register';
    clearFeedback(message);
    document.querySelector('#name-field').hidden = !register;
    name.disabled = !register;
    name.required = register;
    password.minLength = register ? 8 : 1;
    password.autocomplete = register ? 'new-password' : 'current-password';
    password.setCustomValidity('');
    loginTab.classList.toggle('active', !register);
    registerTab.classList.toggle('active', register);
    loginTab.setAttribute('aria-pressed', String(!register));
    registerTab.setAttribute('aria-pressed', String(register));
    document.querySelector('#auth-title').textContent = register ? 'Crea tu cuenta' : 'Bienvenido';
    document.querySelector('#auth-description').textContent = register ? 'Regístrate para comenzar tu catálogo personal.' : 'Inicia sesión para administrar tus productos.';
    document.querySelector('#password-help').textContent = register ? 'Usa al menos 8 caracteres.' : 'Escribe la contraseña de tu cuenta.';
    document.querySelector('#auth-note').textContent = register ? 'Al crear tu cuenta podrás agregar tu primer producto.' : 'Tus productos estarán disponibles después de iniciar sesión.';
    submit.textContent = register ? 'Crear cuenta' : 'Iniciar sesión';
    document.title = `${register ? 'Crear cuenta' : 'Iniciar sesión'} | Productos`;
    (register ? name : email).focus();
  }

  loginTab.addEventListener('click', () => setMode('login'));
  registerTab.addEventListener('click', () => setMode('register'));
  document.querySelector('#toggle-password').addEventListener('click', (event) => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
    event.currentTarget.setAttribute('aria-pressed', String(show));
    event.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  password.addEventListener('input', () => password.setCustomValidity(''));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    clearFeedback(message);
    if (mode === 'register' && new TextEncoder().encode(password.value).length > 72) {
      password.setCustomValidity('La contraseña es demasiado larga. Prueba con menos caracteres.');
    }
    if (!form.reportValidity()) return;
    const body = { email: email.value.trim(), password: password.value };
    if (mode === 'register') body.name = name.value.trim();
    busy = true;
    loginTab.disabled = true;
    registerTab.disabled = true;
    setFormBusy(form, true);
    submit.textContent = mode === 'register' ? 'Creando cuenta…' : 'Ingresando…';
    try {
      await api(`/api/auth/${mode}`, { method: 'POST', body });
      window.location.assign('/products.html');
    } catch (error) {
      feedback(message, error.message, 'error', error.details);
      message.focus();
    } finally {
      busy = false;
      loginTab.disabled = false;
      registerTab.disabled = false;
      setFormBusy(form, false);
      submit.textContent = mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión';
    }
  });

  if (new URLSearchParams(window.location.search).get('session') === 'expired') {
    feedback(message, 'Tu sesión terminó. Inicia sesión nuevamente para continuar.', 'info');
    history.replaceState(null, '', '/');
  }
  // Una sesión vigente vuelve al catálogo; un 401 es normal en esta página.
  api('/api/auth/me').then(() => window.location.replace('/products.html')).catch(() => {});
})();
