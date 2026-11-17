'use strict';

const jwt = require('jsonwebtoken');
const Session = require('../../src/models/Session');
const { openSession, clearSessionCookie, cookieOptions } = require('../../src/utils/session');
const { user, response } = require('../helpers');

describe('Emisión y cookies de sesión', () => {
  test('emite JWT firmado con expiración y conserva el mismo jti en Mongo', async () => {
    jest.spyOn(Session, 'create').mockResolvedValue({});
    const res = response();
    await openSession(user, res);
    const [name, value, options] = res.cookie.mock.calls[0];
    const decoded = jwt.verify(value, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'actividad4-productos', audience: 'actividad4-web' });
    expect(name).toBe('actividad4_token');
    expect(decoded.sub).toBe(user._id);
    expect(decoded.exp - decoded.iat).toBe(7200);
    expect(Session.create).toHaveBeenCalledWith({ user: user._id, tokenId: decoded.jti, expiresAt: new Date(decoded.exp * 1000) });
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: 7200000 });
  });

  test('no envía cookie si no pudo registrar la sesión en Mongo', async () => {
    jest.spyOn(Session, 'create').mockRejectedValue(new Error('No hay base'));
    const res = response();
    await expect(openSession(user, res)).rejects.toThrow('No hay base');
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('producción exige cookie Secure y la eliminación conserva su alcance', () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(cookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
      const res = response(); clearSessionCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith('actividad4_token', { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
    } finally { process.env.NODE_ENV = previous; }
  });
});
