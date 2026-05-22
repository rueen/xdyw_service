/**
 * @fileoverview 系统配置控制器
 */

'use strict';

const configService = require('../services/configService');
const { success } = require('../utils/response');

/** 获取所有配置 */
async function getAll(req, res, next) {
  try {
    const configs = await configService.getAllConfigs();
    return success(res, configs);
  } catch (error) {
    next(error);
  }
}

/**
 * 修改单项配置
 * params: { key } body: { value }
 */
async function update(req, res, next) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await configService.updateConfig(key, value, req.user.userId);
    return success(res, null, '配置更新成功');
  } catch (error) {
    next(error);
  }
}

module.exports = { getAll, update };
