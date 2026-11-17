'use strict';

function serializeUser(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    price: product.priceInCents / 100,
    stock: product.stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

module.exports = { serializeUser, serializeProduct };
