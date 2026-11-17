'use strict';

const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { assertConfigured, getConfig } = require('./config/env');
const { connectDatabase } = require('./config/database');
const sameOrigin = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errors');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');

function createApp(options = {}) {
  const app = express();
  const ensureDatabase = options.connectDatabase || connectDatabase;
  app.disable('x-powered-by');
  if (process.env.VERCEL) app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], fontSrc: ["'self'"],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
      upgradeInsecureRequests: getConfig().production ? [] : null,
    } },
    strictTransportSecurity: getConfig().production ? undefined : false,
  }));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', sameOrigin);
  if (options.authRateLimit !== false) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Se alcanzó el límite de intentos. Espera unos minutos antes de volver a intentar.' } },
    });
    app.use('/api/auth/login', limiter);
    app.use('/api/auth/register', limiter);
  }
  app.use('/api', async (req, res, next) => {
    assertConfigured();
    await ensureDatabase();
    next();
  });
  app.get('/api/health', async (req, res) => {
    const connection = await ensureDatabase();
    await connection.db.admin().ping();
    res.json({ status: 'ok', database: 'connected' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  // En Vercel public/ es servido por su CDN; Express lo sirve en desarrollo local.
  app.use(express.static(path.join(__dirname, '..', 'public'), { dotfiles: 'deny', index: 'index.html' }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
