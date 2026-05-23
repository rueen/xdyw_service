/**
 * @fileoverview 系统配置路由
 */

'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const configController        = require('../controllers/configController');
const reminderConfigController = require('../controllers/reminderConfigController');
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

/**
 * GET /configs/reminders
 * 获取所有复诊提醒阈值配置
 */
router.get('/reminders', reminderConfigController.getAll);

/**
 * POST /configs/reminders
 * 新增提醒阈值天数
 */
router.post(
  '/reminders',
  [
    body('days')
      .notEmpty().withMessage('提醒天数不能为空')
      .isInt({ min: 1 }).withMessage('提醒天数必须为正整数'),
  ],
  validate,
  reminderConfigController.add
);

/**
 * DELETE /configs/reminders/:days
 * 删除提醒阈值天数
 */
router.delete(
  '/reminders/:days',
  [param('days').isInt({ min: 1 }).withMessage('提醒天数格式错误')],
  validate,
  reminderConfigController.remove
);

module.exports = router;
