/**
 * @fileoverview AES 加密/解密工具
 * @description 使用 Node.js 原生 crypto 模块实现 AES-256-CBC 加密，
 *              用于对患者手机号、身份证等敏感字段进行加密存储
 */

'use strict';

const crypto = require('crypto');
const config = require('../config');

/** 加密算法 */
const ALGORITHM = 'aes-256-cbc';

/**
 * 确保密钥和IV长度符合要求
 * AES-256 需要 32 字节密钥，CBC 模式需要 16 字节 IV
 */
const SECRET_KEY = Buffer.from(config.aes.key.padEnd(32, '0').slice(0, 32));
const IV         = Buffer.from(config.aes.iv.padEnd(16, '0').slice(0, 16));

/**
 * AES-256-CBC 加密
 * @param {string} plaintext - 明文字符串
 * @returns {string} Base64 编码的密文，格式为 "iv:ciphertext"（使用随机IV增强安全性）
 * @throws {Error} 加密失败时抛出错误
 */
function encrypt(plaintext) {
  if (!plaintext && plaintext !== 0) return '';
  try {
    /** 每次加密使用随机 IV，提高安全性 */
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    /** 将随机 IV 和密文一起存储（iv:ciphertext） */
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new Error(`加密失败: ${error.message}`);
  }
}

/**
 * AES-256-CBC 解密
 * @param {string} ciphertext - Base64 编码的密文（格式：iv:ciphertext）
 * @returns {string} 明文字符串
 * @throws {Error} 解密失败时抛出错误
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  try {
    const [ivHex, encrypted] = ciphertext.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('密文格式错误');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error(`解密失败: ${error.message}`);
  }
}

/**
 * 安全解密（解密失败时返回空字符串，不抛出异常）
 * @param {string} ciphertext - 密文
 * @returns {string} 明文或空字符串
 */
function safeDecrypt(ciphertext) {
  try {
    return decrypt(ciphertext);
  } catch {
    return '';
  }
}

module.exports = { encrypt, decrypt, safeDecrypt };
