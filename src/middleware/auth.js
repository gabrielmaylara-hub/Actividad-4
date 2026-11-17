'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const { getConfig } = require('../config/env');
const AppError = require('../utils/AppError');

async function requireAuth(req, res, next) {
  const config = getConfig();
  const token = req.cookies[config.cookieName];
  if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'], issuer: config.jwtIssuer, audience: config.jwtAudience,
    });
    if (typeof payload !== 'object' || !/^[a-fA-F0-9]{24}$/.test(payload.sub || '') || typeof payload.jti !== 'string' || !Number.isSafeInteger(payload.exp)) throw new Error('Invalid claims');
  } catch {
    throw new AppError(401, 'INVALID_SESSION', 'La sesión no es válida o ha caducado. Inicia sesión de nuevo.');
  }
  // La expiración se comprueba aquí, sin depender del borrado diferido del índice TTL.
  const session = await Session.findOne({ tokenId: payload.jti, user: payload.sub, expiresAt: mongoose.trusted({ $gt: new Date() }) });
  if (!session) throw new AppError(401, 'INVALID_SESSION', 'La sesión terminó. Inicia sesión de nuevo.');
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'INVALID_SESSION', 'La sesión terminó. Inicia sesión de nuevo.');
  req.user = user;
  req.auth = { tokenId: payload.jti };
  next();
}

module.exports = requireAuth;
