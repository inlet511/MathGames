import { _decorator, Color, Component, instantiate, Label, Layers, Node, Prefab, resources, Sprite, SpriteFrame, UITransform, Vec3, tween, v3 } from 'cc';
const { ccclass, property } = _decorator;

// 素材图统一放在 resources/images/items 下(icon_*.png),整目录动态加载,
// 不再依赖固定的中文水果名 —— 增删图片无需改代码。
const ITEMS_DIR = 'images/items';

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
        // 整目录加载 items 下所有 SpriteFrame,用资源名(如 icon_113)作为 key
        resources.loadDir(ITEMS_DIR, SpriteFrame, (err, frames) => {
            if (!err && frames) {
                for (const sf of frames) {
                    const key = sf.name || sf.uuid;
                    this._spriteFrames.set(key, sf);
                }
            }
            this._loaded = true;
        });
    }

    public isReady(): boolean { return this._loaded; }

    // 随机取一个已加载的水果名,供外部让多个 spawner 共用同一种水果
    public randomFruitName(): string | null {
        const names = Array.from(this._spriteFrames.keys());
        return names.length > 0 ? names[Math.floor(Math.random() * names.length)] : null;
    }

    public clearFruits() {
        for (const fruit of this._currentFruits) {
            fruit.removeFromParent();
        }
        this._currentFruits = [];
    }

    // ordered=true:整齐网格排列(用于数字加法,便于孩子点数);false:随机散落(用于数一数)
    // crossOut=true:整组水果变暗并打红叉,表示"被吃掉/拿走"(用于减法右侧)
    // fruitName:指定水果种类(让加减法左右两侧共用同一种水果);为空时按 sameType 随机
    public spawn(count: number, sameType: boolean = false, ordered: boolean = false, crossOut: boolean = false, fruitName: string | null = null) {
        this.clearFruits();
        if (!this._loaded || !this.spawnArea) return;

        // 优先用指定水果;否则 sameType=true 时整组随机同一种(如"3个苹果 + 2个香蕉")
        const names = Array.from(this._spriteFrames.keys());
        const fixedName = fruitName && this._spriteFrames.has(fruitName)
            ? fruitName
            : (sameType && names.length > 0
                ? names[Math.floor(Math.random() * names.length)]
                : null);

        const areaTransform = this.spawnArea.getComponent(UITransform)!;

        // 缩放:整齐模式统一大小,随机模式各自轻微随机
        const scales: number[] = [];
        for (let i = 0; i < count; i++) {
            scales.push(ordered ? 1 : 0.85 + Math.random() * 0.2); // 随机模式 85%~105%
        }

        const positions = ordered
            ? this.gridPositions(count, areaTransform.width, areaTransform.height)
            : this.generatePositions(count, areaTransform.width, areaTransform.height, scales);

        for (let i = 0; i < count; i++) {
            const fruitNode = this.createFruitNode(fixedName);
            this.spawnArea.addChild(fruitNode);
            this._currentFruits.push(fruitNode);

            fruitNode.setPosition(positions[i]);

            // 整齐模式不旋转;随机模式 ±15度
            const rot = ordered ? 0 : (Math.random() - 0.5) * 30;
            fruitNode.setRotationFromEuler(0, 0, rot);

            let scale = scales[i];

            if (crossOut) {
                // 被吃掉的水果:变暗 + 红叉,略微缩小
                scale *= 0.9;
                const sprite = fruitNode.getComponent(Sprite);
                if (sprite) sprite.color = new Color(120, 120, 120, 180);
                this.addCross(fruitNode);
            }

            fruitNode.setScale(v3(0, 0, 0));

            // 弹出动画:极快弹出,几乎瞬间到位
            tween(fruitNode)
                .to(0.05, { scale: v3(scale * 1.1, scale * 1.1, 1) }, { easing: 'quadOut' })
                .to(0.04, { scale: v3(scale, scale, 1) })
                .start();
        }
    }

    // 在水果节点上叠加一个红色 "✕" 标记,表示被减掉
    private addCross(parent: Node) {
        const cross = new Node('Cross');
        cross.layer = Layers.Enum.UI_2D;
        const label = cross.addComponent(Label);
        label.string = '✕';
        label.fontSize = this.fruitSize * 0.9;
        label.lineHeight = this.fruitSize * 0.9;
        label.color = new Color(231, 76, 60, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.isBold = true;
        parent.addChild(cross);
        cross.setPosition(v3(0, 0, 0));
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

        // 按图片原始宽高比缩放到 fruitSize 内接框,避免被拉伸/压扁
        const sf = this._spriteFrames.get(name)!;
        const rect = sf.rect;
        let w = this.fruitSize;
        let h = this.fruitSize;
        if (rect && rect.width > 0 && rect.height > 0) {
            const ratio = rect.width / rect.height;
            if (ratio >= 1) {
                w = this.fruitSize;
                h = this.fruitSize / ratio;
            } else {
                h = this.fruitSize;
                w = this.fruitSize * ratio;
            }
        }
        transform.setContentSize(w, h);

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

    // 整齐网格排列:居中,从上到下、从左到右规则摆放
    private gridPositions(count: number, areaW: number, areaH: number): Vec3[] {
        const positions: Vec3[] = [];
        if (count <= 0) return positions;

        const gap = 14;                       // 单元格之间留白
        const cell = this.fruitSize + gap;    // 每个单元格边长

        // 列数:尽量接近正方形,同时不超过区域可容纳的列数
        const maxCols = Math.max(1, Math.floor(areaW / cell));
        let cols = Math.min(count, Math.ceil(Math.sqrt(count)));
        cols = Math.min(cols, maxCols);
        const rows = Math.ceil(count / cols);

        // 整个网格居中:计算左上角起点
        const gridW = cols * cell;
        const gridH = rows * cell;
        const startX = -gridW / 2 + cell / 2;
        const startY = gridH / 2 - cell / 2;

        for (let i = 0; i < count; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;

            // 最后一行不满时,让该行居中对齐
            const itemsInRow = Math.min(cols, count - row * cols);
            const rowOffset = (cols - itemsInRow) * cell / 2;

            const x = startX + col * cell + rowOffset;
            const y = startY - row * cell;
            positions.push(v3(x, y, 0));
        }
        return positions;
    }
}
