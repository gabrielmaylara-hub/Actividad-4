'use strict';

require('dotenv').config({ quiet: true });
const AppError = require('../utils/AppError');

function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    mongodbUri: process.env.MONGODB_URI || '',
    jwtSecret: process.env.JWT_SECRET || '',
    appOrigin: process.env.APP_ORIGIN || '',
    production: process.env.NODE_ENV === 'production',
    sessionSeconds: 2 * 60 * 60,
    cookieName: 'actividad4_token',
    jwtIssuer: 'actividad4-productos',
    jwtAudience: 'actividad4-web',
  };
}

function assertConfigured() {
  const config = getConfig();
  if (Buffer.byteLength(config.jwtSecret, 'utf8') < 32 || !config.mongodbUri) {
    throw new AppError(503, 'CONFIGURATION_REQUIRED', 'El servicio aún no está configurado. Revisa las variables de entorno del servidor.');
  }
  if (config.production && (!config.appOrigin || !config.appOrigin.startsWith('https://'))) {
    throw new AppError(503, 'CONFIGURATION_REQUIRED', 'Configura el origen HTTPS de la aplicación.');
  }
  return config;
}

module.exports = { getConfig, assertConfigured };
