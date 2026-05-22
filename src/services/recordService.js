/**
 * @fileoverview 病例管理服务
 * @description 处理病例的增删改查、状态流转、数据权限控制、脱敏等核心业务逻辑
 */

'use strict';

const { query, transaction } = require('../config/database');
const { encrypt, safeDecrypt } = require('../utils/crypto');
const { desensitizeRecord } = require('../utils/desensitize');
const { createError } = require('../middleware/errorHandler');
const { getDescendantIds } = require('./salespersonService');

/**
 * 允许的状态流转映射表
 * key: 当前状态, value: 允许流转到的状态列表（操作类型 -> 新状态）
 */
const STATUS_TRANSITIONS = {
  pending_review: {
    review_suitable:   'suitable',
    review_unsuitable: 'unsuitable',
    review_incomplete: 'incomplete',
    complete:          'completed',
  },
  suitable: {
    visited:  'pending_follow_up',
    complete: 'completed',
  },
  unsuitable: {
    complete: 'completed',
  },
  incomplete: {
    supplement: 'pending_review',
    complete:   'completed',
  },
  pending_follow_up: {
    follow_up: 'pending_follow_up', // 已复诊 -> 自动重置为待复诊
    complete:  'completed',
  },
  completed: {},
};

/**
 * 获取系统配置中的复诊间隔天数
 * @returns {Promise<number>} 复诊间隔天数
 */
async function getFollowUpIntervalDays() {
  const rows = await query(
    "SELECT config_value FROM system_configs WHERE config_key = 'follow_up_interval_days'",
    []
  );
  return rows.length > 0 ? parseInt(rows[0].config_value, 10) : 60;
}

/**
 * 计算病例的下次复诊日期（不存库，动态计算）
 * 规则：最后一次复诊时间（或已就诊时间）+ 复诊间隔天数
 * @param {number} recordId - 病例ID
 * @param {number} intervalDays - 复诊间隔天数
 * @returns {Promise<string|null>} 下次复诊日期（YYYY-MM-DD）或 null
 */
async function calcNextFollowUpTime(recordId, intervalDays) {
  /** 优先取最后一次复诊记录时间 */
  const followUps = await query(
    `SELECT DATE(follow_up_time) AS last_date
     FROM record_follow_ups WHERE record_id = ?
     ORDER BY follow_up_time DESC LIMIT 1`,
    [recordId]
  );

  let baseDate = null;
  if (followUps.length > 0) {
    baseDate = new Date(followUps[0].last_date);
  } else {
    /** 无复诊记录，取已就诊操作时间 */
    const visited = await query(
      `SELECT DATE(created_at) AS last_date
       FROM record_operations
       WHERE record_id = ? AND operation = 'visited'
       ORDER BY created_at DESC LIMIT 1`,
      [recordId]
    );
    if (visited.length > 0) {
      baseDate = new Date(visited[0].last_date);
    }
  }

  if (!baseDate) return null;

  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  return nextDate.toISOString().slice(0, 10);
}

/**
 * 对病例列表做解密 + 权限控制（完整信息 or 脱敏）
 * @param {Array}   records           - 原始病例列表（含加密字段）
 * @param {number}  currentSalespersonId - 当前业务员ID
 * @param {string}  role              - 角色：'super_admin' | 'salesperson' | 'doctor'
 * @param {number[]} ownSalespersonIds - 当前用户自己录入的病例的 salesperson_id 列表（自身ID）
 * @returns {Array} 处理后的病例列表
 */
function processRecords(records, currentSalespersonId, role, ownSalespersonIds) {
  return records.map(record => {
    /** 解密敏感字段 */
    const decrypted = {
      ...record,
      patient_phone:   safeDecrypt(record.patient_phone),
      patient_id_card: safeDecrypt(record.patient_id_card),
    };

    /** 超级管理员始终返回完整信息 */
    if (role === 'super_admin') return decrypted;

    /** 医生始终返回完整信息（医生只能看自己被指派的病例，已在查询层过滤） */
    if (ownSalespersonIds === null) return decrypted;

    /** 业务员：自己录入的病例返回完整信息，下级录入的返回脱敏信息 */
    if (record.salesperson_id === currentSalespersonId) {
      return decrypted;
    }
    return desensitizeRecord(decrypted);
  });
}

/**
 * 获取病例列表（分页 + 筛选 + 权限控制）
 * @param {Object} filters - 筛选条件
 * @param {string} [filters.patientName]   - 患者姓名（模糊）
 * @param {string} [filters.patientPhone]  - 患者手机号（模糊，明文搜索会先加密）
 * @param {string} [filters.patientIdCard] - 患者身份证（模糊）
 * @param {number} [filters.doctorId]      - 医生ID
 * @param {number} [filters.salespersonId] - 业务员ID（仅超级管理员可用；普通业务员只能看自己可见范围内的）
 * @param {string} [filters.status]        - 病例状态
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=10]
 * @param {Object} currentUser - 当前登录用户 { userId, userType, role }
 * @returns {Promise<{list: Array, total: number}>}
 */
async function getRecordList(filters = {}, currentUser) {
  const {
    patientName, patientPhone, patientIdCard, doctorId, salespersonId, status,
    page = 1, pageSize = 10,
  } = filters;
  const { userId, userType, role } = currentUser;

  const conditions = ['mr.deleted_at IS NULL'];
  const params = [];

  /** ========== 数据权限过滤 ========== */
  let visibleSalespersonIds = null; // null 表示无限制（超级管理员/医生）

  if (userType === 'doctor') {
    /** 医生：只能查看指派给自己的病例 */
    conditions.push('mr.doctor_id = ?');
    params.push(userId);
  } else if (role === 'super_admin') {
    /** 超级管理员：可查看所有病例 */
  } else {
    /** 普通业务员：只能查看自己及子孙录入的病例 */
    visibleSalespersonIds = await getDescendantIds(userId);
    if (visibleSalespersonIds.length === 0) {
      return { list: [], total: 0 };
    }
    conditions.push(`mr.salesperson_id IN (${visibleSalespersonIds.map(() => '?').join(',')})`);
    params.push(...visibleSalespersonIds);
  }

  /** ========== 筛选条件 ========== */
  if (patientName) {
    conditions.push('mr.patient_name LIKE ?');
    params.push(`%${patientName}%`);
  }

  /**
   * 手机号和身份证号在数据库中是加密存储的，无法直接模糊查询。
   * 解决方案：将查询关键词加密后进行全表解密扫描（性能较差）
   * 或将加密字段的前缀分离（本项目使用全表扫描 + 应用层过滤，适合中小数据量）
   * 生产建议：对加密字段建立辅助搜索索引（如明文哈希）
   */
  let phoneFilter = null;
  let idCardFilter = null;
  if (patientPhone) phoneFilter = patientPhone.trim();
  if (patientIdCard) idCardFilter = patientIdCard.trim();

  if (doctorId) {
    conditions.push('mr.doctor_id = ?');
    params.push(doctorId);
  }
  /**
   * 业务员筛选：
   * - 超级管理员可按任意业务员ID筛选
   * - 普通业务员只能在自身可见范围（已由数据权限 IN 子句限制）内进一步筛选
   * - 医生无法使用此筛选（其可见范围已固定为指派给自己的病例）
   */
  if (salespersonId && userType !== 'doctor') {
    conditions.push('mr.salesperson_id = ?');
    params.push(salespersonId);
  }
  if (status) {
    conditions.push('mr.status = ?');
    params.push(status);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * pageSize;
  const intervalDays = await getFollowUpIntervalDays();

  const rawList = await query(
    `SELECT mr.id, mr.patient_name, mr.patient_phone, mr.patient_id_card,
            mr.doctor_id, mr.salesperson_id, mr.description, mr.photos,
            mr.status, mr.created_at, mr.updated_at,
            d.name AS doctor_name,
            s.name AS salesperson_name
     FROM medical_records mr
     LEFT JOIN doctors d ON mr.doctor_id = d.id
     LEFT JOIN users   s ON mr.salesperson_id = s.id
     ${where}
     ORDER BY mr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM medical_records mr ${where}`,
    [...params]
  );

  /** 解密 + 权限处理 */
  let processedList = processRecords(
    rawList,
    userId,
    role || (userType === 'doctor' ? 'doctor' : 'salesperson'),
    userType === 'doctor' ? null : visibleSalespersonIds
  );

  /** 应用层手机号/身份证号模糊过滤（加密字段） */
  if (phoneFilter) {
    processedList = processedList.filter(r =>
      r.patient_phone && r.patient_phone.includes(phoneFilter)
    );
  }
  if (idCardFilter) {
    processedList = processedList.filter(r =>
      r.patient_id_card && r.patient_id_card.includes(idCardFilter)
    );
  }

  /** 为待复诊病例计算下次复诊日期 */
  const listWithFollowUp = await Promise.all(
    processedList.map(async record => {
      if (record.status === 'pending_follow_up') {
        const nextFollowUpTime = await calcNextFollowUpTime(record.id, intervalDays);
        return { ...record, next_follow_up_time: nextFollowUpTime };
      }
      return { ...record, next_follow_up_time: null };
    })
  );

  return { list: listWithFollowUp, total: countResult[0].total };
}

/**
 * 获取病例详情（含操作日志、复诊记录）
 * @param {number} recordId - 病例ID
 * @param {Object} currentUser - 当前登录用户
 * @returns {Promise<Object>} 病例详情
 */
async function getRecordById(recordId, currentUser) {
  const { userId, userType, role } = currentUser;

  const rows = await query(
    `SELECT mr.id, mr.patient_name, mr.patient_phone, mr.patient_id_card,
            mr.doctor_id, mr.salesperson_id, mr.description, mr.photos,
            mr.status, mr.created_at, mr.updated_at,
            d.name AS doctor_name,
            s.name AS salesperson_name
     FROM medical_records mr
     LEFT JOIN doctors d ON mr.doctor_id = d.id
     LEFT JOIN users   s ON mr.salesperson_id = s.id
     WHERE mr.id = ? AND mr.deleted_at IS NULL`,
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);

  const record = rows[0];

  /** 数据权限校验 */
  if (userType === 'doctor') {
    if (record.doctor_id !== userId) throw createError('无权访问此病例', 403);
  } else if (role !== 'super_admin') {
    const descendantIds = await getDescendantIds(userId);
    if (!descendantIds.includes(record.salesperson_id)) {
      throw createError('无权访问此病例', 403);
    }
  }

  /** 解密 */
  const decrypted = {
    ...record,
    patient_phone:   safeDecrypt(record.patient_phone),
    patient_id_card: safeDecrypt(record.patient_id_card),
  };

  /** 脱敏判断：普通业务员查看下级病例时脱敏 */
  let finalRecord = decrypted;
  if (role === 'salesperson' && record.salesperson_id !== userId) {
    finalRecord = desensitizeRecord(decrypted);
  }

  /** 计算下次复诊日期 */
  const intervalDays = await getFollowUpIntervalDays();
  finalRecord.next_follow_up_time = record.status === 'pending_follow_up'
    ? await calcNextFollowUpTime(recordId, intervalDays)
    : null;

  /** 获取操作日志 */
  finalRecord.operations = await query(
    `SELECT ro.id, ro.operation, ro.notes, ro.operator_type, ro.operator_id,
            ro.created_at,
            CASE ro.operator_type
              WHEN 'salesperson' THEN u.name
              WHEN 'doctor'      THEN d.name
            END AS operator_name
     FROM record_operations ro
     LEFT JOIN users   u ON ro.operator_type = 'salesperson' AND ro.operator_id = u.id
     LEFT JOIN doctors d ON ro.operator_type = 'doctor'      AND ro.operator_id = d.id
     WHERE ro.record_id = ?
     ORDER BY ro.created_at ASC`,
    [recordId]
  );

  /** 获取复诊记录 */
  finalRecord.follow_ups = await query(
    `SELECT rf.id, rf.follow_up_time, rf.notes, rf.created_at,
            u.name AS salesperson_name
     FROM record_follow_ups rf
     LEFT JOIN users u ON rf.created_by = u.id
     WHERE rf.record_id = ?
     ORDER BY rf.follow_up_time ASC`,
    [recordId]
  );

  return finalRecord;
}

/**
 * 新增病例
 * @param {Object} data - 病例数据
 * @param {Object} currentUser - 当前登录用户（必须为业务员）
 * @returns {Promise<{id: number}>}
 */
async function createRecord(data, currentUser) {
  const { patientName, patientPhone, patientIdCard, doctorId, description, photos } = data;
  const { userId } = currentUser;

  /** 验证医生存在 */
  const doctorRows = await query(
    "SELECT id FROM doctors WHERE id = ? AND deleted_at IS NULL AND status = 'normal'",
    [doctorId]
  );
  if (doctorRows.length === 0) throw createError('指派医生不存在或已停用', 400);

  /** 加密敏感字段 */
  const encryptedPhone  = encrypt(patientPhone);
  const encryptedIdCard = encrypt(patientIdCard);

  const result = await transaction(async conn => {
    /** 插入病例 */
    const [insertResult] = await conn.execute(
      `INSERT INTO medical_records
         (patient_name, patient_phone, patient_id_card, doctor_id, salesperson_id,
          description, photos, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)`,
      [
        patientName, encryptedPhone, encryptedIdCard,
        doctorId, userId,
        description || null,
        photos ? JSON.stringify(photos) : null,
        userId, userId,
      ]
    );
    const recordId = insertResult.insertId;

    /** 记录操作日志 */
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, operator_type, operator_id)
       VALUES (?, 'create', 'salesperson', ?)`,
      [recordId, userId]
    );

    return { id: recordId };
  });

  return result;
}

/**
 * 修改病例基础信息（仅业务员可操作，且仅能修改自己录入的病例）
 * @param {number} recordId - 病例ID
 * @param {Object} data - 修改字段
 * @param {Object} currentUser - 当前登录用户
 * @returns {Promise<void>}
 */
async function updateRecord(recordId, data, currentUser) {
  const { userId, role } = currentUser;

  const rows = await query(
    'SELECT id, salesperson_id, status FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  /** 普通业务员只能修改自己录入的病例 */
  if (role !== 'super_admin' && record.salesperson_id !== userId) {
    throw createError('只能修改自己录入的病例', 403);
  }

  const { patientName, patientPhone, patientIdCard, doctorId, description, photos } = data;
  const fields = [];
  const params = [];

  if (patientName) { fields.push('patient_name = ?'); params.push(patientName); }
  if (patientPhone) {
    fields.push('patient_phone = ?');
    params.push(encrypt(patientPhone));
  }
  if (patientIdCard) {
    fields.push('patient_id_card = ?');
    params.push(encrypt(patientIdCard));
  }
  if (doctorId) {
    const doctorRows = await query('SELECT id FROM doctors WHERE id = ? AND deleted_at IS NULL', [doctorId]);
    if (doctorRows.length === 0) throw createError('指派医生不存在', 400);
    fields.push('doctor_id = ?');
    params.push(doctorId);
  }
  if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
  if (photos !== undefined) {
    fields.push('photos = ?');
    params.push(photos ? JSON.stringify(photos) : null);
  }

  if (fields.length === 0) throw createError('没有需要更新的字段', 400);

  fields.push('updated_by = ?');
  params.push(userId);
  params.push(recordId);

  await transaction(async conn => {
    await conn.execute(`UPDATE medical_records SET ${fields.join(', ')} WHERE id = ?`, params);
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, operator_type, operator_id)
       VALUES (?, 'update', 'salesperson', ?)`,
      [recordId, userId]
    );
  });
}

/**
 * 软删除病例（仅超级管理员）
 * @param {number} recordId - 病例ID
 * @param {number} operatorId - 操作人ID
 */
async function deleteRecord(recordId, operatorId) {
  const rows = await query(
    'SELECT id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);

  await query(
    'UPDATE medical_records SET deleted_at = NOW(), updated_by = ? WHERE id = ?',
    [operatorId, recordId]
  );
}

/**
 * 医生判读病例（符合用药 / 不符合用药 / 资料不全）
 * @param {number} recordId  - 病例ID
 * @param {string} operation - 操作类型：review_suitable | review_unsuitable | review_incomplete
 * @param {string} [notes]   - 备注（资料不全时必填）
 * @param {Object} currentUser - 当前登录医生
 * @returns {Promise<void>}
 */
async function reviewRecord(recordId, operation, notes, currentUser) {
  const { userId } = currentUser;

  const rows = await query(
    'SELECT id, status, doctor_id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  /** 只有被指派的医生才能判读 */
  if (record.doctor_id !== userId) throw createError('您无权判读此病例', 403);

  /** 检查状态流转是否合法 */
  const newStatus = STATUS_TRANSITIONS[record.status]?.[operation];
  if (!newStatus) {
    throw createError(`当前状态「${record.status}」不允许执行此操作`, 400);
  }

  /** 资料不全时备注必填 */
  if (operation === 'review_incomplete' && !notes) {
    throw createError('标记资料不全时，备注不能为空', 400);
  }

  await transaction(async conn => {
    await conn.execute(
      'UPDATE medical_records SET status = ?, updated_by = ? WHERE id = ?',
      [newStatus, userId, recordId]
    );
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, notes, operator_type, operator_id)
       VALUES (?, ?, ?, 'doctor', ?)`,
      [recordId, operation, notes || null, userId]
    );
  });
}

/**
 * 业务员操作"已就诊"（符合用药 -> 待复诊）
 * @param {number} recordId - 病例ID
 * @param {Object} currentUser - 当前登录业务员
 */
async function markVisited(recordId, currentUser) {
  const { userId, role } = currentUser;

  const rows = await query(
    'SELECT id, status, salesperson_id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  /** 检查可见权限 */
  if (role !== 'super_admin') {
    const descendantIds = await getDescendantIds(userId);
    if (!descendantIds.includes(record.salesperson_id)) {
      throw createError('无权操作此病例', 403);
    }
  }

  const newStatus = STATUS_TRANSITIONS[record.status]?.['visited'];
  if (!newStatus) {
    throw createError(`当前状态「${record.status}」不允许执行已就诊操作`, 400);
  }

  await transaction(async conn => {
    await conn.execute(
      'UPDATE medical_records SET status = ?, updated_by = ? WHERE id = ?',
      [newStatus, userId, recordId]
    );
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, operator_type, operator_id)
       VALUES (?, 'visited', 'salesperson', ?)`,
      [recordId, userId]
    );
  });
}

/**
 * 业务员操作"已复诊"（记录复诊时间，状态重置为待复诊）
 * @param {number} recordId      - 病例ID
 * @param {string} followUpTime  - 复诊日期（YYYY-MM-DD）
 * @param {string} [notes]       - 备注
 * @param {Object} currentUser   - 当前登录业务员
 */
async function markFollowUp(recordId, followUpTime, notes, currentUser) {
  const { userId, role } = currentUser;

  const rows = await query(
    'SELECT id, status, salesperson_id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  if (role !== 'super_admin') {
    const descendantIds = await getDescendantIds(userId);
    if (!descendantIds.includes(record.salesperson_id)) {
      throw createError('无权操作此病例', 403);
    }
  }

  const newStatus = STATUS_TRANSITIONS[record.status]?.['follow_up'];
  if (!newStatus) {
    throw createError(`当前状态「${record.status}」不允许执行已复诊操作`, 400);
  }

  await transaction(async conn => {
    /** 插入复诊记录 */
    await conn.execute(
      'INSERT INTO record_follow_ups (record_id, follow_up_time, notes, created_by) VALUES (?, ?, ?, ?)',
      [recordId, followUpTime, notes || null, userId]
    );
    /** 状态重置为待复诊（新一轮复诊周期） */
    await conn.execute(
      'UPDATE medical_records SET status = ?, updated_by = ? WHERE id = ?',
      [newStatus, userId, recordId]
    );
    /** 记录操作日志 */
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, notes, operator_type, operator_id)
       VALUES (?, 'follow_up', ?, 'salesperson', ?)`,
      [recordId, notes || null, userId]
    );
  });
}

/**
 * 标记病例为"已完诊"（任意状态均可操作）
 * @param {number} recordId  - 病例ID
 * @param {Object} currentUser - 当前登录业务员
 */
async function markCompleted(recordId, currentUser) {
  const { userId, role } = currentUser;

  const rows = await query(
    'SELECT id, status, salesperson_id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  if (role !== 'super_admin') {
    const descendantIds = await getDescendantIds(userId);
    if (!descendantIds.includes(record.salesperson_id)) {
      throw createError('无权操作此病例', 403);
    }
  }

  if (record.status === 'completed') {
    throw createError('病例已完诊', 400);
  }

  await transaction(async conn => {
    await conn.execute(
      "UPDATE medical_records SET status = 'completed', updated_by = ? WHERE id = ?",
      [userId, recordId]
    );
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, operator_type, operator_id)
       VALUES (?, 'complete', 'salesperson', ?)`,
      [recordId, userId]
    );
  });
}

/**
 * 业务员补充资料（资料不全 -> 待判读）
 * @param {number} recordId  - 病例ID
 * @param {Object} data      - 补充的资料
 * @param {Object} currentUser - 当前登录业务员
 */
async function supplementRecord(recordId, data, currentUser) {
  const { userId, role } = currentUser;

  const rows = await query(
    'SELECT id, status, salesperson_id FROM medical_records WHERE id = ? AND deleted_at IS NULL',
    [recordId]
  );
  if (rows.length === 0) throw createError('病例不存在', 404);
  const record = rows[0];

  if (role !== 'super_admin') {
    const descendantIds = await getDescendantIds(userId);
    if (!descendantIds.includes(record.salesperson_id)) {
      throw createError('无权操作此病例', 403);
    }
  }

  if (record.status !== 'incomplete') {
    throw createError('只有「资料不全」状态的病例才能补充资料', 400);
  }

  const { description, photos } = data;
  const fields = ["status = 'pending_review'", 'updated_by = ?'];
  const params = [userId];

  if (description !== undefined) { fields.push('description = ?'); params.push(description || null); }
  if (photos !== undefined) {
    fields.push('photos = ?');
    params.push(photos ? JSON.stringify(photos) : null);
  }
  params.push(recordId);

  await transaction(async conn => {
    await conn.execute(
      `UPDATE medical_records SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    await conn.execute(
      `INSERT INTO record_operations (record_id, operation, operator_type, operator_id)
       VALUES (?, 'supplement', 'salesperson', ?)`,
      [recordId, userId]
    );
  });
}

module.exports = {
  getRecordList,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  reviewRecord,
  markVisited,
  markFollowUp,
  markCompleted,
  supplementRecord,
};
