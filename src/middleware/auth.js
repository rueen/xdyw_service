/**
 * @fileoverview JWT 身份验证中间件
 * @description 提供 JWT 鉴权和基于角色的访问控制（RBAC）中间件
 */

'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * JWT 鉴权中间件
 * 从 Authorization: Bearer <token> 中提取并验证 JWT
 * 验证通过后将用户信息挂载到 req.user
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, '未提供认证 Token');
  }

  const token = authHeader.slice(7); // 去掉 "Bearer " 前缀
  try {
    /**
     * JWT payload 结构：
     * {
     *   userId:   number,   // 用户ID
     *   userType: string,   // 'salesperson' | 'doctor'
     *   role:     string,   // 'super_admin' | 'salesperson'（仅业务员有）
     *   phone:    string,   // 手机号
     * }
     */
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    /** 让全局错误处理器处理 JWT 相关错误 */
    next(error);
  }
}

/**
 * 角色权限中间件工厂函数
 * @param {...string} roles - 允许访问的角色列表（'super_admin' | 'salesperson' | 'doctor'）
 * @returns {import('express').RequestHandler} 权限检查中间件
 * @example
 * // 仅超级管理员可访问
 * router.get('/list', authenticate, requireRole('super_admin'), handler);
 *
 * // 超级管理员和普通业务员均可访问
 * router.post('/records', authenticate, requireRole('super_admin', 'salesperson'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res);
    }

    /** 医生角色判断 */
    if (roles.includes('doctor') && req.user.userType === 'doctor') {
      return next();
    }

    /** 业务员角色判断（包含超级管理员） */
    if (req.user.userType === 'salesperson') {
      if (roles.includes('super_admin') && req.user.role === 'super_admin') {
        return next();
      }
      if (roles.includes('salesperson')) {
        return next();
      }
    }

    return forbidden(res, '您没有执行此操作的权限');
  };
}

/**
 * 仅业务员可访问（包含超级管理员）
 */
const requireSalesperson = requireRole('super_admin', 'salesperson');

/**
 * 仅超级管理员可访问
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * 仅医生可访问
 */
const requireDoctor = requireRole('doctor');

/**
 * 业务员和医生均可访问
 */
const requireLogin = requireRole('super_admin', 'salesperson', 'doctor');

module.exports = {
  authenticate,
  requireRole,
  requireSalesperson,
  requireSuperAdmin,
  requireDoctor,
  requireLogin,
};
