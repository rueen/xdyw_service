/**
 * @fileoverview 通知路由
 */

'use strict';

const express = require('express');
const { param, query } = require('express-validator');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { authenticate, requireSalesperson } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate, requireSalesperson);

/**
 * GET /notifications
 * 获取通知列表（业务员）
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 50 }),
    query('isRead').optional().isIn(['0', '1']).withMessage('isRead 只能为 0 或 1'),
  ],
  validate,
  notificationController.getList
);

/**
 * PUT /notifications/read-all
 * 全部标记已读
 * 注意：此路由必须在 /:id 之前定义
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * PUT /notifications/:id/read
 * 标记单条通知已读
 */
router.put(
  '/:id/read',
  [param('id').isInt({ min: 1 })],
  validate,
  notificationController.markAsRead
);

module.exports = router;
