/**
 * @fileoverview 文件上传路由
 */

'use strict';

const express = require('express');
const router = express.Router();

const { upload, uploadImages } = require('../controllers/uploadController');
const { authenticate, requireSalesperson } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');

router.use(authenticate, requireSalesperson);

/**
 * POST /upload
 * 上传图片（最多10张，字段名 images）
 * 上传成功后返回 OSS 访问 URL 列表
 */
router.post(
  '/',
  uploadLimiter,
  upload.array('images', 10),
  uploadImages
);

module.exports = router;
