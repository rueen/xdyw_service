# 鑫达医委病例管理系统 - 服务端

基于 Node.js + Express + MySQL 的病例管理系统后端服务。

## 技术栈

- **运行时**: Node.js >= 18
- **框架**: Express 4
- **数据库**: MySQL 8（本地）
- **认证**: JWT (HS256)
- **加密**: bcryptjs（密码）+ AES-256-CBC（敏感字段）
- **文件存储**: 阿里云 OSS
- **定时任务**: node-cron
- **日志**: winston

---

## 快速启动

### 1. 初始化数据库

> 确保本地 MySQL 已启动，且无密码（或根据实际情况配置）

```bash
mysql -u root < database/schema.sql
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 按实际情况编辑 .env 文件（重点配置 OSS 凭证和 AES 密钥）
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动服务

```bash
# 开发环境（热重载）
npm run dev

# 生产环境
npm start
```

服务启动后访问 `http://localhost:3000/health` 验证是否正常。

---

## 超级管理员账号

| 字段 | 值 |
|---|---|
| 手机号 | 13800000000 |
| 密码 | Admin@123456 |

> **首次登录后请立即修改密码！**

---

## 接口文档

### 统一规范

- 基础路径：`/api/v1`
- 请求头：`Authorization: Bearer <token>`
- 响应格式：`{ code, message, data }`

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/login | 登录（业务员/医生统一入口） |
| GET | /auth/profile | 获取当前用户信息 |
| PUT | /auth/password | 修改密码 |

### 业务员管理

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /salespersons | 列表 | 超级管理员 |
| GET | /salespersons/subordinates | 我的下级列表 | 业务员 |
| GET | /salespersons/:id | 详情 | 超级管理员 |
| POST | /salespersons | 新增 | 超级管理员/业务员 |
| PUT | /salespersons/:id | 修改 | 超级管理员 |
| DELETE | /salespersons/:id | 删除 | 超级管理员 |

### 医生管理

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /doctors | 列表 | 超级管理员 |
| GET | /doctors/active | 可用医生列表 | 业务员 |
| POST | /doctors | 新增 | 超级管理员 |
| PUT | /doctors/:id | 修改 | 超级管理员 |
| DELETE | /doctors/:id | 删除 | 超级管理员 |

### 病例管理

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /records | 列表（含权限过滤） | 业务员/医生 |
| POST | /records | 新增 | 业务员 |
| GET | /records/:id | 详情（含操作日志、复诊记录） | 业务员/医生 |
| PUT | /records/:id | 修改基础信息 | 业务员 |
| DELETE | /records/:id | 删除 | 超级管理员 |
| POST | /records/:id/review | 医生判读 | 医生 |
| POST | /records/:id/visited | 已就诊 | 业务员 |
| POST | /records/:id/follow-up | 已复诊 | 业务员 |
| POST | /records/:id/complete | 已完诊 | 业务员 |
| POST | /records/:id/supplement | 补充资料 | 业务员 |

### 其他

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | /statistics | 数据统计 | 超级管理员 |
| GET | /configs | 系统配置 | 超级管理员 |
| PUT | /configs/:key | 修改配置 | 超级管理员 |
| GET | /notifications | 通知列表 | 业务员 |
| PUT | /notifications/:id/read | 标记已读 | 业务员 |
| PUT | /notifications/read-all | 全部已读 | 业务员 |
| POST | /upload | 上传图片 | 业务员 |

---

## 病例状态说明

| 状态值 | 说明 | 可操作人 |
|---|---|---|
| pending_review | 待医生判读 | 医生 |
| suitable | 符合用药 | 业务员（操作已就诊） |
| unsuitable | 不符合用药 | 业务员（标记完诊） |
| incomplete | 资料不全 | 业务员（补充资料） |
| pending_follow_up | 待复诊 | 业务员（操作已复诊/完诊） |
| completed | 已完诊 | - |

> 任意状态均可被标记为「已完诊」

---

## 系统配置项

| 配置键 | 默认值 | 说明 |
|---|---|---|
| follow_up_interval_days | 60 | 复诊间隔天数（2个月） |
| follow_up_reminder_days | 7 | 提前提醒天数 |

---

## 目录结构

```
src/
├── config/         # 数据库连接、全局配置
├── middleware/     # 鉴权、限流、错误处理、参数校验
├── routes/         # 路由定义
├── controllers/    # 请求/响应处理
├── services/       # 业务逻辑
├── utils/          # 工具函数（加密、脱敏、日志、定时任务）
└── app.js          # 应用入口
database/
└── schema.sql      # 建表SQL
```
