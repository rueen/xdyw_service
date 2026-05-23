-- =====================================================
-- 鑫达医委病例管理系统 - 数据库初始化脚本
-- 数据库: xdyw
-- 字符集: utf8mb4
-- =====================================================

-- 创建并选择数据库
CREATE DATABASE IF NOT EXISTS xdyw CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xdyw;

-- =====================================================
-- 0. 机构表 (institutions)
-- 说明: 业务员所属机构，与 users 表通过 institution_id 关联
-- =====================================================
CREATE TABLE IF NOT EXISTS `institutions` (
  `id`         INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name`       VARCHAR(100) NOT NULL                COMMENT '机构名称',
  `status`     ENUM('normal','disabled') NOT NULL DEFAULT 'normal' COMMENT '状态：normal正常 disabled停用',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME     DEFAULT NULL            COMMENT '软删除时间，NULL表示未删除',
  PRIMARY KEY (`id`),
  KEY `idx_status`     (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='机构表';

-- =====================================================
-- 1. 业务员表 (users)
-- 说明: 超级管理员 parent_id 为 NULL，role 为 super_admin
-- =====================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`          INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name`        VARCHAR(50)  NOT NULL                COMMENT '姓名',
  `phone`       VARCHAR(20)  NOT NULL                COMMENT '手机号（全局唯一）',
  `password`    VARCHAR(255) NOT NULL                COMMENT '密码（bcrypt哈希）',
  `province_code` VARCHAR(20)  DEFAULT NULL            COMMENT '省级行政区划代码',
  `province_name` VARCHAR(50)  DEFAULT NULL            COMMENT '省名称',
  `city_code`     VARCHAR(20)  DEFAULT NULL            COMMENT '市级行政区划代码',
  `city_name`     VARCHAR(50)  DEFAULT NULL            COMMENT '市名称',
  `district_code` VARCHAR(20)  DEFAULT NULL            COMMENT '区级行政区划代码',
  `district_name` VARCHAR(50)  DEFAULT NULL            COMMENT '区名称',
  `institution_id` INT         DEFAULT NULL            COMMENT '所属机构ID',
  `parent_id`   INT          DEFAULT NULL            COMMENT '上级业务员ID，NULL表示超级管理员',
  `role`        ENUM('super_admin','salesperson') NOT NULL DEFAULT 'salesperson' COMMENT '角色',
  `status`      ENUM('normal','disabled')         NOT NULL DEFAULT 'normal'      COMMENT '状态：normal正常 disabled停用',
  `created_by`  INT          DEFAULT NULL            COMMENT '创建人ID',
  `updated_by`  INT          DEFAULT NULL            COMMENT '最后更新人ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     DEFAULT NULL            COMMENT '软删除时间，NULL表示未删除',
  PRIMARY KEY (`id`),
  /**
   * 不在数据库层设置手机号唯一索引，原因：
   * 软删除后记录仍保留在表中，相同手机号重新注册时会触发唯一约束冲突。
   * 唯一性由应用层（isPhoneExists 过滤 deleted_at IS NULL）保证。
   */
  KEY `idx_phone`          (`phone`),
  KEY `idx_institution_id` (`institution_id`),
  KEY `idx_parent_id`      (`parent_id`),
  KEY `idx_status`         (`status`),
  KEY `idx_deleted_at`     (`deleted_at`),
  CONSTRAINT `fk_users_parent` FOREIGN KEY (`parent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务员表';

-- =====================================================
-- 2. 医生表 (doctors)
-- 说明: 手机号与 users 表全局唯一（应用层保证）
-- =====================================================
CREATE TABLE IF NOT EXISTS `doctors` (
  `id`          INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name`        VARCHAR(50)  NOT NULL                COMMENT '姓名',
  `phone`       VARCHAR(20)  NOT NULL                COMMENT '手机号（全局唯一）',
  `password`    VARCHAR(255) NOT NULL                COMMENT '密码（bcrypt哈希）',
  `status`      ENUM('normal','disabled') NOT NULL DEFAULT 'normal' COMMENT '状态：normal正常 disabled停用',
  `created_by`  INT          DEFAULT NULL            COMMENT '创建人ID',
  `updated_by`  INT          DEFAULT NULL            COMMENT '最后更新人ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     DEFAULT NULL            COMMENT '软删除时间，NULL表示未删除',
  PRIMARY KEY (`id`),
  KEY `idx_phone`      (`phone`),
  KEY `idx_status`     (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='医生表';

-- =====================================================
-- 3. 病例表 (medical_records)
-- 说明: patient_phone/patient_id_card 使用 AES-256 加密存储
--       next_follow_up_time 不存库，由接口动态计算
-- =====================================================
CREATE TABLE IF NOT EXISTS `medical_records` (
  `id`              INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `patient_name`    VARCHAR(50)  NOT NULL                COMMENT '患者姓名',
  `patient_phone`   VARCHAR(500) NOT NULL                COMMENT '患者手机号（AES加密密文）',
  `patient_id_card` VARCHAR(500) NOT NULL                COMMENT '患者身份证号（AES加密密文）',
  `doctor_id`       INT          NOT NULL                COMMENT '指派医生ID',
  `salesperson_id`  INT          NOT NULL                COMMENT '录入业务员ID',
  `description`     TEXT         DEFAULT NULL            COMMENT '病情描述（≤300字）',
  `photos`          JSON         DEFAULT NULL            COMMENT '照片URL列表（最多10张）',
  `status`          ENUM(
    'pending_review',    -- 待医生判读
    'suitable',          -- 符合用药
    'unsuitable',        -- 不符合用药
    'incomplete',        -- 资料不全
    'pending_follow_up', -- 待复诊
    'completed'          -- 已完诊
  ) NOT NULL DEFAULT 'pending_review'                    COMMENT '病例状态',
  `payment_status`  ENUM(
    'pending_payment',   -- 待付费
    'paid',              -- 已付费
    'refunded'           -- 已退费
  ) NOT NULL DEFAULT 'pending_payment'                   COMMENT '付费状态',
  `created_by`      INT          DEFAULT NULL            COMMENT '创建人ID',
  `updated_by`      INT          DEFAULT NULL            COMMENT '最后更新人ID',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`      DATETIME     DEFAULT NULL            COMMENT '软删除时间，NULL表示未删除',
  PRIMARY KEY (`id`),
  KEY `idx_doctor_id`      (`doctor_id`),
  KEY `idx_salesperson_id` (`salesperson_id`),
  KEY `idx_status`         (`status`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_deleted_at`     (`deleted_at`),
  CONSTRAINT `fk_records_doctor`      FOREIGN KEY (`doctor_id`)      REFERENCES `doctors` (`id`),
  CONSTRAINT `fk_records_salesperson` FOREIGN KEY (`salesperson_id`) REFERENCES `users`   (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='病例表';

-- =====================================================
-- 4. 复诊记录表 (record_follow_ups)
-- 说明: 每次业务员操作"已复诊"时插入一条记录
--       接口通过 MAX(follow_up_time) + 配置天数 计算下次复诊日期
-- =====================================================
CREATE TABLE IF NOT EXISTS `record_follow_ups` (
  `id`             INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `record_id`      INT          NOT NULL                COMMENT '病例ID',
  `follow_up_time` DATE         NOT NULL                COMMENT '本次复诊日期',
  `notes`          VARCHAR(500) DEFAULT NULL            COMMENT '复诊备注',
  `created_by`     INT          NOT NULL                COMMENT '操作业务员ID',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_record_id` (`record_id`),
  CONSTRAINT `fk_followups_record` FOREIGN KEY (`record_id`) REFERENCES `medical_records` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='复诊记录表';

-- =====================================================
-- 5. 病例操作日志表 (record_operations)
-- 说明: 记录病例所有操作，包含操作人、操作类型、备注
-- =====================================================
CREATE TABLE IF NOT EXISTS `record_operations` (
  `id`            INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `record_id`     INT          NOT NULL                COMMENT '病例ID',
  `operation`     VARCHAR(50)  NOT NULL                COMMENT '操作类型：create/update/review_suitable/review_unsuitable/review_incomplete/supplement/visited/follow_up/complete/pay/refund',
  `notes`         VARCHAR(500) DEFAULT NULL            COMMENT '操作备注（如资料不全时的医生备注）',
  `extra_data`    JSON         DEFAULT NULL            COMMENT '操作附加数据（付费/退费时存储金额、凭证等）',
  `operator_type` ENUM('salesperson','doctor') NOT NULL COMMENT '操作人类型',
  `operator_id`   INT          NOT NULL                COMMENT '操作人ID',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_record_id`   (`record_id`),
  KEY `idx_operator`    (`operator_type`, `operator_id`),
  KEY `idx_operation`   (`operation`),
  CONSTRAINT `fk_operations_record` FOREIGN KEY (`record_id`) REFERENCES `medical_records` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='病例操作日志表';

-- =====================================================
-- 6. 系统配置表 (system_configs)
-- =====================================================
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id`           INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key`   VARCHAR(100) NOT NULL                COMMENT '配置键',
  `config_value` VARCHAR(500) NOT NULL                COMMENT '配置值',
  `description`  VARCHAR(200) DEFAULT NULL            COMMENT '配置说明',
  `updated_by`   INT          DEFAULT NULL            COMMENT '最后更新人ID',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP                  COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- =====================================================
-- 7. 通知表 (notifications)
-- 说明: 每日定时任务检测待复诊病例，生成复诊提醒通知
-- =====================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`             INT          NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `salesperson_id` INT          NOT NULL                COMMENT '接收通知的业务员ID',
  `record_id`      INT          NOT NULL                COMMENT '相关病例ID',
  `type`           VARCHAR(50)  NOT NULL DEFAULT 'follow_up_reminder' COMMENT '通知类型',
  `reminder_days`  INT          DEFAULT NULL             COMMENT '触发本条通知的提醒阈值天数（用于按阈值去重）',
  `content`        VARCHAR(500) NOT NULL                COMMENT '通知内容',
  `is_read`        TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '是否已读：0未读 1已读',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_salesperson_id` (`salesperson_id`),
  KEY `idx_record_id`      (`record_id`),
  KEY `idx_is_read`        (`is_read`),
  KEY `idx_created_at`     (`created_at`),
  CONSTRAINT `fk_notifications_salesperson` FOREIGN KEY (`salesperson_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_notifications_record`      FOREIGN KEY (`record_id`)      REFERENCES `medical_records` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- =====================================================
-- 8. 复诊提醒天数配置表 (follow_up_reminder_configs)
-- 说明: 支持配置多个提醒阈值天数，每条为一个独立阈值（如 7、3、1 天）
--       调度器按阈值从大到小依次匹配窗口，每个阈值每轮复诊周期只发一次通知
-- =====================================================
CREATE TABLE IF NOT EXISTS `follow_up_reminder_configs` (
  `id`         INT      NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `days`       INT      NOT NULL                COMMENT '提醒阈值天数（距复诊日期不足该天数时触发）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_days` (`days`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='复诊提醒天数配置表';

-- =====================================================
-- 初始化数据
-- =====================================================

-- 插入默认系统配置
INSERT INTO `system_configs` (`config_key`, `config_value`, `description`) VALUES
  ('follow_up_interval_days', '60', '默认复诊间隔天数（2个月）')
ON DUPLICATE KEY UPDATE `config_value` = VALUES(`config_value`);

-- 插入默认复诊提醒阈值（7天前提醒一次）
INSERT INTO `follow_up_reminder_configs` (`days`) VALUES (7)
ON DUPLICATE KEY UPDATE `days` = VALUES(`days`);

-- 插入超级管理员账号（密码: Admin@123456，bcrypt加密，登录后请立即修改）
-- bcrypt hash of 'Admin@123456' with saltRounds=12
INSERT INTO `users` (`name`, `phone`, `password`, `role`, `status`, `parent_id`) VALUES
  ('超级管理员', '15382338670', '$2a$12$ysuFzM3LAkVU1pRBZK0ceuwNLXTXV6Iok0iVEd.ff37LBs2SauOta', 'super_admin', 'normal', NULL)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
