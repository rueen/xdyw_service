/**
 * @fileoverview 病例管理路由
 */

'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();

const recordController = require('../controllers/recordController');
const { authenticate, requireSalesperson, requireSuperAdmin, requireDoctor, requireLogin } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

/**
 * GET /records
 * 病例列表（业务员/医生，各自看自己可见范围）
 */
router.get(
  '/',
  requireLogin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn([
      'pending_review', 'suitable', 'unsuitable',
      'incomplete', 'pending_follow_up', 'completed',
    ]).withMessage('状态值无效'),
    query('doctorId').optional().isInt({ min: 1 }),
    query('salespersonId').optional().isInt({ min: 1 }).withMessage('业务员ID格式错误'),
  ],
  validate,
  recordController.getList
);

/**
 * GET /records/:id
 * 病例详情
 */
router.get(
  '/:id',
  requireLogin,
  [param('id').isInt({ min: 1 })],
  validate,
  recordController.getDetail
);

/**
 * POST /records
 * 新增病例（业务员）
 */
router.post(
  '/',
  requireSalesperson,
  [
    body('patientName').notEmpty().withMessage('患者姓名不能为空').isLength({ max: 50 }),
    body('patientPhone').isMobilePhone('zh-CN').withMessage('患者手机号格式错误'),
    body('patientIdCard')
      .notEmpty().withMessage('身份证号不能为空')
      .matches(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/i)
      .withMessage('身份证号格式错误'),
    body('doctorId').isInt({ min: 1 }).withMessage('请选择指派医生'),
    body('description').optional().isLength({ max: 300 }).withMessage('描述不能超过300字'),
    body('photos').optional().isArray({ max: 10 }).withMessage('照片最多10张'),
    body('photos.*').optional().isURL().withMessage('照片必须为有效URL'),
  ],
  validate,
  recordController.create
);

/**
 * PUT /records/:id
 * 修改病例基础信息（业务员）
 */
router.put(
  '/:id',
  requireSalesperson,
  [
    param('id').isInt({ min: 1 }),
    body('patientName').optional().isLength({ max: 50 }),
    body('patientPhone').optional().isMobilePhone('zh-CN'),
    body('patientIdCard').optional().matches(
      /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/i
    ).withMessage('身份证号格式错误'),
    body('doctorId').optional().isInt({ min: 1 }),
    body('description').optional().isLength({ max: 300 }).withMessage('描述不能超过300字'),
    body('photos').optional().isArray({ max: 10 }).withMessage('照片最多10张'),
  ],
  validate,
  recordController.update
);

/**
 * DELETE /records/:id
 * 删除病例（超级管理员）
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  [param('id').isInt({ min: 1 })],
  validate,
  recordController.remove
);

/**
 * POST /records/:id/review
 * 医生判读（符合用药 / 不符合用药 / 资料不全）
 */
router.post(
  '/:id/review',
  requireDoctor,
  [
    param('id').isInt({ min: 1 }),
    body('operation')
      .isIn(['review_suitable', 'review_unsuitable', 'review_incomplete'])
      .withMessage('操作类型无效'),
    body('notes')
      .if(body('operation').equals('review_incomplete'))
      .notEmpty().withMessage('标记资料不全时，备注不能为空')
      .isLength({ max: 300 }).withMessage('备注不能超过300字'),
  ],
  validate,
  recordController.review
);

/**
 * POST /records/:id/visited
 * 业务员操作已就诊（符合用药 -> 待复诊）
 */
router.post(
  '/:id/visited',
  requireSalesperson,
  [param('id').isInt({ min: 1 })],
  validate,
  recordController.markVisited
);

/**
 * POST /records/:id/follow-up
 * 业务员操作已复诊
 */
router.post(
  '/:id/follow-up',
  requireSalesperson,
  [
    param('id').isInt({ min: 1 }),
    body('followUpTime')
      .notEmpty().withMessage('复诊日期不能为空')
      .isDate().withMessage('复诊日期格式错误（YYYY-MM-DD）'),
    body('notes').optional().isLength({ max: 300 }).withMessage('备注不能超过300字'),
  ],
  validate,
  recordController.markFollowUp
);

/**
 * POST /records/:id/complete
 * 标记已完诊（任意状态）
 */
router.post(
  '/:id/complete',
  requireSalesperson,
  [param('id').isInt({ min: 1 })],
  validate,
  recordController.markCompleted
);

/**
 * POST /records/:id/supplement
 * 业务员补充资料（资料不全 -> 待判读）
 */
router.post(
  '/:id/supplement',
  requireSalesperson,
  [
    param('id').isInt({ min: 1 }),
    body('description').optional().isLength({ max: 300 }),
    body('photos').optional().isArray({ max: 10 }),
  ],
  validate,
  recordController.supplement
);

module.exports = router;
