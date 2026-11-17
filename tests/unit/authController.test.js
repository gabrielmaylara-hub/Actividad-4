'use strict';

jest.mock('../../src/utils/session', () => ({ openSession: jest.fn(), clearSessionCookie: jest.fn() }));
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Session = require('../../src/models/Session');
const { openSession, clearSessionCookie } = require('../../src/utils/session');
const controller = require('../../src/controllers/authController');
const { user, response } = require('../helpers');

describe('Controlador de autenticación', () => {
  let res;
  beforeEach(() => { res = response(); openSession.mockResolvedValue(undefined); });

  test('registra únicamente hash y datos permitidos; no expone contraseña ni hash', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash-seguro');
    jest.spyOn(User, 'create').mockResolvedValue({ ...user, passwordHash: 'hash-seguro' });
    const req = { validated: { name: user.name, email: user.email, password: 'PruebaSegura123!' } };
    await controller.register(req, res);
    expect(bcrypt.hash).toHaveBeenCalledWith('PruebaSegura123!', 12);
    expect(User.create).toHaveBeenCalledWith({ name: user.name, email: user.email, passwordHash: 'hash-seguro' });
    expect(openSession).toHaveBeenCalledWith(expect.objectContaining({ _id: user._id }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user: { id: user._id, name: user.name, email: user.email } });
  });

  test('rechaza correo existente sin crear usuario ni iniciar sesión', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue({ _id: user._id });
    const create = jest.spyOn(User, 'create');
    await expect(controller.register({ validated: { ...user, password: 'PruebaSegura123!' } }, res)).rejects.toMatchObject({ status: 409, code: 'EMAIL_EXISTS' });
    expect(create).not.toHaveBeenCalled();
    expect(openSession).not.toHaveBeenCalled();
  });

  test('propaga duplicado concurrente de Mongo para que el middleware responda 409', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash');
    const duplicate = { code: 11000, keyPattern: { email: 1 } };
    jest.spyOn(User, 'create').mockRejectedValue(duplicate);
    await expect(controller.register({ validated: { ...user, password: 'PruebaSegura123!' } }, res)).rejects.toBe(duplicate);
    expect(res.json).not.toHaveBeenCalled();
  });

  test('inicia sesión tras comparar el hash', async () => {
    const select = jest.fn().mockResolvedValue({ ...user, passwordHash: 'hash' });
    jest.spyOn(User, 'findOne').mockReturnValue({ select });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    await controller.login({ validated: { email: user.email, password: 'PruebaSegura123!' } }, res);
    expect(select).toHaveBeenCalledWith('+passwordHash');
    expect(bcrypt.compare).toHaveBeenCalledWith('PruebaSegura123!', 'hash');
    expect(openSession).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ user: { id: user._id, name: user.name, email: user.email } });
  });

  test.each([['correo inexistente', null, false], ['contraseña incorrecta', { ...user, passwordHash: 'hash' }, false]])('rechaza %s con el mismo error genérico', async (_, storedUser, matches) => {
    jest.spyOn(User, 'findOne').mockReturnValue({ select: jest.fn().mockResolvedValue(storedUser) });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(matches);
    await expect(controller.login({ validated: { email: user.email, password: 'Incorrecta123!' } }, res)).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(openSession).not.toHaveBeenCalled();
  });

  test('logout revoca solo la sesión actual y elimina la cookie', async () => {
    jest.spyOn(Session, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
    await controller.logout({ user, auth: { tokenId: 'sesion-actual' } }, res);
    expect(Session.deleteOne).toHaveBeenCalledWith({ user: user._id, tokenId: 'sesion-actual' });
    expect(clearSessionCookie).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test('no informa cierre exitoso si no se pudo revocar la sesión', async () => {
    jest.spyOn(Session, 'deleteOne').mockRejectedValue(new Error('Mongo no disponible'));
    await expect(controller.logout({ user, auth: { tokenId: 'actual' } }, res)).rejects.toThrow('Mongo no disponible');
    expect(clearSessionCookie).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});
