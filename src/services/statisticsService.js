/**
 * @fileoverview 数据统计服务
 * @description 提供昨日、今日、本周、本月、自定义时间范围的病例统计数据
 */

'use strict';

const { query } = require('../config/database');
const { createError } = require('../middleware/errorHandler');
const { getDescendantIds } = require('./salespersonService');

/**
 * 根据时间范围类型计算开始和结束时间
 * @param {string} rangeType - 时间范围类型：yesterday|today|week|month|custom
 * @param {string} [startDate] - 自定义开始日期（YYYY-MM-DD）
 * @param {string} [endDate]   - 自定义结束日期（YYYY-MM-DD）
 * @returns {{ startTime: string, endTime: string }} 开始和结束时间（含时分秒）
 */
function calcDateRange(rangeType, startDate, endDate) {
  const now = new Date();

  /** 获取当前日期的零点 */
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  /** 获取当前日期的 23:59:59 */
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  switch (rangeType) {
    case 'today': {
      return {
        startTime: formatDatetime(todayStart),
        endTime:   formatDatetime(todayEnd),
      };
    }
    case 'yesterday': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { startTime: formatDatetime(start), endTime: formatDatetime(end) };
    }
    case 'week': {
      /** 本周一 00:00:00 */
      const dayOfWeek = todayStart.getDay() || 7; // 将周日的 0 改为 7
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
      return { startTime: formatDatetime(weekStart), endTime: formatDatetime(todayEnd) };
    }
    case 'month': {
      /** 本月 1 日 00:00:00 */
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startTime: formatDatetime(monthStart), endTime: formatDatetime(todayEnd) };
    }
    case 'custom': {
      if (!startDate || !endDate) {
        throw createError('自定义时间范围需要提供开始和结束日期', 400);
      }
      if (new Date(startDate) > new Date(endDate)) {
        throw createError('开始日期不能晚于结束日期', 400);
      }
      return {
        startTime: `${startDate} 00:00:00`,
        endTime:   `${endDate} 23:59:59`,
      };
    }
    default:
      throw createError('不支持的时间范围类型', 400);
  }
}

/**
 * 格式化 Date 为本地时间的 MySQL datetime 字符串（YYYY-MM-DD HH:mm:ss）
 * 不能用 toISOString()，那会转为 UTC，在东八区会差 8 小时
 * @param {Date} date
 * @returns {string}
 */
function formatDatetime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 获取统计数据
 * @param {string} rangeType   - 时间范围类型
 * @param {string} [startDate] - 自定义开始日期
 * @param {string} [endDate]   - 自定义结束日期
 * @param {Object} currentUser - 当前登录用户 { userId, role, userType }
 * @returns {Promise<Object>} 统计结果
 */
async function getStatistics(rangeType, startDate, endDate, currentUser) {
  const { startTime, endTime } = calcDateRange(rangeType, startDate, endDate);
  const { userId, role, userType } = currentUser;

  /**
   * 数据权限过滤，生成附加的 WHERE 条件和参数：
   * - 超级管理员：统计全部病例，无附加条件
   * - 普通业务员：只统计自己及子孙录入的病例（按 salesperson_id 过滤）
   * - 医生：只统计指派给自己的病例（按 doctor_id 过滤）
   */
  let extraCondition = '';
  let extraParams = [];

  if (userType === 'doctor') {
    extraCondition = 'AND doctor_id = ?';
    extraParams = [userId];
  } else if (role !== 'super_admin') {
    const visibleIds = await getDescendantIds(userId);
    if (visibleIds.length === 0) {
      return {
        timeRange: { type: rangeType, startTime, endTime },
        newCases: 0, pendingReview: 0, suitable: 0,
        unsuitable: 0, incomplete: 0,
        pendingFollowUp: 0, completed: 0, visited: 0,
      };
    }
    extraCondition = `AND salesperson_id IN (${visibleIds.map(() => '?').join(',')})`;
    extraParams = visibleIds;
  }

  /**
   * 统计逻辑：以「在时间范围内创建的病例」为基准，统计这批病例当前各状态的分布。
   *
   * 例如今日新增 10 条病例：
   *   - 6 条仍是「待判读」→ pendingReview = 6
   *   - 3 条已被判读为「符合用药」→ suitable = 3
   *   - 1 条「资料不全」→ incomplete = 1
   *   - newCases = 10
   *
   * 已就诊（visited）从操作日志统计，因为「已就诊」不是独立状态，
   * 操作后病例直接流转为「待复诊」，需从日志中读取发生次数。
   */
  const statusCondition = `created_at BETWEEN ? AND ? AND deleted_at IS NULL ${extraCondition}`;
  const statusParams = [startTime, endTime, ...extraParams];

  const [statusResult] = await query(
    `SELECT
       COUNT(*)                                              AS newCases,
       SUM(status = 'pending_review')                       AS pendingReview,
       SUM(status = 'suitable')                             AS suitable,
       SUM(status = 'unsuitable')                           AS unsuitable,
       SUM(status = 'incomplete')                           AS incomplete,
       SUM(status = 'pending_follow_up')                    AS pendingFollowUp,
       SUM(status = 'completed')                            AS completed
     FROM medical_records
     WHERE ${statusCondition}`,
    statusParams
  );

  /** 已就诊次数：统计时间范围内发生的 visited 操作，关联病例表做范围限制 */
  let visitedResult;
  if (extraCondition) {
    [visitedResult] = await query(
      `SELECT COUNT(*) AS count
       FROM record_operations ro
       INNER JOIN medical_records mr ON ro.record_id = mr.id AND mr.deleted_at IS NULL
       WHERE ro.operation = 'visited'
         AND ro.created_at BETWEEN ? AND ?
         AND mr.${extraCondition.replace(/^AND\s+/, '')}`,
      [startTime, endTime, ...extraParams]
    );
  } else {
    [visitedResult] = await query(
      `SELECT COUNT(*) AS count FROM record_operations
       WHERE operation = 'visited' AND created_at BETWEEN ? AND ?`,
      [startTime, endTime]
    );
  }

  return {
    timeRange:        { type: rangeType, startTime, endTime },
    newCases:         Number(statusResult.newCases        || 0),
    pendingReview:    Number(statusResult.pendingReview   || 0),
    suitable:         Number(statusResult.suitable        || 0),
    unsuitable:       Number(statusResult.unsuitable      || 0),
    incomplete:       Number(statusResult.incomplete      || 0),
    pendingFollowUp:  Number(statusResult.pendingFollowUp || 0),
    completed:        Number(statusResult.completed       || 0),
    visited:          Number(visitedResult.count          || 0),
  };
}

module.exports = { getStatistics };
