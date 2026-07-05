import { _decorator, Component, Node, director, v3, tween, CCString } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 游戏选择菜单控制器。
 * tiles 与 targetScenes 一一对应(同序):
 *   - targetScenes[i] 非空 → 点击该卡跳转到对应场景;
 *   - targetScenes[i] 为空串 → 占位("敬请期待"),点击只做抖动反馈,不跳转。
 */
@ccclass('MenuController')
export class MenuController extends Component {
    @property({ type: [Node] })
    private tiles: Node[] = [];

    @property({ type: [CCString] })
    private targetScenes: string[] = [];

    onLoad() {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            if (!tile) continue;
            const scene = this.targetScenes[i] ?? '';
            tile.on(Node.EventType.TOUCH_END, () => this.onTileClick(tile, scene));
        }
    }

    private onTileClick(tile: Node, scene: string) {
        if (scene && scene.length > 0) {
            // 按下缩放反馈后跳转
            tween(tile)
                .to(0.06, { scale: v3(0.92, 0.92, 1) })
                .to(0.06, { scale: v3(1, 1, 1) })
                .call(() => director.loadScene(scene))
                .start();
        } else {
            // 占位卡:左右抖动,表示"未解锁/敬请期待"
            const x = tile.position.x;
            tween(tile)
                .to(0.05, { position: v3(x - 8, tile.position.y, 0) })
                .to(0.05, { position: v3(x + 8, tile.position.y, 0) })
                .to(0.05, { position: v3(x - 8, tile.position.y, 0) })
                .to(0.05, { position: v3(x, tile.position.y, 0) })
                .start();
        }
    }
}
