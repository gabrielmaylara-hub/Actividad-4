'use strict';

const express = require('express');
const controller = require('../controllers/authController');
const requireAuth = require('../middleware/auth');
const { jsonObject, authValidation } = require('../middleware/validate');

const router = express.Router();
router.post('/register', jsonObject, authValidation(true), controller.register);
router.post('/login', jsonObject, authValidation(false), controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/logout', requireAuth, controller.logout);

module.exports = router;
