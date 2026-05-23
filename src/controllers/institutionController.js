/**
 * @fileoverview 机构管理控制器
 * @description 处理机构 CRUD 操作的 HTTP 请求
 */

'use strict';

const institutionService = require('../services/institutionService');
const { success, created, paginate } = require('../utils/response');

/**
 * 获取机构列表
 */
async function getList(req, res, next) {
  try {
    const { name, status, page = 1, pageSize = 10 } = req.query;

    const { list, total } = await institutionService.getInstitutionList({
      name,
      status,
      page:     parseInt(page),
      pageSize: parseInt(pageSize),
    });

    return paginate(res, list, total, parseInt(page), parseInt(pageSize));
  } catch (error) {
    next(error);
  }
}

/**
 * 新增机构
 */
async function create(req, res, next) {
  try {
    const { name, status } = req.body;
    const result = await institutionService.createInstitution({ name, status });
    return created(res, result, '机构创建成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 修改机构
 */
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await institutionService.updateInstitution(id, req.body);
    return success(res, null, '机构信息更新成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 删除机构
 */
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await institutionService.deleteInstitution(id);
    return success(res, null, '机构删除成功');
  } catch (error) {
    next(error);
  }
}

module.exports = { getList, create, update, remove };
