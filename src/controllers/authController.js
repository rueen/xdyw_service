/**
 * @fileoverview 认证控制器
 * @description 处理登录、登出、修改密码、获取用户信息的 HTTP 请求
 */

'use strict';

const authService = require('../services/authService');
const { success, fail } = require('../utils/response');

/**
 * 用户登录
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const result = await authService.login(phone, password);
    return success(res, result, '登录成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户信息
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function getProfile(req, res, next) {
  try {
    const { userId, userType } = req.user;
    const profile = await authService.getProfile(userId, userType);
    return success(res, profile);
  } catch (error) {
    next(error);
  }
}

/**
 * 修改密码
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function changePassword(req, res, next) {
  try {
    const { userId, userType } = req.user;
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(userId, userType, oldPassword, newPassword);
    return success(res, null, '密码修改成功');
  } catch (error) {
    next(error);
  }
}

module.exports = { login, getProfile, changePassword };
