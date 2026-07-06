# 排行榜后端 (NumberGame Server)

数学游戏合集的分数排行榜后端。技术栈:**Fastify + TypeScript + SQLite**(better-sqlite3)。

## 运行

```bash
cd server
npm install
npm run dev        # 开发模式,自动重载,默认端口 4567
```

生产:

```bash
npm run build      # 编译到 dist/
npm run serve      # node 运行编译产物
```

环境变量:`PORT`(默认 4567)、`HOST`(默认 0.0.0.0)。

数据存储在 `server/leaderboard.db`(SQLite 单文件,已被 .gitignore 忽略;备份即拷贝该文件)。

## 接口

四个游戏标识:`count`(数一数)、`addition`(10内加减)、`small`(20内加减)、`big`(100内加减)。

### 提交分数
```
POST /api/score
Content-Type: application/json

{ "game": "count", "name": "小明", "score": 850, "correct": 12, "total": 15 }
```
- `name` 可选,最长 12 字;不传或空串表示匿名。
- 返回:`{ "rank": 8, "total": 42 }` —— 本次分数在该游戏榜中的名次 / 该游戏总记录数。

### 取榜单前 N 名
```
GET /api/top?game=count&n=10
```
返回:
```json
{
  "game": "count",
  "entries": [
    { "rank": 1, "name": "小明", "score": 980, "correct": 15, "total": 15, "created_at": 1720000000000 }
  ]
}
```
`name` 为空串的记录,前端展示为“匿名”。

### 健康检查
```
GET /api/health  ->  { "ok": true }
```

## 说明
- 每次游戏结束记录一条(同名玩家可多次上榜)。
- 分数、game 有基础 schema 校验(挡明显刷分)。排行榜为公开可写接口,如需更强防作弊需加签名/服务端校验。
