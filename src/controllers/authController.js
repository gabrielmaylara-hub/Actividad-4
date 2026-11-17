'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const { serializeUser } = require('../utils/serialize');
const { openSession, clearSessionCookie } = require('../utils/session');

async function register(req, res) {
  const { name, email, password } = req.validated;
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_EXISTS', 'Este correo ya está registrado.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  await openSession(user, res);
  res.status(201).json({ user: serializeUser(user) });
}

async function login(req, res) {
  const { email, password } = req.validated;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
  }
  await openSession(user, res);
  res.json({ user: serializeUser(user) });
}

function me(req, res) {
  res.json({ user: serializeUser(req.user) });
}

async function logout(req, res) {
  await Session.deleteOne({ tokenId: req.auth.tokenId, user: req.user._id });
  clearSessionCookie(res);
  res.status(204).end();
}

module.exports = { register, login, me, logout };
