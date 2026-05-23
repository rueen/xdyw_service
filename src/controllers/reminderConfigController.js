/**
 * @fileoverview 复诊提醒阈值配置控制器
 */

'use strict';

const reminderConfigService = require('../services/reminderConfigService');
const { success, created } = require('../utils/response');

/** 获取所有提醒阈值配置 */
async function getAll(req, res, next) {
  try {
    const list = await reminderConfigService.getAllReminderConfigs();
    return success(res, list);
  } catch (error) {
    next(error);
  }
}

/** 新增提醒阈值 */
async function add(req, res, next) {
  try {
    const days = parseInt(req.body.days, 10);
    const result = await reminderConfigService.addReminderConfig(days);
    return created(res, result, '提醒配置添加成功');
  } catch (error) {
    next(error);
  }
}

/** 删除提醒阈值 */
async function remove(req, res, next) {
  try {
    const days = parseInt(req.params.days, 10);
    await reminderConfigService.removeReminderConfig(days);
    return success(res, null, '提醒配置删除成功');
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, add, remove };
