/**
 * @fileoverview 系统配置路由
 */

'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const configController = require('../controllers/configController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate, requireSuperAdmin);

/** GET /configs - 获取所有配置 */
router.get('/', configController.getAll);

/**
 * PUT /configs/:key
 * 修改单项配置
 */
router.put(
  '/:key',
  [
    param('key').notEmpty().withMessage('配置键不能为空'),
    body('value').notEmpty().withMessage('配置值不能为空'),
  ],
  validate,
  configController.update
);

module.exports = router;
