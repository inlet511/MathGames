import { _decorator, Color, Component, Graphics, Label, Node, Sprite, UITransform, v3, tween, Tween, input, Input, director } from 'cc';
import { AudioManager } from './AudioManager';
import { ScoreManager } from './ScoreManager';
import { FruitSpawner } from './FruitSpawner';
import { ButtonPanel } from './ButtonPanel';
import { ResultPanel } from './ResultPanel';
const { ccclass, property } = _decorator;

enum GameState {
    IDLE,
    COUNTDOWN,
    PLAYING,
    WAITING_ANSWER,
    FEEDBACK,
    GAME_OVER
}

// 未知数位置:上堆(总数/组合)/左下堆/右下堆(分成)
enum Unknown {
    TOP = 0,
    LEFT = 1,
    RIGHT = 2
}

/**
 * 数的分成:教 3~10 的分成与组合,共 15 题,不计时。
 *  - 上方一堆(总数)用两根斜线指向下方两堆(两个部分),total = left + right。
 *  - 三堆中随机一堆用方框表示为未知数:
 *      · 挖上堆 → "组合"(已知两部分求和)。
 *      · 挖某个部分 → "分成"(已知总数和另一部分求差)。
 *  - 旁边用稍小的数字以同样的三角结构标注这道分成,未知处显示 "?"。
 * 答案范围 1~10,复用 1~10 答案按钮。
 * 复用 AudioManager/ScoreManager/ResultPanel/ButtonPanel/FruitSpawner,不使用 TimerManager。
 */
@ccclass('SplitGameManager')
export class SplitGameManager extends Component {
    @property(AudioManager)
    private audioManager: AudioManager | null = null;

    @property(ScoreManager)
    private scoreManager: ScoreManager | null = null;

    @property(FruitSpawner)
    private topSpawner: FruitSpawner | null = null;

    @property(FruitSpawner)
    private leftSpawner: FruitSpawner | null = null;

    @property(FruitSpawner)
    private rightSpawner: FruitSpawner | null = null;

    @property(ButtonPanel)
    private buttonPanel: ButtonPanel | null = null;

    @property(ResultPanel)
    private resultPanel: ResultPanel | null = null;

    // 画两根斜线(上堆 → 左下堆、上堆 → 右下堆)的 Graphics
    @property(Graphics)
    private lineGraphics: Graphics | null = null;

    // 三堆的背景色块节点:始终显示。已知数用白色背景(上面摆水果),未知数用紫色背景 + "?"。
    @property(Node)
    private topBox: Node | null = null;

    @property(Node)
    private leftBox: Node | null = null;

    @property(Node)
    private rightBox: Node | null = null;

    // 侧边数字示意(小号),按 top = left + right 的三角结构摆放;未知处显示 "?"
    @property(Label)
    private sideTop: Label | null = null;

    @property(Label)
    private sideLeft: Label | null = null;

    @property(Label)
    private sideRight: Label | null = null;

    @property(Label)
    private countdownLabel: Label | null = null;

    @property(Label)
    private feedbackLabel: Label | null = null;

    // 进度显示 Label(如 "3/15")
    @property(Label)
    private progressLabel: Label | null = null;

    // 顶部提示 Label(如 "谁不见了?")
    @property(Label)
    private equationLabel: Label | null = null;

    @property
    private totalQuestions: number = 15;

    // 背景色块颜色:已知数白色,未知数紫色(#7931B3)
    private static readonly KNOWN_COLOR = new Color(255, 255, 255, 255);
    private static readonly UNKNOWN_COLOR = new Color(121, 49, 179, 255);

    private _state: GameState = GameState.IDLE;
    private _currentAnswer: number = 0;
    private _questionStartTime: number = 0;
    private _questionIndex: number = 0;

    onLoad() {
        this.buttonPanel?.setAnswerCallback(this.onPlayerAnswer.bind(this));
        this.resultPanel?.setCallbacks(this.startGame.bind(this), this.goHome.bind(this));

        // 预加载音效
        this.audioManager?.preload('correct', 'audio/correct-selection-sound');
        this.audioManager?.preload('wrong', 'audio/elect-menu-go-back');
        this.audioManager?.preload('click', 'audio/select-menu-select');
        this.audioManager?.preload('appear', 'audio/jump');
        this.audioManager?.preload('combo', 'audio/laser');
        this.audioManager?.preload('beep', 'audio/beep-sound');
        this.audioManager?.preload('beepFinal', 'audio/beep-final');

        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownNode!.active = false;

        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    start() {
        this.showIdle();
    }

    // 倒计时显示节点:背景色块 Sprite 挂在这个节点上,Label 在其子节点。
    // 兼容旧场景(Label 与背景同节点)——没有背景父节点时回退到 Label 自身节点。
    private get countdownNode(): Node | null {
        if (!this.countdownLabel) return null;
        const self = this.countdownLabel.node;
        const parent = self.parent;
        return parent && parent.getComponent(Sprite) ? parent : self;
    }

    private showIdle() {
        this._state = GameState.IDLE;
        if (this.countdownLabel) {
            this.countdownNode!.active = true;
            this.countdownLabel.string = '点击开始';
        }
        if (this.progressLabel) this.progressLabel.string = '';
        this.showEquation('');
        this.hideAllVisuals();
        this.buttonPanel?.setEnabled(false);
    }

    public startGame() {
        this._state = GameState.COUNTDOWN;
        this._questionIndex = 0;
        this.scoreManager?.reset();
        this.resultPanel?.hide();
        this.hideAllVisuals();
        this.buttonPanel?.setEnabled(false);
        this.showEquation('');

        this.showCountdown(3);
    }

    private showCountdown(num: number) {
        if (!this.countdownLabel) return;
        const node = this.countdownNode!;
        node.active = true;
        this.countdownLabel.string = num > 0 ? `${num}` : '开始!';
        node.setScale(v3(0, 0, 0));

        this.audioManager?.play(num > 0 ? 'beep' : 'beepFinal');

        tween(node)
            .to(0.2, { scale: v3(1.3, 1.3, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .delay(num > 0 ? 0.5 : 0.3)
            .call(() => {
                if (num > 0) {
                    this.showCountdown(num - 1);
                } else {
                    node.active = false;
                    this.startPlaying();
                }
            })
            .start();
    }

    private startPlaying() {
        this._state = GameState.PLAYING;
        this.scoreManager?.reset();
        this.buttonPanel?.setEnabled(true);
        this.nextQuestion();
    }

    private nextQuestion() {
        // 已出满 totalQuestions 题 → 结束
        if (this._questionIndex >= this.totalQuestions) {
            this.endGame();
            return;
        }
        this._questionIndex++;

        this.topSpawner?.clearFruits();
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();

        // total = left + right,total 取 3~10,两部分各 1~(total-1)
        const total = 3 + Math.floor(Math.random() * 8);          // 3~10
        const left = 1 + Math.floor(Math.random() * (total - 1)); // 1~(total-1)
        const right = total - left;
        const unknown = Math.floor(Math.random() * 3) as Unknown;  // 0=top,1=left,2=right

        this._currentAnswer = [total, left, right][unknown];

        // 三堆共用同一种水果,让"分成/组合"关系更直观
        const fruit = this.topSpawner?.randomFruitName() ?? null;

        // 逐堆渲染:已知堆摆水果,未知堆显示方框
        this.renderPile(Unknown.TOP, this.topSpawner, this.topBox, total, unknown, fruit);
        this.renderPile(Unknown.LEFT, this.leftSpawner, this.leftBox, left, unknown, fruit);
        this.renderPile(Unknown.RIGHT, this.rightSpawner, this.rightBox, right, unknown, fruit);

        // 侧边数字示意:未知处显示 "?"
        this.setSide(this.sideTop, total, unknown === Unknown.TOP);
        this.setSide(this.sideLeft, left, unknown === Unknown.LEFT);
        this.setSide(this.sideRight, right, unknown === Unknown.RIGHT);

        this.drawLines();
        this.showEquation('方框里是几?');

        this.updateProgress();
        this.audioManager?.play('appear');

        this._questionStartTime = Date.now();
        this._state = GameState.WAITING_ANSWER;
    }

    // 渲染一堆:背景色块始终显示。已知数 → 白色背景 + 摆水果、隐藏 "?";
    // 未知数 → 紫色背景 + 显示 "?"、清空水果,并做弹出反馈。
    private renderPile(
        pile: Unknown,
        spawner: FruitSpawner | null,
        box: Node | null,
        count: number,
        unknown: Unknown,
        fruit: string | null
    ) {
        const isUnknown = pile === unknown;

        if (box) {
            box.active = true;
            // 背景色:已知白色 / 未知紫色
            const sprite = box.getComponent(Sprite);
            if (sprite) {
                sprite.color = isUnknown
                    ? SplitGameManager.UNKNOWN_COLOR
                    : SplitGameManager.KNOWN_COLOR;
            }
            // "?" 仅未知堆显示
            const q = box.getComponentInChildren(Label);
            if (q) q.node.active = isUnknown;

            // 未知堆弹出反馈;已知堆保持原始大小
            Tween.stopAllByTarget(box);
            if (isUnknown) {
                box.setScale(v3(0, 0, 0));
                tween(box)
                    .to(0.12, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
                    .to(0.08, { scale: v3(1, 1, 1) })
                    .start();
            } else {
                box.setScale(v3(1, 1, 1));
            }
        }

        if (isUnknown) {
            spawner?.clearFruits();
        } else {
            spawner?.spawn(count, true, true, false, fruit);
        }
    }

    private setSide(label: Label | null, value: number, isUnknown: boolean) {
        if (!label) return;
        label.node.active = true;
        // 未知项:留空(不显示 "?"),未知指示交给紫色色块;已知项显示数字
        label.string = isUnknown ? '' : `${value}`;
        label.color = new Color(60, 60, 60);
    }

    // 画整套示意图:三个区域各用一个方框包围,再从上框边缘精确连线到左右两个下框边缘。
    // 方框尺寸取各 box 节点的 UITransform,保证与固定的水果区域一致。
    // 用世界坐标转 Graphics 本地坐标,兼容任意节点层级。
    private drawLines() {
        const g = this.lineGraphics;
        if (!g || !this.topBox || !this.leftBox || !this.rightBox) return;

        const gTransform = g.node.getComponent(UITransform);
        if (!gTransform) return;

        const toLocal = (n: Node) => {
            const world = n.getWorldPosition();
            const p = gTransform.convertToNodeSpaceAR(world);
            return { x: p.x, y: p.y };
        };
        const halfOf = (n: Node) => {
            const t = n.getComponent(UITransform);
            return { hw: (t?.width ?? 0) / 2, hh: (t?.height ?? 0) / 2 };
        };

        const top = toLocal(this.topBox);
        const left = toLocal(this.leftBox);
        const right = toLocal(this.rightBox);
        const th = halfOf(this.topBox);
        const lh = halfOf(this.leftBox);
        const rh = halfOf(this.rightBox);

        g.clear();
        g.lineWidth = 5;
        g.strokeColor = new Color(150, 150, 150, 255);

        // 两根连线:从上堆色块边缘出发,精确接触左/右下色块边缘(不再画方框轮廓)
        this.strokeConnector(g, top, th, left, lh);
        this.strokeConnector(g, top, th, right, rh);

        g.stroke();
    }

    // 连接两个矩形框:分别求射线与各自框边界的交点作为端点,使连线精确贴合框边缘
    private strokeConnector(
        g: Graphics,
        a: { x: number; y: number }, ah: { hw: number; hh: number },
        b: { x: number; y: number }, bh: { hw: number; hh: number }
    ) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        // 从矩形中心沿单位方向到达边界的距离(取先碰到的那条边)
        const edgeDist = (h: { hw: number; hh: number }) => Math.min(
            ux !== 0 ? h.hw / Math.abs(ux) : Infinity,
            uy !== 0 ? h.hh / Math.abs(uy) : Infinity
        );
        const ta = edgeDist(ah);
        const tb = edgeDist(bh);
        g.moveTo(a.x + ux * ta, a.y + uy * ta);
        g.lineTo(b.x - ux * tb, b.y - uy * tb);
    }

    private onPlayerAnswer(num: number) {
        if (this._state !== GameState.WAITING_ANSWER) return;

        this.audioManager?.play('click');
        this._state = GameState.FEEDBACK;

        const reactionTime = (Date.now() - this._questionStartTime) / 1000;
        const correct = num === this._currentAnswer;

        const delta = this.scoreManager?.submitAnswer(correct, reactionTime) ?? 0;

        if (correct) {
            this.buttonPanel?.flashCorrect(num);
            this.audioManager?.play('correct');
            this.showFeedback(`加${delta}分`, true);

            if ((this.scoreManager?.combo ?? 0) >= 3) {
                this.audioManager?.play('combo');
            }
        } else {
            this.buttonPanel?.flashWrong(num);
            this.audioManager?.play('wrong');
            const lost = Math.abs(delta);
            this.showFeedback(lost > 0 ? `扣${lost}分 是${this._currentAnswer}` : `是 ${this._currentAnswer}`, false);
        }

        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this.nextQuestion();
            }
        }, correct ? 0.15 : 1.0);
    }

    private endGame() {
        this._state = GameState.GAME_OVER;
        this.buttonPanel?.setEnabled(false);
        this.hideAllVisuals();

        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownNode!.active = false;
        if (this.progressLabel) this.progressLabel.string = '';
        this.showEquation('');

        const sm = this.scoreManager;
        if (sm && this.resultPanel) {
            this.resultPanel.show(
                sm.score,
                sm.correctCount,
                sm.totalCount,
                sm.maxCombo,
                sm.fastestReaction,
                sm.getStarCount()
            );
        }
    }

    // 清空三堆水果、隐藏方框、清斜线与侧边数字
    private hideAllVisuals() {
        this.topSpawner?.clearFruits();
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();
        if (this.topBox) this.topBox.active = false;
        if (this.leftBox) this.leftBox.active = false;
        if (this.rightBox) this.rightBox.active = false;
        if (this.sideTop) this.sideTop.node.active = false;
        if (this.sideLeft) this.sideLeft.node.active = false;
        if (this.sideRight) this.sideRight.node.active = false;
        this.lineGraphics?.clear();
    }

    private updateProgress() {
        if (this.progressLabel) {
            this.progressLabel.string = `${this._questionIndex}/${this.totalQuestions}`;
        }
    }

    private showEquation(text: string) {
        if (this.equationLabel) this.equationLabel.string = text;
    }

    private showFeedback(text: string, isCorrect: boolean) {
        if (!this.feedbackLabel) return;
        this.feedbackLabel.node.active = true;
        this.feedbackLabel.string = text;
        this.feedbackLabel.color = isCorrect
            ? new Color(46, 204, 113)
            : new Color(231, 76, 60);
        this.feedbackLabel.node.setScale(v3(0, 0, 0));

        tween(this.feedbackLabel.node)
            .to(0.15, { scale: v3(1.2, 1.2, 1) })
            .to(0.1, { scale: v3(1, 1, 1) })
            .delay(0.5)
            .call(() => { this.feedbackLabel!.node.active = false; })
            .start();
    }

    private goHome() {
        this.resultPanel?.hide();
        director.loadScene('Start');
    }

    public onTouchStart() {
        if (this._state === GameState.IDLE) {
            this.startGame();
        }
    }
}
