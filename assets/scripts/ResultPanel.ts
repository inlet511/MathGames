import { _decorator, Component, Label, Node, v3, tween } from 'cc';
const { ccclass, property } = _decorator;

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

    @property(Node)
    private replayBtn: Node | null = null;

    @property(Node)
    private homeBtn: Node | null = null;

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
        this.replayBtn?.on(Node.EventType.TOUCH_END, () => this._onReplay?.());
        this.homeBtn?.on(Node.EventType.TOUCH_END, () => this._onHome?.());
    }

    public setCallbacks(onReplay: () => void, onHome: () => void) {
        this._onReplay = onReplay;
        this._onHome = onHome;
    }

    public show(score: number, correctCount: number, totalCount: number, maxCombo: number, fastestReaction: number, stars: number) {
        const panel = this.panel;
        panel.active = true;
        panel.setScale(v3(0, 0, 0));

        if (this.finalScoreLabel) this.finalScoreLabel.string = `${score}`;
        if (this.correctCountLabel) this.correctCountLabel.string = `${correctCount}/${totalCount}`;
        if (this.maxComboLabel) this.maxComboLabel.string = `${maxCombo}`;
        if (this.fastestLabel) {
            this.fastestLabel.string = fastestReaction < Infinity ? `${fastestReaction.toFixed(2)}秒` : '--';
        }
        if (this.starsLabel) {
            this.starsLabel.string = '⭐'.repeat(stars);
        }

        tween(panel)
            .to(0.3, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .start();
    }

    public hide() {
        this.panel.active = false;
    }
}
