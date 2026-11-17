'use strict';

// Valores ficticios y exclusivos de pruebas; no se usan credenciales de Atlas.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'clave-exclusiva-para-pruebas-actividad4-con-48-caracteres';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/actividad4_unit_test';
process.env.APP_ORIGIN = 'http://localhost:3000';
delete process.env.VERCEL;
