/**
 * @fileoverview 业务员管理服务
 * @description 处理业务员的增删改查、层级关系查询等业务逻辑
 */

'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const config = require('../config');
const { createError } = require('../middleware/errorHandler');

/**
 * 使用递归 CTE 查询某业务员的所有子孙 ID（包含自身）
 * 利用 MySQL 8+ 的 WITH RECURSIVE 语法
 * @param {number} salespersonId - 业务员 ID
 * @returns {Promise<number[]>} 包含自身及所有子孙的 ID 数组
 */
async function getDescendantIds(salespersonId) {
  const rows = await query(
    `WITH RECURSIVE subordinates AS (
       SELECT id FROM users WHERE id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT u.id FROM users u
       INNER JOIN subordinates s ON u.parent_id = s.id
       WHERE u.deleted_at IS NULL
     )
     SELECT id FROM subordinates`,
    [salespersonId]
  );
  return rows.map(r => r.id);
}

/**
 * 检查手机号是否在业务员表或医生表中已存在
 * @param {string} phone       - 手机号
 * @param {number} [excludeId] - 排除的业务员ID（编辑时使用）
 * @returns {Promise<boolean>} 存在则返回 true
 */
async function isPhoneExists(phone, excludeId = null) {
  let sql = 'SELECT id FROM users WHERE phone = ? AND deleted_at IS NULL';
  const params = [phone];
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const inUsers = await query(sql, params);
  if (inUsers.length > 0) return true;

  const inDoctors = await query('SELECT id FROM doctors WHERE phone = ? AND deleted_at IS NULL', [phone]);
  return inDoctors.length > 0;
}

/**
 * 获取业务员列表（分页 + 筛选）
 * @param {Object} filters
 * @param {string} [filters.keyword]       - 关键词（同时模糊匹配姓名和手机号）
 * @param {string} [filters.name]          - 姓名（模糊查询）
 * @param {string} [filters.phone]         - 手机号（模糊查询）
 * @param {string} [filters.province_code]  - 省级区划代码（精确匹配）
 * @param {string} [filters.city_code]      - 市级区划代码（精确匹配）
 * @param {string} [filters.district_code]  - 区级区划代码（精确匹配）
 * @param {number} [filters.institution_id] - 所属机构ID（精确匹配）
 * @param {number} [filters.parent_id]      - 上级业务员ID
 * @param {string} [filters.status]         - 状态
 * @param {number} [filters.page=1]         - 页码
 * @param {number} [filters.pageSize=10]    - 每页条数
 * @param {Object} [filters.currentUser]    - 当前登录用户（用于数据权限过滤）
 * @returns {Promise<{list: Array, total: number}>}
 */
async function getSalespersonList(filters = {}) {
  const {
    keyword, name, phone,
    province_code, city_code, district_code,
    institution_id, parent_id, status,
    page = 1, pageSize = 10,
    currentUser,
  } = filters;

  const conditions = ['u.deleted_at IS NULL', 'u.role != "super_admin"'];
  const params = [];

  /**
   * 数据权限：普通业务员只能看自己的子孙级业务员（不含自身）
   * 超级管理员可查看全部
   */
  if (currentUser && currentUser.role !== 'super_admin') {
    const descendantIds = await getDescendantIds(currentUser.userId);
    /** descendantIds 包含自身，过滤掉自身只保留子孙 */
    const subordinateIds = descendantIds.filter(id => id !== currentUser.userId);
    if (subordinateIds.length === 0) {
      return { list: [], total: 0 };
    }
    conditions.push(`u.id IN (${subordinateIds.map(() => '?').join(',')})`);
    params.push(...subordinateIds);
  }

  if (keyword) {
    /** keyword 同时匹配姓名和手机号（OR 关系），括号包裹避免与其他条件干扰 */
    conditions.push('(u.name LIKE ? OR u.phone LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  } else {
    if (name)  { conditions.push('u.name LIKE ?');  params.push(`%${name}%`); }
    if (phone) { conditions.push('u.phone LIKE ?'); params.push(`%${phone}%`); }
  }

  /** 使用区划代码精确筛选，避免同名区县的歧义 */
  if (province_code)  { conditions.push('u.province_code = ?');  params.push(province_code); }
  if (city_code)      { conditions.push('u.city_code = ?');      params.push(city_code); }
  if (district_code)  { conditions.push('u.district_code = ?');  params.push(district_code); }
  if (institution_id) { conditions.push('u.institution_id = ?'); params.push(institution_id); }
  if (parent_id)      { conditions.push('u.parent_id = ?');      params.push(parent_id); }
  if (status)         { conditions.push('u.status = ?');         params.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const [countResult, list] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM users u ${where}`, [...params]),
    query(
      `SELECT u.id, u.name, u.phone,
              u.province_code, u.province_name,
              u.city_code,     u.city_name,
              u.district_code, u.district_name,
              u.institution_id,
              u.role, u.status, u.parent_id, u.created_at, u.updated_at,
              p.name  AS parent_name,
              i.name  AS institution_name
       FROM users u
       LEFT JOIN users        p ON u.parent_id      = p.id
       LEFT JOIN institutions i ON u.institution_id = i.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
  ]);

  return { list, total: countResult[0].total };
}

/**
 * 根据 ID 获取业务员详情
 * @param {number} id - 业务员 ID
 * @returns {Promise<Object>} 业务员信息
 * @throws {Error} 不存在时抛出 404
 */
async function getSalespersonById(id) {
  const rows = await query(
    `SELECT u.id, u.name, u.phone,
            u.province_code, u.province_name,
            u.city_code,     u.city_name,
            u.district_code, u.district_name,
            u.institution_id,
            u.role, u.status, u.parent_id, u.created_at, u.updated_at,
            p.name AS parent_name,
            i.name AS institution_name
     FROM users u
     LEFT JOIN users        p ON u.parent_id      = p.id
     LEFT JOIN institutions i ON u.institution_id = i.id
     WHERE u.id = ? AND u.deleted_at IS NULL`,
    [id]
  );
  if (rows.length === 0) throw createError('业务员不存在', 404);
  return rows[0];
}

/**
 * 新增业务员
 * @param {Object} data
 * @param {string} data.name           - 姓名
 * @param {string} data.phone          - 手机号
 * @param {string} data.password       - 明文密码
 * @param {number} [data.parent_id]    - 上级业务员ID
 * @param {string} [data.province_code]  - 省级区划代码
 * @param {string} [data.province_name]  - 省名称
 * @param {string} [data.city_code]      - 市级区划代码
 * @param {string} [data.city_name]      - 市名称
 * @param {string} [data.district_code]  - 区级区划代码
 * @param {string} [data.district_name]  - 区名称
 * @param {number} [data.institution_id] - 所属机构ID
 * @param {number} operatorId            - 操作人ID
 * @returns {Promise<{id: number}>}
 */
async function createSalesperson(data, operatorId) {
  const {
    name, phone, password,
    parent_id,
    province_code, province_name,
    city_code, city_name,
    district_code, district_name,
    institution_id,
  } = data;

  /** 检查未删除的记录中是否已存在该手机号 */
  if (await isPhoneExists(phone)) {
    throw createError('该手机号已被注册', 409);
  }

  if (parent_id) {
    const parent = await query(
      'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL',
      [parent_id]
    );
    if (parent.length === 0) throw createError('上级业务员不存在', 400);
  }

  const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);

  /**
   * 查找是否存在已软删除的同手机号记录。
   * 若存在，则恢复该记录并更新信息（复用原 ID），保证同一手机号在表中只有一条记录。
   * 若不存在，则正常插入新记录。
   */
  const deleted = await query(
    'SELECT id FROM users WHERE phone = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 1',
    [phone]
  );

  if (deleted.length > 0) {
    /** 恢复已删除记录，清除 deleted_at 并更新全部字段 */
    await query(
      `UPDATE users SET
         name = ?, password = ?,
         province_code = ?, province_name = ?,
         city_code = ?, city_name = ?,
         district_code = ?, district_name = ?,
         institution_id = ?,
         parent_id = ?, role = 'salesperson', status = 'normal',
         deleted_at = NULL, updated_by = ?, created_by = ?
       WHERE id = ?`,
      [
        name, hashedPassword,
        province_code  || null, province_name  || null,
        city_code      || null, city_name      || null,
        district_code  || null, district_name  || null,
        institution_id || null,
        parent_id      || null,
        operatorId, operatorId,
        deleted[0].id,
      ]
    );
    return { id: deleted[0].id };
  }

  /** 全新记录，直接插入 */
  const result = await query(
    `INSERT INTO users
       (name, phone, password,
        province_code, province_name,
        city_code, city_name,
        district_code, district_name,
        institution_id,
        parent_id, role, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'salesperson', 'normal', ?, ?)`,
    [
      name, phone, hashedPassword,
      province_code  || null, province_name  || null,
      city_code      || null, city_name      || null,
      district_code  || null, district_name  || null,
      institution_id || null,
      parent_id      || null,
      operatorId, operatorId,
    ]
  );

  return { id: result.insertId };
}

/**
 * 修改业务员
 * @param {number} id         - 业务员ID
 * @param {Object} data       - 修改字段（字段名与数据库保持一致，均为下划线风格）
 * @param {number} operatorId - 操作人ID
 * @returns {Promise<void>}
 */
async function updateSalesperson(id, data, operatorId) {
  const existing = await getSalespersonById(id);

  const {
    name, phone, password, status,
    parent_id,
    province_code, province_name,
    city_code, city_name,
    district_code, district_name,
    institution_id,
  } = data;

  if (phone && phone !== existing.phone) {
    if (await isPhoneExists(phone, id)) {
      throw createError('该手机号已被注册', 409);
    }
  }

  if (parent_id && parent_id === id) {
    throw createError('不能将自己设为自己的上级', 400);
  }

  const fields = [];
  const params = [];

  if (name)      { fields.push('name = ?');      params.push(name); }
  if (phone)     { fields.push('phone = ?');     params.push(phone); }
  if (status)    { fields.push('status = ?');    params.push(status); }
  if (parent_id !== undefined) { fields.push('parent_id = ?'); params.push(parent_id || null); }

  /** 省市区 code 和 name 成对更新 */
  if (province_code !== undefined)  { fields.push('province_code = ?');  params.push(province_code  || null); }
  if (province_name !== undefined)  { fields.push('province_name = ?');  params.push(province_name  || null); }
  if (city_code !== undefined)      { fields.push('city_code = ?');      params.push(city_code      || null); }
  if (city_name !== undefined)      { fields.push('city_name = ?');      params.push(city_name      || null); }
  if (district_code !== undefined)  { fields.push('district_code = ?');  params.push(district_code  || null); }
  if (district_name !== undefined)  { fields.push('district_name = ?');  params.push(district_name  || null); }
  if (institution_id !== undefined) { fields.push('institution_id = ?'); params.push(institution_id || null); }

  if (password) {
    const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
    fields.push('password = ?');
    params.push(hashedPassword);
  }

  if (fields.length === 0) throw createError('没有需要更新的字段', 400);

  fields.push('updated_by = ?');
  params.push(operatorId);
  params.push(id);

  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
}

/**
 * 软删除业务员
 * @param {number} id         - 业务员ID
 * @param {number} operatorId - 操作人ID
 */
async function deleteSalesperson(id, operatorId) {
  await getSalespersonById(id);

  const subordinates = await query(
    'SELECT id FROM users WHERE parent_id = ? AND deleted_at IS NULL',
    [id]
  );
  if (subordinates.length > 0) {
    throw createError('该业务员下还有子级业务员，请先处理后再删除', 400);
  }

  await query(
    'UPDATE users SET deleted_at = NOW(), updated_by = ? WHERE id = ?',
    [operatorId, id]
  );
}

module.exports = {
  getDescendantIds,
  getSalespersonList,
  getSalespersonById,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson,
};
