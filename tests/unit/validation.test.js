'use strict';

const { authValidation, productValidation, listValidation, idValidation, jsonObject } = require('../../src/middleware/validate');
const { productInput } = require('../helpers');

function validate(fn, body) {
  const req = { body }; const next = jest.fn();
  fn(req, {}, next);
  return { req, next };
}

describe('Validación de entradas', () => {
  test('normaliza nombre y correo sin modificar la contraseña', () => {
    const password = ' EspaciosSonParte ';
    const { req, next } = validate(authValidation(true), { name: '  Usuario Test  ', email: ' USUARIO@EXAMPLE.TEST ', password });
    expect(req.validated).toEqual({ name: 'Usuario Test', email: 'usuario@example.test', password });
    expect(next).toHaveBeenCalled();
  });

  test.each([
    ['correo inválido', { email: 'sin-arroba' }],
    ['objeto de inyección', { email: { $ne: null } }],
    ['contraseña corta', { password: 'corta' }],
    ['más de 72 bytes UTF-8', { password: 'á'.repeat(37) }],
    ['rol no permitido', { role: 'admin' }],
    ['nombre vacío', { name: '  ' }],
  ])('rechaza registro con %s', (_, change) => {
    expect(() => validate(authValidation(true), { name: 'Usuario de prueba', email: 'usuario@example.test', password: 'Segura123!', ...change })).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('producto convierte precio en centavos exactos y SKU en mayúsculas', () => {
    const { req } = validate(productValidation, { ...productInput, price: 0.29, description: undefined });
    expect(req.validated).toMatchObject({ priceInCents: 29, sku: 'TEC-01', description: '' });
    expect(req.validated).not.toHaveProperty('price');
  });

  test.each([
    ['precio negativo', { price: -1 }], ['precio con tres decimales', { price: 1.001 }],
    ['fracción menor que un centavo', { price: 0.000000001 }], ['fracción oculta por redondeo', { price: 1.000000001 }],
    ['precio texto', { price: '10.50' }], ['precio infinito', { price: Infinity }],
    ['existencia decimal', { stock: 1.5 }], ['existencia negativa', { stock: -1 }],
    ['categoría desconocida', { category: 'Sin categoría' }], ['SKU con caracteres no permitidos', { sku: 'A$01' }],
    ['nombre vacío', { name: '  ' }], ['cambio de propietario', { owner: '507f1f77bcf86cd799439099' }],
    ['operador Mongo', { $set: { stock: 90 } }], ['descripción demasiado larga', { description: 'x'.repeat(501) }],
  ])('rechaza %s', (_, change) => {
    expect(() => validate(productValidation, { ...productInput, ...change })).toThrow(expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }));
  });

  test('acepta precio y existencia cero, y valores máximos declarados', () => {
    expect(validate(productValidation, { ...productInput, price: 0, stock: 0 }).req.validated.priceInCents).toBe(0);
    expect(validate(productValidation, { ...productInput, price: 9999999.99, stock: 999999 }).req.validated.priceInCents).toBe(999999999);
  });

  test('lista sin parámetros recibe paginación predeterminada', () => {
    const req = { query: {} }; listValidation(req, {}, jest.fn());
    expect(req.validatedQuery).toEqual({ q: '', category: '', page: 1, limit: 10 });
  });

  test.each([{ page: '0' }, { limit: '51' }, { page: '2.5' }, { q: ['uno', 'dos'] }, { category: 'Desconocida' }, { 'q[$ne]': '' }, { sort: 'passwordHash' }])('rechaza consulta no válida %j', query => {
    expect(() => listValidation({ query }, {}, jest.fn())).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('rechaza ID mal formado antes de convertirlo a ObjectId', () => {
    expect(() => idValidation({ params: { id: 'abc' } }, {}, jest.fn())).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_ID' }));
  });

  test('JSON exige tipo y objeto, no arreglos', () => {
    const next = jest.fn();
    jsonObject({ is: () => false, body: {} }, {}, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 415 }));
    jsonObject({ is: () => true, body: [] }, {}, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));
  });
});
