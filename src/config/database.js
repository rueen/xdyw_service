/**
 * @fileoverview 数据库连接模块
 * @description 使用 mysql2 创建连接池，提供 Promise 风格的查询接口
 */

'use strict';

const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * MySQL 连接池实例
 * @type {mysql.Pool}
 */
let pool;

/**
 * 获取数据库连接池（单例模式）
 * @returns {mysql.Pool} 连接池实例
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:            config.db.host,
      port:            config.db.port,
      user:            config.db.user,
      password:        config.db.password,
      database:        config.db.database,
    connectionLimit: config.db.connectionLimit,
    timezone:        config.db.timezone,
    /** 将所有 DATE / DATETIME / TIMESTAMP 字段以字符串形式返回（格式：YYYY-MM-DD HH:mm:ss），
     *  避免 mysql2 将其转换为 JavaScript Date 对象后序列化为 ISO 8601 格式 */
    dateStrings: true,
    /** 自动将查询结果中的 bigint 转为字符串，避免精度丢失 */
    supportBigNumbers: true,
    bigNumberStrings:  true,
    /** 启用多语句执行（schema.sql 初始化时使用，正常业务禁止） */
    multipleStatements: false,
    });

    logger.info('MySQL 连接池已创建');
  }
  return pool;
}

/**
 * 执行 SQL 查询（参数化查询，防止 SQL 注入）
 * @param {string} sql - SQL 语句，使用 ? 作为占位符
 * @param {Array} [params=[]] - 查询参数列表
 * @returns {Promise<Array>} 查询结果
 * @example
 * const rows = await query('SELECT * FROM users WHERE id = ?', [1]);
 */
async function query(sql, params = []) {
  const pool = getPool();
  /**
   * 使用 pool.query() 而非 pool.execute()：
   * pool.execute() 基于服务端预处理语句，MySQL 协议不支持将 LIMIT/OFFSET 作为参数传入，
   * 会抛出 "Incorrect arguments to mysqld_stmt_execute" 错误。
   * pool.query() 使用客户端转义（mysql2 自动对所有 ? 参数进行安全转义），
   * 同样能防止 SQL 注入，且完全支持 LIMIT/OFFSET 参数。
   */
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数，接收 connection 参数
 * @returns {Promise<*>} 事务执行结果
 * @example
 * const result = await transaction(async (conn) => {
 *   await conn.execute('INSERT INTO ...', [...]);
 *   await conn.execute('UPDATE ...', [...]);
 *   return result;
 * });
 */
async function transaction(callback) {
  const pool = getPool();
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    /**
     * 将连接的 execute 代理为 query，原因同上：
     * connection.execute() 也是预处理语句，同样不支持 LIMIT/OFFSET 参数。
     * 通过代理确保事务内所有 SQL 都走 query()，行为与外部 query() 函数一致。
     */
    const proxiedConnection = new Proxy(connection, {
      get(target, prop) {
        if (prop === 'execute') return target.query.bind(target);
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const result = await callback(proxiedConnection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 测试数据库连接是否正常
 * @returns {Promise<boolean>} 连接成功返回 true
 */
async function testConnection() {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('数据库连接测试成功');
    return true;
  } catch (error) {
    logger.error('数据库连接失败:', error.message);
    throw error;
  }
}

module.exports = { query, transaction, testConnection, getPool };
