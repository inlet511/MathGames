import { _decorator, Component, Label } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 通用按键(配合 BasicButton.prefab 使用)。
 * 显示内容做成 `text` 字符串实例可配置:既能是数字("5"),也能是任意文字
 * ("对"/"错"/"红色"…)。既能在 Inspector 里逐个实例改(prefab 属性覆盖),
 * 也能被面板运行时用 setText()/setNumber() 动态设置。所有按键共用同一个
 * prefab,增删/换皮只改 prefab 一处。
 *
 * 底色不在这里管 —— 直接改按键节点上的 cc.Sprite.color(Inspector 可改、
 * 可做 prefab 实例覆盖)。本组件只负责把文本同步到子 Label,避免两处存内容。
 *
 * @executeInEditMode + text getter/setter:在编辑器里一改 Inspector 就立刻
 * 刷到 Label,所见即所得。
 *
 * 面板(ButtonPanel)通过读取本组件的 `value`(文本)或 `number`(解析为数字)
 * 得知这个键代表的内容 —— 因此摆放顺序、数量都可自由。
 */
@ccclass('BasicButton')
@executeInEditMode
export class BasicButton extends Component {
    // 这个键显示的文本(可以是数字,也可以是任意文字)
    @property({ tooltip: '按键显示的文本(数字或任意文字)' })
    private get text(): string { return this._text; }
    private set text(v: string) { this._text = v; this.apply(); }

    // 显示内容的子 Label(prefab 里连到子节点)
    @property(Label)
    private label: Label | null = null;

    @property({ visible: false })
    private _text: string = '1';

    /** 这个键代表的文本内容 */
    public get value(): string { return this._text; }

    /** 文本解析为数字(可解析时返回数字,否则 NaN)—— 兼容按数字答题的游戏 */
    public get number(): number { return Number(this._text); }

    onLoad() {
        this.apply();
    }

    /** 运行时设置文本(数字或任意文字,供面板批量配置) */
    public setText(text: string) {
        this._text = text;
        this.apply();
    }

    /** 运行时设置数字(兼容旧接口,内部转成文本) */
    public setNumber(value: number) {
        this._text = `${value}`;
        this.apply();
    }

    /** 把当前文本刷到子 Label */
    public apply() {
        if (this.label) this.label.string = this._text;
    }
}
