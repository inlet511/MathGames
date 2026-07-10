import { _decorator, Color, Component, Label, Node, Sprite, v3, tween, input, Input, director } from 'cc';
import { AudioManager } from './AudioManager';
import { ScoreManager } from './ScoreManager';
import { ResultPanel } from './ResultPanel';
import { Keypad } from './Keypad';
const { ccclass, property } = _decorator;

enum GameState {
    IDLE,
    COUNTDOWN,
    PLAYING,
    WAITING_ANSWER,
    FEEDBACK,
    GAME_OVER
}

/**
 * 100内加减:纯数字计算器式输入,共 15 道题,不计时。
 *  - 加法 a+b:和 <= 100。
 *  - 减法 a-b:a >= b,结果 >= 0。
 * 顶部显示算式(如 "45 + 23 = ?"),中部显示已输入数字,下方计算器键盘输入多位数,点"确定"提交。
 * 复用 AudioManager/ScoreManager/ResultPanel。
 */
@ccclass('BigMathManager')
export class BigMathManager extends Component {
    @property(AudioManager)
    private audioManager: AudioManager | null = null;

    @property(ScoreManager)
    private scoreManager: ScoreManager | null = null;

    @property(ResultPanel)
    private resultPanel: ResultPanel | null = null;

    @property(Keypad)
    private keypad: Keypad | null = null;

    @property(Label)
    private equationLabel: Label | null = null;

    // 当前输入显示
    @property(Label)
    private inputLabel: Label | null = null;

    @property(Label)
    private countdownLabel: Label | null = null;

    @property(Label)
    private feedbackLabel: Label | null = null;

    @property(Label)
    private progressLabel: Label | null = null;

    @property
    private totalQuestions: number = 15;

    // 数值上限:加法和 <= maxValue,减法被减数 <= maxValue。20 => "20内加减",100 => "100内加减"
    @property
    private maxValue: number = 100;

    private _state: GameState = GameState.IDLE;
    private _currentAnswer: number = 0;
    private _questionStartTime: number = 0;
    private _questionIndex: number = 0;
    private _inputStr: string = '';

    onLoad() {
        this.keypad?.setCallbacks(
            this.onDigit.bind(this),
            this.onClear.bind(this),
            this.onEnter.bind(this)
        );
        this.resultPanel?.setCallbacks(this.startGame.bind(this), this.goHome.bind(this));

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
        if (this.equationLabel) this.equationLabel.string = '';
        this.setInput('');
        this.keypad?.setEnabled(false);
    }

    public startGame() {
        this._state = GameState.COUNTDOWN;
        this._questionIndex = 0;
        this.scoreManager?.reset();
        this.resultPanel?.hide();
        this.keypad?.setEnabled(false);
        if (this.equationLabel) this.equationLabel.string = '';
        this.setInput('');

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
        this.keypad?.setEnabled(true);
        this.nextQuestion();
    }

    private nextQuestion() {
        if (this._questionIndex >= this.totalQuestions) {
            this.endGame();
            return;
        }
        this._questionIndex++;

        // 随机加法或减法
        const isAddition = Math.random() < 0.5;
        let a = 0, b = 0;

        const max = this.maxValue;

        if (isAddition) {
            // a + b <= max,两数 1~(max-1)
            do {
                a = 1 + Math.floor(Math.random() * (max - 1));
                b = 1 + Math.floor(Math.random() * (max - 1));
            } while (a + b > max);
            this._currentAnswer = a + b;
            this.setEquation(`${a} + ${b} = ?`);
        } else {
            // a - b,被减数 a 为 2~max,减数 b 为 1~(a-1);保证差 >=1,避免 a-a=0 或 a-0
            a = 2 + Math.floor(Math.random() * (max - 1));  // 2~max
            b = 1 + Math.floor(Math.random() * (a - 1));    // 1~(a-1)
            this._currentAnswer = a - b;
            this.setEquation(`${a} − ${b} = ?`);
        }

        this.setInput('');
        this.updateProgress();
        this.audioManager?.play('appear');

        this._questionStartTime = Date.now();
        this._state = GameState.WAITING_ANSWER;
    }

    private onDigit(d: number) {
        if (this._state !== GameState.WAITING_ANSWER) return;
        this.audioManager?.play('click');
        // 最多 3 位数;避免前导 0(输入为空且按 0 时保持单个 0)
        if (this._inputStr === '0') this._inputStr = '';
        if (this._inputStr.length >= 3) return;
        this._inputStr += `${d}`;
        this.setInput(this._inputStr);
    }

    private onClear() {
        if (this._state !== GameState.WAITING_ANSWER) return;
        this.audioManager?.play('click');
        this.setInput('');
    }

    private onEnter() {
        if (this._state !== GameState.WAITING_ANSWER) return;
        if (this._inputStr.length === 0) return; // 没输入不提交

        this._state = GameState.FEEDBACK;
        const reactionTime = (Date.now() - this._questionStartTime) / 1000;
        const value = parseInt(this._inputStr, 10);
        const correct = value === this._currentAnswer;

        const delta = this.scoreManager?.submitAnswer(correct, reactionTime) ?? 0;

        if (correct) {
            this.keypad?.flash(this.keypad.enterBtn, true);
            this.audioManager?.play('correct');
            this.showFeedback(`加${delta}分`, true);
            if ((this.scoreManager?.combo ?? 0) >= 3) {
                this.audioManager?.play('combo');
            }
        } else {
            this.keypad?.flash(this.keypad.enterBtn, false);
            this.audioManager?.play('wrong');
            const lost = Math.abs(delta);
            this.showFeedback(lost > 0 ? `扣${lost}分 是${this._currentAnswer}` : `是 ${this._currentAnswer}`, false);
        }

        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this.nextQuestion();
            }
        }, correct ? 0.4 : 1.2);
    }

    private endGame() {
        this._state = GameState.GAME_OVER;
        this.keypad?.setEnabled(false);

        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownNode!.active = false;
        if (this.equationLabel) this.equationLabel.string = '';
        if (this.progressLabel) this.progressLabel.string = '';
        this.setInput('');

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

    private setEquation(text: string) {
        if (this.equationLabel) this.equationLabel.string = text;
    }

    private setInput(str: string) {
        this._inputStr = str;
        if (this.inputLabel) this.inputLabel.string = str.length > 0 ? str : '_';
    }

    private updateProgress() {
        if (this.progressLabel) {
            this.progressLabel.string = `${this._questionIndex}/${this.totalQuestions}`;
        }
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
