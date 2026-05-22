/**
 * @fileoverview 全局错误处理中间件
 * @description 统一捕获并处理所有未被 controller 捕获的异常，返回标准化错误响应
 */

'use strict';

const logger = require('../utils/logger');

/**
 * 404 路由未找到处理器
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    code:    404,
    message: `接口不存在: ${req.method} ${req.originalUrl}`,
    data:    null,
  });
}

/**
 * 全局错误处理中间件（必须有 4 个参数，Express 才识别为错误处理器）
 * @param {Error}                      err  - 捕获到的错误对象
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function globalErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  /**
   * 带 statusCode 的错误是业务逻辑主动抛出的预期错误（如密码错误、资源不存在等），
   * 用 warn 级别记录，不打印堆栈，避免污染错误日志。
   * 没有 statusCode 的才是真正的未捕获异常，用 error 级别记录完整堆栈。
   */
  if (err.statusCode) {
    logger.warn(`业务错误 [${err.statusCode}]: ${err.message} — ${req.method} ${req.originalUrl}`);
  } else {
    logger.error('未捕获异常:', {
      message: err.message,
      stack:   err.stack,
      url:     req.originalUrl,
      method:  req.method,
      ip:      req.ip,
    });
  }

  /** JWT 验证失败 */
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ code: 401, message: 'Token 无效', data: null });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ code: 401, message: 'Token 已过期，请重新登录', data: null });
  }

  /** MySQL 错误处理 */
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ code: 409, message: '数据已存在，请勿重复操作', data: null });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ code: 400, message: '关联数据不存在', data: null });
  }

  /** 文件上传错误（multer） */
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ code: 400, message: '文件大小超出限制（最大 10MB）', data: null });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ code: 400, message: '上传文件数量超出限制（最多 10 张）', data: null });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ code: 400, message: '上传字段名称不正确', data: null });
  }

  /** 自定义业务错误（带 statusCode 属性） */
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      code:    err.statusCode,
      message: err.message,
      data:    null,
    });
  }

  /** 默认 500 服务器错误 */
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    code:    500,
    message: isDev ? err.message : '服务器内部错误，请稍后重试',
    data:    isDev ? { stack: err.stack } : null,
  });
}

/**
 * 创建带状态码的业务错误
 * @param {string} message - 错误消息
 * @param {number} [statusCode=400] - HTTP 状态码
 * @returns {Error} 带 statusCode 属性的 Error 对象
 */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { notFoundHandler, globalErrorHandler, createError };
