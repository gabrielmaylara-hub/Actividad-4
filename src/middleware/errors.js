'use strict';

const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe.'));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof AppError ? error.status : 500;
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  let message = error instanceof AppError ? error.message : 'Ocurrió un error interno. Intenta de nuevo más tarde.';
  let details = error instanceof AppError ? error.details : undefined;
  if (error.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'El cuerpo de la solicitud contiene JSON incorrecto.';
  } else if (error.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'La solicitud supera el tamaño permitido.';
  } else if (error.code === 11000) {
    status = 409; code = 'DUPLICATE_VALUE';
    message = error.keyPattern && error.keyPattern.email ? 'Este correo ya está registrado.' : 'Ya existe un producto con ese SKU en tu catálogo.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Los datos enviados no son válidos.';
  } else if (['MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkTimeoutError'].includes(error.name)) {
    status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'La base de datos no está disponible. Intenta de nuevo más tarde.';
  }
  // Nunca se devuelven trazas, URI, consultas ni credenciales.
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

module.exports = { notFound, errorHandler };
