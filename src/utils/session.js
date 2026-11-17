'use strict';

const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const { getConfig } = require('../config/env');

function cookieOptions() {
  const config = getConfig();
  return { httpOnly: true, secure: config.production, sameSite: 'strict', path: '/' };
}

async function openSession(user, res) {
  const config = getConfig();
  const tokenId = randomUUID();
  const token = jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256', subject: String(user._id), jwtid: tokenId,
    expiresIn: config.sessionSeconds, issuer: config.jwtIssuer, audience: config.jwtAudience,
  });
  const { exp } = jwt.decode(token);
  await Session.create({ user: user._id, tokenId, expiresAt: new Date(exp * 1000) });
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: config.sessionSeconds * 1000 });
}

function clearSessionCookie(res) {
  res.clearCookie(getConfig().cookieName, cookieOptions());
}

module.exports = { openSession, clearSessionCookie, cookieOptions };
