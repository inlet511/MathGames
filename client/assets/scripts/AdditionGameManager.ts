import { _decorator, Color, Component, Label, Node, v3, tween, input, Input, director } from 'cc';
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

/**
 * 10内加减:混合加法/减法,共 15 道题,不计时。
 *  - 加法 a+b:左侧摆 a 个水果,右侧摆 b 个水果,"+" 连接,答案 a+b。
 *  - 减法 a-b:左侧摆 a 个水果并把其中 b 个划掉,右侧留空,"−" 连接,答案 a-b。
 * 答案限制在 1~9(复用 1~9 答案按钮)。
 * 复用 AudioManager/ScoreManager/ResultPanel/ButtonPanel/FruitSpawner,不使用 TimerManager。
 */
@ccclass('AdditionGameManager')
export class AdditionGameManager extends Component {
    @property(AudioManager)
    private audioManager: AudioManager | null = null;

    @property(ScoreManager)
    private scoreManager: ScoreManager | null = null;

    @property(FruitSpawner)
    private leftSpawner: FruitSpawner | null = null;

    @property(FruitSpawner)
    private rightSpawner: FruitSpawner | null = null;

    @property(ButtonPanel)
    private buttonPanel: ButtonPanel | null = null;

    @property(ResultPanel)
    private resultPanel: ResultPanel | null = null;

    @property(Label)
    private countdownLabel: Label | null = null;

    @property(Label)
    private feedbackLabel: Label | null = null;

    // 运算符号("+"/"−")显示 Label,复用原 PlusLabel
    @property(Label)
    private operatorLabel: Label | null = null;

    // 进度显示 Label(如 "第 3/15 题"),复用原计时 Label
    @property(Label)
    private progressLabel: Label | null = null;

    // 顶部算式 Label(如 "6 + 4 = ?")
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
        this.audioManager?.preload('correct', 'audio/powerup-get-something-big');
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
        // 未开始/未出题时隐藏运算符和算式,避免默认显示 "+"
        if (this.operatorLabel) this.operatorLabel.node.active = false;
        this.showEquation('');
        this.buttonPanel?.setEnabled(false);
    }

    public startGame() {
        this._state = GameState.COUNTDOWN;
        this._questionIndex = 0;
        this.scoreManager?.reset();
        this.resultPanel?.hide();
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();
        this.buttonPanel?.setEnabled(false);
        // 倒计时期间隐藏运算符和算式
        if (this.operatorLabel) this.operatorLabel.node.active = false;
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

        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();

        // 随机加法或减法
        const isAddition = Math.random() < 0.5;
        let a = 0, b = 0;

        // 让左右两侧共用同一种水果
        const fruit = this.leftSpawner?.randomFruitName() ?? null;

        if (isAddition) {
            // a + b,和在 2~10(10以内含10;答案 1~10)
            do {
                a = 1 + Math.floor(Math.random() * 9);
                b = 1 + Math.floor(Math.random() * 9);
            } while (a + b > 10 || a + b < 2);
            this._currentAnswer = a + b;

            if (this.operatorLabel) this.operatorLabel.node.active = true;
            if (this.operatorLabel) this.operatorLabel.string = '+';
            this.showEquation(`${a} + ${b} = ?`);
            this.leftSpawner?.spawn(a, true, true, false, fruit);
            this.rightSpawner?.spawn(b, true, true, false, fruit);
        } else {
            // a - b,被减数 a 为 2~10,减数 b 为 1~(a-1),差 1~9(答案 >=1)
            a = 2 + Math.floor(Math.random() * 9);        // 2~10
            b = 1 + Math.floor(Math.random() * (a - 1));  // 1~(a-1)
            this._currentAnswer = a - b;

            if (this.operatorLabel) this.operatorLabel.node.active = true;
            if (this.operatorLabel) this.operatorLabel.string = '−';
            this.showEquation(`${a} − ${b} = ?`);
            // 左侧总数 a 个,右侧吃掉 b 个(打叉);答案 = a - b
            this.leftSpawner?.spawn(a, true, true, false, fruit);
            this.rightSpawner?.spawn(b, true, true, true, fruit);
        }

        this.updateProgress();
        this.audioManager?.play('appear');

        this._questionStartTime = Date.now();
        this._state = GameState.WAITING_ANSWER;
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
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();

        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownLabel.node.active = false;
        if (this.operatorLabel) this.operatorLabel.node.active = false;
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
