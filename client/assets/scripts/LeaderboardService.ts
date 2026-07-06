import { sys } from 'cc';

/**
 * 排行榜服务:封装与后端的 HTTP 通信,以及本地用户名存储。
 * 后端接口见 server/README.md。
 *
 * 服务器地址集中在此处 BASE_URL,部署到真实服务器时改这里即可。
 * 注意:端口用 4567 —— 3000 被 Cocos Creator 编辑器内部服务占用。
 */
const BASE_URL = 'http://localhost:4567';

const NAME_KEY = 'playerName';

export interface TopEntry {
    rank: number;
    name: string;
    score: number;
    correct: number;
    total: number;
    created_at: number;
}

export interface SubmitResult {
    rank: number;
    total: number;
}

// 通用请求:用引擎内置 XMLHttpRequest,超时后失败;失败一律 reject,由调用方降级处理
function request<T>(method: string, url: string, body?: object, timeout = 6000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = timeout;
        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText) as T);
                } catch (e) {
                    reject(new Error('响应解析失败'));
                }
            } else {
                reject(new Error(`请求失败: ${xhr.status}`));
            }
        };
        xhr.ontimeout = () => reject(new Error('请求超时'));
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.send(body ? JSON.stringify(body) : undefined);
    });
}

export class LeaderboardService {
    /** 读取本地保存的用户名(无则空串) */
    static getPlayerName(): string {
        return sys.localStorage.getItem(NAME_KEY) ?? '';
    }

    /** 保存用户名到本地(下次自动带出) */
    static setPlayerName(name: string): void {
        sys.localStorage.setItem(NAME_KEY, (name ?? '').trim().slice(0, 12));
    }

    /** 提交一局分数,返回排名与总记录数 */
    static submit(
        game: string,
        name: string,
        score: number,
        correct: number,
        total: number
    ): Promise<SubmitResult> {
        return request<SubmitResult>('POST', `${BASE_URL}/api/score`, {
            game,
            name: (name ?? '').trim().slice(0, 12),
            score,
            correct,
            total,
        });
    }

    /** 取某游戏榜单前 n 名 */
    static top(game: string, n = 10): Promise<TopEntry[]> {
        return request<{ game: string; entries: TopEntry[] }>(
            'GET',
            `${BASE_URL}/api/top?game=${encodeURIComponent(game)}&n=${n}`
        ).then((res) => res.entries ?? []);
    }
}
