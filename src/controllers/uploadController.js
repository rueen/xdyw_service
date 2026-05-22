/**
 * @fileoverview 文件上传控制器
 * @description 处理图片上传到阿里云 OSS
 */

'use strict';

const path = require('path');
const OSS = require('ali-oss');
const multer = require('multer');
const config = require('../config');
const { success, fail } = require('../utils/response');
const logger = require('../utils/logger');

/** 使用内存存储（文件不落盘，直接上传到 OSS） */
const storage = multer.memoryStorage();

/**
 * multer 文件过滤器，只允许上传图片
 * @param {import('express').Request} req
 * @param {Express.Multer.File} file
 * @param {Function} cb
 */
function fileFilter(req, file, cb) {
  if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传 JPG、PNG、WebP、GIF 格式的图片'), false);
  }
}

/**
 * multer 上传中间件（单次最多 10 张）
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  config.upload.maxFileSize,
    files:     config.upload.maxCount,
  },
});

/**
 * 获取 OSS 客户端（每次请求新建，避免凭证过期问题）
 * @returns {OSS} OSS 客户端实例
 */
function getOssClient() {
  return new OSS({
    region:          config.oss.region,
    accessKeyId:     config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    bucket:          config.oss.bucket,
  });
}

/**
 * 上传图片到 OSS
 * @param {import('express').Request}  req - req.files 为文件列表
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function uploadImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return fail(res, '请选择要上传的图片', 400);
    }

    const ossClient = getOssClient();
    const uploadResults = [];

    for (const file of req.files) {
      /** 生成唯一文件名：records/年月日/时间戳_随机数.扩展名 */
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const uniqueName = `records/${dateStr}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

      const result = await ossClient.put(uniqueName, file.buffer, {
        headers: {
          'Content-Type': file.mimetype,
          /** 公共读权限 */
          'x-oss-object-acl': 'public-read',
        },
      });

      uploadResults.push({
        name:        file.originalname,
        url:         `${config.oss.baseUrl}/${uniqueName}`,
        size:        file.size,
        ossKey:      uniqueName,
      });

      logger.info(`文件上传成功: ${uniqueName}`);
    }

    return success(res, { urls: uploadResults.map(r => r.url), files: uploadResults }, '上传成功');
  } catch (error) {
    logger.error('文件上传失败:', error);
    next(error);
  }
}

module.exports = { upload, uploadImages };
