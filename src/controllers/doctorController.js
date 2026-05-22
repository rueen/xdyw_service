/**
 * @fileoverview 医生管理控制器
 * @description 处理医生 CRUD 操作的 HTTP 请求
 */

'use strict';

const doctorService = require('../services/doctorService');
const { success, created, paginate } = require('../utils/response');

/**
 * 获取医生列表
 */
async function getList(req, res, next) {
  try {
    const { name, phone, status, page = 1, pageSize = 10 } = req.query;
    const { list, total } = await doctorService.getDoctorList({
      name, phone, status,
      page:     parseInt(page),
      pageSize: parseInt(pageSize),
    });
    return paginate(res, list, total, parseInt(page), parseInt(pageSize));
  } catch (error) {
    next(error);
  }
}

/**
 * 获取医生详情
 */
async function getDetail(req, res, next) {
  try {
    const doctor = await doctorService.getDoctorById(parseInt(req.params.id));
    return success(res, doctor);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取所有可用医生（用于病例指派选择）
 */
async function getActiveDoctors(req, res, next) {
  try {
    const list = await doctorService.getActiveDoctors();
    return success(res, list);
  } catch (error) {
    next(error);
  }
}

/**
 * 新增医生
 */
async function create(req, res, next) {
  try {
    const { name, phone, password } = req.body;
    const operatorId = req.user.userId;
    const result = await doctorService.createDoctor({ name, phone, password }, operatorId);
    return created(res, result, '医生创建成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 修改医生
 */
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const operatorId = req.user.userId;
    await doctorService.updateDoctor(id, req.body, operatorId);
    return success(res, null, '医生信息更新成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 删除医生
 */
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const operatorId = req.user.userId;
    await doctorService.deleteDoctor(id, operatorId);
    return success(res, null, '医生删除成功');
  } catch (error) {
    next(error);
  }
}

module.exports = { getList, getDetail, getActiveDoctors, create, update, remove };
