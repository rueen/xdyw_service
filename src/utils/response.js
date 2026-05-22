/**
 * @fileoverview 统一响应格式工具
 * @description 提供标准化的 HTTP 响应方法，确保所有接口返回格式一致
 */

'use strict';

/**
 * 成功响应
 * @param {import('express').Response} res - Express 响应对象
 * @param {*} [data=null] - 响应数据
 * @param {string} [message='操作成功'] - 响应消息
 * @param {number} [statusCode=200] - HTTP 状态码
 */
function success(res, data = null, message = '操作成功', statusCode = 200) {
  return res.status(statusCode).json({
    code:    statusCode,
    message,
    data,
  });
}

/**
 * 创建成功响应（HTTP 201）
 * @param {import('express').Response} res - Express 响应对象
 * @param {*} [data=null] - 响应数据
 * @param {string} [message='创建成功'] - 响应消息
 */
function created(res, data = null, message = '创建成功') {
  return success(res, data, message, 201);
}

/**
 * 失败响应
 * @param {import('express').Response} res - Express 响应对象
 * @param {string} [message='操作失败'] - 错误消息
 * @param {number} [statusCode=400] - HTTP 状态码
 * @param {*} [errors=null] - 详细错误信息（参数校验错误等）
 */
function fail(res, message = '操作失败', statusCode = 400, errors = null) {
  const body = { code: statusCode, message };
  if (errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * 未授权响应（HTTP 401）
 * @param {import('express').Response} res - Express 响应对象
 * @param {string} [message='请先登录'] - 错误消息
 */
function unauthorized(res, message = '请先登录') {
  return fail(res, message, 401);
}

/**
 * 禁止访问响应（HTTP 403）
 * @param {import('express').Response} res - Express 响应对象
 * @param {string} [message='无权限访问'] - 错误消息
 */
function forbidden(res, message = '无权限访问') {
  return fail(res, message, 403);
}

/**
 * 资源不存在响应（HTTP 404）
 * @param {import('express').Response} res - Express 响应对象
 * @param {string} [message='资源不存在'] - 错误消息
 */
function notFound(res, message = '资源不存在') {
  return fail(res, message, 404);
}

/**
 * 服务器内部错误响应（HTTP 500）
 * @param {import('express').Response} res - Express 响应对象
 * @param {string} [message='服务器内部错误'] - 错误消息
 */
function serverError(res, message = '服务器内部错误') {
  return fail(res, message, 500);
}

/**
 * 分页数据响应
 * @param {import('express').Response} res - Express 响应对象
 * @param {Array}  list - 数据列表
 * @param {number} total - 总记录数
 * @param {number} page - 当前页码
 * @param {number} pageSize - 每页条数
 * @param {string} [message='获取成功'] - 响应消息
 */
function paginate(res, list, total, page, pageSize, message = '获取成功') {
  return success(res, {
    list,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }, message);
}

module.exports = { success, created, fail, unauthorized, forbidden, notFound, serverError, paginate };
