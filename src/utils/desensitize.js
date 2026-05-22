/**
 * @fileoverview 数据脱敏工具
 * @description 提供各类敏感数据的脱敏方法，用于上级业务员查看下级病例时隐藏关键信息
 */

'use strict';

/**
 * 手机号脱敏（保留前 3 位和后 4 位）
 * @param {string} phone - 手机号明文
 * @returns {string} 脱敏后的手机号，如 138****8888
 * @example desensitizePhone('13812348888') => '138****8888'
 */
function desensitizePhone(phone) {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/**
 * 身份证号脱敏（保留前 6 位和后 4 位）
 * @param {string} idCard - 身份证号明文
 * @returns {string} 脱敏后的身份证号，如 110101********1234
 * @example desensitizeIdCard('110101199001011234') => '110101********1234'
 */
function desensitizeIdCard(idCard) {
  if (!idCard || idCard.length < 10) return '***';
  return idCard.slice(0, 6) + '********' + idCard.slice(-4);
}

/**
 * 姓名脱敏（保留第一个字，其余用 * 代替）
 * @param {string} name - 姓名明文
 * @returns {string} 脱敏后的姓名，如 张**
 * @example desensitizeName('张三丰') => '张**'
 */
function desensitizeName(name) {
  if (!name) return '***';
  if (name.length === 1) return '*';
  if (name.length === 2) return name.slice(0, 1) + '*';
  return name.slice(0, 1) + '*'.repeat(name.length - 1);
}

/**
 * 对病例记录进行脱敏处理（上级查看下级病例时使用）
 * 规则：姓名/手机号/身份证脱敏，照片隐藏（置为 null）
 * @param {Object} record - 病例原始数据（已解密）
 * @returns {Object} 脱敏后的病例数据
 */
function desensitizeRecord(record) {
  return {
    ...record,
    patient_phone:   desensitizePhone(record.patient_phone),
    patient_id_card: desensitizeIdCard(record.patient_id_card),
    photos:          null,
  };
}

/**
 * 医生查看病例时的脱敏处理
 * 规则：手机号/身份证脱敏，姓名与照片保持原样
 * @param {Object} record - 病例原始数据（已解密）
 * @returns {Object} 脱敏后的病例数据
 */
function desensitizeRecordForDoctor(record) {
  return {
    ...record,
    patient_phone:   desensitizePhone(record.patient_phone),
    patient_id_card: desensitizeIdCard(record.patient_id_card),
  };
}

module.exports = {
  desensitizePhone,
  desensitizeIdCard,
  desensitizeName,
  desensitizeRecord,
  desensitizeRecordForDoctor,
};
