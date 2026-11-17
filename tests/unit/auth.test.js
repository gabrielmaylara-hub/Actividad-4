'use strict';

const jwt = require('jsonwebtoken');
const Session = require('../../src/models/Session');
const User = require('../../src/models/User');
const requireAuth = require('../../src/middleware/auth');
const { user, token } = require('../helpers');

describe('Middleware JWT', () => {
  let next;
  beforeEach(() => { next = jest.fn(); });

  test('rechaza falta de cookie antes de consultar la base', async () => {
    const query = jest.spyOn(Session, 'findOne');
    await expect(requireAuth({ cookies: {} }, {}, next)).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['alterado', () => 'token.alterado.invalido'],
    ['vencido', () => token({ expiresIn: -10 })],
    ['algoritmo distinto', () => token({ algorithm: 'HS384' })],
    ['emisor distinto', () => token({ issuer: 'otro-emisor' })],
    ['audiencia distinta', () => token({ audience: 'otra-app' })],
    ['usuario inválido', () => token({ subject: 'sin-object-id' })],
  ])('rechaza JWT %s', async (_, makeToken) => {
    const query = jest.spyOn(Session, 'findOne');
    await expect(requireAuth({ cookies: { actividad4_token: makeToken() } }, {}, next)).rejects.toMatchObject({ status: 401, code: 'INVALID_SESSION' });
    expect(query).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rechaza JWT sin expiración aunque esté firmado correctamente', async () => {
    const value = jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: user._id, jwtid: 'session-test-01', issuer: 'actividad4-productos', audience: 'actividad4-web' });
    const query = jest.spyOn(Session, 'findOne');
    await expect(requireAuth({ cookies: { actividad4_token: value } }, {}, next)).rejects.toMatchObject({ status: 401, code: 'INVALID_SESSION' });
    expect(query).not.toHaveBeenCalled();
  });

  test('acepta firma válida solo con sesión vigente y usuario existente', async () => {
    jest.spyOn(Session, 'findOne').mockResolvedValue({ tokenId: 'session-test-01' });
    jest.spyOn(User, 'findById').mockResolvedValue(user);
    const req = { cookies: { actividad4_token: token() } };
    await requireAuth(req, {}, next);
    expect(Session.findOne).toHaveBeenCalledWith(expect.objectContaining({ user: user._id, tokenId: 'session-test-01', expiresAt: expect.objectContaining({ $gt: expect.any(Date) }) }));
    expect(req.user).toBe(user);
    expect(req.auth).toEqual({ tokenId: 'session-test-01' });
    expect(next).toHaveBeenCalledWith();
  });

  test('rechaza una sesión revocada aunque JWT mantenga firma y vigencia', async () => {
    jest.spyOn(Session, 'findOne').mockResolvedValue(null);
    const lookup = jest.spyOn(User, 'findById');
    await expect(requireAuth({ cookies: { actividad4_token: token() } }, {}, next)).rejects.toMatchObject({ status: 401 });
    expect(lookup).not.toHaveBeenCalled();
  });

  test('rechaza sesión cuyo usuario ya no existe', async () => {
    jest.spyOn(Session, 'findOne').mockResolvedValue({});
    jest.spyOn(User, 'findById').mockResolvedValue(null);
    await expect(requireAuth({ cookies: { actividad4_token: token() } }, {}, next)).rejects.toMatchObject({ status: 401 });
  });

  test('no transforma una caída de la base en credenciales incorrectas', async () => {
    const failure = Object.assign(new Error('No hay red'), { name: 'MongoNetworkError' });
    jest.spyOn(Session, 'findOne').mockRejectedValue(failure);
    await expect(requireAuth({ cookies: { actividad4_token: token() } }, {}, next)).rejects.toBe(failure);
  });
});
