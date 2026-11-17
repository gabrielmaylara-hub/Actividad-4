'use strict';

const jwt = require('jsonwebtoken');
const userId = '507f1f77bcf86cd799439011';
const productId = '507f1f77bcf86cd799439012';
const user = { _id: userId, name: 'Usuario de prueba', email: 'usuario@example.test' };
const product = {
  _id: productId, owner: userId, name: 'Teclado', sku: 'TEC-01',
  description: 'Teclado de prueba', category: 'Tecnología', priceInCents: 25990, stock: 4,
  createdAt: new Date('2026-01-01T10:00:00.000Z'), updatedAt: new Date('2026-01-01T10:00:00.000Z'),
};
const productInput = { name: 'Teclado', sku: 'tec-01', description: 'Teclado de prueba', category: 'Tecnología', price: 259.90, stock: 4 };

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis(), cookie: jest.fn().mockReturnThis(), clearCookie: jest.fn().mockReturnThis() };
}

function token(options = {}) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: userId, jwtid: 'session-test-01',
    issuer: 'actividad4-productos', audience: 'actividad4-web', expiresIn: '2h', ...options,
  });
}

function cookie(value = token()) { return `actividad4_token=${value}`; }

module.exports = { userId, productId, user, product, productInput, response, token, cookie };
