import { _decorator, Color, Component, Label, Node, v3, tween, UITransform, input, Input } from 'cc';
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

@ccclass('GameManager')
export class GameManager extends Component {
    @property(AudioManager)
    private audioManager: AudioManager | null = null;

    @property(ScoreManager)
    private scoreManager: ScoreManager | null = null;

    @property(TimerManager)
    private timerManager: TimerManager | null = null;

    @property(FruitSpawner)
    private fruitSpawner: FruitSpawner | null = null;

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
    private baseQuestionTime: number = 5;

    private _state: GameState = GameState.IDLE;
    private _currentAnswer: number = 0;
    private _questionStartTime: number = 0;
    private _elapsedTime: number = 0;

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

        // 监听全局点击,在 idle 状态下开始游戏
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
        this._elapsedTime = 0;
        this.scoreManager?.reset();
        this.resultPanel?.hide();
        this.fruitSpawner?.clearFruits();
        this.buttonPanel?.setEnabled(false);

        // 3-2-1 倒计时
        this.showCountdown(3);
    }

    private showCountdown(num: number) {
        if (!this.countdownLabel) return;
        this.countdownLabel.node.active = true;
        this.countdownLabel.string = num > 0 ? `${num}` : '开始!';
        this.countdownLabel.node.setScale(v3(0, 0, 0));

        // 倒计时音效:3-2-1 用 beep,"开始!" 用 beepFinal
        this.audioManager?.play(num > 0 ? 'beep' : 'beepFinal');

        tween(this.countdownLabel.node)
            .to(0.2, { scale: v3(1.3, 1.3, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) })
            .delay(num > 0 ? 0.5 : 0.3)
            .call(() => {
                if (num > 0) {
                    this.showCountdown(num - 1);
                } else {
                    this.countdownLabel.node.active = false;
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
        this.fruitSpawner?.clearFruits();

        // 难度递进:按游戏实际流逝时间(墙钟)分三档
        const remain = this.timerManager?.remainTime ?? this.totalTime;
        const elapsed = this.totalTime - remain;
        const progress = elapsed / this.totalTime; // 0~1

        let minFruits = 1;
        let maxFruits = 3;
        let questionTime = this.baseQuestionTime;

        // 注意:答案按钮只有 1~5,count 不能超过 5
        if (progress >= 0.66) {
            minFruits = 3;
            maxFruits = 5;
            questionTime = 3;
        } else if (progress >= 0.33) {
            minFruits = 2;
            maxFruits = 5;
            questionTime = 4;
        }

        // count 在 [minFruits, maxFruits] 之间
        const count = minFruits + Math.floor(Math.random() * (maxFruits - minFruits + 1));
        this._currentAnswer = count;

        this.timerManager?.resetQuestionTimer(questionTime);

        // 生成水果
        this.fruitSpawner?.spawn(count);
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

        // 延迟后下一题
        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this._elapsedTime += (Date.now() - this._questionStartTime) / 1000;
                this.nextQuestion();
            }
        }, correct ? 0.6 : 1.0);
    }

    private onQuestionTimeout() {
        if (this._state !== GameState.WAITING_ANSWER) return;
        this._state = GameState.FEEDBACK;
        this.scoreManager?.submitAnswer(false, this.timerManager?.perQuestionTime ?? 5);
        this.showFeedback(`时间到! 是 ${this._currentAnswer}`, false);
        this.audioManager?.play('wrong');

        this.scheduleOnce(() => {
            if (this._state === GameState.FEEDBACK) {
                this._elapsedTime += this.timerManager?.perQuestionTime ?? 5;
                this.nextQuestion();
            }
        }, 1.0);
    }

    private onGameTimeout() {
        console.log('[GameManager] onGameTimeout fired');
        this._state = GameState.GAME_OVER;
        this.timerManager?.stopTimer();
        this.buttonPanel?.setEnabled(false);
        this.fruitSpawner?.clearFruits();

        // 隐藏游戏中的临时 label,避免和结算面板重叠
        if (this.feedbackLabel) this.feedbackLabel.node.active = false;
        if (this.countdownLabel) this.countdownLabel.node.active = false;

        const sm = this.scoreManager;
        console.log('[GameManager] scoreManager=', !!sm, 'resultPanel=', !!this.resultPanel);
        if (sm && this.resultPanel) {
            this.resultPanel.show(
                sm.score,
                sm.correctCount,
                sm.totalCount,
                sm.maxCombo,
                sm.fastestReaction,
                sm.getStarCount()
            );
            console.log('[GameManager] resultPanel.show called, score=', sm.score);
        } else {
            console.error('[GameManager] cannot show result: scoreManager or resultPanel is null');
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
        this.showIdle();
    }

    public onTouchStart() {
        if (this._state === GameState.IDLE) {
            this.startGame();
        }
    }
}
