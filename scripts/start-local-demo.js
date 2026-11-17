'use strict';

// Laboratorio opcional: MongoDB real temporal; los datos se pierden al detenerlo.
// No sustituye MongoDB Atlas ni un despliegue para la entrega académica.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ quiet: true });

(async () => {
  const mongo = await MongoMemoryServer.create({ instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] } });
  process.env.MONGODB_URI = mongo.getUri('actividad4_demo');
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.NODE_ENV = 'development';
  process.env.APP_ORIGIN = `http://localhost:${process.env.PORT || 3000}`;
  const { start } = require('../server');
  await start({ onShutdown: () => mongo.stop() });
  console.log('Laboratorio temporal activo: MongoDB local. Los datos se eliminan al detenerlo.');
})().catch(() => {
  console.error('No se pudo iniciar MongoDB temporal. Configura Atlas y usa npm start.');
  process.exitCode = 1;
});
