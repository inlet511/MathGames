import { _decorator, Component, Node, Label, UITransform, Color, Sprite, Button, v3, tween } from 'cc';
const { ccclass, property } = _decorator;

const BUTTON_COLORS = [
    new Color(231, 76, 60),   // 1 - 红
    new Color(52, 152, 219),  // 2 - 蓝
    new Color(46, 204, 113),  // 3 - 绿
    new Color(243, 156, 18),  // 4 - 橙
    new Color(155, 89, 182),  // 5 - 紫
];

@ccclass('ButtonPanel')
export class ButtonPanel extends Component {
    @property(Node)
    private buttons: Node[] = [];

    private _onAnswer: ((num: number) => void) | null = null;
    private _enabled: boolean = false;

    onLoad() {
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            const num = i + 1;

            // 设置颜色(取模,支持任意数量按钮,如加法用 1~9)
            const sprite = btn.getComponent(Sprite);
            if (sprite) sprite.color = BUTTON_COLORS[i % BUTTON_COLORS.length];

            // 设置数字
            const label = btn.getComponentInChildren(Label);
            if (label) label.string = `${num}`;

            // 点击事件
            btn.on(Node.EventType.TOUCH_END, () => {
                if (!this._enabled) return;
                this.onButtonClick(num);
            });
        }
    }

    public setEnabled(enabled: boolean) {
        this._enabled = enabled;
        for (const btn of this.buttons) {
            const button = btn.getComponent(Button);
            if (button) button.interactable = enabled;
        }
    }

    public setAnswerCallback(callback: (num: number) => void) {
        this._onAnswer = callback;
    }

    private onButtonClick(num: number) {
        // 按下动画
        const btn = this.buttons[num - 1];
        tween(btn)
            .to(0.05, { scale: v3(0.9, 0.9, 1) })
            .to(0.05, { scale: v3(1, 1, 1) })
            .start();

        this._onAnswer?.(num);
    }

    public flashCorrect(num: number) {
        const btn = this.buttons[num - 1];
        const sprite = btn.getComponent(Sprite);
        if (!sprite) return;
        const original = sprite.color.clone();
        sprite.color = new Color(255, 255, 255);
        tween(btn)
            .to(0.1, { scale: v3(1.15, 1.15, 1) })
            .to(0.1, { scale: v3(1, 1, 1) })
            .call(() => { sprite.color = original; })
            .start();
    }

    public flashWrong(num: number) {
        const btn = this.buttons[num - 1];
        tween(btn)
            .to(0.05, { position: v3(btn.position.x - 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x + 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x - 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x, btn.position.y, 0) })
            .start();
    }
}
