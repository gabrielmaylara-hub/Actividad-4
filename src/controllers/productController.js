'use strict';

const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { serializeProduct } = require('../utils/serialize');

function escapedRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function list(req, res) {
  const { q, category, page, limit } = req.validatedQuery;
  const filter = { owner: req.user._id };
  if (category) filter.category = category;
  if (q) {
    const literal = new RegExp(escapedRegex(q), 'i');
    filter.$or = [{ name: literal }, { sku: literal }];
  }
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products: products.map(serializeProduct), pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } });
}

async function show(req, res) {
  const product = await Product.findOne({ _id: req.params.id, owner: req.user._id });
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe o no está disponible en tu catálogo.');
  res.json({ product: serializeProduct(product) });
}

async function create(req, res) {
  const product = await Product.create({ ...req.validated, owner: req.user._id });
  res.status(201).json({ product: serializeProduct(product) });
}

async function update(req, res) {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { $set: req.validated },
    { new: true, runValidators: true },
  );
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe o no está disponible en tu catálogo.');
  res.json({ product: serializeProduct(product) });
}

async function remove(req, res) {
  const product = await Product.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe o no está disponible en tu catálogo.');
  res.status(204).end();
}

module.exports = { list, show, create, update, remove };
