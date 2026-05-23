/**
 * @fileoverview 复诊提醒阈值配置服务
 * @description 管理 follow_up_reminder_configs 表，支持多个提醒天数阈值的增删查
 */

'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * 获取所有提醒阈值配置（升序排列）
 * @returns {Promise<Array<{id: number, days: number, created_at: string}>>}
 */
async function getAllReminderConfigs() {
  return query(
    'SELECT id, days, created_at FROM follow_up_reminder_configs ORDER BY days ASC'
  );
}

/**
 * 新增提醒阈值
 * @param {number} days - 提醒天数（必须为正整数，且不能与已有配置重复）
 * @returns {Promise<{id: number, days: number}>}
 */
async function addReminderConfig(days) {
  if (!Number.isInteger(days) || days < 1) {
    throw createError('提醒天数必须为正整数', 400);
  }

  const existing = await query(
    'SELECT id FROM follow_up_reminder_configs WHERE days = ?',
    [days]
  );
  if (existing.length > 0) throw createError(`已存在 ${days} 天的提醒配置`, 409);

  const result = await query(
    'INSERT INTO follow_up_reminder_configs (days) VALUES (?)',
    [days]
  );
  return { id: result.insertId, days };
}

/**
 * 删除提醒阈值
 * @param {number} days - 要删除的提醒天数
 * @returns {Promise<void>}
 */
async function removeReminderConfig(days) {
  const existing = await query(
    'SELECT id FROM follow_up_reminder_configs WHERE days = ?',
    [days]
  );
  if (existing.length === 0) throw createError(`不存在 ${days} 天的提醒配置`, 404);

  /** 至少保留一个提醒阈值 */
  const total = await query('SELECT COUNT(*) AS cnt FROM follow_up_reminder_configs');
  if (total[0].cnt <= 1) throw createError('至少需要保留一个提醒天数配置', 400);

  await query('DELETE FROM follow_up_reminder_configs WHERE days = ?', [days]);
}

module.exports = { getAllReminderConfigs, addReminderConfig, removeReminderConfig };
