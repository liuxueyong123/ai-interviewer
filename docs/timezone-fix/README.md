# 时区问题排查与修复总结

## 问题现象

线上环境前端展示的时间总是比实际多 8 小时。例如面试创建时间为北京时间 10:00，页面显示为 18:00。

本地开发环境正常——面试从 0 分钟开始计时，线上却从 -480 分钟开始计时（-480 分钟 = -8 小时）。

## 环境背景

| 组件 | 时区 |
|------|------|
| 阿里云 RDS MySQL | UTC+8 (Asia/Shanghai) |
| Docker 容器 (node:22-alpine) | 默认 UTC |
| 用户浏览器 | UTC+8 (中国) |

## 排查过程

### 时间数据流

```
MySQL NOW() → DATETIME 字段 → mysql2 驱动(timezone 配置) → JS Date 对象
→ JSON.stringify → ISO 字符串(Z) → 前端 new Date() → toLocaleString
```

### 第一轮：发现根本原因

mysql2 驱动通过 `extra.timezone` 配置解读 DATETIME 字段。该配置告诉驱动"把数据库返回的 DATETIME 字符串按哪个时区理解"。

**配置链路（修复前）：**

```
MySQL NOW() 返回 "2026-05-13 10:00:00" (UTC+8 本地时间)
      ↓
extra.timezone: "+00:00" → 驱动按 UTC 解读 → Date = 10:00 UTC (错误，实际应为 02:00 UTC)
      ↓
JSON.stringify → "2026-05-13T10:00:00.000Z"
      ↓
浏览器 new Date() → 识别为 UTC → toLocaleString("zh-CN") → +8h → 显示 18:00 ❌
```

**提交：** `73d9d83` — 此时 `extra.timezone: "+00:00"` 已存在，但只改了驱动侧，MySQL 的 `NOW()` 依然产出本地时间，偏移依旧。

### 第二轮：尝试 SET GLOBAL time_zone

思路是让 MySQL 会话时区也设为 UTC，使 `NOW()` 产出 UTC 时间：

```sql
SET GLOBAL time_zone = '+00:00';  -- 让所有新连接默认 UTC
SET time_zone = '+00:00';         -- 当前会话 UTC
```

同时引入 `DB_TIMEZONE` 环境变量方便灵活配置。

**提交：** `47a906f`

**问题：** 阿里云 RDS 不授予 SUPER 权限，`SET GLOBAL time_zone` 静默失败。只有初始化时的第一个连接执行了 session 级别 `SET time_zone`，连接池中后续新建的连接依然是 RDS 默认的 `+08:00`，导致时间问题间歇性出现（取决于请求落在哪个连接上）。

### 第三轮：服务端渲染的隐藏问题

Dashboard 页面使用 `force-dynamic`（SSR 服务端渲染），其中 `toLocaleString("zh-CN", ...)` 在 Node.js 进程中执行。

```
Docker 容器 TZ=UTC → toLocaleString 输出 UTC 时间 → 即使 Date 对象正确，显示也偏移
```

如果 Docker 容器是 UTC，即使数据库驱动层面时间已修正，SSR 渲染的时间仍会错误。

### 最终方案：统一时区为 Asia/Shanghai

既然整个应用面向中国用户，RDS 是 UTC+8，浏览器是 UTC+8，最简洁的方案是让 Docker 容器也统一到 `Asia/Shanghai`。

## 最终配置

### Dockerfile（runner stage）

```dockerfile
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata
```

Alpine 镜像不包含时区数据，需安装 `tzdata` 包，否则 `TZ` 环境变量不生效。

### docker-compose.prod.yml

```yaml
environment:
  - TZ=Asia/Shanghai
```

### src/lib/database.ts

```typescript
extra: {
  connectTimeout: 10000,
  ...(process.env.DB_TIMEZONE ? { timezone: process.env.DB_TIMEZONE } : {}),
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
},
```

不显式设置 `timezone`，mysql2 驱动默认使用 `"local"`（即容器的 `Asia/Shanghai`），与 RDS 时区一致。`DB_TIMEZONE` 仅在特殊场景下按需覆盖。

### 前端页面

无需任何特殊处理。`toLocaleString("zh-CN", ...)` 在服务端使用容器时区（+08:00），在客户端使用浏览器时区（+08:00），结果一致。

## 原理

修正后的数据流：

```
MySQL NOW() → "2026-05-13 10:00:00" (RDS = UTC+8)
      ↓
mysql2 timezone="local" = Asia/Shanghai → 驱动按 +08:00 解读 → Date = 02:00 UTC ✅
      ↓
JSON.stringify → "2026-05-13T02:00:00.000Z" ✅
      ↓
SSR: toLocaleString("zh-CN") 容器 TZ=+08:00 → 显示 10:00 ✅
浏览器: new Date() → 本地 +08:00 → 显示 10:00 ✅
```

## 总结

| 尝试 | 做法 | 结果 |
|------|------|------|
| `extra.timezone: "+00:00"` | 只改驱动解读方式 | 偏移仍存在，MySQL `NOW()` 未对齐 |
| `SET GLOBAL time_zone` | 运行时改 MySQL 全局时区 | RDS 无 SUPER 权限，间歇性失效 |
| `timeZone: "Asia/Shanghai"` in toLocaleString | 前端硬编码时区 | 打补丁方式，不解决根本问题 |
| **Docker `TZ=Asia/Shanghai`** | **容器层面统一时区** | **一次配置，全链路一致** |

核心原则：**不要在代码里与时区搏斗。让运行环境（Docker、数据库、浏览器）的时区保持一致，代码保持简单。**

如果未来服务海外用户，可考虑将 `TZ` 和 `DB_TIMEZONE` 设为 `UTC`，前端展示时用 `Intl.DateTimeFormat` 按用户偏好时区格式化。但在此之前，当前方案是最简且正确的选择。
