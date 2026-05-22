/**
 * @fileoverview 业务员管理路由
 */

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();

const salespersonController = require('../controllers/salespersonController');
const { authenticate, requireSuperAdmin, requireSalesperson } = require('../middleware/auth');
const validate = require('../middleware/validate');

/** 所有路由需要登录 */
router.use(authenticate);

/**
 * GET /salespersons
 * 业务员列表（超级管理员查看全部；普通业务员只能查看自己的子孙级业务员）
 */
router.get(
  '/',
  requireSalesperson,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('每页条数为1-100'),
    query('status').optional().isIn(['normal', 'disabled']).withMessage('状态值无效'),
    query('keyword').optional().isString().isLength({ max: 50 }).withMessage('keyword 最长50字'),
    query('province_code').optional().isString(),
    query('city_code').optional().isString(),
    query('district_code').optional().isString(),
    query('parent_id').optional().isInt({ min: 1 }),
  ],
  validate,
  salespersonController.getList
);

/**
 * GET /salespersons/subordinates
 * 获取我的下级列表（业务员可调用）
 * 注意：此路由必须在 /:id 之前定义，避免路由冲突
 */
router.get(
  '/subordinates',
  requireSalesperson,
  salespersonController.getSubordinates
);

/**
 * GET /salespersons/:id
 * 业务员详情（仅超级管理员）
 */
router.get(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 }).withMessage('ID 格式错误')],
  validate,
  salespersonController.getDetail
);

/**
 * POST /salespersons
 * 新增业务员（超级管理员 / 业务员可为自己添加下级）
 */
router.post(
  '/',
  requireSalesperson,
  [
    body('name').notEmpty().withMessage('姓名不能为空').isLength({ max: 50 }).withMessage('姓名最长50字'),
    body('phone').isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
    body('password').isLength({ min: 6, max: 50 }).withMessage('密码长度为6-50位'),
    body('parent_id').optional().isInt({ min: 1 }).withMessage('上级业务员ID格式错误'),
    body('province_code').optional().isString().isLength({ max: 20 }),
    body('province_name').optional().isString().isLength({ max: 50 }),
    body('city_code').optional().isString().isLength({ max: 20 }),
    body('city_name').optional().isString().isLength({ max: 50 }),
    body('district_code').optional().isString().isLength({ max: 20 }),
    body('district_name').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  salespersonController.create
);

/**
 * PUT /salespersons/:id
 * 修改业务员（仅超级管理员）
 */
router.put(
  '/:id',
  requireSuperAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID 格式错误'),
    body('name').optional().isLength({ max: 50 }),
    body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式错误'),
    body('status').optional().isIn(['normal', 'disabled']).withMessage('状态值无效'),
    body('parent_id').optional().isInt({ min: 1 }),
    body('province_code').optional().isString().isLength({ max: 20 }),
    body('province_name').optional().isString().isLength({ max: 50 }),
    body('city_code').optional().isString().isLength({ max: 20 }),
    body('city_name').optional().isString().isLength({ max: 50 }),
    body('district_code').optional().isString().isLength({ max: 20 }),
    body('district_name').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  salespersonController.update
);

/**
 * DELETE /salespersons/:id
 * 删除业务员（仅超级管理员）
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 }).withMessage('ID 格式错误')],
  validate,
  salespersonController.remove
);

module.exports = router;
