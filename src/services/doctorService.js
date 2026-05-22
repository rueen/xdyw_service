/**
 * @fileoverview 医生管理服务
 * @description 处理医生的增删改查业务逻辑
 */

'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const config = require('../config');
const { createError } = require('../middleware/errorHandler');

/**
 * 检查手机号是否在业务员表或医生表中已存在
 * @param {string} phone     - 手机号
 * @param {number} [excludeId] - 排除的医生ID（编辑时使用）
 * @returns {Promise<boolean>}
 */
async function isPhoneExists(phone, excludeId = null) {
  /** 查医生表 */
  let sql = 'SELECT id FROM doctors WHERE phone = ? AND deleted_at IS NULL';
  const params = [phone];
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const inDoctors = await query(sql, params);
  if (inDoctors.length > 0) return true;

  /** 查业务员表 */
  const inUsers = await query('SELECT id FROM users WHERE phone = ? AND deleted_at IS NULL', [phone]);
  return inUsers.length > 0;
}

/**
 * 获取医生列表（分页 + 筛选）
 * @param {Object} filters - 筛选条件
 * @param {string} [filters.name]   - 姓名（模糊查询）
 * @param {string} [filters.phone]  - 手机号（模糊查询）
 * @param {string} [filters.status] - 状态
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=10]
 * @returns {Promise<{list: Array, total: number}>}
 */
async function getDoctorList(filters = {}) {
  const { name, phone, status, page = 1, pageSize = 10 } = filters;

  const conditions = ['deleted_at IS NULL'];
  const params = [];

  if (name) {
    conditions.push('name LIKE ?');
    params.push(`%${name}%`);
  }
  if (phone) {
    conditions.push('phone LIKE ?');
    params.push(`%${phone}%`);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const [countResult, list] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM doctors ${where}`, [...params]),
    query(
      `SELECT id, name, phone, status, created_at, updated_at
       FROM doctors ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  return { list, total: countResult[0].total };
}

/**
 * 根据 ID 获取医生详情
 * @param {number} id - 医生ID
 * @returns {Promise<Object>}
 * @throws {Error} 不存在时抛出 404
 */
async function getDoctorById(id) {
  const rows = await query(
    'SELECT id, name, phone, status, created_at, updated_at FROM doctors WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (rows.length === 0) throw createError('医生不存在', 404);
  return rows[0];
}

/**
 * 新增医生
 * @param {Object} data - 医生数据
 * @param {string} data.name
 * @param {string} data.phone
 * @param {string} data.password
 * @param {number} operatorId - 操作人ID
 * @returns {Promise<{id: number}>}
 */
async function createDoctor(data, operatorId) {
  const { name, phone, password } = data;

  if (await isPhoneExists(phone)) {
    throw createError('该手机号已被注册', 409);
  }

  const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

  /**
   * 若存在已软删除的同手机号医生记录，恢复并更新，保证表中同一手机号只有一条记录。
   */
  const deleted = await query(
    'SELECT id FROM doctors WHERE phone = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1',
    [phone]
  );

  if (deleted.length > 0) {
    await query(
      `UPDATE doctors SET
         name = ?, password = ?, status = 'normal',
         deleted_at = NULL, updated_by = ?, created_by = ?
       WHERE id = ?`,
      [name, hashedPassword, operatorId, operatorId, deleted[0].id]
    );
    return { id: deleted[0].id };
  }

  const result = await query(
    `INSERT INTO doctors (name, phone, password, status, created_by, updated_by)
     VALUES (?, ?, ?, 'normal', ?, ?)`,
    [name, phone, hashedPassword, operatorId, operatorId]
  );

  return { id: result.insertId };
}

/**
 * 修改医生
 * @param {number} id - 医生ID
 * @param {Object} data - 修改字段
 * @param {number} operatorId - 操作人ID
 * @returns {Promise<void>}
 */
async function updateDoctor(id, data, operatorId) {
  const existing = await getDoctorById(id);

  const { name, phone, password, status } = data;

  if (phone && phone !== existing.phone) {
    if (await isPhoneExists(phone, id)) {
      throw createError('该手机号已被注册', 409);
    }
  }

  const fields = [];
  const params = [];

  if (name)   { fields.push('name = ?');   params.push(name); }
  if (phone)  { fields.push('phone = ?');  params.push(phone); }
  if (status) { fields.push('status = ?'); params.push(status); }
  if (password) {
    const hashed = await bcrypt.hash(password, config.bcryptSaltRounds);
    fields.push('password = ?');
    params.push(hashed);
  }

  if (fields.length === 0) throw createError('没有需要更新的字段', 400);

  fields.push('updated_by = ?');
  params.push(operatorId);
  params.push(id);

  await query(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`, params);
}

/**
 * 软删除医生
 * @param {number} id - 医生ID
 * @param {number} operatorId - 操作人ID
 */
async function deleteDoctor(id, operatorId) {
  await getDoctorById(id);
  await query(
    'UPDATE doctors SET deleted_at = NOW(), updated_by = ? WHERE id = ?',
    [operatorId, id]
  );
}

/**
 * 获取所有正常状态的医生列表（用于病例指派时选择）
 * @returns {Promise<Array>}
 */
async function getActiveDoctors() {
  return query(
    "SELECT id, name, phone FROM doctors WHERE status = 'normal' AND deleted_at IS NULL ORDER BY name"
  );
}

module.exports = {
  getDoctorList,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getActiveDoctors,
};
