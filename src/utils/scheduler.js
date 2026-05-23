/**
 * @fileoverview 定时任务模块
 * @description 使用 node-cron 实现每日复诊提醒通知生成
 *              每天 08:00 执行，检测待复诊病例并按多阈值窗口匹配生成通知
 *
 * 提醒逻辑（多阈值窗口匹配）：
 *   - 从 follow_up_reminder_configs 表读取所有阈值（如 [7, 3, 1]）
 *   - 按升序找到"最小满足 daysUntilFollowUp <= T"的阈值 T，即命中该阈值的窗口
 *     例：daysUntilFollowUp=5，阈值[7,3,1] → 命中 7（3<5<=7）
 *         daysUntilFollowUp=2，阈值[7,3,1] → 命中 3（1<2<=3）
 *         daysUntilFollowUp=0，阈值[7,3,1] → 命中 1（0<=1）
 *   - 去重：同一病例同一 reminder_days 阈值在本次复诊周期内只发一次
 *     （通过对比 notifications.created_at >= last_follow_up_date 实现）
 *   - 若病例在上次提醒后已复诊（last_follow_up_date 更新），后续阈值自动重置
 */

'use strict';

const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('./logger');

/**
 * 生成复诊提醒通知
 */
async function generateFollowUpReminders() {
  logger.info('[定时任务] 开始生成复诊提醒...');
  try {
    /** 读取复诊间隔天数配置 */
    const configs = await query(
      'SELECT config_key, config_value FROM system_configs WHERE config_key = ?',
      ['follow_up_interval_days']
    );
    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = parseInt(c.config_value, 10); });
    const intervalDays = configMap.follow_up_interval_days || 60;

    /** 读取所有提醒阈值，升序排列（用于窗口匹配：找最小满足条件的阈值） */
    const reminderRows = await query(
      'SELECT days FROM follow_up_reminder_configs ORDER BY days ASC'
    );
    const thresholds = reminderRows.map(r => r.days); // e.g. [1, 3, 7]

    if (thresholds.length === 0) {
      logger.info('[定时任务] 无提醒阈值配置，跳过');
      return;
    }

    /**
     * 查询所有待复诊病例，关联最后一次复诊时间或已就诊操作时间
     */
    const records = await query(`
      SELECT
        mr.id                AS record_id,
        mr.salesperson_id,
        mr.patient_name,
        COALESCE(
          (SELECT DATE(rf.follow_up_time)
           FROM record_follow_ups rf
           WHERE rf.record_id = mr.id
           ORDER BY rf.follow_up_time DESC
           LIMIT 1),
          (SELECT DATE(ro.created_at)
           FROM record_operations ro
           WHERE ro.record_id = mr.id AND ro.operation = 'visited'
           ORDER BY ro.created_at DESC
           LIMIT 1)
        ) AS last_follow_up_date
      FROM medical_records mr
      WHERE mr.status = 'pending_follow_up'
        AND mr.deleted_at IS NULL
    `);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let generatedCount = 0;

    for (const record of records) {
      if (!record.last_follow_up_date) continue;

      /** 计算下次复诊日期 */
      const lastDate = new Date(record.last_follow_up_date);
      const nextFollowUpDate = new Date(lastDate);
      nextFollowUpDate.setDate(nextFollowUpDate.getDate() + intervalDays);

      /** 距离下次复诊的天数（可为负数，表示已过期） */
      const daysUntilFollowUp = Math.ceil(
        (nextFollowUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      /**
       * 窗口匹配：在升序阈值列表中找到最小的满足 daysUntilFollowUp <= T 的阈值
       * 即：找到当前天数所落入的最小阈值窗口
       * 若 daysUntilFollowUp > max(thresholds)，则不在任何窗口，跳过
       */
      const matchedThreshold = thresholds.find(T => daysUntilFollowUp <= T);
      if (matchedThreshold === undefined) continue;

      /**
       * 去重：本次复诊周期内（created_at >= last_follow_up_date）
       * 是否已为该病例发送过此阈值的通知
       */
      const lastFollowUpStr = record.last_follow_up_date instanceof Date
        ? record.last_follow_up_date.toISOString().slice(0, 10)
        : String(record.last_follow_up_date).slice(0, 10);

      const existing = await query(
        `SELECT id FROM notifications
         WHERE record_id = ?
           AND reminder_days = ?
           AND DATE(created_at) >= ?`,
        [record.record_id, matchedThreshold, lastFollowUpStr]
      );
      if (existing.length > 0) continue;

      /** 构建通知内容 */
      const nextDateStr = nextFollowUpDate.toISOString().slice(0, 10);
      const content = daysUntilFollowUp <= 0
        ? `患者「${record.patient_name}」复诊日期（${nextDateStr}）已到期，请及时安排复诊。`
        : `患者「${record.patient_name}」将于 ${nextDateStr} 复诊（还有 ${daysUntilFollowUp} 天），请提前安排。`;

      /** 插入通知记录，记录触发的阈值 */
      await query(
        `INSERT INTO notifications (salesperson_id, record_id, type, reminder_days, content)
         VALUES (?, ?, 'follow_up_reminder', ?, ?)`,
        [record.salesperson_id, record.record_id, matchedThreshold, content]
      );
      generatedCount++;
    }

    logger.info(`[定时任务] 复诊提醒生成完毕，共生成 ${generatedCount} 条通知`);
  } catch (error) {
    logger.error('[定时任务] 生成复诊提醒失败:', error);
  }
}

/**
 * 启动所有定时任务
 */
function startScheduler() {
  /** 每天 08:00 执行复诊提醒生成 */
  cron.schedule('0 8 * * *', generateFollowUpReminders, {
    timezone: 'Asia/Shanghai',
  });
  logger.info('[定时任务] 复诊提醒任务已注册（每天 08:00 执行）');
}

module.exports = { startScheduler, generateFollowUpReminders };
