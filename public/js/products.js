'use strict';

(() => {
  const { api, feedback, clearFeedback, redirectToLogin, setFormBusy, currency, integer } = window.ProductApp;
  const byId = (id) => document.getElementById(id);
  const pageFeedback = byId('page-feedback');
  const productDialog = byId('product-dialog');
  const detailDialog = byId('detail-dialog');
  const deleteDialog = byId('delete-dialog');
  const productForm = byId('product-form');
  const productFeedback = byId('product-feedback');
  const deleteFeedback = byId('delete-feedback');
  const fields = Object.fromEntries(['name', 'sku', 'category', 'price', 'stock', 'description'].map((name) => [name, byId(`product-${name}`)]));
  const state = { page: 1, pages: 1, q: '', category: '', editingId: null, detail: null, deleting: null, saving: false, deletingBusy: false, loading: false, requestId: 0, resourceRequestId: 0, abort: null };

  function handleError(error, target = pageFeedback) {
    if (error.status === 401) {
      redirectToLogin();
      return;
    }
    feedback(target, error.message, 'error', error.details);
    if (target !== pageFeedback) target.focus();
  }

  function cell(value, label, className) {
    const td = document.createElement('td');
    td.dataset.label = label;
    if (className) td.className = className;
    td.textContent = value;
    return td;
  }

  function actionButton(text, label, action, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `row-action${danger ? ' row-action-danger' : ''}`;
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      try { await action(); } finally { button.disabled = false; }
    });
    return button;
  }

  function renderProducts(products, pagination) {
    const body = byId('products-body');
    body.replaceChildren();
    for (const product of products) {
      const row = document.createElement('tr');
      const nameCell = cell('', 'Producto', 'product-name-cell');
      const name = document.createElement('strong');
      name.textContent = product.name;
      nameCell.append(name);
      if (product.description) {
        const description = document.createElement('span');
        description.className = 'table-description';
        description.textContent = product.description;
        nameCell.append(description);
      }
      const categoryCell = cell('', 'Categoría');
      const category = document.createElement('span');
      category.className = 'category-tag';
      category.textContent = product.category;
      categoryCell.append(category);
      const stockCell = cell('', 'Existencias', 'stock-cell');
      const stock = document.createElement('span');
      stock.className = `stock-badge${product.stock === 0 ? ' stock-empty' : ''}`;
      stock.textContent = product.stock === 0 ? 'Sin existencias' : `${integer.format(product.stock)} ${product.stock === 1 ? 'unidad' : 'unidades'}`;
      stockCell.append(stock);
      const actions = cell('', 'Acciones', 'row-actions');
      actions.append(
        actionButton('Ver', `Ver detalle de ${product.name}`, () => showDetails(product.id)),
        actionButton('Editar', `Editar ${product.name}`, () => loadEditor(product.id)),
        actionButton('Eliminar', `Eliminar ${product.name}`, () => askDelete(product), true),
      );
      row.append(nameCell, cell(product.sku, 'SKU', 'sku-cell'), categoryCell, cell(currency.format(product.price), 'Precio MXN', 'number-cell'), stockCell, actions);
      body.append(row);
    }
    state.pages = Math.max(1, pagination.pages);
    byId('total-count').textContent = integer.format(pagination.total);
    byId('table-wrap').hidden = products.length === 0;
    byId('empty-state').hidden = products.length !== 0;
    const filtered = Boolean(state.q || state.category);
    byId('empty-title').textContent = filtered ? 'No encontramos productos' : 'Tu catálogo está listo para empezar';
    byId('empty-description').textContent = filtered ? 'Prueba con otro nombre, código SKU o categoría.' : 'Agrega tu primer producto para guardar su precio y sus existencias.';
    byId('empty-add-button').hidden = filtered;
    byId('pagination').hidden = pagination.total === 0;
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = from + products.length - 1;
    byId('pagination-description').textContent = `Mostrando ${integer.format(from)}–${integer.format(to)} de ${integer.format(pagination.total)}`;
    byId('page-number').textContent = `${pagination.page} / ${state.pages}`;
    byId('previous-page').disabled = pagination.page <= 1;
    byId('next-page').disabled = pagination.page >= state.pages;
  }

  async function loadProducts() {
    const requestId = ++state.requestId;
    state.abort?.abort();
    state.abort = new AbortController();
    state.loading = true;
    byId('products-region').setAttribute('aria-busy', 'true');
    byId('list-status').textContent = 'Consultando catálogo…';
    byId('list-error').hidden = true;
    byId('previous-page').disabled = true;
    byId('next-page').disabled = true;
    byId('clear-filters-button').hidden = !(state.q || state.category);
    const query = new URLSearchParams({ page: state.page, limit: 10 });
    if (state.q) query.set('q', state.q);
    if (state.category) query.set('category', state.category);
    try {
      const data = await api(`/api/products?${query}`, { signal: state.abort.signal });
      if (requestId !== state.requestId) return;
      if (data.pagination.total > 0 && state.page > data.pagination.pages) {
        state.page = Math.max(1, data.pagination.pages);
        await loadProducts();
        return;
      }
      if (data.products.length === 0 && state.page > 1) {
        state.page = 1;
        await loadProducts();
        return;
      }
      renderProducts(data.products, data.pagination);
      byId('list-status').textContent = state.q || state.category ? 'Filtros aplicados' : '';
    } catch (error) {
      if (error.name === 'AbortError' || requestId !== state.requestId) return;
      if (error.status === 401) return redirectToLogin();
      byId('table-wrap').hidden = true;
      byId('empty-state').hidden = true;
      byId('pagination').hidden = true;
      byId('list-error').hidden = false;
      byId('list-error-message').textContent = error.message;
      byId('total-count').textContent = '';
      byId('list-status').textContent = '';
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        byId('products-region').setAttribute('aria-busy', 'false');
      }
    }
  }

  function openEditor(product = null) {
    // Una acción nueva descarta respuestas anteriores que aún estén en tránsito.
    state.resourceRequestId += 1;
    state.editingId = product?.id || null;
    productForm.reset();
    clearFeedback(productFeedback);
    for (const [field, input] of Object.entries(fields)) {
      input.removeAttribute('aria-invalid');
      input.setCustomValidity('');
      if (product) input.value = product[field] ?? '';
    }
    byId('product-dialog-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
    byId('save-product-button').textContent = product ? 'Guardar cambios' : 'Guardar producto';
    byId('description-count').textContent = `${fields.description.value.length} / 500 caracteres`;
    productDialog.showModal();
    fields.name.focus();
  }

  async function loadEditor(id) {
    const requestId = ++state.resourceRequestId;
    clearFeedback(pageFeedback);
    try {
      const { product } = await api(`/api/products/${encodeURIComponent(id)}`);
      if (requestId !== state.resourceRequestId) return;
      openEditor(product);
    } catch (error) { if (requestId === state.resourceRequestId) handleError(error); }
  }

  function addDetail(list, title, value, wide = false) {
    const pair = document.createElement('div');
    if (wide) pair.className = 'detail-wide';
    const dt = document.createElement('dt');
    dt.textContent = title;
    const dd = document.createElement('dd');
    dd.textContent = value;
    pair.append(dt, dd);
    list.append(pair);
  }

  async function showDetails(id) {
    const requestId = ++state.resourceRequestId;
    clearFeedback(pageFeedback);
    try {
      const { product } = await api(`/api/products/${encodeURIComponent(id)}`);
      if (requestId !== state.resourceRequestId) return;
      state.detail = product;
      byId('detail-title').textContent = product.name;
      const details = byId('product-details');
      details.replaceChildren();
      addDetail(details, 'Código SKU', product.sku);
      addDetail(details, 'Categoría', product.category);
      addDetail(details, 'Precio en MXN', currency.format(product.price));
      addDetail(details, 'Existencias', `${integer.format(product.stock)} ${product.stock === 1 ? 'unidad' : 'unidades'}`);
      addDetail(details, 'Descripción', product.description || 'Sin descripción.', true);
      const formatter = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      if (product.createdAt) addDetail(details, 'Fecha de registro', formatter.format(new Date(product.createdAt)));
      if (product.updatedAt) addDetail(details, 'Última actualización', formatter.format(new Date(product.updatedAt)));
      detailDialog.showModal();
    } catch (error) { if (requestId === state.resourceRequestId) handleError(error); }
  }

  function askDelete(product) {
    state.resourceRequestId += 1;
    state.deleting = product;
    clearFeedback(deleteFeedback);
    byId('delete-product-name').textContent = `${product.name} (${product.sku})`;
    deleteDialog.showModal();
  }

  function setDialogBusy(dialog, busy) {
    dialog.setAttribute('aria-busy', String(busy));
    for (const button of dialog.querySelectorAll('[data-close]')) button.disabled = busy;
  }

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => byId(button.dataset.close).close());
  });
  productDialog.addEventListener('cancel', (event) => { if (state.saving) event.preventDefault(); });
  deleteDialog.addEventListener('cancel', (event) => { if (state.deletingBusy) event.preventDefault(); });
  byId('new-product-button').addEventListener('click', () => openEditor());
  byId('empty-add-button').addEventListener('click', () => openEditor());
  byId('retry-button').addEventListener('click', loadProducts);
  byId('edit-detail-button').addEventListener('click', () => {
    const product = state.detail;
    detailDialog.close();
    if (product) openEditor(product);
  });
  fields.description.addEventListener('input', () => {
    byId('description-count').textContent = `${fields.description.value.length} / 500 caracteres`;
  });
  for (const input of Object.values(fields)) {
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); input.setCustomValidity(''); });
  }

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.saving) return;
    clearFeedback(productFeedback);
    if (!productForm.reportValidity()) return;
    const body = {
      name: fields.name.value.trim(),
      sku: fields.sku.value.trim().toUpperCase(),
      category: fields.category.value,
      price: Number(fields.price.value),
      stock: Number(fields.stock.value),
      description: fields.description.value.trim(),
    };
    const editing = Boolean(state.editingId);
    const path = editing ? `/api/products/${encodeURIComponent(state.editingId)}` : '/api/products';
    state.saving = true;
    setFormBusy(productForm, true);
    setDialogBusy(productDialog, true);
    byId('save-product-button').textContent = 'Guardando…';
    try {
      await api(path, { method: editing ? 'PUT' : 'POST', body });
      productDialog.close();
      feedback(pageFeedback, editing ? 'Los cambios se guardaron correctamente.' : 'El producto se agregó a tu catálogo.', 'success');
      if (!editing) {
        state.page = 1;
        state.q = '';
        state.category = '';
        byId('filter-form').reset();
      }
      void loadProducts();
    } catch (error) {
      handleError(error, productFeedback);
      for (const detail of error.details || []) fields[detail.field]?.setAttribute('aria-invalid', 'true');
    } finally {
      state.saving = false;
      setFormBusy(productForm, false);
      setDialogBusy(productDialog, false);
      byId('save-product-button').textContent = editing ? 'Guardar cambios' : 'Guardar producto';
    }
  });

  byId('confirm-delete-button').addEventListener('click', async () => {
    if (state.deletingBusy || !state.deleting) return;
    state.deletingBusy = true;
    clearFeedback(deleteFeedback);
    setDialogBusy(deleteDialog, true);
    const button = byId('confirm-delete-button');
    button.disabled = true;
    button.textContent = 'Eliminando…';
    try {
      await api(`/api/products/${encodeURIComponent(state.deleting.id)}`, { method: 'DELETE' });
      deleteDialog.close();
      feedback(pageFeedback, 'El producto se eliminó de tu catálogo.', 'success');
      state.deleting = null;
      void loadProducts();
    } catch (error) { handleError(error, deleteFeedback); }
    finally {
      state.deletingBusy = false;
      setDialogBusy(deleteDialog, false);
      button.disabled = false;
      button.textContent = 'Eliminar producto';
    }
  });

  byId('filter-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.q = byId('search').value.trim();
    state.category = byId('category-filter').value;
    state.page = 1;
    clearFeedback(pageFeedback);
    loadProducts();
  });
  byId('clear-filters-button').addEventListener('click', () => {
    byId('filter-form').reset();
    state.q = '';
    state.category = '';
    state.page = 1;
    clearFeedback(pageFeedback);
    loadProducts();
  });
  byId('previous-page').addEventListener('click', () => {
    if (!state.loading && state.page > 1) { state.page -= 1; loadProducts(); }
  });
  byId('next-page').addEventListener('click', () => {
    if (!state.loading && state.page < state.pages) { state.page += 1; loadProducts(); }
  });
  byId('logout-button').addEventListener('click', async (event) => {
    state.resourceRequestId += 1;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Cerrando sesión…';
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.replace('/');
    } catch (error) {
      handleError(error);
      button.disabled = false;
      button.textContent = 'Cerrar sesión';
    }
  });

  async function initialize() {
    try {
      const { user } = await api('/api/auth/me');
      byId('user-name').textContent = user.name;
      byId('user-name').title = user.email;
      byId('user-avatar').textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      byId('session-status').hidden = true;
      byId('catalog-content').hidden = false;
      byId('account-menu').hidden = false;
      await loadProducts();
    } catch (error) {
      if (error.status === 401) return redirectToLogin();
      const status = byId('session-status');
      status.replaceChildren();
      const text = document.createElement('span');
      text.textContent = error.message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button-secondary';
      retry.textContent = 'Volver a intentar';
      retry.addEventListener('click', () => { status.textContent = 'Verificando tu sesión…'; initialize(); });
      status.append(text, retry);
    }
  }

  initialize();
})();
