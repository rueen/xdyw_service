/**
 * @fileoverview 通知控制器
 */

'use strict';

const notificationService = require('../services/notificationService');
const { success, paginate } = require('../utils/response');

/** 获取通知列表 */
async function getList(req, res, next) {
  try {
    const { userId } = req.user;
    const { page = 1, pageSize = 20, isRead } = req.query;
    const result = await notificationService.getNotifications(userId, {
      page:     parseInt(page),
      pageSize: parseInt(pageSize),
      isRead:   isRead !== undefined ? parseInt(isRead) : undefined,
    });
    return success(res, {
      list:        result.list,
      unreadCount: result.unreadCount,
      pagination: {
        total:      result.total,
        page:       parseInt(page),
        pageSize:   parseInt(pageSize),
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
}

/** 标记单条通知已读 */
async function markAsRead(req, res, next) {
  try {
    await notificationService.markAsRead(parseInt(req.params.id), req.user.userId);
    return success(res, null, '已标记为已读');
  } catch (error) {
    next(error);
  }
}

/** 全部标记已读 */
async function markAllAsRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.userId);
    return success(res, null, '已全部标记为已读');
  } catch (error) {
    next(error);
  }
}

module.exports = { getList, markAsRead, markAllAsRead };
