import { _decorator, Color, Component, Graphics, Label, Node, UITransform, v3, tween, input, Input, director } from 'cc';
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

    // 三堆的"方框(未知数)"节点:对应堆被挖空时显示,其余隐藏
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
        if (this.countdownLabel) this.countdownLabel.node.active = false;

        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    start() {
        this.showIdle();
    }

    private showIdle() {
        this._state = GameState.IDLE;
        if (this.countdownLabel) {
            this.countdownLabel.node.active = true;
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
        this.countdownLabel.node.active = true;
        this.countdownLabel.string = num > 0 ? `${num}` : '开始!';
        this.countdownLabel.node.setScale(v3(0, 0, 0));

        this.audioManager?.play(num > 0 ? 'beep' : 'beepFinal');

        tween(this.countdownLabel.node)
            .to(0.2, { scale: v3(1.3, 1.3, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .delay(num > 0 ? 0.5 : 0.3)
            .call(() => {
                if (num > 0) {
                    this.showCountdown(num - 1);
                } else {
                    this.countdownLabel!.node.active = false;
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

    // 渲染一堆:若为未知堆则清空水果并显示方框,否则摆水果并隐藏方框
    private renderPile(
        pile: Unknown,
        spawner: FruitSpawner | null,
        box: Node | null,
        count: number,
        unknown: Unknown,
        fruit: string | null
    ) {
        const isUnknown = pile === unknown;
        if (box) box.active = isUnknown;
        if (isUnknown) {
            spawner?.clearFruits();
            // 方框弹出反馈
            if (box) {
                box.setScale(v3(0, 0, 0));
                tween(box)
                    .to(0.12, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
                    .to(0.08, { scale: v3(1, 1, 1) })
                    .start();
            }
        } else {
            spawner?.spawn(count, true, true, false, fruit);
        }
    }

    private setSide(label: Label | null, value: number, isUnknown: boolean) {
        if (!label) return;
        label.node.active = true;
        label.string = isUnknown ? '?' : `${value}`;
        label.color = isUnknown ? new Color(231, 76, 60) : new Color(60, 60, 60);
    }

    // 画两根斜线:上堆中心 → 左下堆中心、上堆中心 → 右下堆中心。
    // 用世界坐标转 Graphics 本地坐标,兼容任意节点层级。
    private drawLines() {
        const g = this.lineGraphics;
        if (!g || !this.topBox || !this.leftBox || !this.rightBox) return;

        const gTransform = g.node.getComponent(UITransform);
        if (!gTransform) return;

        const toLocal = (n: Node) => {
            const world = n.getWorldPosition();
            return gTransform.convertToNodeSpaceAR(world);
        };

        const top = toLocal(this.topBox);
        const left = toLocal(this.leftBox);
        const right = toLocal(this.rightBox);

        // 端点内缩:线从上堆下沿出发,到下堆上沿结束,避免穿过水果/方框
        const pad = 50;
        const shorten = (from: { x: number; y: number }, to: { x: number; y: number }) => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            return {
                sx: from.x + ux * pad,
                sy: from.y + uy * pad,
                ex: to.x - ux * pad,
                ey: to.y - uy * pad,
            };
        };

        g.clear();
        g.lineWidth = 6;
        g.strokeColor = new Color(120, 120, 120, 255);

        const l = shorten(top, left);
        g.moveTo(l.sx, l.sy);
        g.lineTo(l.ex, l.ey);

        const r = shorten(top, right);
        g.moveTo(r.sx, r.sy);
        g.lineTo(r.ex, r.ey);

        g.stroke();
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
        if (this.countdownLabel) this.countdownLabel.node.active = false;
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
