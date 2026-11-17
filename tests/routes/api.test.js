'use strict';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Session = require('../../src/models/Session');
const Product = require('../../src/models/Product');
const { createApp } = require('../../src/app');
const { user, product, productInput, cookie } = require('../helpers');
const AppError = require('../../src/utils/AppError');

describe('Rutas Express con dependencias de persistencia simuladas', () => {
  let app;
  beforeEach(() => {
    app = createApp({ connectDatabase: async () => ({ db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) } }), authRateLimit: false });
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockResolvedValue(user);
    jest.spyOn(User, 'findById').mockResolvedValue(user);
    jest.spyOn(User, 'findOne').mockReturnValue({ select: jest.fn().mockResolvedValue({ ...user, passwordHash: 'hash' }) });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    jest.spyOn(Session, 'create').mockResolvedValue({});
    jest.spyOn(Session, 'findOne').mockResolvedValue({ tokenId: 'session-test-01' });
    jest.spyOn(Session, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Product, 'create').mockResolvedValue(product);
    jest.spyOn(Product, 'findOne').mockResolvedValue(product);
    jest.spyOn(Product, 'findOneAndUpdate').mockResolvedValue({ ...product, name: 'Actualizado' });
    jest.spyOn(Product, 'findOneAndDelete').mockResolvedValue(product);
    jest.spyOn(Product, 'find').mockReturnValue({ sort: () => ({ skip: () => ({ limit: async () => [product] }) }) });
    jest.spyOn(Product, 'countDocuments').mockResolvedValue(1);
  });

  test('registro responde 201 con cookie HttpOnly y datos públicos', async () => {
    const result = await request(app).post('/api/auth/register').send({ name: user.name, email: user.email, password: 'Segura123!' });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ user: { id: user._id, name: user.name, email: user.email } });
    expect(result.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(result.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect(result.headers['cache-control']).toBe('no-store');
  });

  test('registro inválido se detiene antes del controlador', async () => {
    const result = await request(app).post('/api/auth/register').send({ name: 'A', email: 'incorrecto', password: 'corta' });
    expect(result.status).toBe(400);
    expect(result.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));
    expect(User.create).not.toHaveBeenCalled();
  });

  test('login incorrecto devuelve 401 sin cookie', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const result = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Incorrecta123!' });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(result.headers['set-cookie']).toBeUndefined();
  });

  test('me expone únicamente la identidad de sesión', async () => {
    const result = await request(app).get('/api/auth/me').set('Cookie', cookie());
    expect(result.status).toBe(200);
    expect(result.body.user).toEqual({ id: user._id, name: user.name, email: user.email });
  });

  test('logout devuelve 204 y elimina cookie al revocar', async () => {
    const result = await request(app).post('/api/auth/logout').set('Cookie', cookie());
    expect(result.status).toBe(204);
    expect(result.text).toBe('');
    expect(Session.deleteOne).toHaveBeenCalledWith({ user: user._id, tokenId: 'session-test-01' });
    expect(result.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  test.each([
    ['get', '/api/products'], ['get', `/api/products/${product._id}`],
    ['post', '/api/products'], ['put', `/api/products/${product._id}`], ['delete', `/api/products/${product._id}`],
  ])('%s %s requiere autenticación', async (method, path) => {
    const result = await request(app)[method](path).send(productInput);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('AUTH_REQUIRED');
    expect(Product.create).not.toHaveBeenCalled();
    expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Product.findOneAndDelete).not.toHaveBeenCalled();
  });

  test('crear producto atraviesa validación y establece el propietario real', async () => {
    const result = await request(app).post('/api/products').set('Cookie', cookie()).send(productInput);
    expect(result.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({ sku: 'TEC-01', priceInCents: 25990, owner: user._id }));
    expect(result.body.product.price).toBe(259.9);
  });

  test('listar permite filtros y devuelve metadatos de página', async () => {
    const result = await request(app).get('/api/products?q=teclado&category=Tecnolog%C3%ADa&page=1&limit=10').set('Cookie', cookie());
    expect(result.status).toBe(200);
    expect(result.body.products).toHaveLength(1);
    expect(result.body.pagination).toEqual({ page: 1, limit: 10, total: 1, pages: 1 });
  });

  test.each([['get', 200], ['put', 200], ['delete', 204]])('%s producto protegido responde HTTP %i', async (method, expectedStatus) => {
    const result = await request(app)[method](`/api/products/${product._id}`).set('Cookie', cookie()).send(productInput);
    expect(result.status).toBe(expectedStatus);
  });

  test.each([['get', 'findOne'], ['put', 'findOneAndUpdate'], ['delete', 'findOneAndDelete']])('%s producto ajeno responde 404', async (method, modelMethod) => {
    Product[modelMethod].mockResolvedValue(null);
    const result = await request(app)[method](`/api/products/${product._id}`).set('Cookie', cookie()).send(productInput);
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('rechaza cambio de propietario desde cliente', async () => {
    const result = await request(app).put(`/api/products/${product._id}`).set('Cookie', cookie()).send({ ...productInput, owner: '507f1f77bcf86cd799439099' });
    expect(result.status).toBe(400);
    expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('ID inválido devuelve 400 sin consulta del producto', async () => {
    const result = await request(app).get('/api/products/no-es-object-id').set('Cookie', cookie());
    expect(result.status).toBe(400);
    expect(Product.findOne).not.toHaveBeenCalled();
  });

  test('duplicado de índice único se expresa como conflicto 409', async () => {
    Product.create.mockRejectedValue({ code: 11000, keyPattern: { owner: 1, sku: 1 } });
    const result = await request(app).post('/api/products').set('Cookie', cookie()).send(productInput);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('DUPLICATE_VALUE');
  });

  test('un fallo inesperado del controlador devuelve 500 sin stack ni secretos', async () => {
    Product.findOne.mockRejectedValue(new Error('mongodb://usuario:clave-secreta@host/db'));
    const result = await request(app).get(`/api/products/${product._id}`).set('Cookie', cookie());
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toMatch(/mongodb|clave-secreta|stack/);
  });

  test('caída de conexión devuelve 503 sin ejecutar controladores', async () => {
    const failing = createApp({ connectDatabase: async () => { throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Base no disponible.'); }, authRateLimit: false });
    const result = await request(failing).post('/api/auth/login').send({ email: user.email, password: 'Segura123!' });
    expect(result.status).toBe(503);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('health comprueba disponibilidad e informa estado sin credenciales', async () => {
    const result = await request(app).get('/api/health');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok', database: 'connected' });
  });

  test('cuerpo JSON incorrecto produce 400', async () => {
    const result = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('INVALID_JSON');
  });

  test('cuerpo excesivo produce 413 antes de acceder a la base', async () => {
    const result = await request(app).post('/api/auth/login').send({ email: 'x'.repeat(17000) });
    expect(result.status).toBe(413);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('formulario urlencoded no aceptado para autenticación JSON', async () => {
    const result = await request(app).post('/api/auth/login').type('form').send({ email: user.email, password: 'Segura123!' });
    expect(result.status).toBe(415);
  });

  test.each([
    { Origin: 'https://sitio-ajeno.example' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('bloquea escritura desde otro origen %j', async headers => {
    const result = await request(app).post('/api/products').set('Cookie', cookie()).set(headers).send(productInput);
    expect(result.status).toBe(403);
    expect(Product.create).not.toHaveBeenCalled();
  });

  test('permite solicitud enviada desde el origen configurado', async () => {
    const result = await request(app).post('/api/products').set('Cookie', cookie()).set('Origin', 'http://localhost:3000').send(productInput);
    expect(result.status).toBe(201);
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(result.headers['content-security-policy']).toMatch(/script-src 'self'/);
  });

  test('ruta no existente produce 404 JSON', async () => {
    const result = await request(app).get('/api/desconocida');
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('rechaza configuración incompleta en lugar de firmar con secreto débil', async () => {
    const previous = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'corta';
      const result = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Segura123!' });
      expect(result.status).toBe(503);
      expect(result.body.error.code).toBe('CONFIGURATION_REQUIRED');
    } finally { process.env.JWT_SECRET = previous; }
  });

  test('limita intentos de autenticación consecutivos', async () => {
    const limited = createApp({ connectDatabase: async () => ({}) });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await request(limited).post('/api/auth/login').send({});
      expect(response.status).toBe(400);
    }
    const result = await request(limited).post('/api/auth/login').send({});
    expect(result.status).toBe(429);
    expect(result.body.error.code).toBe('RATE_LIMITED');
  });
});
