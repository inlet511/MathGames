import { _decorator, Component, director, Node, v3, tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('StartScene')
export class StartScene extends Component {
    @property(Node)
    private startBtn: Node | null = null;

    @property(Node)
    private titleNode: Node | null = null;

    onLoad() {
        this.startBtn?.on(Node.EventType.TOUCH_END, () => {
            director.loadScene('Game');
        });
    }

    start() {
        // 标题弹入动画
        if (this.titleNode) {
            this.titleNode.setScale(v3(0, 0, 0));
            tween(this.titleNode)
                .to(0.5, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
                .to(0.2, { scale: v3(1, 1, 1) })
                .start();
        }

        // 按钮呼吸动画
        if (this.startBtn) {
            tween(this.startBtn)
                .repeatForever(
                    tween(this.startBtn)
                        .to(0.8, { scale: v3(1.05, 1.05, 1) })
                        .to(0.8, { scale: v3(1, 1, 1) })
                )
                .start();
        }
    }
}
