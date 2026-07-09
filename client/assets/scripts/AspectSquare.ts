import { _decorator, Component, UITransform, Node } from 'cc';
const { ccclass, executeInEditMode } = _decorator;

/**
 * 让节点保持正方形:把高度同步成宽度。
 *
 * 用途:放在 HorizontalLayout(Resize Mode = CHILDREN)的子节点上时,子节点宽度
 * 由布局动态分配、无法预知,本组件负责把 height 追平 width,保证每个子节点是正方形。
 *
 * 双保险刷新:
 *  - 监听 SIZE_CHANGED —— 布局改宽度时立即补高度;
 *  - update() 里轮询 —— 编辑器里 Layout 重排的时机不一定派发事件,轮询兜底,
 *    保证 @executeInEditMode 下所见即所得。
 *
 * 不会死循环:改 height 不影响水平布局的宽度分配,且用 height !== width 挡住
 * 因设置 height 再次触发的回调(width 没变则不再处理)。
 *
 * 注意:父容器高度要 ≥ 预期边长,否则正方形会被父节点裁掉(视觉上)。
 */
@ccclass('AspectSquare')
@executeInEditMode
export class AspectSquare extends Component {
    private ui: UITransform | null = null;

    onEnable() {
        this.ui = this.getComponent(UITransform);
        this.node.on(Node.EventType.SIZE_CHANGED, this.sync, this);
        this.sync();
    }

    onDisable() {
        this.node.off(Node.EventType.SIZE_CHANGED, this.sync, this);
    }

    update() {
        // 编辑器/运行时兜底:布局重排未必派发 SIZE_CHANGED,轮询补齐
        this.sync();
    }

    /** 把高度追平宽度 */
    private sync() {
        if (!this.ui) return;
        if (this.ui.height !== this.ui.width) {
            this.ui.height = this.ui.width;
        }
    }
}
