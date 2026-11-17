'use strict';

const AppError = require('../utils/AppError');
const { getConfig } = require('../config/env');

function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('sec-fetch-site') === 'cross-site') {
    return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'La solicitud debe enviarse desde esta aplicación.'));
  }
  const origin = req.get('origin');
  // Clientes no navegador (REST Client, Supertest) pueden omitir Origin.
  if (!origin) return next();
  const config = getConfig();
  const allowed = config.appOrigin || `${req.protocol}://${req.get('host')}`;
  if (origin !== allowed) return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'El origen de la solicitud no está permitido.'));
  next();
}

module.exports = sameOrigin;
