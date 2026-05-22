/**
 * @fileoverview 数据统计控制器
 */

'use strict';

const statisticsService = require('../services/statisticsService');
const { success } = require('../utils/response');

/**
 * 获取统计数据
 * query: { rangeType: 'today'|'yesterday'|'week'|'month'|'custom', startDate?, endDate? }
 */
async function getStatistics(req, res, next) {
  try {
    const { rangeType = 'today', startDate, endDate } = req.query;
    const data = await statisticsService.getStatistics(
      rangeType,
      startDate,
      endDate,
      { userId: req.user.userId, role: req.user.role, userType: req.user.userType }
    );
    return success(res, data);
  } catch (error) {
    next(error);
  }
}

module.exports = { getStatistics };
