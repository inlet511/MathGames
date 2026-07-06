import Fastify from 'fastify';
import cors from '@fastify/cors';
import { GAMES, insertScore, getTop, previewRank, type GameId } from './db.js';

const PORT = Number(process.env.PORT ?? 4567);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

// 允许 H5 跨域(开发期放开所有来源;上线可收紧为具体域名)
await app.register(cors, { origin: true });

// 健康检查
app.get('/api/health', async () => ({ ok: true }));

// —— 提交分数 ——
const submitSchema = {
  body: {
    type: 'object',
    required: ['game', 'score'],
    additionalProperties: false,
    properties: {
      game: { type: 'string', enum: GAMES as unknown as string[] },
      // 用户名可选,最长 12 字符;不传或空串 => 匿名
      name: { type: 'string', maxLength: 12 },
      score: { type: 'integer', minimum: 0, maximum: 100000 },
      correct: { type: 'integer', minimum: 0, maximum: 10000 },
      total: { type: 'integer', minimum: 0, maximum: 10000 },
    },
  },
};

app.post('/api/score', { schema: submitSchema }, async (req) => {
  const b = req.body as {
    game: GameId;
    name?: string;
    score: number;
    correct?: number;
    total?: number;
  };
  const name = (b.name ?? '').trim().slice(0, 12);
  const result = insertScore({
    game: b.game,
    name,
    score: b.score,
    correct: b.correct ?? 0,
    total: b.total ?? 0,
  });
  return result; // { rank, total }
});

// —— 取榜单前 n 名 ——
const topSchema = {
  querystring: {
    type: 'object',
    required: ['game'],
    properties: {
      game: { type: 'string', enum: GAMES as unknown as string[] },
      n: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};

app.get('/api/top', { schema: topSchema }, async (req) => {
  const q = req.query as { game: GameId; n?: number };
  const entries = getTop(q.game, q.n ?? 10);
  return { game: q.game, entries };
});

// —— 预览某分数名次(不写库),用于打开榜单时显示“本次能排第几 / 前百分之几” ——
const previewSchema = {
  querystring: {
    type: 'object',
    required: ['game', 'score'],
    properties: {
      game: { type: 'string', enum: GAMES as unknown as string[] },
      score: { type: 'integer', minimum: 0, maximum: 100000 },
    },
  },
};

app.get('/api/preview', { schema: previewSchema }, async (req) => {
  const q = req.query as { game: GameId; score: number };
  return previewRank(q.game, q.score); // { rank, total, topPercent }
});


app
  .listen({ port: PORT, host: HOST })
  .then(() => {
    app.log.info(`排行榜后端已启动: http://localhost:${PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
