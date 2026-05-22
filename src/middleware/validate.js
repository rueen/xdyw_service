/**
 * @fileoverview 请求参数校验中间件
 * @description 使用 express-validator 对请求参数进行校验，统一返回校验错误
 */

'use strict';

const { validationResult } = require('express-validator');

/**
 * 参数校验结果检查中间件
 * 在路由处理器中使用 express-validator 的校验规则之后调用此中间件
 * 若存在校验错误，直接返回 400 响应；否则继续执行后续中间件
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 * @example
 * router.post('/login',
 *   body('phone').isMobilePhone('zh-CN'),
 *   body('password').notEmpty(),
 *   validate,      // <- 此中间件检查校验结果
 *   authController.login
 * );
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code:    400,
      message: '请求参数错误',
      errors:  errors.array().map(err => ({
        field:   err.path,
        message: err.msg,
        value:   err.value,
      })),
    });
  }
  next();
}

module.exports = validate;
