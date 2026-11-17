'use strict';

const express = require('express');
const controller = require('../controllers/productController');
const requireAuth = require('../middleware/auth');
const { jsonObject, productValidation, idValidation, listValidation } = require('../middleware/validate');

const router = express.Router();
router.use(requireAuth);
router.get('/', listValidation, controller.list);
router.post('/', jsonObject, productValidation, controller.create);
router.get('/:id', idValidation, controller.show);
router.put('/:id', idValidation, jsonObject, productValidation, controller.update);
router.delete('/:id', idValidation, controller.remove);

module.exports = router;
