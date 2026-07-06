import { _decorator, Component, Node, Label, Sprite, Button, Color, v3, tween } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 计算器式数字键盘。12 个键:0-9、清除(C)、确定(=)。
 * 每个键节点名约定:Key0..Key9、KeyClear、KeyEnter。
 * 通过回调把事件抛给游戏逻辑:onDigit(d) / onClear() / onEnter()。
 */
@ccclass('Keypad')
export class Keypad extends Component {
    // 数字键 0~9,按下标 = 数字
    @property({ type: [Node] })
    private digitButtons: Node[] = [];

    @property(Node)
    private clearButton: Node | null = null;

    @property(Node)
    private enterButton: Node | null = null;

    private _onDigit: ((d: number) => void) | null = null;
    private _onClear: (() => void) | null = null;
    private _onEnter: (() => void) | null = null;
    private _enabled: boolean = false;

    onLoad() {
        for (let i = 0; i < this.digitButtons.length; i++) {
            const btn = this.digitButtons[i];
            if (!btn) continue;
            const digit = i;
            const label = btn.getComponentInChildren(Label);
            if (label) label.string = `${digit}`;
            btn.on(Node.EventType.TOUCH_END, () => {
                if (!this._enabled) return;
                this.press(btn);
                this._onDigit?.(digit);
            });
        }

        if (this.clearButton) {
            const label = this.clearButton.getComponentInChildren(Label);
            if (label) label.string = 'C';
            this.clearButton.on(Node.EventType.TOUCH_END, () => {
                if (!this._enabled) return;
                this.press(this.clearButton!);
                this._onClear?.();
            });
        }

        if (this.enterButton) {
            const label = this.enterButton.getComponentInChildren(Label);
            if (label) label.string = '确定';
            this.enterButton.on(Node.EventType.TOUCH_END, () => {
                if (!this._enabled) return;
                this.press(this.enterButton!);
                this._onEnter?.();
            });
        }
    }

    public setEnabled(enabled: boolean) {
        this._enabled = enabled;
        const all = [...this.digitButtons, this.clearButton, this.enterButton];
        for (const btn of all) {
            const button = btn?.getComponent(Button);
            if (button) button.interactable = enabled;
        }
    }

    public setCallbacks(onDigit: (d: number) => void, onClear: () => void, onEnter: () => void) {
        this._onDigit = onDigit;
        this._onClear = onClear;
        this._onEnter = onEnter;
    }

    private press(btn: Node) {
        tween(btn)
            .to(0.05, { scale: v3(0.9, 0.9, 1) })
            .to(0.05, { scale: v3(1, 1, 1) })
            .start();
    }

    // 供逻辑层做正确/错误反馈
    public flash(btn: Node | null, correct: boolean) {
        if (!btn) return;
        const sprite = btn.getComponent(Sprite);
        if (!sprite) return;
        const original = sprite.color.clone();
        sprite.color = correct ? new Color(46, 204, 113) : new Color(231, 76, 60);
        tween(btn)
            .to(0.1, { scale: v3(1.12, 1.12, 1) })
            .to(0.1, { scale: v3(1, 1, 1) })
            .call(() => { sprite.color = original; })
            .start();
    }

    public get enterBtn(): Node | null { return this.enterButton; }
}
