/**
 * @fileoverview 认证路由
 * @description POST /api/v1/auth/login, GET /api/v1/auth/profile, PUT /api/v1/auth/password
 */

'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimit');

/**
 * POST /auth/login
 * 登录（业务员 / 医生统一入口）
 */
router.post(
  '/login',
  loginLimiter,
  [
    body('phone')
      .notEmpty().withMessage('手机号不能为空')
      .isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
    body('password')
      .notEmpty().withMessage('密码不能为空')
      .isLength({ min: 6 }).withMessage('密码长度不能少于6位'),
  ],
  validate,
  authController.login
);

/**
 * GET /auth/profile
 * 获取当前用户信息
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * PUT /auth/password
 * 修改密码
 */
router.put(
  '/password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword')
      .notEmpty().withMessage('新密码不能为空')
      .isLength({ min: 6, max: 50 }).withMessage('新密码长度为6-50位')
      .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('新密码必须包含字母和数字'),
  ],
  validate,
  authController.changePassword
);

module.exports = router;
