/**
 * @fileoverview 接口限流中间件
 * @description 基于 express-rate-limit 实现不同接口的访问频率限制，防止恶意请求和服务器过载
 */

'use strict';

const rateLimit = require('express-rate-limit');

/**
 * 通用限流响应格式
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function rateLimitHandler(req, res) {
  res.status(429).json({
    code:    429,
    message: '请求过于频繁，请稍后再试',
    data:    null,
  });
}

/**
 * 登录接口限流：每个 IP 每分钟最多 5 次，防止暴力破解
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const loginLimiter = rateLimit({
  windowMs:         60 * 1000, // 1 分钟
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler:          rateLimitHandler,
  skipSuccessfulRequests: false,
  message:          '登录尝试过于频繁，请 1 分钟后再试',
});

/**
 * 普通接口限流：每个 IP 每分钟最多 100 次
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const generalLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 分钟
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/**
 * 文件上传限流：每个 IP 每分钟最多 20 次
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const uploadLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

module.exports = { loginLimiter, generalLimiter, uploadLimiter };
