/**
 * @fileoverview 数据统计路由
 */

'use strict';

const express = require('express');
const { query } = require('express-validator');
const router = express.Router();

const statisticsController = require('../controllers/statisticsController');
const { authenticate, requireLogin } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

/**
 * GET /statistics
 * 获取统计数据（超级管理员查看全部；普通业务员只看自己可见范围；医生只看指派给自己的病例）
 */
router.get(
  '/',
  requireLogin,
  [
    query('rangeType')
      .optional()
      .isIn(['today', 'yesterday', 'week', 'month', 'custom'])
      .withMessage('时间范围类型无效'),
    query('startDate')
      .if(query('rangeType').equals('custom'))
      .notEmpty().withMessage('自定义时间范围需要提供开始日期')
      .isDate().withMessage('开始日期格式错误（YYYY-MM-DD）'),
    query('endDate')
      .if(query('rangeType').equals('custom'))
      .notEmpty().withMessage('自定义时间范围需要提供结束日期')
      .isDate().withMessage('结束日期格式错误（YYYY-MM-DD）'),
  ],
  validate,
  statisticsController.getStatistics
);

module.exports = router;
