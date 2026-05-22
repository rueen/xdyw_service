/**
 * @fileoverview 病例管理控制器
 * @description 处理病例 CRUD、状态流转操作的 HTTP 请求
 */

'use strict';

const recordService = require('../services/recordService');
const { success, created, paginate } = require('../utils/response');

/**
 * 获取病例列表
 */
async function getList(req, res, next) {
  try {
    const {
      patientName, patientPhone, patientIdCard,
      doctorId, salespersonId, status, page = 1, pageSize = 10,
    } = req.query;

    const { list, total } = await recordService.getRecordList(
      {
        patientName, patientPhone, patientIdCard,
        doctorId:      doctorId      ? parseInt(doctorId)      : undefined,
        salespersonId: salespersonId ? parseInt(salespersonId) : undefined,
        status,
        page:     parseInt(page),
        pageSize: parseInt(pageSize),
      },
      req.user
    );

    return paginate(res, list, total, parseInt(page), parseInt(pageSize));
  } catch (error) {
    next(error);
  }
}

/**
 * 获取病例详情
 */
async function getDetail(req, res, next) {
  try {
    const record = await recordService.getRecordById(parseInt(req.params.id), req.user);
    return success(res, record);
  } catch (error) {
    next(error);
  }
}

/**
 * 新增病例（业务员）
 */
async function create(req, res, next) {
  try {
    const { patientName, patientPhone, patientIdCard, doctorId, description, photos } = req.body;
    const result = await recordService.createRecord(
      { patientName, patientPhone, patientIdCard, doctorId: parseInt(doctorId), description, photos },
      req.user
    );
    return created(res, result, '病例创建成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 修改病例基础信息（业务员）
 */
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await recordService.updateRecord(id, req.body, req.user);
    return success(res, null, '病例更新成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 删除病例（超级管理员）
 */
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await recordService.deleteRecord(id, req.user.userId);
    return success(res, null, '病例删除成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 医生判读病例
 * body: { operation: 'review_suitable'|'review_unsuitable'|'review_incomplete', notes?: string }
 */
async function review(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { operation, notes } = req.body;
    await recordService.reviewRecord(id, operation, notes, req.user);

    const messages = {
      review_suitable:   '已标记为符合用药',
      review_unsuitable: '已标记为不符合用药',
      review_incomplete: '已标记为资料不全',
    };
    return success(res, null, messages[operation] || '操作成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 业务员操作"已就诊"（符合用药 -> 待复诊）
 */
async function markVisited(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await recordService.markVisited(id, req.user);
    return success(res, null, '已标记为已就诊，病例进入待复诊状态');
  } catch (error) {
    next(error);
  }
}

/**
 * 业务员操作"已复诊"
 * body: { followUpTime: 'YYYY-MM-DD', notes?: string }
 */
async function markFollowUp(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { followUpTime, notes } = req.body;
    await recordService.markFollowUp(id, followUpTime, notes, req.user);
    return success(res, null, '复诊记录已保存');
  } catch (error) {
    next(error);
  }
}

/**
 * 标记病例为已完诊（任意状态）
 */
async function markCompleted(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await recordService.markCompleted(id, req.user);
    return success(res, null, '病例已标记为已完诊');
  } catch (error) {
    next(error);
  }
}

/**
 * 业务员补充资料（资料不全 -> 待判读）
 * body: { description?: string, photos?: string[] }
 */
async function supplement(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { description, photos } = req.body;
    await recordService.supplementRecord(id, { description, photos }, req.user);
    return success(res, null, '资料补充成功，病例已重新进入待判读状态');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getList, getDetail, create, update, remove,
  review, markVisited, markFollowUp, markCompleted, supplement,
};
