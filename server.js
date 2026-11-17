'use strict';

const app = require('./src/app');
const { assertConfigured } = require('./src/config/env');
const { connectDatabase, closeDatabase } = require('./src/config/database');

async function start(options = {}) {
  const config = assertConfigured();
  await connectDatabase();
  const server = app.listen(config.port, () => console.log(`Productos disponible en http://localhost:${config.port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => server.close(async () => {
      await closeDatabase();
      if (options.onShutdown) await options.onShutdown();
      process.exit(0);
    }));
  }
  return server;
}

if (require.main === module) start().catch(error => {
  console.error(error.code || 'STARTUP_ERROR', 'No fue posible iniciar el servidor. Revisa .env y la conexión con MongoDB.');
  process.exitCode = 1;
});

module.exports = app;
module.exports.start = start;
