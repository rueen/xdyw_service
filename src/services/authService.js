/**
 * @fileoverview 认证服务
 * @description 处理登录、登出、修改密码等认证相关业务逻辑
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const config = require('../config');
const { createError } = require('../middleware/errorHandler');

/**
 * 用户登录
 * 自动识别业务员或医生身份（手机号全局唯一，先查业务员表，再查医生表）
 *
 * @param {string} phone    - 手机号
 * @param {string} password - 明文密码
 * @returns {Promise<{token: string, userInfo: Object}>} JWT Token 和用户信息
 * @throws {Error} 手机号或密码错误时抛出 401 错误
 */
async function login(phone, password) {
  let user = null;
  let userType = null;

  /** 先从业务员表查找 */
  const salespersons = await query(
    'SELECT id, name, phone, password, role, status FROM users WHERE phone = ? AND deleted_at IS NULL',
    [phone]
  );
  if (salespersons.length > 0) {
    user = salespersons[0];
    userType = 'salesperson';
  } else {
    /** 再从医生表查找 */
    const doctors = await query(
      'SELECT id, name, phone, password, status FROM doctors WHERE phone = ? AND deleted_at IS NULL',
      [phone]
    );
    if (doctors.length > 0) {
      user = doctors[0];
      userType = 'doctor';
    }
  }

  /** 用户不存在或密码错误（统一返回相同错误，防止用户枚举攻击） */
  if (!user) {
    throw createError('手机号或密码错误', 401);
  }

  /** 账号状态检查 */
  if (user.status === 'disabled') {
    throw createError('账号已被停用，请联系管理员', 403);
  }

  /** 验证密码（bcrypt 比较） */
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw createError('手机号或密码错误', 401);
  }

  /**
   * 生成 JWT
   * payload 包含: userId, userType, role（仅业务员）, phone
   */
  const payload = {
    userId:   user.id,
    userType,
    phone:    user.phone,
    ...(userType === 'salesperson' ? { role: user.role } : {}),
  };
  const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

  /** 构建返回的用户信息（去除敏感字段） */
  const userInfo = {
    id:       user.id,
    name:     user.name,
    phone:    user.phone,
    userType,
    ...(userType === 'salesperson' ? { role: user.role } : {}),
  };

  return { token, userInfo };
}

/**
 * 修改密码
 * @param {number} userId     - 当前用户ID
 * @param {string} userType   - 用户类型：'salesperson' | 'doctor'
 * @param {string} oldPassword - 旧密码（明文）
 * @param {string} newPassword - 新密码（明文）
 * @returns {Promise<void>}
 * @throws {Error} 旧密码错误时抛出 400 错误
 */
async function changePassword(userId, userType, oldPassword, newPassword) {
  const table = userType === 'doctor' ? 'doctors' : 'users';

  /** 获取当前密码哈希 */
  const rows = await query(
    `SELECT password FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
    [userId]
  );
  if (rows.length === 0) {
    throw createError('用户不存在', 404);
  }

  /** 验证旧密码 */
  const isValid = await bcrypt.compare(oldPassword, rows[0].password);
  if (!isValid) {
    throw createError('旧密码错误', 400);
  }

  /** 加密新密码并更新 */
  const hashedPassword = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
  await query(
    `UPDATE ${table} SET password = ?, updated_at = NOW() WHERE id = ?`,
    [hashedPassword, userId]
  );
}

/**
 * 获取当前用户信息
 * @param {number} userId   - 用户ID
 * @param {string} userType - 用户类型
 * @returns {Promise<Object>} 用户信息
 */
async function getProfile(userId, userType) {
  if (userType === 'doctor') {
    const rows = await query(
      'SELECT id, name, phone, status, created_at FROM doctors WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    if (rows.length === 0) throw createError('用户不存在', 404);
    return { ...rows[0], userType: 'doctor' };
  }

  const rows = await query(
    `SELECT u.id, u.name, u.phone,
            u.province_code, u.province_name,
            u.city_code,     u.city_name,
            u.district_code, u.district_name,
            u.role, u.status, u.parent_id, u.created_at,
            p.name AS parent_name
     FROM users u
     LEFT JOIN users p ON u.parent_id = p.id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [userId]
  );
  if (rows.length === 0) throw createError('用户不存在', 404);
  return { ...rows[0], userType: 'salesperson' };
}

module.exports = { login, changePassword, getProfile };
