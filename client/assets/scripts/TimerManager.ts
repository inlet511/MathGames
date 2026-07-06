import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TimerManager')
export class TimerManager extends Component {
    @property(Label)
    private timeLabel: Label | null = null;

    private _totalTime: number = 30;
    private _remainTime: number = 0;
    private _perQuestionTime: number = 5;
    private _remainQuestionTime: number = 0;
    private _running: boolean = false;
    private _onTimeout: (() => void) | null = null;
    private _onQuestionTimeout: (() => void) | null = null;

    public get remainTime() { return this._remainTime; }
    public get remainQuestionTime() { return this._remainQuestionTime; }
    public get perQuestionTime() { return this._perQuestionTime; }

    public init(totalTime: number, perQuestionTime: number) {
        this._totalTime = totalTime;
        this._perQuestionTime = perQuestionTime;
        this._remainTime = totalTime;
        this._remainQuestionTime = perQuestionTime;
        this._running = false;
        this.updateUI();
    }

    public startTimer(onTimeout: () => void, onQuestionTimeout: () => void) {
        this._onTimeout = onTimeout;
        this._onQuestionTimeout = onQuestionTimeout;
        this._running = true;
    }

    public resetQuestionTimer(perQuestionTime: number) {
        this._perQuestionTime = perQuestionTime;
        this._remainQuestionTime = perQuestionTime;
    }

    public stopTimer() {
        this._running = false;
    }

    public penalize(seconds: number) {
        this._remainTime = Math.max(0, this._remainTime - seconds);
    }

    update(dt: number) {
        if (!this._running) return;

        this._remainTime -= dt;
        this._remainQuestionTime -= dt;

        if (this._remainTime <= 0) {
            this._remainTime = 0;
            this._running = false;
            this.updateUI();
            this._onTimeout?.();
            return;
        }

        if (this._remainQuestionTime <= 0) {
            this._remainQuestionTime = 0;
            this._onQuestionTimeout?.();
        }

        this.updateUI();
    }

    private updateUI() {
        if (this.timeLabel) {
            this.timeLabel.string = `${Math.ceil(this._remainTime)}s`;
        }
    }
}
