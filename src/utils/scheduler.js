/**
 * @fileoverview 定时任务模块
 * @description 使用 node-cron 实现每日复诊提醒通知生成
 *              每天 08:00 执行，检测待复诊病例并为对应业务员生成通知
 */

'use strict';

const cron = require('node-cron');
const { query } = require('../config/database');
const logger = require('./logger');

/**
 * 生成复诊提醒通知
 * 逻辑：
 *   1. 查找所有状态为 pending_follow_up 的病例
 *   2. 获取每个病例最后一次复诊时间（record_follow_ups）
 *      - 若无复诊记录，则以操作日志中 visited 操作时间为基准
 *   3. 计算 next_follow_up_time = 基准时间 + follow_up_interval_days
 *   4. 若 next_follow_up_time - 今天 <= follow_up_reminder_days，则生成通知
 *   5. 同一病例同一天只生成一条通知（去重）
 */
async function generateFollowUpReminders() {
  logger.info('[定时任务] 开始生成复诊提醒...');
  try {
    /** 读取系统配置 */
    const configs = await query(
      'SELECT config_key, config_value FROM system_configs WHERE config_key IN (?, ?)',
      ['follow_up_interval_days', 'follow_up_reminder_days']
    );
    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = parseInt(c.config_value, 10); });
    const intervalDays = configMap.follow_up_interval_days || 60;
    const reminderDays = configMap.follow_up_reminder_days  || 7;

    /**
     * 查询所有待复诊病例，关联最后一次复诊时间或已就诊操作时间
     * 使用子查询获取最后复诊日期，若无复诊记录则使用 visited 操作时间
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

      /** 距离下次复诊的天数 */
      const daysUntilFollowUp = Math.ceil(
        (nextFollowUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      /** 判断是否在提醒窗口内 */
      if (daysUntilFollowUp > reminderDays || daysUntilFollowUp < 0) continue;

      /** 检查今天是否已经为该病例生成过通知（去重） */
      const todayStr = today.toISOString().slice(0, 10);
      const existing = await query(
        `SELECT id FROM notifications
         WHERE salesperson_id = ? AND record_id = ? AND DATE(created_at) = ?`,
        [record.salesperson_id, record.record_id, todayStr]
      );
      if (existing.length > 0) continue;

      /** 构建通知内容 */
      const nextDateStr = nextFollowUpDate.toISOString().slice(0, 10);
      const content = daysUntilFollowUp <= 0
        ? `患者「${record.patient_name}」复诊日期（${nextDateStr}）已到期，请及时安排复诊。`
        : `患者「${record.patient_name}」将于 ${nextDateStr} 复诊（还有 ${daysUntilFollowUp} 天），请提前安排。`;

      /** 插入通知记录 */
      await query(
        `INSERT INTO notifications (salesperson_id, record_id, type, content)
         VALUES (?, ?, 'follow_up_reminder', ?)`,
        [record.salesperson_id, record.record_id, content]
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
