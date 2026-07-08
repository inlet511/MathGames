import { _decorator, Component, Node, Label, EditBox, v3, tween, sys, isValid } from 'cc';
import { LeaderboardService, TopEntry } from './LeaderboardService';
const { ccclass, property } = _decorator;

/**
 * 排行榜子面板。
 *
 * 规则:一局分数“恰好提交一次”,匿名是兜底。
 *  - 打开时:预览本次名次(不入库),显示“本次第 X 名 / 前 Y%”,并拉取前 6 名。
 *  - 输入名字点“确认上榜”:带名字提交一次,刷新榜单。
 *  - 不输入 / 不确认,直接点“返回”:匿名提交一次(兜底),关闭面板。
 *  - ResultPanel 的重玩/返回主页/退出按钮也会触发匿名兜底(见 ResultPanel)。
 */
@ccclass('LeaderboardPanel')
export class LeaderboardPanel extends Component {
    @property(Node)
    private panelNode: Node | null = null;

    // “本次成绩:第 X 名 / 共 Y 人,前 Z%”
    @property(Label)
    private rankLabel: Label | null = null;

    // 前 6 名列表(多行文本)
    @property(Label)
    private listLabel: Label | null = null;

    // 用户名输入框(可选填)
    @property(EditBox)
    private nameEditBox: EditBox | null = null;

    // “确认上榜”按钮
    @property(Node)
    private submitBtn: Node | null = null;

    // 返回按钮(不输入名字直接返回 => 匿名兜底)
    @property(Node)
    private backBtn: Node | null = null;

    // 编辑输入框时,整个面板上移的距离(避开手机软键盘遮挡)。仅移动端生效。
    @property
    private keyboardLiftY: number = 300;

    private _game = '';
    private _score = 0;

    private get panel(): Node {
        return this.panelNode ?? this.node;
    }

    onLoad() {
        this.panel.active = false;
        this.submitBtn?.on(Node.EventType.TOUCH_END, this.onConfirm, this);
        this.backBtn?.on(Node.EventType.TOUCH_END, this.onBack, this);
        // 移动端:聚焦输入框时上移面板,失焦后复位,避免软键盘遮住输入框和按钮
        if (this.nameEditBox) {
            this.nameEditBox.node.on('editing-did-began', this.onEditBegan, this);
            this.nameEditBox.node.on('editing-did-ended', this.onEditEnded, this);
        }
    }

    onDestroy() {
        // 场景销毁时子节点可能先于本组件被释放。此时 this.submitBtn 等仍是残留引用,
        // 但节点内部已失效,直接调用 .off 会在引擎内部崩溃。用 isValid 判断已销毁对象。
        const editNode = this.nameEditBox?.node;
        if (isValid(editNode)) {
            editNode.off('editing-did-began', this.onEditBegan, this);
            editNode.off('editing-did-ended', this.onEditEnded, this);
        }
        if (isValid(this.submitBtn)) {
            this.submitBtn.off(Node.EventType.TOUCH_END, this.onConfirm, this);
        }
        if (isValid(this.backBtn)) {
            this.backBtn.off(Node.EventType.TOUCH_END, this.onBack, this);
        }
    }

    // 是否需要为软键盘让位:移动端(含手机浏览器 H5)才有软键盘;桌面端物理键盘不占屏,不上移
    private get liftForKeyboard(): boolean {
        return this.keyboardLiftY > 0 && sys.isMobile;
    }

    private onEditBegan() {
        if (!this.liftForKeyboard) return;
        tween(this.panel).stop();
        tween(this.panel)
            .to(0.2, { position: v3(0, this.keyboardLiftY, 0) }, { easing: 'quadOut' })
            .start();
    }

    private onEditEnded() {
        if (!this.liftForKeyboard) return;
        tween(this.panel).stop();
        tween(this.panel)
            .to(0.2, { position: v3(0, 0, 0) }, { easing: 'quadOut' })
            .start();
    }

    /** 由 ResultPanel 在游戏结束时调用,记录本局数据(此时尚未提交) */
    public setResult(game: string, score: number, correct: number, total: number) {
        this._game = game;
        this._score = score;
        LeaderboardService.setPending(game, score, correct, total);
    }

    /** 打开排行榜面板 */
    public open() {
        const panel = this.panel;
        panel.active = true;
        panel.setScale(v3(0, 0, 0));
        // 复位到未上移状态(上次编辑上移后可能停在偏移位置)
        panel.setPosition(v3(0, 0, 0));
        tween(panel)
            .to(0.25, { scale: v3(1.05, 1.05, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .start();

        // 预填保存的名字
        if (this.nameEditBox) {
            this.nameEditBox.string = LeaderboardService.getPlayerName();
        }
        if (this.rankLabel) this.rankLabel.string = '正在计算排名...';
        if (this.listLabel) this.listLabel.string = '加载中...';

        // 预览名次(不提交),再拉榜单
        LeaderboardService.preview(this._game, this._score)
            .then((res) => {
                if (this.rankLabel) {
                    const suffix = LeaderboardService.submitted ? '(已上榜)' : '';
                    this.rankLabel.string =
                        `本次成绩:第 ${res.rank} 名 / 共 ${res.total} 人\n超过 ${100 - res.topPercent}% 的玩家${suffix}`;
                }
            })
            .catch(() => {
                if (this.rankLabel) this.rankLabel.string = '';
            });
        this.refreshTop();
    }

    /** 确认上榜:带名字提交一次,刷新榜单 */
    private onConfirm() {
        const name = this.nameEditBox ? this.nameEditBox.string : '';

        // 已提交过(比如之前匿名兜底了):只更新提示,不重复提交
        if (LeaderboardService.submitted) {
            if (this.rankLabel) this.rankLabel.string = '本局已上榜,无法重复提交';
            this.refreshTop();
            return;
        }

        LeaderboardService.submitWithName(name)
            .then((res) => {
                if (this.rankLabel) {
                    this.rankLabel.string = `已上榜!第 ${res.rank} 名 / 共 ${res.total} 人`;
                }
                return this.refreshTop();
            })
            .catch(() => {
                if (this.rankLabel) this.rankLabel.string = '';
                if (this.listLabel) this.listLabel.string = '暂时无法连接排行榜\n请检查网络后重试';
            });
    }

    /** 返回:若还没提交,匿名兜底提交一次,然后关闭 */
    private onBack() {
        LeaderboardService.flushAnonymous();
        this.hide();
    }

    public hide() {
        this.panel.active = false;
    }

    private refreshTop(): Promise<void> {
        // 只展示前 6 名
        return LeaderboardService.top(this._game, 6)
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
