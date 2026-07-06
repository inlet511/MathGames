import { _decorator, Component, Node, director, v3, tween } from 'cc';
import { LeaderboardService } from './LeaderboardService';
const { ccclass, property } = _decorator;

/**
 * 小退出按钮:点击直接返回首页(Start 场景)。
 * 挂在按钮节点上,自身监听触摸,不依赖各游戏的管理器。
 * 若本局已结束但分数还没上榜,退出时匿名兜底提交一次(游戏未结束时为空操作)。
 */
@ccclass('ExitButton')
export class ExitButton extends Component {
    // 目标场景名,默认回首页
    @property
    private homeScene: string = 'Start';

    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onClick, this);
    }

    private onClick() {
        // 有待提交成绩则匿名兜底(未结束游戏时无 pending,不会误提交)
        LeaderboardService.flushAnonymous();
        // 按下缩放反馈后跳转
        tween(this.node)
            .to(0.06, { scale: v3(0.85, 0.85, 1) })
            .to(0.06, { scale: v3(1, 1, 1) })
            .call(() => director.loadScene(this.homeScene))
            .start();
    }
}

