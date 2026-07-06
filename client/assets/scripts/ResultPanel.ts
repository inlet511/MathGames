import { _decorator, Component, Label, Node, v3, tween } from 'cc';
import { LeaderboardPanel } from './LeaderboardPanel';
import { LeaderboardService } from './LeaderboardService';
const { ccclass, property } = _decorator;

// 按星数(0~4)分档的鼓励评语库,每档多句随机挑一句;内容积极、有趣、无脏话
const COMMENTS: string[][] = [
    // 0 星:兜底(理论上最少 1 星,保留以防万一)
    [
        '别灰心,再试一次吧!',
        '慢慢来,你可以的!',
        '数字有点调皮,再抓抓看!',
    ],
    // 1 星:需要继续努力
    [
        '不错的开始,继续加油!',
        '再练一练,下次会更棒!',
        '每一次都在进步哦!',
        '小小英雄,继续闯关吧!',
        '慢慢来,你已经在路上啦!',
    ],
    // 2 星:还可以
    [
        '做得不错,再冲一冲!',
        '有两下子嘛,继续保持!',
        '越来越熟练啦,棒棒的!',
        '离满星只差一点点咯!',
        '手速在线,脑子也在线!',
    ],
    // 3 星:很厉害
    [
        '太厉害了,真是数学小能手!',
        '哇,这波操作很惊艳!',
        '又快又准,给你点赞!',
        '闪闪发光的表现!',
        '再进一步就满星啦,冲!',
    ],
    // 4 星:满星,超级棒
    [
        '完美!你就是数学小超人!',
        '满星达成,无敌了!',
        '全对又神速,太强啦!',
        '教科书级别的发挥!',
        '星星都被你收集光啦,厉害!',
    ],
];

@ccclass('ResultPanel')
export class ResultPanel extends Component {
    @property(Label)
    private finalScoreLabel: Label | null = null;

    @property(Label)
    private correctCountLabel: Label | null = null;

    @property(Label)
    private maxComboLabel: Label | null = null;

    @property(Label)
    private fastestLabel: Label | null = null;

    @property(Label)
    private starsLabel: Label | null = null;

    // 根据星数显示的鼓励评语
    @property(Label)
    private commentLabel: Label | null = null;

    @property(Node)
    private replayBtn: Node | null = null;

    @property(Node)
    private homeBtn: Node | null = null;

    // 排行榜按钮 + 排行榜子面板
    @property(Node)
    private leaderboardBtn: Node | null = null;

    @property(LeaderboardPanel)
    private leaderboardPanel: LeaderboardPanel | null = null;

    // 本游戏标识:count / addition / small / big。四个场景分别填写。
    @property
    private gameId: string = '';

    // 真正的结算面板节点(脚本挂在独立空节点上,需显式引用面板)
    @property(Node)
    private panelNode: Node | null = null;

    private _onReplay: (() => void) | null = null;
    private _onHome: (() => void) | null = null;

    private get panel(): Node {
        return this.panelNode ?? this.node;
    }

    onLoad() {
        this.panel.active = false;
        // 重玩 / 返回主页前,若还没上榜就匿名兜底提交一次
        this.replayBtn?.on(Node.EventType.TOUCH_END, () => {
            LeaderboardService.flushAnonymous();
            this._onReplay?.();
        });
        this.homeBtn?.on(Node.EventType.TOUCH_END, () => {
            LeaderboardService.flushAnonymous();
            this._onHome?.();
        });
        this.leaderboardBtn?.on(Node.EventType.TOUCH_END, () => this.leaderboardPanel?.open());
    }

    public setCallbacks(onReplay: () => void, onHome: () => void) {
        this._onReplay = onReplay;
        this._onHome = onHome;
    }

    public show(score: number, correctCount: number, totalCount: number, maxCombo: number, fastestReaction: number, stars: number) {
        const panel = this.panel;
        panel.active = true;
        panel.setScale(v3(0, 0, 0));

        // 满星数(与 ScoreManager.getStarCount 上限一致)
        const MAX_STARS = 4;

        if (this.finalScoreLabel) this.finalScoreLabel.string = `得分 ${score}`;
        if (this.correctCountLabel) this.correctCountLabel.string = `答对 ${correctCount}/${totalCount}`;
        if (this.maxComboLabel) this.maxComboLabel.string = `最高连击 ${maxCombo}`;
        if (this.fastestLabel) {
            this.fastestLabel.string = fastestReaction < Infinity ? `最快 ${fastestReaction.toFixed(2)}秒` : '最快 --';
        }
        if (this.starsLabel) {
            // 实心星表示已获得,空心星表示未获得,并显示 "n/满星"
            const clamped = Math.max(0, Math.min(stars, MAX_STARS));
            const filled = '★'.repeat(clamped);
            const empty = '☆'.repeat(MAX_STARS - clamped);
            this.starsLabel.string = `${filled}${empty}  ${clamped}/${MAX_STARS}`;
        }
        if (this.commentLabel) {
            const clamped = Math.max(0, Math.min(stars, MAX_STARS));
            const pool = COMMENTS[clamped] ?? COMMENTS[0];
            this.commentLabel.string = pool[Math.floor(Math.random() * pool.length)];
        }

        // 把本局成绩交给排行榜面板(点击排行榜按钮时提交并展示)
        this.leaderboardPanel?.setResult(this.gameId, score, correctCount, totalCount);

        tween(panel)
            .to(0.3, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .start();
    }

    public hide() {
        this.panel.active = false;
    }
}
