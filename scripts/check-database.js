'use strict';

const { assertConfigured } = require('../src/config/env');
const { connectDatabase, closeDatabase } = require('../src/config/database');

(async () => {
  try {
    assertConfigured();
    const connection = await connectDatabase();
    await connection.db.admin().ping();
    console.log('Conexión con MongoDB e índices verificados. No se muestran credenciales.');
  } catch (error) {
    console.error(error.code || 'DATABASE_CHECK_FAILED', 'No fue posible verificar MongoDB. Revisa URI, usuario y acceso de red.');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
})();
