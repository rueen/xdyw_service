/*
 * @Author: diaochan diaochan@seatent.com
 * @Date: 2026-05-10 15:50:40
 * @LastEditors: diaochan diaochan@seatent.com
 * @LastEditTime: 2026-05-23 16:55:19
 * @FilePath: /xdyw_service/src/config/index.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * @fileoverview 全局配置模块
 * @description 统一管理所有环境变量和应用配置，提供类型安全的配置访问
 */

'use strict';

require('dotenv').config();

/**
 * @typedef {Object} AppConfig
 * @property {number} port - 服务端口
 * @property {string} nodeEnv - 运行环境
 * @property {Object} db - 数据库配置
 * @property {Object} jwt - JWT 配置
 * @property {Object} aes - AES 加密配置
 * @property {string[]} allowedOrigins - 允许的跨域来源列表
 * @property {Object} oss - 阿里云 OSS 配置
 */

/** @type {AppConfig} */
const config = {
  /** 服务端口 */
  port: parseInt(process.env.PORT, 10) || 3000,

  /** 运行环境 */
  nodeEnv: process.env.NODE_ENV || 'development',

  /** 数据库连接配置 */
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT, 10) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'xdyw',
    /** 连接池最大连接数 */
    connectionLimit: 10,
    /** 时区设置为东八区 */
    timezone: '+08:00',
    /** 支持 JSON 类型字段自动解析 */
    jsonStrings: false,
  },

  /** JWT 配置 */
  jwt: {
    secret:    process.env.JWT_SECRET     || 'fallback_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  /** AES-256-CBC 加密配置（用于手机号、身份证等敏感字段） */
  aes: {
    key: process.env.AES_SECRET_KEY || 'xdyw_aes_key_32chars_202401',
    iv:  process.env.AES_IV         || 'xdyw_iv_16c',
  },

  /** 允许跨域的来源列表 */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim()),

  /** 阿里云 OSS 配置 */
  oss: {
    region:          process.env.OSS_REGION           || 'oss-cn-hangzhou',
    accessKeyId:     process.env.OSS_ACCESS_KEY_ID    || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket:          process.env.OSS_BUCKET            || '',
    baseUrl:         process.env.OSS_BASE_URL          || '',
  },

  /** bcrypt 加盐轮次（值越高越安全，但越慢） */
  bcryptSaltRounds: 12,

  /** 上传文件配置 */
  upload: {
    /** 单张图片最大 10MB */
    maxFileSize: 10 * 1024 * 1024,
    /** 每次最多上传 10 张 */
    maxCount: 10,
    /** 允许的图片 MIME 类型 */
    allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  },
};

module.exports = config;
