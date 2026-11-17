'use strict';

const mongoose = require('mongoose');
const CATEGORIES = Object.freeze(['Tecnología', 'Oficina', 'Hogar', 'Otros']);

const productSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  sku: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 40, match: /^[A-Z0-9-]+$/ },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  category: { type: String, required: true, enum: CATEGORIES },
  priceInCents: { type: Number, required: true, min: 0, max: 999999999, validate: Number.isSafeInteger },
  stock: { type: Number, required: true, min: 0, max: 999999, validate: Number.isSafeInteger },
}, { timestamps: true, versionKey: false });

productSchema.index({ owner: 1, sku: 1 }, { unique: true });
productSchema.index({ owner: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
