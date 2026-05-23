/**
 * @fileoverview 系统配置服务
 * @description 管理系统全局配置项（复诊间隔、提醒天数等）
 */

'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * 获取所有系统配置
 * @returns {Promise<Array>} 配置列表
 */
async function getAllConfigs() {
  return query('SELECT config_key, config_value, description, updated_at FROM system_configs ORDER BY id');
}

/**
 * 根据 key 获取单条配置
 * @param {string} key - 配置键
 * @returns {Promise<Object>}
 * @throws {Error} 不存在时抛出 404
 */
async function getConfigByKey(key) {
  const rows = await query(
    'SELECT config_key, config_value, description, updated_at FROM system_configs WHERE config_key = ?',
    [key]
  );
  if (rows.length === 0) throw createError('配置项不存在', 404);
  return rows[0];
}

/**
 * 修改配置项
 * @param {string} key   - 配置键
 * @param {string} value - 配置值（字符串）
 * @param {number} operatorId - 操作人ID
 * @returns {Promise<void>}
 */
async function updateConfig(key, value, operatorId) {
  const existing = await getConfigByKey(key);
  if (!existing) throw createError('配置项不存在', 404);

  /** 数值类配置校验 */
  const numericKeys = ['follow_up_interval_days'];
  if (numericKeys.includes(key)) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num <= 0) {
      throw createError('该配置项的值必须为正整数', 400);
    }
  }

  await query(
    'UPDATE system_configs SET config_value = ?, updated_by = ? WHERE config_key = ?',
    [String(value), operatorId, key]
  );
}

module.exports = { getAllConfigs, getConfigByKey, updateConfig };
