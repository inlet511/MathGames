import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 数据库文件放在 server/ 目录下(与 src 同级的上一层),被 .gitignore 忽略
const DB_PATH = join(__dirname, '..', 'leaderboard.db');

// 合法的游戏标识,与前端关卡顺序一一对应:
// 01-count / 02-split / 03-addition(10内加减) / 04-smallmath(20内加减) / 05-bigmath
export const GAMES = ['count', 'split', 'addition', 'small', 'big'] as const;
export type GameId = (typeof GAMES)[number];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game       TEXT    NOT NULL,
    name       TEXT    NOT NULL DEFAULT '',
    score      INTEGER NOT NULL,
    correct    INTEGER NOT NULL DEFAULT 0,
    total      INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_scores_game_score
    ON scores (game, score DESC);
`);

// 预编译语句
const stmtInsert = db.prepare(`
  INSERT INTO scores (game, name, score, correct, total, created_at)
  VALUES (@game, @name, @score, @correct, @total, @created_at)
`);

// 排名:同一游戏中,严格高于本次分数的记录数 + 1
const stmtRank = db.prepare(`
  SELECT COUNT(*) AS higher FROM scores WHERE game = ? AND score > ?
`);

const stmtCount = db.prepare(`
  SELECT COUNT(*) AS n FROM scores WHERE game = ?
`);

const stmtTop = db.prepare(`
  SELECT name, score, correct, total, created_at
  FROM scores
  WHERE game = ?
  ORDER BY score DESC, created_at ASC
  LIMIT ?
`);

export interface ScoreInput {
  game: GameId;
  name: string;
  score: number;
  correct: number;
  total: number;
}

export interface TopEntry {
  rank: number;
  name: string;
  score: number;
  correct: number;
  total: number;
  created_at: number;
}

/** 插入一条分数,返回该分数在本游戏榜中的排名与总记录数 */
export function insertScore(input: ScoreInput): { rank: number; total: number } {
  const created_at = Date.now();
  stmtInsert.run({ ...input, created_at });

  const { higher } = stmtRank.get(input.game, input.score) as { higher: number };
  const { n } = stmtCount.get(input.game) as { n: number };
  return { rank: higher + 1, total: n };
}

/**
 * 预览某分数的名次(不写入库)。
 * total 计为“把这条算进去后的总人数”(现有 + 1),
 * topPercent = 名次占总数的百分比(越小越靠前),至少 1。
 */
export function previewRank(
  game: GameId,
  score: number
): { rank: number; total: number; topPercent: number } {
  const { higher } = stmtRank.get(game, score) as { higher: number };
  const { n } = stmtCount.get(game) as { n: number };
  const rank = higher + 1;
  const total = n + 1;
  const topPercent = Math.max(1, Math.round((rank / total) * 100));
  return { rank, total, topPercent };
}


/** 取某游戏分数前 n 名 */
export function getTop(game: GameId, n: number): TopEntry[] {
  const rows = stmtTop.all(game, n) as Omit<TopEntry, 'rank'>[];
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
