'use strict';

const mongoose = require('mongoose');
const { getConfig } = require('./env');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const Product = require('../models/Product');
const Session = require('../models/Session');

mongoose.set('bufferCommands', false);
mongoose.set('sanitizeFilter', true);
let connectionPromise;

async function connectDatabase() {
  if (connectionPromise) return connectionPromise;
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const { mongodbUri } = getConfig();
  if (!mongodbUri) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'La base de datos no está configurada.');
  // Una promesa compartida evita conexiones duplicadas durante el inicio serverless.
  connectionPromise = mongoose.connect(mongodbUri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    // Adaptador explícito para el driver MongoDB bajo Jest (NODE-7832).
    runtimeAdapters: { os: require('node:os') },
  }).then(async () => {
    // Los índices únicos deben existir antes de aceptar registros o SKU.
    await Promise.all([User.init(), Product.init(), Session.init()]);
    return mongoose.connection;
  }).catch(async () => {
    // Un fallo al crear índices no debe dejar una conexión utilizable sin unicidad.
    await mongoose.disconnect().catch(() => {});
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'No fue posible conectar con la base de datos. Intenta de nuevo más tarde.');
  }).finally(() => { connectionPromise = undefined; });
  return connectionPromise;
}

async function closeDatabase() {
  await mongoose.disconnect();
  connectionPromise = undefined;
}

module.exports = { connectDatabase, closeDatabase };
