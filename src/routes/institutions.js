/**
 * @fileoverview 机构管理路由
 */

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();

const institutionController = require('../controllers/institutionController');
const { authenticate, requireSuperAdmin, requireSalesperson } = require('../middleware/auth');
const validate = require('../middleware/validate');

/** 所有路由需要登录 */
router.use(authenticate);

/**
 * GET /institutions
 * 机构列表（业务员及以上权限可调用，用于下拉选择等场景）
 */
router.get(
  '/',
  requireSalesperson,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('每页条数为1-100'),
    query('name').optional().isString().isLength({ max: 100 }).withMessage('名称最长100字'),
    query('status').optional().isIn(['normal', 'disabled']).withMessage('状态值无效'),
  ],
  validate,
  institutionController.getList
);

/**
 * POST /institutions
 * 新增机构（仅超级管理员）
 */
router.post(
  '/',
  requireSuperAdmin,
  [
    body('name').notEmpty().withMessage('机构名称不能为空').isLength({ max: 100 }).withMessage('机构名称最长100字'),
    body('status').optional().isIn(['normal', 'disabled']).withMessage('状态值无效'),
  ],
  validate,
  institutionController.create
);

/**
 * PUT /institutions/:id
 * 修改机构（仅超级管理员）
 */
router.put(
  '/:id',
  requireSuperAdmin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID 格式错误'),
    body('name').optional().isLength({ max: 100 }).withMessage('机构名称最长100字'),
    body('status').optional().isIn(['normal', 'disabled']).withMessage('状态值无效'),
  ],
  validate,
  institutionController.update
);

/**
 * DELETE /institutions/:id
 * 删除机构（仅超级管理员）
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 }).withMessage('ID 格式错误')],
  validate,
  institutionController.remove
);

module.exports = router;
