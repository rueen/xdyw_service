/**
 * @fileoverview 业务员管理控制器
 * @description 处理业务员 CRUD 操作的 HTTP 请求
 */

'use strict';

const salespersonService = require('../services/salespersonService');
const { query } = require('../config/database');
const { success, created, paginate } = require('../utils/response');

/**
 * 获取业务员列表
 */
async function getList(req, res, next) {
  try {
    const {
      keyword, name, phone,
      provinceCode, cityCode, districtCode,
      parentId, status,
      page = 1, pageSize = 10,
    } = req.query;

    const { list, total } = await salespersonService.getSalespersonList({
      keyword, name, phone,
      province_code: provinceCode,
      city_code:     cityCode,
      district_code: districtCode,
      parent_id: parentId ? parseInt(parentId) : undefined,
      status,
      page:     parseInt(page),
      pageSize: parseInt(pageSize),
      currentUser: {
        userId: req.user.userId,
        role:   req.user.role,
      },
    });

    return paginate(res, list, total, parseInt(page), parseInt(pageSize));
  } catch (error) {
    next(error);
  }
}

/**
 * 获取业务员详情
 */
async function getDetail(req, res, next) {
  try {
    const salesperson = await salespersonService.getSalespersonById(parseInt(req.params.id));
    return success(res, salesperson);
  } catch (error) {
    next(error);
  }
}

/**
 * 新增业务员
 */
async function create(req, res, next) {
  try {
    const {
      name, phone, password,
      parent_id,
      province_code, province_name,
      city_code, city_name,
      district_code, district_name,
    } = req.body;
    const operatorId = req.user.userId;

    /** 不传 parent_id 时，默认挂在超级管理员下 */
    let resolvedParentId = parent_id;
    if (!resolvedParentId) {
      const superAdmin = await query(
        "SELECT id FROM users WHERE role = 'super_admin' AND deleted_at IS NULL LIMIT 1",
        []
      );
      resolvedParentId = superAdmin.length > 0 ? superAdmin[0].id : null;
    }

    const result = await salespersonService.createSalesperson(
      {
        name, phone, password,
        parent_id: resolvedParentId,
        province_code, province_name,
        city_code, city_name,
        district_code, district_name,
      },
      operatorId
    );
    return created(res, result, '业务员创建成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 修改业务员
 */
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const operatorId = req.user.userId;
    await salespersonService.updateSalesperson(id, req.body, operatorId);
    return success(res, null, '业务员信息更新成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 删除业务员
 */
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const operatorId = req.user.userId;
    await salespersonService.deleteSalesperson(id, operatorId);
    return success(res, null, '业务员删除成功');
  } catch (error) {
    next(error);
  }
}

/**
 * 获取下级业务员列表（业务员可查看自己的下级）
 */
async function getSubordinates(req, res, next) {
  try {
    const { userId } = req.user;
    const { page = 1, pageSize = 100 } = req.query;
    const { list, total } = await salespersonService.getSalespersonList({
      parent_id: userId,
      page:     parseInt(page),
      pageSize: parseInt(pageSize),
    });
    return paginate(res, list, total, parseInt(page), parseInt(pageSize));
  } catch (error) {
    next(error);
  }
}

module.exports = { getList, getDetail, create, update, remove, getSubordinates };
