/**
 * @fileoverview 通知服务
 * @description 管理业务员的复诊提醒通知（查询、标记已读）
 */

'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * 获取当前业务员的通知列表
 * @param {number} salespersonId - 业务员ID
 * @param {Object} [filters]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=20]
 * @param {number} [filters.isRead] - 0:未读 1:已读 undefined:全部
 * @returns {Promise<{list: Array, total: number, unreadCount: number}>}
 */
async function getNotifications(salespersonId, filters = {}) {
  const { page = 1, pageSize = 20, isRead } = filters;

  const conditions = ['n.salesperson_id = ?'];
  const params = [salespersonId];

  if (isRead !== undefined && isRead !== null) {
    conditions.push('n.is_read = ?');
    params.push(isRead);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;

  const [countResult, list, unreadResult] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM notifications n ${where}`, [...params]),
    query(
      `SELECT n.id, n.record_id, n.type, n.content, n.is_read, n.created_at,
              mr.patient_name, mr.status AS record_status
       FROM notifications n
       LEFT JOIN medical_records mr ON n.record_id = mr.id
       ${where}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    ),
    /** 未读数量 */
    query(
      'SELECT COUNT(*) AS count FROM notifications WHERE salesperson_id = ? AND is_read = 0',
      [salespersonId]
    ),
  ]);

  return {
    list,
    total:       countResult[0].total,
    unreadCount: unreadResult[0].count,
  };
}

/**
 * 标记单条通知为已读
 * @param {number} notificationId - 通知ID
 * @param {number} salespersonId  - 当前业务员ID（防越权）
 * @returns {Promise<void>}
 */
async function markAsRead(notificationId, salespersonId) {
  const rows = await query(
    'SELECT id, salesperson_id FROM notifications WHERE id = ?',
    [notificationId]
  );
  if (rows.length === 0) throw createError('通知不存在', 404);
  if (rows[0].salesperson_id !== salespersonId) throw createError('无权操作此通知', 403);

  await query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
}

/**
 * 全部标记已读
 * @param {number} salespersonId - 当前业务员ID
 * @returns {Promise<void>}
 */
async function markAllAsRead(salespersonId) {
  await query(
    'UPDATE notifications SET is_read = 1 WHERE salesperson_id = ? AND is_read = 0',
    [salespersonId]
  );
}

module.exports = { getNotifications, markAsRead, markAllAsRead };
