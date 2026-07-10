import { sys } from 'cc';

/**
 * 排行榜服务:封装与后端的 HTTP 通信,以及本地用户名存储。
 * 后端接口见 server/README.md。
 *
 * —— 后端地址配置(H5 部署,构建后可改,无需重新编译)——
 * 地址来源优先级:
 *   1) 构建产物根目录的 config.json 里的 backendUrl 字段(运行时读取)。
 *      部署后直接在服务器上编辑该文件即可改地址,刷新页面生效。
 *      · 填独立域名:"https://api.你的域名.com"(前端 https 则后端也必须 https)
 *      · 同源反代(推荐):填 "",请求走相对路径 /api/...,无跨域/无混合内容,
 *        需 Nginx 把 /api 转发到后端。
 *   2) 读不到 config.json 时自动降级:本机/内网用 DEV_BASE_URL,其余用相对路径。
 * 本地编辑器预览无需任何配置。端口 4567 —— 3000 被 Cocos 编辑器占用。
 */
const DEV_BASE_URL = 'http://localhost:4567';   // 本地开发地址,一般不用改

// 运行时读到的后端地址:undefined=config 还没加载完;string(含空串)=已确定。
let _configuredBaseUrl: string | undefined;

// 自动降级:web 平台本机/内网用开发地址,线上用相对路径(同源);非 web 用相对路径。
function fallbackBaseUrl(): string {
    if (typeof location === 'undefined' || !location.hostname) return '';
    const h = location.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1'
        || h.startsWith('192.168.') || h.startsWith('10.');
    return isLocal ? DEV_BASE_URL : '';
}

// 当前生效地址:config 已加载则用它(空串=同源),否则用降级值。
function baseUrl(): string {
    return _configuredBaseUrl ?? fallbackBaseUrl();
}

// 启动时异步拉取 config.json(带时间戳防缓存)。分数提交发生在一局游戏之后,
// 这点网络往返早已完成,不会有竞态;失败则保持降级逻辑。
(function loadBackendConfig() {
    if (typeof XMLHttpRequest === 'undefined') return;
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `config.json?t=${new Date().getTime()}`, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const cfg = JSON.parse(xhr.responseText);
                    if (typeof cfg.backendUrl === 'string') {
                        _configuredBaseUrl = cfg.backendUrl.replace(/\/+$/, '');
                    }
                } catch { /* 解析失败保持降级 */ }
            }
        };
        xhr.send();
    } catch { /* 忽略,保持降级 */ }
})();

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

export interface PreviewResult {
    rank: number;
    total: number;
    topPercent: number;
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
    // —— 待提交成绩:保证一局分数“恰好提交一次” ——
    // 游戏结束时 setPending;任何退出路径 flushAnonymous(匿名);排行榜里确认则 submitWithName(带名)。
    private static _pending: { game: string; score: number; correct: number; total: number } | null = null;
    private static _submitted = false;

    /** 游戏结束时登记本局成绩(尚未提交) */
    static setPending(game: string, score: number, correct: number, total: number): void {
        this._pending = { game, score, correct, total };
        this._submitted = false;
    }

    /** 本局是否已提交 */
    static get submitted(): boolean {
        return this._submitted;
    }

    /** 兜底:若还没提交,以匿名提交一次(退出/重玩/直接返回时调用)。fire-and-forget。 */
    static flushAnonymous(): void {
        if (!this._pending || this._submitted) return;
        this._submitted = true;
        const p = this._pending;
        // 不 await;Cocos web 下 loadScene 不重载 JS VM,请求会继续完成
        this.submit(p.game, '', p.score, p.correct, p.total).catch(() => {});
    }

    /** 带名字确认提交(排行榜里点确认时调用),返回名次;只提交一次 */
    static submitWithName(name: string): Promise<SubmitResult> {
        if (!this._pending) return Promise.reject(new Error('没有待提交成绩'));
        if (this._submitted) return Promise.reject(new Error('已提交'));
        this._submitted = true;
        this.setPlayerName(name);
        const p = this._pending;
        return this.submit(p.game, name, p.score, p.correct, p.total);
    }

    /** 当前待提交成绩(供预览用) */
    static get pending() {
        return this._pending;
    }

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
        return request<SubmitResult>('POST', `${baseUrl()}/api/score`, {
            game,
            name: (name ?? '').trim().slice(0, 12),
            score,
            correct,
            total,
        });
    }

    /** 预览本次分数名次(不入库):返回名次 / 总人数 / 前百分之几 */
    static preview(game: string, score: number): Promise<PreviewResult> {
        return request<PreviewResult>(
            'GET',
            `${baseUrl()}/api/preview?game=${encodeURIComponent(game)}&score=${score}`
        );
    }

    /** 取某游戏榜单前 n 名 */
    static top(game: string, n = 10): Promise<TopEntry[]> {
        return request<{ game: string; entries: TopEntry[] }>(
            'GET',
            `${baseUrl()}/api/top?game=${encodeURIComponent(game)}&n=${n}`
        ).then((res) => res.entries ?? []);
    }
}
