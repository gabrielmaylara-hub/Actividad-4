'use strict';

// Estas pruebas usan un proceso MongoDB real. No sustituyen la verificación de Atlas.
// Con TEST_MONGODB_URI se admite exclusivamente una base cuyo nombre contenga _test.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Session = require('../../src/models/Session');
const { createApp } = require('../../src/app');
const { connectDatabase, closeDatabase } = require('../../src/config/database');
const { productInput } = require('../helpers');

let mongo; let app;
const credentials = { name: 'Usuario de prueba', email: 'usuario@example.test', password: 'SeguraDePrueba123!' };

function sessionCookie(result) { return result.headers['set-cookie'][0].split(';')[0]; }
function rawToken(cookie) { return cookie.slice(cookie.indexOf('=') + 1); }
async function register(overrides = {}) {
  const result = await request(app).post('/api/auth/register').send({ ...credentials, ...overrides });
  expect(result.status).toBe(201);
  return { result, cookie: sessionCookie(result), user: result.body.user };
}
async function createProduct(cookie, overrides = {}) {
  const result = await request(app).post('/api/products').set('Cookie', cookie).send({ ...productInput, ...overrides });
  expect(result.status).toBe(201);
  return result.body.product;
}

beforeAll(async () => {
  if (process.env.TEST_MONGODB_URI) {
    const uri = new URL(process.env.TEST_MONGODB_URI);
    const dbName = decodeURIComponent(uri.pathname.replace(/^\//, ''));
    if (!/^[A-Za-z0-9_-]*_test(?:_[A-Za-z0-9_-]+)?$/.test(dbName)) {
      throw new Error('TEST_MONGODB_URI debe nombrar una base exclusiva con _test. Se canceló la limpieza para proteger datos.');
    }
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  } else {
    mongo = await MongoMemoryServer.create({ instance: {
      dbName: 'actividad4_integration_test',
      args: process.platform === 'win32' ? [] : ['--nounixsocket'],
    } });
    process.env.MONGODB_URI = mongo.getUri('actividad4_integration_test');
  }
  await connectDatabase();
  app = createApp({ authRateLimit: false });
}, 120000);

beforeEach(async () => {
  if (!app) throw new Error('MongoDB no pudo iniciar; la integración no fue verificada.');
  await Session.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await Session.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});
  }
  await closeDatabase();
  if (mongo) await mongo.stop();
});

describe('Integración con MongoDB real', () => {
  test('registro persiste hash bcrypt y devuelve identidad sin contraseña', async () => {
    const { result } = await register({ email: ' USUARIO@EXAMPLE.TEST ' });
    const stored = await User.findOne({ email: credentials.email }).select('+passwordHash');
    expect(stored).not.toBeNull();
    expect(stored.passwordHash).not.toBe(credentials.password);
    expect(await bcrypt.compare(credentials.password, stored.passwordHash)).toBe(true);
    expect(result.body.user).not.toHaveProperty('passwordHash');
    expect(result.body.user).not.toHaveProperty('password');
    expect(await Session.countDocuments({ user: stored._id })).toBe(1);
  });

  test('correo normalizado es único en la base', async () => {
    await register();
    const result = await request(app).post('/api/auth/register').send({ ...credentials, email: 'USUARIO@EXAMPLE.TEST' });
    expect(result.status).toBe(409);
    expect(await User.countDocuments()).toBe(1);
  });

  test('inicio de sesión válido crea sesión, incorrecto no la crea', async () => {
    await register();
    const failed = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'Incorrecta123!' });
    expect(failed.status).toBe(401);
    expect(await Session.countDocuments()).toBe(1);
    const success = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
    expect(success.status).toBe(200);
    expect(await Session.countDocuments()).toBe(2);
    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(success));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(credentials.email);
  });

  test('CRUD completo conserva precio en centavos y elimina realmente el producto', async () => {
    const { cookie, user } = await register();
    const created = await createProduct(cookie, { price: 0.29 });
    const stored = await Product.findById(created.id);
    expect(stored.owner.toString()).toBe(user.id);
    expect(stored.priceInCents).toBe(29);
    const list = await request(app).get('/api/products').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(1);
    const detail = await request(app).get(`/api/products/${created.id}`).set('Cookie', cookie);
    expect(detail.body.product.price).toBe(0.29);
    const updated = await request(app).put(`/api/products/${created.id}`).set('Cookie', cookie).send({ ...productInput, name: 'Teclado actualizado', price: 499.99, stock: 0 });
    expect(updated.status).toBe(200);
    expect(updated.body.product).toMatchObject({ name: 'Teclado actualizado', price: 499.99, stock: 0 });
    expect((await Product.findById(created.id)).priceInCents).toBe(49999);
    const deleted = await request(app).delete(`/api/products/${created.id}`).set('Cookie', cookie);
    expect(deleted.status).toBe(204);
    expect(await Product.findById(created.id)).toBeNull();
  });

  test('dos usuarios no pueden consultar, editar ni eliminar productos ajenos', async () => {
    const first = await register();
    const second = await register({ name: 'Segundo usuario', email: 'segundo@example.test' });
    const product = await createProduct(first.cookie);
    const list = await request(app).get('/api/products').set('Cookie', second.cookie);
    expect(list.body.products).toEqual([]);
    for (const method of ['get', 'put', 'delete']) {
      const result = await request(app)[method](`/api/products/${product.id}`).set('Cookie', second.cookie).send(productInput);
      expect(result.status).toBe(404);
    }
    expect((await Product.findById(product.id)).name).toBe(productInput.name);
  });

  test('SKU es único por usuario sin distinguir mayúsculas, pero otro usuario puede usarlo', async () => {
    const first = await register();
    const second = await register({ email: 'segundo@example.test' });
    await createProduct(first.cookie, { sku: 'sku-01' });
    const duplicate = await request(app).post('/api/products').set('Cookie', first.cookie).send({ ...productInput, sku: 'SKU-01' });
    expect(duplicate.status).toBe(409);
    await createProduct(second.cookie, { sku: 'SKU-01' });
    expect(await Product.countDocuments({ sku: 'SKU-01' })).toBe(2);
  });

  test('actualizar no permite duplicar SKU y conserva el documento anterior', async () => {
    const { cookie } = await register();
    await createProduct(cookie, { sku: 'UNO-01' });
    const second = await createProduct(cookie, { sku: 'DOS-02' });
    const conflict = await request(app).put(`/api/products/${second.id}`).set('Cookie', cookie).send({ ...productInput, sku: 'uno-01' });
    expect(conflict.status).toBe(409);
    expect((await Product.findById(second.id)).sku).toBe('DOS-02');
  });

  test('búsqueda literal, categoría y paginación consultan la base correctamente', async () => {
    const { cookie } = await register();
    await createProduct(cookie, { name: 'Teclado .* especial', sku: 'ESPECIAL-01' });
    await createProduct(cookie, { name: 'Mesa', category: 'Hogar', sku: 'MESA-01' });
    const literal = await request(app).get('/api/products').query({ q: '.*' }).set('Cookie', cookie);
    expect(literal.status).toBe(200);
    expect(literal.body.products).toHaveLength(1);
    expect(literal.body.products[0].sku).toBe('ESPECIAL-01');
    const category = await request(app).get('/api/products').query({ category: 'Hogar' }).set('Cookie', cookie);
    expect(category.body.products).toHaveLength(1);
    expect(category.body.products[0].name).toBe('Mesa');
    const page = await request(app).get('/api/products').query({ page: 2, limit: 1 }).set('Cookie', cookie);
    expect(page.body.pagination).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(page.body.products).toHaveLength(1);
  });

  test('logout revoca JWT previo aunque se reenvíe la cookie copiada', async () => {
    const { cookie } = await register();
    const loggedOut = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(loggedOut.status).toBe(204);
    expect(await Session.countDocuments()).toBe(0);
    const replay = await request(app).get('/api/products').set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('INVALID_SESSION');
  });

  test('cerrar una sesión no revoca las otras sesiones del mismo usuario', async () => {
    const first = await register();
    const login = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
    const secondCookie = sessionCookie(login);
    await request(app).post('/api/auth/logout').set('Cookie', first.cookie).expect(204);
    await request(app).get('/api/auth/me').set('Cookie', secondCookie).expect(200);
    expect(await Session.countDocuments()).toBe(1);
  });

  test('sesión expirada se rechaza antes de que el TTL elimine su documento', async () => {
    const { cookie } = await register();
    const payload = jwt.decode(rawToken(cookie));
    await Session.updateOne({ tokenId: payload.jti }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const result = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(result.status).toBe(401);
  });

  test('firma alterada y JWT expirado no aceptan una sesión válida en Mongo', async () => {
    const { cookie, user } = await register();
    const payload = jwt.decode(rawToken(cookie));
    const expired = jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user.id, jwtid: payload.jti, issuer: 'actividad4-productos', audience: 'actividad4-web', expiresIn: -1 });
    await request(app).get('/api/products').set('Cookie', `actividad4_token=${expired}`).expect(401);
    const parts = rawToken(cookie).split('.');
    parts[2] = `${parts[2][0] === 'a' ? 'b' : 'a'}${parts[2].slice(1)}`;
    await request(app).get('/api/products').set('Cookie', `actividad4_token=${parts.join('.')}`).expect(401);
  });

  test('las cinco rutas CRUD rechazan acceso sin sesión', async () => {
    const { cookie } = await register();
    const product = await createProduct(cookie);
    for (const [method, path] of [
      ['get', '/api/products'], ['get', `/api/products/${product.id}`],
      ['post', '/api/products'], ['put', `/api/products/${product.id}`], ['delete', `/api/products/${product.id}`],
    ]) {
      const result = await request(app)[method](path).send(productInput);
      expect(result.status).toBe(401);
    }
    expect(await Product.countDocuments()).toBe(1);
  });

  test('valida datos, bloquea operadores Mongo y no persiste solicitudes inválidas', async () => {
    const { cookie } = await register();
    for (const changes of [{ price: -5 }, { stock: 1.5 }, { owner: '507f1f77bcf86cd799439099' }, { name: { $ne: null } }]) {
      await request(app).post('/api/products').set('Cookie', cookie).send({ ...productInput, ...changes }).expect(400);
    }
    await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'SeguraDePrueba123!' }).expect(400);
    await request(app).get('/api/products?q[$ne]=x').set('Cookie', cookie).expect(400);
    expect(await Product.countDocuments()).toBe(0);
  });

  test('rechaza escritura cruzada sin alterar MongoDB', async () => {
    const { cookie } = await register();
    await request(app).post('/api/products').set('Cookie', cookie).set('Origin', 'https://sitio-ajeno.example').send(productInput).expect(403);
    await request(app).post('/api/products').set('Cookie', cookie).set('Sec-Fetch-Site', 'cross-site').send(productInput).expect(403);
    expect(await Product.countDocuments()).toBe(0);
  });

  test('health hace ping a Mongo real y los datos persisten entre peticiones', async () => {
    const { cookie } = await register();
    const created = await createProduct(cookie);
    const anotherApp = createApp({ authRateLimit: false });
    await request(anotherApp).get('/api/health').expect(200, { status: 'ok', database: 'connected' });
    const fetched = await request(anotherApp).get(`/api/products/${created.id}`).set('Cookie', cookie);
    expect(fetched.status).toBe(200);
    expect(fetched.body.product.sku).toBe('TEC-01');
  });
});
