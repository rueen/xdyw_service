/**
 * @fileoverview 医生管理路由
 */

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();

const doctorController = require('../controllers/doctorController');
const { authenticate, requireSuperAdmin, requireSalesperson } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

/**
 * GET /doctors/active
 * 获取所有正常状态的医生（业务员填写病例时选择指派医生使用）
 */
router.get('/active', requireSalesperson, doctorController.getActiveDoctors);

/**
 * GET /doctors
 * 医生列表（超级管理员）
 */
router.get(
  '/',
  requireSuperAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['normal', 'disabled']),
  ],
  validate,
  doctorController.getList
);

/**
 * GET /doctors/:id
 * 医生详情（超级管理员）
 */
router.get(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 })],
  validate,
  doctorController.getDetail
);

/**
 * POST /doctors
 * 新增医生（超级管理员）
 */
router.post(
  '/',
  requireSuperAdmin,
  [
    body('name').notEmpty().withMessage('姓名不能为空').isLength({ max: 50 }),
    body('phone').isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
    body('password').isLength({ min: 6, max: 50 }).withMessage('密码长度为6-50位'),
  ],
  validate,
  doctorController.create
);

/**
 * PUT /doctors/:id
 * 修改医生（超级管理员）
 */
router.put(
  '/:id',
  requireSuperAdmin,
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().isLength({ max: 50 }),
    body('phone').optional().isMobilePhone('zh-CN'),
    body('status').optional().isIn(['normal', 'disabled']),
  ],
  validate,
  doctorController.update
);

/**
 * DELETE /doctors/:id
 * 删除医生（超级管理员）
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 })],
  validate,
  doctorController.remove
);

module.exports = router;
