# 赛百诺病例管理系统 - API 接口文档

**Base URL**: `http://localhost:3000/api/v1`

**版本**: v1.0.0

---

## 目录

- [通用规范](#通用规范)
- [认证模块](#认证模块)
- [业务员管理](#业务员管理)
- [医生管理](#医生管理)
- [病例管理](#病例管理)
- [数据统计](#数据统计)
- [系统配置](#系统配置)
- [通知管理](#通知管理)
- [文件上传](#文件上传)
- [枚举值说明](#枚举值说明)

---

## 通用规范

### 请求头

```
Authorization: Bearer <token>
Content-Type: application/json
```

> 除登录接口外，所有接口均需要携带 `Authorization` 请求头。

### 统一响应格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

### 分页响应格式

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 10,
      "totalPages": 10
    }
  }
}
```

### 错误响应格式

```json
{
  "code": 400,
  "message": "错误描述",
  "errors": [
    { "field": "phone", "message": "手机号格式错误", "value": "abc" }
  ]
}
```

### HTTP 状态码说明

| 状态码 | 说明 |
|---|---|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未登录 / Token 无效或过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 数据冲突（如手机号重复） |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 认证模块

### 登录

业务员和医生使用同一个登录接口，系统自动识别身份。

**POST** `/auth/login`

> 无需 Token，登录接口每 IP 每分钟限制 5 次请求。

**请求体**

```json
{
  "phone": "13812345678",
  "password": "Admin@123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| phone | string | ✅ | 手机号 |
| password | string | ✅ | 密码（最少6位） |

**成功响应**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userInfo": {
      "id": 1,
      "name": "张三",
      "phone": "13812345678",
      "userType": "salesperson",
      "role": "super_admin"
    }
  }
}
```

> `userType` 为 `salesperson`（业务员）或 `doctor`（医生）
>
> `role` 仅业务员有此字段，值为 `super_admin` 或 `salesperson`

---

### 获取当前用户信息

**GET** `/auth/profile`

**成功响应（业务员）**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "张三",
    "phone": "13812345678",
    "province": "广东省",
    "city": "广州市",
    "district": "天河区",
    "role": "salesperson",
    "status": "normal",
    "parent_id": 1,
    "parent_name": "超级管理员",
    "created_at": "2024-01-01 08:00:00",
    "userType": "salesperson"
  }
}
```

**成功响应（医生）**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "name": "李医生",
    "phone": "13900000001",
    "status": "normal",
    "created_at": "2024-01-01 08:00:00",
    "userType": "doctor"
  }
}
```

---

### 修改密码

**PUT** `/auth/password`

**请求体**

```json
{
  "oldPassword": "Admin@123456",
  "newPassword": "NewPass@789"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| oldPassword | string | ✅ | 旧密码 |
| newPassword | string | ✅ | 新密码（6-50位，必须包含字母和数字） |

**成功响应**

```json
{
  "code": 200,
  "message": "密码修改成功",
  "data": null
}
```

---

## 业务员管理

> 以下接口除「获取下级列表」外，均需要**超级管理员**权限。

### 获取业务员列表

**GET** `/salespersons`

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | - | 姓名（模糊查询） |
| phone | string | - | 手机号（模糊查询） |
| province | string | - | 省（精确） |
| city | string | - | 市（精确） |
| district | string | - | 区（精确） |
| parentId | number | - | 上级业务员ID |
| status | string | - | 状态：`normal` / `disabled` |
| page | number | - | 页码，默认 1 |
| pageSize | number | - | 每页条数，默认 10，最大 100 |

**成功响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 2,
        "name": "张业务",
        "phone": "13812345678",
        "province": "广东省",
        "city": "广州市",
        "district": "天河区",
        "role": "salesperson",
        "status": "normal",
        "parent_id": 1,
        "parent_name": "超级管理员",
        "created_at": "2024-01-01 08:00:00",
        "updated_at": "2024-01-01 08:00:00"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "pageSize": 10,
      "totalPages": 5
    }
  }
}
```

---

### 获取业务员详情

**GET** `/salespersons/:id`

**成功响应**：同列表单条数据结构。

---

### 获取我的下级列表

> 业务员权限即可调用，返回直接下级列表。

**GET** `/salespersons/subordinates`

**Query 参数**：`page`、`pageSize`

**成功响应**：同列表结构。

---

### 新增业务员

> 超级管理员或业务员（为自己添加下级）均可调用。

**POST** `/salespersons`

**请求体**

```json
{
  "name": "王业务",
  "phone": "13700000001",
  "password": "Pass@123",
  "province": "广东省",
  "city": "深圳市",
  "district": "南山区",
  "parentId": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | ✅ | 姓名（最长50字） |
| phone | string | ✅ | 手机号（全局唯一） |
| password | string | ✅ | 密码（6-50位） |
| province | string | - | 省 |
| city | string | - | 市 |
| district | string | - | 区 |
| parentId | number | - | 上级业务员ID，不传则默认挂在超级管理员下 |

**成功响应**

```json
{
  "code": 201,
  "message": "业务员创建成功",
  "data": { "id": 5 }
}
```

---

### 修改业务员

**PUT** `/salespersons/:id`

**请求体**（所有字段均为可选）

```json
{
  "name": "新名字",
  "phone": "13700000002",
  "password": "NewPass@123",
  "province": "北京市",
  "city": "北京市",
  "district": "朝阳区",
  "parentId": 2,
  "status": "disabled"
}
```

**成功响应**

```json
{
  "code": 200,
  "message": "业务员信息更新成功",
  "data": null
}
```

---

### 删除业务员

**DELETE** `/salespersons/:id`

> 软删除。若该业务员还有未删除的下级，操作会失败。

**成功响应**

```json
{
  "code": 200,
  "message": "业务员删除成功",
  "data": null
}
```

---

## 医生管理

> 以下接口均需要**超级管理员**权限（`GET /doctors/active` 除外）。

### 获取医生列表

**GET** `/doctors`

**Query 参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| name | string | 姓名（模糊） |
| phone | string | 手机号（模糊） |
| status | string | `normal` / `disabled` |
| page | number | 默认 1 |
| pageSize | number | 默认 10 |

**成功响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "李医生",
        "phone": "13900000001",
        "status": "normal",
        "created_at": "2024-01-01 08:00:00",
        "updated_at": "2024-01-01 08:00:00"
      }
    ],
    "pagination": { "total": 5, "page": 1, "pageSize": 10, "totalPages": 1 }
  }
}
```

---

### 获取可用医生列表（病例指派用）

> 业务员权限即可调用，用于新建病例时选择指派医生。

**GET** `/doctors/active`

**成功响应**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    { "id": 1, "name": "李医生", "phone": "13900000001" },
    { "id": 2, "name": "王医生", "phone": "13900000002" }
  ]
}
```

---

### 新增医生

**POST** `/doctors`

**请求体**

```json
{
  "name": "赵医生",
  "phone": "13900000003",
  "password": "Doc@123456"
}
```

**成功响应**

```json
{
  "code": 201,
  "message": "医生创建成功",
  "data": { "id": 3 }
}
```

---

### 修改医生

**PUT** `/doctors/:id`

**请求体**（所有字段均为可选）

```json
{
  "name": "新名字",
  "phone": "13900000004",
  "password": "NewDoc@123",
  "status": "disabled"
}
```

---

### 删除医生

**DELETE** `/doctors/:id`

---

## 病例管理

### 获取病例列表

> - **业务员**：可见自己及所有子孙级录入的病例（下级病例自动脱敏）
> - **医生**：只能查看指派给自己的病例
> - **超级管理员**：可查看全部病例

**GET** `/records`

**Query 参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| patientName | string | 患者姓名（模糊） |
| patientPhone | string | 患者手机号（模糊，解密后匹配） |
| patientIdCard | string | 患者身份证号（模糊，解密后匹配） |
| doctorId | number | 指派医生ID |
| status | string | 病例状态（见枚举值说明） |
| page | number | 默认 1 |
| pageSize | number | 默认 10 |

**成功响应**

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "id": 1,
        "patient_name": "张三",
        "patient_phone": "138****8888",
        "patient_id_card": "110101********1234",
        "doctor_id": 1,
        "doctor_name": "李医生",
        "salesperson_id": 2,
        "salesperson_name": "王业务",
        "description": "患者描述...",
        "photos": [
          "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/records/20240101/xxx.jpg"
        ],
        "status": "pending_review",
        "next_follow_up_time": null,
        "created_at": "2024-01-01 10:00:00",
        "updated_at": "2024-01-01 10:00:00"
      }
    ],
    "pagination": { "total": 100, "page": 1, "pageSize": 10, "totalPages": 10 }
  }
}
```

> **脱敏规则**：上级业务员查看下级录入的病例时，`patient_name`、`patient_phone`、`patient_id_card` 自动脱敏显示。
>
> `next_follow_up_time`：仅 `status = pending_follow_up` 时有值（格式 `YYYY-MM-DD`），由服务端动态计算（最后复诊时间 + 系统配置的复诊间隔天数）。

---

### 获取病例详情

**GET** `/records/:id`

**成功响应**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": 1,
    "patient_name": "张三",
    "patient_phone": "13812348888",
    "patient_id_card": "110101199001011234",
    "doctor_id": 1,
    "doctor_name": "李医生",
    "salesperson_id": 2,
    "salesperson_name": "王业务",
    "description": "患者描述...",
    "photos": ["https://...jpg"],
    "status": "pending_follow_up",
    "next_follow_up_time": "2024-03-01",
    "created_at": "2024-01-01 10:00:00",
    "updated_at": "2024-01-15 10:00:00",
    "operations": [
      {
        "id": 1,
        "operation": "create",
        "notes": null,
        "operator_type": "salesperson",
        "operator_id": 2,
        "operator_name": "王业务",
        "created_at": "2024-01-01 10:00:00"
      },
      {
        "id": 2,
        "operation": "review_suitable",
        "notes": null,
        "operator_type": "doctor",
        "operator_id": 1,
        "operator_name": "李医生",
        "created_at": "2024-01-02 09:00:00"
      },
      {
        "id": 3,
        "operation": "visited",
        "notes": null,
        "operator_type": "salesperson",
        "operator_id": 2,
        "operator_name": "王业务",
        "created_at": "2024-01-03 14:00:00"
      }
    ],
    "follow_ups": [
      {
        "id": 1,
        "follow_up_time": "2024-01-15",
        "notes": "复诊正常",
        "salesperson_name": "王业务",
        "created_at": "2024-01-15 10:00:00"
      }
    ]
  }
}
```

---

### 新增病例

> **业务员**权限

**POST** `/records`

**请求体**

```json
{
  "patientName": "张三",
  "patientPhone": "13812348888",
  "patientIdCard": "110101199001011234",
  "doctorId": 1,
  "description": "患者主诉：头痛，已持续一周...",
  "photos": [
    "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/records/20240101/photo1.jpg"
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| patientName | string | ✅ | 患者姓名（最长50字） |
| patientPhone | string | ✅ | 患者手机号 |
| patientIdCard | string | ✅ | 患者身份证号（18位，自动验证格式） |
| doctorId | number | ✅ | 指派医生ID |
| description | string | - | 病情描述（最长300字） |
| photos | string[] | - | 照片URL数组（最多10张，需先调用上传接口获取URL） |

**成功响应**

```json
{
  "code": 201,
  "message": "病例创建成功",
  "data": { "id": 10 }
}
```

---

### 修改病例基础信息

> **业务员**权限，且只能修改自己录入的病例（超级管理员可修改所有）

**PUT** `/records/:id`

**请求体**（所有字段均为可选）

```json
{
  "patientName": "张三丰",
  "patientPhone": "13812340000",
  "patientIdCard": "110101199001011234",
  "doctorId": 2,
  "description": "更新的描述...",
  "photos": ["https://...jpg", "https://...jpg"]
}
```

**成功响应**

```json
{
  "code": 200,
  "message": "病例更新成功",
  "data": null
}
```

---

### 删除病例

> **超级管理员**权限，软删除

**DELETE** `/records/:id`

---

### 医生判读病例

> **医生**权限，且只能判读指派给自己的病例

**POST** `/records/:id/review`

**请求体**

```json
{
  "operation": "review_incomplete",
  "notes": "缺少近三个月血常规报告，请补充"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| operation | string | ✅ | 操作类型（见下方） |
| notes | string | 条件必填 | operation 为 `review_incomplete` 时必填，最长300字 |

**operation 枚举值**

| 值 | 说明 | 状态流转 |
|---|---|---|
| review_suitable | 符合用药 | → `suitable` |
| review_unsuitable | 不符合用药 | → `unsuitable` |
| review_incomplete | 资料不全 | → `incomplete` |

> 仅当病例状态为 `pending_review` 时，可以执行判读操作。

**成功响应**

```json
{
  "code": 200,
  "message": "已标记为资料不全",
  "data": null
}
```

---

### 业务员操作「已就诊」

> **业务员**权限。病例状态必须为 `suitable`。

**POST** `/records/:id/visited`

**请求体**：无需传参

**成功响应**

```json
{
  "code": 200,
  "message": "已标记为已就诊，病例进入待复诊状态",
  "data": null
}
```

> 操作后病例状态变为 `pending_follow_up`，系统开始计算复诊到期时间。

---

### 业务员操作「已复诊」

> **业务员**权限。病例状态必须为 `pending_follow_up`。

**POST** `/records/:id/follow-up`

**请求体**

```json
{
  "followUpTime": "2024-03-01",
  "notes": "复诊情况良好，继续观察"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| followUpTime | string | ✅ | 本次复诊日期（YYYY-MM-DD） |
| notes | string | - | 复诊备注（最长300字） |

**成功响应**

```json
{
  "code": 200,
  "message": "复诊记录已保存",
  "data": null
}
```

> 操作成功后：
> - 插入一条复诊记录到 `record_follow_ups`
> - 病例状态**重置为** `pending_follow_up`（开始新一轮复诊周期）
> - 下次复诊日期自动重新计算为：本次复诊时间 + 系统配置的复诊间隔天数

---

### 标记病例「已完诊」

> **业务员**权限。**任意状态**的病例均可标记为完诊。

**POST** `/records/:id/complete`

**请求体**：无需传参

**成功响应**

```json
{
  "code": 200,
  "message": "病例已标记为已完诊",
  "data": null
}
```

---

### 业务员补充资料

> **业务员**权限。病例状态必须为 `incomplete`。

**POST** `/records/:id/supplement`

**请求体**（至少填写一个字段）

```json
{
  "description": "补充后的描述，包含血常规报告内容...",
  "photos": [
    "https://...血常规.jpg",
    "https://...其他资料.jpg"
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| description | string | - | 更新后的描述（最长300字） |
| photos | string[] | - | 更新后的照片列表（最多10张） |

**成功响应**

```json
{
  "code": 200,
  "message": "资料补充成功，病例已重新进入待判读状态",
  "data": null
}
```

> 操作后病例状态重置为 `pending_review`，医生重新进行判读。

---

## 数据统计

> **超级管理员**权限

**GET** `/statistics`

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| rangeType | string | - | 时间范围类型，默认 `today` |
| startDate | string | 条件必填 | 自定义开始日期（YYYY-MM-DD），`rangeType=custom` 时必填 |
| endDate | string | 条件必填 | 自定义结束日期（YYYY-MM-DD），`rangeType=custom` 时必填 |

**rangeType 枚举值**

| 值 | 说明 |
|---|---|
| today | 今日 |
| yesterday | 昨日 |
| week | 本周（周一至今） |
| month | 本月（1日至今） |
| custom | 自定义（需传 startDate、endDate） |

**成功响应**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "timeRange": {
      "type": "today",
      "startTime": "2024-01-15 00:00:00",
      "endTime": "2024-01-15 23:59:59"
    },
    "newCases": 12,
    "pendingReview": 5,
    "suitable": 3,
    "unsuitable": 1,
    "incomplete": 2,
    "visited": 4
  }
}
```

| 字段 | 说明 |
|---|---|
| newCases | 新增病例数（按创建时间统计） |
| pendingReview | 待判读病例数 |
| suitable | 符合用药病例数 |
| unsuitable | 不符合用药病例数 |
| incomplete | 资料不全病例数 |
| visited | 已就诊次数（从操作日志统计） |

---

## 系统配置

> **超级管理员**权限

### 获取所有配置

**GET** `/configs`

**成功响应**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "config_key": "follow_up_interval_days",
      "config_value": "60",
      "description": "默认复诊间隔天数（2个月）",
      "updated_at": "2024-01-01 08:00:00"
    },
    {
      "config_key": "follow_up_reminder_days",
      "config_value": "7",
      "description": "复诊到期提前提醒天数",
      "updated_at": "2024-01-01 08:00:00"
    }
  ]
}
```

---

### 修改配置项

**PUT** `/configs/:key`

**路径参数**：`key` 为配置键名（如 `follow_up_interval_days`）

**请求体**

```json
{
  "value": "90"
}
```

**成功响应**

```json
{
  "code": 200,
  "message": "配置更新成功",
  "data": null
}
```

**支持的配置键**

| key | 说明 | 类型 | 示例 |
|---|---|---|---|
| follow_up_interval_days | 复诊间隔天数 | 正整数 | 60 |
| follow_up_reminder_days | 提前提醒天数 | 正整数 | 7 |

---

## 通知管理

> **业务员**权限（医生无通知）

### 获取通知列表

**GET** `/notifications`

**Query 参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| page | number | 默认 1 |
| pageSize | number | 默认 20 |
| isRead | number | 0：仅未读，1：仅已读，不传：全部 |

**成功响应**

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "list": [
      {
        "id": 1,
        "record_id": 5,
        "type": "follow_up_reminder",
        "content": "患者「张三」将于 2024-03-01 复诊（还有 5 天），请提前安排。",
        "is_read": 0,
        "created_at": "2024-02-24 08:00:00",
        "patient_name": "张三",
        "record_status": "pending_follow_up"
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "total": 10,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
}
```

> `unreadCount`：当前业务员的未读通知总数，可用于显示角标。

---

### 标记单条通知已读

**PUT** `/notifications/:id/read`

**成功响应**

```json
{
  "code": 200,
  "message": "已标记为已读",
  "data": null
}
```

---

### 全部标记已读

**PUT** `/notifications/read-all`

**成功响应**

```json
{
  "code": 200,
  "message": "已全部标记为已读",
  "data": null
}
```

---

## 文件上传

> **业务员**权限，每 IP 每分钟最多上传 20 次

**POST** `/upload`

**请求格式**：`multipart/form-data`

| 字段名 | 类型 | 说明 |
|---|---|---|
| images | File[] | 图片文件，字段名必须为 `images`，最多 10 张，单张最大 10MB |

**支持格式**：JPG、PNG、WebP、GIF

**成功响应**

```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "urls": [
      "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/records/20240101/1704067200000_abc123.jpg",
      "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/records/20240101/1704067200001_def456.png"
    ],
    "files": [
      {
        "name": "photo1.jpg",
        "url": "https://...jpg",
        "size": 1024000,
        "ossKey": "records/20240101/1704067200000_abc123.jpg"
      }
    ]
  }
}
```

> **上传流程**：先调用此接口上传图片获取 URL，再将 URL 数组传入新增/修改病例接口的 `photos` 字段。

---

## 枚举值说明

### 病例状态（status）

| 值 | 中文说明 | 可执行操作 |
|---|---|---|
| pending_review | 待医生判读 | 医生判读（符合/不符合/资料不全）；业务员标记完诊 |
| suitable | 符合用药 | 业务员操作已就诊；业务员标记完诊 |
| unsuitable | 不符合用药 | 业务员标记完诊 |
| incomplete | 资料不全 | 业务员补充资料；业务员标记完诊 |
| pending_follow_up | 待复诊 | 业务员操作已复诊；业务员标记完诊 |
| completed | 已完诊 | - |

### 病例操作日志类型（operation）

| 值 | 中文说明 |
|---|---|
| create | 创建病例 |
| update | 修改病例信息 |
| review_suitable | 医生判读：符合用药 |
| review_unsuitable | 医生判读：不符合用药 |
| review_incomplete | 医生判读：资料不全 |
| supplement | 业务员补充资料 |
| visited | 业务员操作：已就诊 |
| follow_up | 业务员操作：已复诊 |
| complete | 标记：已完诊 |

### 用户角色（role）

| 值 | 说明 |
|---|---|
| super_admin | 超级管理员 |
| salesperson | 普通业务员 |

### 用户身份（userType）

| 值 | 说明 |
|---|---|
| salesperson | 业务员（含超级管理员） |
| doctor | 医生 |

### 状态（status）

| 值 | 说明 |
|---|---|
| normal | 正常 |
| disabled | 停用 |

---

## 病例状态流转示意

```
[创建病例]
     ↓
待医生判读 (pending_review)
  ├── 医生→符合用药 (suitable)
  │     └── 业务员→已就诊 ──→ 待复诊 (pending_follow_up)
  │                                └── 业务员→已复诊（循环）
  ├── 医生→不符合用药 (unsuitable)
  └── 医生→资料不全 (incomplete)
            └── 业务员补充资料 ──→ 待医生判读（重新判读）

[任意状态] ──→ 已完诊 (completed)
```

---

*文档生成时间：2026-05-10*
