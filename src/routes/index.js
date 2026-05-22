/**
 * @fileoverview 路由聚合入口
 * @description 统一注册所有业务路由，挂载到 /api/v1 前缀下
 */

'use strict';

const express = require('express');
const router = express.Router();

const authRoutes         = require('./auth');
const salespersonRoutes  = require('./salespersons');
const doctorRoutes       = require('./doctors');
const recordRoutes       = require('./records');
const statisticsRoutes   = require('./statistics');
const configRoutes       = require('./configs');
const notificationRoutes = require('./notifications');
const uploadRoutes       = require('./upload');

router.use('/auth',          authRoutes);
router.use('/salespersons',  salespersonRoutes);
router.use('/doctors',       doctorRoutes);
router.use('/records',       recordRoutes);
router.use('/statistics',    statisticsRoutes);
router.use('/configs',       configRoutes);
router.use('/notifications', notificationRoutes);
router.use('/upload',        uploadRoutes);

module.exports = router;
