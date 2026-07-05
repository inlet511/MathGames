import { _decorator, Color, Component, Label, Node, v3, tween, input, Input, director } from 'cc';
import { AudioManager } from './AudioManager';
import { ScoreManager } from './ScoreManager';
import { TimerManager } from './TimerManager';
import { FruitSpawner } from './FruitSpawner';
import { ButtonPanel } from './ButtonPanel';
import { ResultPanel } from './ResultPanel';
const { ccclass, property } = _decorator;

enum GameState {
    IDLE,
    COUNTDOWN,
    PLAYING,
    SHOWING_RESULT,
    WAITING_ANSWER,
    FEEDBACK,
    GAME_OVER
}

/**
 * 数字加法:左右两组水果,选出总和(10 以内,答案 2~9)。
 * 复用 AudioManager/ScoreManager/TimerManager/ResultPanel/ButtonPanel/FruitSpawner。
 * 结构照搬 GameManager 状态机,差异主要在 nextQuestion():出两组水果、答案为两数之和。
 */
@ccclass('AdditionGameManager')
export class AdditionGameManager extends Component {
    @property(AudioManager)
    private audioManager: AudioManager | null = null;

    @property(ScoreManager)
    private scoreManager: ScoreManager | null = null;

    @property(TimerManager)
    private timerManager: TimerManager | null = null;

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

    @property
    private totalTime: number = 30;

    @property
    private baseQuestionTime: number = 6;

    private _state: GameState = GameState.IDLE;
    private _currentAnswer: number = 0;
    private _questionStartTime: number = 0;

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
        this.buttonPanel?.setEnabled(false);
    }

    public startGame() {
        this._state = GameState.COUNTDOWN;
        this.scoreManager?.reset();
        this.resultPanel?.hide();
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();
        this.buttonPanel?.setEnabled(false);

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
        this.timerManager?.init(this.totalTime, this.baseQuestionTime);
        this.timerManager?.startTimer(
            this.onGameTimeout.bind(this),
            this.onQuestionTimeout.bind(this)
        );
        this.buttonPanel?.setEnabled(true);
        this.nextQuestion();
    }

    private nextQuestion() {
        this._state = GameState.SHOWING_RESULT;
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();

        // 难度递进:按流逝时间分三档,控制每个加数上限与每题限时
        const remain = this.timerManager?.remainTime ?? this.totalTime;
        const elapsed = this.totalTime - remain;
        const progress = elapsed / this.totalTime; // 0~1

        let maxAddend = 3;
        let questionTime = this.baseQuestionTime;
        if (progress >= 0.66) {
            maxAddend = 5;
            questionTime = 4;
        } else if (progress >= 0.33) {
            maxAddend = 4;
            questionTime = 5;
        }

        // 两个加数各 1~maxAddend;确保和 <= 9(答案按钮 1~9)
        let a = 0, b = 0;
        do {
            a = 1 + Math.floor(Math.random() * maxAddend);
            b = 1 + Math.floor(Math.random() * maxAddend);
        } while (a + b > 9);

        this._currentAnswer = a + b;

        this.timerManager?.resetQuestionTimer(questionTime);

        // 左右各出一组同种水果
        this.leftSpawner?.spawn(a, true);
        this.rightSpawner?.spawn(b, true);
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
            this.timerManager?.penalize(1);
        }

        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this.nextQuestion();
            }
        }, correct ? 0.6 : 1.0);
    }

    private onQuestionTimeout() {
        if (this._state !== GameState.WAITING_ANSWER) return;
        this._state = GameState.FEEDBACK;
        this.scoreManager?.submitAnswer(false, this.timerManager?.perQuestionTime ?? 6);
        this.showFeedback(`时间到! 是 ${this._currentAnswer}`, false);
        this.audioManager?.play('wrong');

        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this.nextQuestion();
            }
        }, 1.0);
    }

    private onGameTimeout() {
        this._state = GameState.GAME_OVER;
        this.timerManager?.stopTimer();
        this.buttonPanel?.setEnabled(false);
        this.leftSpawner?.clearFruits();
        this.rightSpawner?.clearFruits();

        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownLabel.node.active = false;

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
