import { _decorator, Component, Node, Label, EditBox, v3, tween } from 'cc';
import { LeaderboardService, TopEntry } from './LeaderboardService';
const { ccclass, property } = _decorator;

/**
 * 排行榜子面板:显示当前玩家排名 + 榜单前十,可选填用户名。
 * 由 ResultPanel 打开;自身负责提交本局分数、拉取榜单、渲染。
 *
 * 交互:
 *  - 打开时 EditBox 预填本地保存的名字(可为空)。
 *  - 点“上榜并查看”:保存名字到本地,提交本局分数(每局仅提交一次),拉取并显示前十 + 我的排名。
 *  - 再次点击只刷新榜单,不重复提交。
 */
@ccclass('LeaderboardPanel')
export class LeaderboardPanel extends Component {
    // 面板根节点(默认隐藏)
    @property(Node)
    private panelNode: Node | null = null;

    // “你的排名:第 X 名 / 共 Y 人”
    @property(Label)
    private rankLabel: Label | null = null;

    // 前十列表(多行文本)
    @property(Label)
    private listLabel: Label | null = null;

    // 用户名输入框(可选填)
    @property(EditBox)
    private nameEditBox: EditBox | null = null;

    // “上榜并查看”按钮
    @property(Node)
    private submitBtn: Node | null = null;

    // 返回按钮
    @property(Node)
    private backBtn: Node | null = null;

    private _game = '';
    private _score = 0;
    private _correct = 0;
    private _total = 0;
    private _submitted = false; // 本局是否已提交,避免重复上榜

    private get panel(): Node {
        return this.panelNode ?? this.node;
    }

    onLoad() {
        this.panel.active = false;
        this.submitBtn?.on(Node.EventType.TOUCH_END, this.onSubmit, this);
        this.backBtn?.on(Node.EventType.TOUCH_END, this.hide, this);
    }

    /** 由 ResultPanel 在游戏结束时调用,记录本局数据 */
    public setResult(game: string, score: number, correct: number, total: number) {
        this._game = game;
        this._score = score;
        this._correct = correct;
        this._total = total;
        this._submitted = false;
    }

    /** 打开排行榜面板 */
    public open() {
        const panel = this.panel;
        panel.active = true;
        panel.setScale(v3(0, 0, 0));
        tween(panel)
            .to(0.25, { scale: v3(1.05, 1.05, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .start();

        // 预填保存的名字
        if (this.nameEditBox) {
            this.nameEditBox.string = LeaderboardService.getPlayerName();
        }
        if (this.rankLabel) this.rankLabel.string = '';
        if (this.listLabel) this.listLabel.string = '加载中...';

        // 打开即自动上榜并拉取(用当前保存/输入的名字)
        this.onSubmit();
    }

    public hide() {
        this.panel.active = false;
    }

    private onSubmit() {
        const name = this.nameEditBox ? this.nameEditBox.string : '';
        LeaderboardService.setPlayerName(name);

        // 已提交过则只刷新榜单
        if (this._submitted) {
            this.refreshTop();
            return;
        }

        LeaderboardService.submit(this._game, name, this._score, this._correct, this._total)
            .then((res) => {
                this._submitted = true;
                if (this.rankLabel) {
                    this.rankLabel.string = `你的排名:第 ${res.rank} 名 / 共 ${res.total} 人`;
                }
                return this.refreshTop();
            })
            .catch(() => {
                if (this.rankLabel) this.rankLabel.string = '';
                if (this.listLabel) this.listLabel.string = '暂时无法连接排行榜\n请检查网络后重试';
            });
    }

    private refreshTop(): Promise<void> {
        return LeaderboardService.top(this._game, 10)
            .then((entries) => this.renderList(entries))
            .catch(() => {
                if (this.listLabel) this.listLabel.string = '暂时无法连接排行榜\n请检查网络后重试';
            });
    }

    private renderList(entries: TopEntry[]) {
        if (!this.listLabel) return;
        if (!entries.length) {
            this.listLabel.string = '还没有人上榜,快来当第一名!';
            return;
        }
        // 每行:名次  名字  分数;名字空则显示“匿名”
        const lines = entries.map((e) => {
            const name = (e.name && e.name.length > 0) ? e.name : '匿名';
            const rankStr = `${e.rank}`.padStart(2, ' ');
            const nameStr = name.padEnd(6, ' ');
            return `${rankStr}.  ${nameStr}  ${e.score}`;
        });
        this.listLabel.string = lines.join('\n');
    }
}
