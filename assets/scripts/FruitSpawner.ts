import { _decorator, Component, instantiate, Layers, Node, Prefab, resources, Sprite, SpriteFrame, UITransform, Vec3, tween, v3 } from 'cc';
const { ccclass, property } = _decorator;

const FRUIT_NAMES = [
    '菠萝', '草莓', '橙子', '番茄', '哈密瓜', '蓝莓', '芒果', '牛油果',
    '苹果', '青柠', '桑葚', '石榴', '桃子', '西瓜', '西梅', '香蕉', '小番茄', '樱桃'
];

@ccclass('FruitSpawner')
export class FruitSpawner extends Component {
    @property(Node)
    private spawnArea: Node | null = null;

    @property
    private fruitSize: number = 70;

    private _spriteFrames: Map<string, SpriteFrame> = new Map();
    private _loaded: boolean = false;
    private _currentFruits: Node[] = [];

    public get currentFruits() { return this._currentFruits; }

    onLoad() {
        this.preloadFruits();
    }

    private preloadFruits() {
        let loaded = 0;
        const total = FRUIT_NAMES.length;
        for (const name of FRUIT_NAMES) {
            resources.load(`images/${name}/spriteFrame`, SpriteFrame, (err, sf) => {
                if (!err && sf) {
                    this._spriteFrames.set(name, sf);
                }
                loaded++;
                if (loaded >= total) this._loaded = true;
            });
        }
    }

    public isReady(): boolean { return this._loaded; }

    public clearFruits() {
        for (const fruit of this._currentFruits) {
            fruit.removeFromParent();
        }
        this._currentFruits = [];
    }

    public spawn(count: number, sameType: boolean = false) {
        this.clearFruits();
        if (!this._loaded || !this.spawnArea) return;

        // sameType=true 时整组用同一种水果(如加法"3个苹果 + 2个香蕉")
        const names = Array.from(this._spriteFrames.keys());
        const fixedName = sameType && names.length > 0
            ? names[Math.floor(Math.random() * names.length)]
            : null;

        // 每个水果的随机缩放,先确定好用于计算间距
        const scales: number[] = [];
        for (let i = 0; i < count; i++) {
            scales.push(0.85 + Math.random() * 0.2); // 85%~105%
        }

        const areaTransform = this.spawnArea.getComponent(UITransform)!;
        const positions = this.generatePositions(count, areaTransform.width, areaTransform.height, scales);

        for (let i = 0; i < count; i++) {
            const fruitNode = this.createFruitNode(fixedName);
            this.spawnArea.addChild(fruitNode);
            this._currentFruits.push(fruitNode);

            // 随机位置
            fruitNode.setPosition(positions[i]);

            // 随机旋转 ±15度
            const rot = (Math.random() - 0.5) * 30;
            fruitNode.setRotationFromEuler(0, 0, rot);

            const scale = scales[i];
            fruitNode.setScale(v3(0, 0, 0));

            // 弹出动画
            tween(fruitNode)
                .to(0.15, { scale: v3(scale * 1.15, scale * 1.15, 1) }, { easing: 'quadOut' })
                .to(0.15, { scale: v3(scale, scale, 1) }, { easing: 'quadIn' })
                .start();
        }
    }

    private createFruitNode(fixedName: string | null = null): Node {
        const node = new Node('Fruit');
        node.layer = Layers.Enum.UI_2D;
        const sprite = node.addComponent(Sprite);

        // 指定则用固定水果,否则随机选一个
        const names = Array.from(this._spriteFrames.keys());
        const name = fixedName ?? names[Math.floor(Math.random() * names.length)];
        sprite.spriteFrame = this._spriteFrames.get(name)!;

        // 必须用 CUSTOM,否则默认 TRIMMED 会用贴图原始尺寸覆盖 contentSize,导致水果远大于间距计算值而重叠
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // Sprite 会自动添加 UITransform,直接取用避免重复添加
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(this.fruitSize, this.fruitSize);

        return node;
    }

    private generatePositions(count: number, areaW: number, areaH: number, scales: number[]): Vec3[] {
        const positions: Vec3[] = [];
        const radii: number[] = [];
        const maxAttempts = 200;
        const gap = 12; // 水果之间额外留白

        for (let i = 0; i < count; i++) {
            const r = (this.fruitSize * scales[i]) / 2;
            // 让位置保持在区域内(半径内缩),留边距
            const halfW = Math.max(0, areaW / 2 - r);
            const halfH = Math.max(0, areaH / 2 - r);

            let pos = v3(0, 0, 0);
            let attempts = 0;
            let ok = false;
            while (attempts < maxAttempts) {
                const x = (Math.random() * 2 - 1) * halfW;
                const y = (Math.random() * 2 - 1) * halfH;
                pos = v3(x, y, 0);
                attempts++;
                // 与已放置水果保持 两半径之和 + 留白 的距离
                ok = positions.every((p, j) => Vec3.distance(p, pos) >= radii[j] + r + gap);
                if (ok) break;
            }
            positions.push(pos);
            radii.push(r);
        }
        return positions;
    }
}
