'use strict';

const AppError = require('../utils/AppError');
const { CATEGORIES } = require('../models/Product');

function fail(details) {
  throw new AppError(400, 'VALIDATION_ERROR', 'Revisa los datos del formulario.', details);
}

function jsonObject(req, res, next) {
  if (!req.is('application/json')) {
    return next(new AppError(415, 'JSON_REQUIRED', 'Envía los datos como application/json.'));
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'El cuerpo debe ser un objeto JSON.'));
  }
  next();
}

function unknownFields(body, allowed, details) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) details.push({ field: key, message: 'Campo no permitido.' });
  }
}

function textField(body, key, min, max, details, { optional = false } = {}) {
  if (optional && body[key] === undefined) return '';
  if (typeof body[key] !== 'string') {
    details.push({ field: key, message: 'Debe ser texto.' });
    return '';
  }
  const value = body[key].trim();
  if (value.length < min || value.length > max) {
    details.push({ field: key, message: `Debe tener entre ${min} y ${max} caracteres.` });
  }
  return value;
}

function authValidation(register) {
  return (req, res, next) => {
    const details = [];
    unknownFields(req.body, register ? ['name', 'email', 'password'] : ['email', 'password'], details);
    const name = register ? textField(req.body, 'name', 2, 80, details) : undefined;
    const email = textField(req.body, 'email', 3, 254, details).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) details.push({ field: 'email', message: 'Escribe un correo electrónico válido.' });
    const password = req.body.password;
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      details.push({ field: 'password', message: 'Usa al menos 8 caracteres y máximo 72 bytes UTF-8.' });
    }
    if (details.length) return fail(details);
    req.validated = register ? { name, email, password } : { email, password };
    next();
  };
}

function productValidation(req, res, next) {
  const details = [];
  unknownFields(req.body, ['name', 'sku', 'description', 'category', 'price', 'stock'], details);
  const name = textField(req.body, 'name', 2, 100, details);
  const sku = textField(req.body, 'sku', 2, 40, details).toUpperCase();
  const description = textField(req.body, 'description', 0, 500, details, { optional: true });
  const category = textField(req.body, 'category', 1, 40, details);
  if (!/^[A-Z0-9-]+$/.test(sku)) details.push({ field: 'sku', message: 'Usa letras, números y guiones.' });
  if (!CATEGORIES.includes(category)) details.push({ field: 'category', message: 'Selecciona una categoría válida.' });
  const price = req.body.price;
  const stock = req.body.stock;
  const cents = Math.round(price * 100);
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 9999999.99 || cents / 100 !== price) {
    details.push({ field: 'price', message: 'El precio debe ser un número de 0 a 9,999,999.99, con máximo dos decimales.' });
  }
  if (!Number.isSafeInteger(stock) || stock < 0 || stock > 999999) details.push({ field: 'stock', message: 'La existencia debe ser un entero de 0 a 999,999.' });
  if (details.length) return fail(details);
  req.validated = { name, sku, description, category, priceInCents: cents, stock };
  next();
}

function idValidation(req, res, next) {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id || '')) {
    throw new AppError(400, 'INVALID_ID', 'El identificador de producto no es válido.');
  }
  next();
}

function listValidation(req, res, next) {
  const details = [];
  unknownFields(req.query, ['q', 'category', 'page', 'limit'], details);
  const q = req.query.q === undefined ? '' : textField(req.query, 'q', 0, 100, details);
  const category = req.query.category === undefined ? '' : textField(req.query, 'category', 0, 40, details);
  if (category && !CATEGORIES.includes(category)) details.push({ field: 'category', message: 'Categoría no válida.' });
  function positiveInteger(key, fallback, max) {
    if (req.query[key] === undefined) return fallback;
    const value = req.query[key];
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      details.push({ field: key, message: `Usa un entero entre 1 y ${max}.` });
      return fallback;
    }
    return Number(value);
  }
  const page = positiveInteger('page', 1, 1000000);
  const limit = positiveInteger('limit', 10, 50);
  if (details.length) return fail(details);
  req.validatedQuery = { q, category, page, limit };
  next();
}

module.exports = { jsonObject, authValidation, productValidation, idValidation, listValidation };
