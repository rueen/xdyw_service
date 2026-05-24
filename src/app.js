/**
 * @fileoverview Express 应用入口
 * @description 配置中间件、路由、错误处理，启动 HTTP 服务和定时任务
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');

const config                                 = require('./config');
const routes                                 = require('./routes');
const { testConnection }                     = require('./config/database');
const { notFoundHandler, globalErrorHandler} = require('./middleware/errorHandler');
const { generalLimiter }                     = require('./middleware/rateLimit');
const { startScheduler }                     = require('./utils/scheduler');
const logger                                 = require('./utils/logger');

/** Express 实例 */
const app = express();

/**
 * 信任反向代理（Nginx）传递的 X-Forwarded-For 头
 * 生产环境通过 Nginx 代理时必须开启，否则 express-rate-limit 无法正确识别客户端 IP
 */
app.set('trust proxy', 1);

// =====================================================
// 安全相关中间件
// =====================================================

/**
 * helmet：设置安全相关 HTTP 响应头
 * 防止 XSS、点击劫持等常见 Web 安全攻击
 */
app.use(helmet());

/**
 * CORS 跨域配置
 * 仅允许 .env 中配置的前端域名访问
 */
app.use(cors({
  origin: (origin, callback) => {
    /** 允许无 origin 的请求（如 Postman、curl） */
    if (!origin) return callback(null, true);
    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS 拒绝来自 ${origin} 的请求`));
  },
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// =====================================================
// 请求解析中间件
// =====================================================

/** 解析 JSON 请求体，限制大小为 10MB（支持 Base64 图片场景） */
app.use(express.json({ limit: '10mb' }));

/** 解析 URL 编码的请求体 */
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================
// 全局限流（登录接口在路由层单独配置更严格的限流）
// =====================================================
app.use('/api/', generalLimiter);

// =====================================================
// 请求日志（开发环境打印每条请求）
// =====================================================
if (config.nodeEnv !== 'production') {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// =====================================================
// 业务路由（统一前缀 /api/v1）
// =====================================================
app.use('/api/v1', routes);

/** 健康检查接口（供 Docker/K8s 探活） */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =====================================================
// 错误处理（必须放在所有路由之后）
// =====================================================
app.use(notFoundHandler);
app.use(globalErrorHandler);

// =====================================================
// 启动服务
// =====================================================

/**
 * 启动 HTTP 服务器
 * 启动前先验证数据库连接，连接失败则退出进程
 */
async function bootstrap() {
  try {
    /** 验证数据库连接 */
    await testConnection();

    /** 启动定时任务 */
    startScheduler();

    /** 监听端口 */
    app.listen(config.port, () => {
      logger.info(`鑫达医委病例管理系统已启动`);
      logger.info(`服务地址: http://localhost:${config.port}`);
      logger.info(`运行环境: ${config.nodeEnv}`);
      logger.info(`API 根路径: http://localhost:${config.port}/api/v1`);
    });
  } catch (error) {
    logger.error('服务启动失败:', error);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
