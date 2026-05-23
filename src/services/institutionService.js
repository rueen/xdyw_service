/**
 * @fileoverview 机构管理服务
 * @description 处理机构的增删改查业务逻辑
 */

'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * 获取机构列表（分页 + 筛选）
 * @param {Object} filters
 * @param {string} [filters.name]      - 机构名称（模糊查询）
 * @param {string} [filters.status]    - 状态：normal / disabled
 * @param {number} [filters.page=1]    - 页码
 * @param {number} [filters.pageSize=10] - 每页条数
 * @returns {Promise<{list: Array, total: number}>}
 */
async function getInstitutionList(filters = {}) {
  const { name, status, page = 1, pageSize = 10 } = filters;

  const conditions = ['deleted_at IS NULL'];
  const params = [];

  if (name)   { conditions.push('name LIKE ?'); params.push(`%${name}%`); }
  if (status) { conditions.push('status = ?');  params.push(status); }

  const where  = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const [countResult, list] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM institutions ${where}`, [...params]),
    query(
      `SELECT id, name, status, created_at, updated_at
       FROM institutions
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  return { list, total: countResult[0].total };
}

/**
 * 根据 ID 获取机构详情
 * @param {number} id - 机构 ID
 * @returns {Promise<Object>} 机构信息
 * @throws {Error} 不存在时抛出 404
 */
async function getInstitutionById(id) {
  const rows = await query(
    'SELECT id, name, status, created_at, updated_at FROM institutions WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (rows.length === 0) throw createError('机构不存在', 404);
  return rows[0];
}

/**
 * 新增机构
 * @param {Object} data
 * @param {string} data.name     - 机构名称
 * @param {string} [data.status] - 状态，默认 normal
 * @returns {Promise<{id: number}>}
 */
async function createInstitution(data) {
  const { name, status = 'normal' } = data;

  const exists = await query(
    'SELECT id FROM institutions WHERE name = ? AND deleted_at IS NULL',
    [name]
  );
  if (exists.length > 0) throw createError('该机构名称已存在', 409);

  const result = await query(
    'INSERT INTO institutions (name, status) VALUES (?, ?)',
    [name, status]
  );

  return { id: result.insertId };
}

/**
 * 修改机构
 * @param {number} id      - 机构 ID
 * @param {Object} data    - 修改字段
 * @param {string} [data.name]   - 机构名称
 * @param {string} [data.status] - 状态
 * @returns {Promise<void>}
 */
async function updateInstitution(id, data) {
  await getInstitutionById(id);

  const { name, status } = data;

  if (name) {
    const exists = await query(
      'SELECT id FROM institutions WHERE name = ? AND id != ? AND deleted_at IS NULL',
      [name, id]
    );
    if (exists.length > 0) throw createError('该机构名称已存在', 409);
  }

  const fields = [];
  const params = [];

  if (name)   { fields.push('name = ?');   params.push(name); }
  if (status) { fields.push('status = ?'); params.push(status); }

  if (fields.length === 0) throw createError('没有需要更新的字段', 400);

  params.push(id);
  await query(`UPDATE institutions SET ${fields.join(', ')} WHERE id = ?`, params);
}

/**
 * 软删除机构
 * @param {number} id - 机构 ID
 * @returns {Promise<void>}
 */
async function deleteInstitution(id) {
  await getInstitutionById(id);

  /** 自动解除该机构下所有业务员的关联 */
  await query(
    'UPDATE users SET institution_id = NULL WHERE institution_id = ? AND deleted_at IS NULL',
    [id]
  );

  await query('UPDATE institutions SET deleted_at = NOW() WHERE id = ?', [id]);
}

module.exports = {
  getInstitutionList,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,
};
