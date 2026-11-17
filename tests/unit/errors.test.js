'use strict';

const { errorHandler } = require('../../src/middleware/errors');
const AppError = require('../../src/utils/AppError');
const { response } = require('../helpers');

describe('Manejo central de errores', () => {
  test.each([
    [{ type: 'entity.parse.failed' }, 400, 'INVALID_JSON'],
    [{ type: 'entity.too.large' }, 413, 'PAYLOAD_TOO_LARGE'],
    [{ code: 11000, keyPattern: { email: 1 } }, 409, 'DUPLICATE_VALUE'],
    [{ code: 11000, keyPattern: { owner: 1, sku: 1 } }, 409, 'DUPLICATE_VALUE'],
    [{ name: 'CastError' }, 400, 'VALIDATION_ERROR'],
    [{ name: 'ValidationError' }, 400, 'VALIDATION_ERROR'],
    [{ name: 'MongoNetworkError' }, 503, 'DATABASE_UNAVAILABLE'],
    [{ name: 'MongoServerSelectionError' }, 503, 'DATABASE_UNAVAILABLE'],
  ])('convierte %j en HTTP %i', (error, status, code) => {
    const res = response(); errorHandler(error, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code, message: expect.any(String) }) });
  });

  test('no expone secretos ni stack de un error inesperado', () => {
    const res = response();
    errorHandler(new Error('mongodb+srv://usuario:secreto@host/db'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const output = JSON.stringify(res.json.mock.calls[0][0]);
    expect(output).not.toMatch(/mongodb|secreto|stack|usuario/);
  });

  test('conserva detalles de validación controlados', () => {
    const res = response(); const details = [{ field: 'price', message: 'Precio no válido' }];
    errorHandler(new AppError(400, 'VALIDATION_ERROR', 'Revisa los datos.', details), {}, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos.', details } });
  });

  test('delega al siguiente handler si ya se enviaron cabeceras', () => {
    const error = new Error('Tardío'); const next = jest.fn(); const res = { ...response(), headersSent: true };
    errorHandler(error, {}, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
