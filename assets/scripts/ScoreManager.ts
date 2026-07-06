import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScoreManager')
export class ScoreManager extends Component {
    @property(Label)
    private scoreLabel: Label | null = null;

    @property(Label)
    private comboLabel: Label | null = null;

    private _score: number = 0;
    private _combo: number = 0;
    private _maxCombo: number = 0;
    private _correctCount: number = 0;
    private _totalCount: number = 0;
    private _fastestReaction: number = Infinity;

    public get score() { return this._score; }
    public get combo() { return this._combo; }
    public get maxCombo() { return this._maxCombo; }
    public get correctCount() { return this._correctCount; }
    public get totalCount() { return this._totalCount; }
    public get fastestReaction() { return this._fastestReaction; }

    public reset() {
        this._score = 0;
        this._combo = 0;
        this._maxCombo = 0;
        this._correctCount = 0;
        this._totalCount = 0;
        this._fastestReaction = Infinity;
        this.updateUI();
    }

    // 返回本次得分变化(正确为正,错误为负),供 UI 显示"加xx分/扣xx分"
    public submitAnswer(correct: boolean, reactionTime: number): number {
        this._totalCount++;

        if (correct) {
            this._correctCount++;
            this._combo++;
            if (this._combo > this._maxCombo) this._maxCombo = this._combo;

            // 基础分:按反应时间(秒)线性递减,越快越高。
            // 覆盖加减题真实反应区间:0.5s 内满 100 分,之后每秒约扣 11 分,8s 左右触底 20 分。
            // 这样答题快慢在 1~8 秒范围内都有明显区分,不会像以前 2 秒就触底。
            const base = Math.min(100, Math.max(20, Math.round(100 - (reactionTime - 0.5) * 11)));

            // 连击加成:从第 2 连击起,每多一连击 +8 分,最多 +40
            const comboBonus = this._combo >= 2
                ? Math.min((this._combo - 1) * 8, 40)
                : 0;

            const gain = base + comboBonus;
            this._score += gain;

            if (reactionTime < this._fastestReaction) this._fastestReaction = reactionTime;

            this.updateUI();
            return gain;
        } else {
            this._combo = 0;
            // 答错扣分:固定扣 20 分,但不低于 0
            const penalty = Math.min(20, this._score);
            this._score -= penalty;

            this.updateUI();
            return -penalty;
        }
    }

    private updateUI() {
        if (this.scoreLabel) this.scoreLabel.string = `分数: ${this._score}`;
        if (this.comboLabel) {
            this.comboLabel.string = this._combo >= 2 ? `连击 x${this._combo}` : '';
        }
    }

    public getStarCount(): number {
        if (this._score >= 1200) return 4;
        if (this._score >= 800) return 3;
        if (this._score >= 400) return 2;
        return 1;
    }
}
