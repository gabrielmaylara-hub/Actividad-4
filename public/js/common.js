'use strict';

// La cookie de sesión es HttpOnly: JavaScript no lee ni guarda el JWT.
window.ProductApp = (() => {
  async function api(path, options = {}) {
    const { body, ...rest } = options;
    let response;
    try {
      response = await fetch(path, {
        credentials: 'same-origin',
        ...rest,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.error?.message || 'No se pudo completar la solicitud. Inténtalo de nuevo.');
      error.status = response.status;
      error.code = data?.error?.code;
      error.details = Array.isArray(data?.error?.details) ? data.error.details : [];
      throw error;
    }
    if (!data) throw new Error('El servidor devolvió una respuesta inesperada. Inténtalo de nuevo.');
    return data;
  }

  function feedback(element, message, type = 'error', details = []) {
    element.replaceChildren();
    element.className = `feedback feedback-${type}`;
    const text = document.createElement('p');
    text.textContent = message;
    element.append(text);
    if (details.length) {
      const list = document.createElement('ul');
      for (const detail of details) {
        const item = document.createElement('li');
        item.textContent = detail.message || String(detail);
        list.append(item);
      }
      element.append(list);
    }
    element.hidden = false;
  }

  function clearFeedback(element) {
    element.hidden = true;
    element.replaceChildren();
  }

  function redirectToLogin() {
    window.location.replace('/?session=expired');
  }

  function setFormBusy(form, busy) {
    form.setAttribute('aria-busy', String(busy));
    for (const control of form.querySelectorAll('input, textarea, select, button')) {
      if (busy) {
        control.dataset.wasDisabled = String(control.disabled);
        control.disabled = true;
      } else {
        control.disabled = control.dataset.wasDisabled === 'true';
        delete control.dataset.wasDisabled;
      }
    }
  }

  const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  const integer = new Intl.NumberFormat('es-MX');
  return Object.freeze({ api, feedback, clearFeedback, redirectToLogin, setFormBusy, currency, integer });
})();
