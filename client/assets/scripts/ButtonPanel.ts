import { _decorator, Component, Node, Label, UITransform, Color, Sprite, Button, v3, tween } from 'cc';
import { BasicButton } from './BasicButton';
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

            // 数字优先取按钮上的 BasicButton 组件(prefab 自配置);
            // 没有该组件的旧场景回退到"下标+1",并沿用旧的按下标配色。
            const numButton = btn.getComponent(BasicButton);
            const num = numButton ? numButton.number : i + 1;

            if (numButton) {
                // prefab 自己已在 onLoad 里刷好数字与颜色,这里不覆盖
                numButton.apply();
            } else {
                const sprite = btn.getComponent(Sprite);
                if (sprite) sprite.color = BUTTON_COLORS[i % BUTTON_COLORS.length];
                const label = btn.getComponentInChildren(Label);
                if (label) label.string = `${num}`;
            }

            // 点击事件(闭包捕获该按钮对应的数字)
            btn.on(Node.EventType.TOUCH_END, () => {
                if (!this._enabled) return;
                this.onButtonClick(num);
            });
        }
    }

    // 按数字找到对应按钮节点(支持任意数字/顺序,不再假设 num-1 即下标)
    private findButton(num: number): Node | null {
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            const nb = btn.getComponent(BasicButton);
            const value = nb ? nb.number : i + 1;
            if (value === num) return btn;
        }
        return null;
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
        const btn = this.findButton(num);
        if (btn) {
            tween(btn)
                .to(0.05, { scale: v3(0.9, 0.9, 1) })
                .to(0.05, { scale: v3(1, 1, 1) })
                .start();
        }

        this._onAnswer?.(num);
    }

    public flashCorrect(num: number) {
        const btn = this.findButton(num);
        if (!btn) return;
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
        const btn = this.findButton(num);
        if (!btn) return;
        tween(btn)
            .to(0.05, { position: v3(btn.position.x - 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x + 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x - 5, btn.position.y, 0) })
            .to(0.05, { position: v3(btn.position.x, btn.position.y, 0) })
            .start();
    }
}
