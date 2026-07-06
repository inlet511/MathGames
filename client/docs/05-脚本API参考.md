# 数一数 — 脚本 API 参考

## AudioManager

音效管理单例，负责音效的预加载和播放。

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `source` | `AudioSource` | 音频源组件 |

### 静态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `instance` | `AudioManager` | 单例实例 |

### 方法

#### `preload(name: string, path: string): void`
预加载音效到缓存。

```typescript
AudioManager.instance.preload('correct', 'audio/correct-selection-sound');
```

- `name`: 音效名称，用于后续播放
- `path`: 资源路径（相对于 resources 目录，不带扩展名）

#### `play(name: string, volumeScale?: number): void`
播放已预加载的音效。

```typescript
AudioManager.instance.play('correct', 0.8);
```

- `name`: 音效名称
- `volumeScale`: 音量缩放，默认 1.0

---

## ScoreManager

计分系统，管理分数、连击和评级。

### 属性

| 属性 | 类型 | 只读 | 说明 |
|------|------|------|------|
| `score` | `number` | ✓ | 当前分数 |
| `combo` | `number` | ✓ | 当前连击数 |
| `maxCombo` | `number` | ✓ | 最高连击数 |
| `correctCount` | `number` | ✓ | 答对题数 |
| `totalCount` | `number` | ✓ | 总题数 |
| `fastestReaction` | `number` | ✓ | 最快反应时间（秒） |

### 绑定UI

| 属性 | 类型 | 说明 |
|------|------|------|
| `scoreLabel` | `Label` | 分数显示 |
| `comboLabel` | `Label` | 连击显示 |

### 方法

#### `reset(): void`
重置所有计分数据。

#### `submitAnswer(correct: boolean, reactionTime: number): void`
提交答案，更新分数和连击。

```typescript
scoreManager.submitAnswer(true, 0.8); // 答对，反应时间0.8秒
```

- `correct`: 是否答对
- `reactionTime`: 反应时间（秒）

#### `getStarCount(): number`
获取评级星级（1-4）。

---

## TimerManager

计时管理，控制总倒计时和每题倒计时。

### 属性

| 属性 | 类型 | 只读 | 说明 |
|------|------|------|------|
| `remainTime` | `number` | ✓ | 剩余总时间 |
| `remainQuestionTime` | `number` | ✓ | 剩余题目时间 |
| `perQuestionTime` | `number` | ✓ | 每题限时 |

### 绑定UI

| 属性 | 类型 | 说明 |
|------|------|------|
| `timeLabel` | `Label` | 时间显示 |

### 方法

#### `init(totalTime: number, perQuestionTime: number): void`
初始化计时器。

```typescript
timerManager.init(30, 5); // 总时间30秒，每题5秒
```

#### `startTimer(onTimeout: () => void, onQuestionTimeout: () => void): void`
启动计时器，设置回调。

```typescript
timerManager.startTimer(
    () => console.log('游戏结束'),
    () => console.log('本题超时')
);
```

#### `resetQuestionTimer(perQuestionTime: number): void`
重置每题倒计时。

#### `stopTimer(): void`
停止计时器。

#### `penalize(seconds: number): void`
惩罚扣减总时间。

```typescript
timerManager.penalize(1); // 扣减1秒
```

---

## FruitSpawner

水果生成器，负责随机生成水果和播放动画。

### 属性

| 属性 | 类型 | 只读 | 说明 |
|------|------|------|------|
| `currentFruits` | `Node[]` | ✓ | 当前屏幕上的水果 |

### 绑定节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `spawnArea` | `Node` | 水果生成区域 |
| `fruitSize` | `number` | 水果尺寸（默认100） |

### 方法

#### `isReady(): boolean`
检查水果资源是否加载完成。

#### `spawn(count: number): void`
生成指定数量的水果。

```typescript
fruitSpawner.spawn(3); // 生成3个水果
```

- `count`: 水果数量 (1-5)

#### `clearFruits(): void`
清除所有水果。

---

## ButtonPanel

数字按钮面板，处理玩家输入。

### 绑定节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `buttons` | `Node[]` | 5个数字按钮节点 |

### 方法

#### `setEnabled(enabled: boolean): void`
启用/禁用所有按钮。

```typescript
buttonPanel.setEnabled(false); // 禁用按钮
```

#### `setAnswerCallback(callback: (num: number) => void): void`
设置答案回调。

```typescript
buttonPanel.setAnswerCallback((num) => {
    console.log('玩家选择了:', num);
});
```

#### `flashCorrect(num: number): void`
播放答对动画。

#### `flashWrong(num: number): void`
播放答错动画（晃动）。

---

## ResultPanel

结算界面，显示游戏结果。

### 绑定UI

| 属性 | 类型 | 说明 |
|------|------|------|
| `finalScoreLabel` | `Label` | 最终分数 |
| `correctCountLabel` | `Label` | 答对题数 |
| `maxComboLabel` | `Label` | 最高连击 |
| `fastestLabel` | `Label` | 最快反应 |
| `starsLabel` | `Label` | 星级评价 |
| `replayBtn` | `Node` | 再来一次按钮 |
| `homeBtn` | `Node` | 返回主页按钮 |

### 方法

#### `setCallbacks(onReplay: () => void, onHome: () => void): void`
设置按钮回调。

#### `show(score, correctCount, totalCount, maxCombo, fastestReaction, stars): void`
显示结算界面。

```typescript
resultPanel.show(280, 18, 22, 7, 0.42, 3);
```

#### `hide(): void`
隐藏结算界面。

---

## GameManager

游戏主控制器，管理游戏状态和流程。

### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `totalTime` | `number` | 总游戏时间（默认30秒） |
| `baseQuestionTime` | `number` | 基础每题时间（默认5秒） |

### 绑定组件

| 属性 | 类型 | 说明 |
|------|------|------|
| `audioManager` | `AudioManager` | 音效管理器 |
| `scoreManager` | `ScoreManager` | 计分管理器 |
| `timerManager` | `TimerManager` | 计时管理器 |
| `fruitSpawner` | `FruitSpawner` | 水果生成器 |
| `buttonPanel` | `ButtonPanel` | 按钮面板 |
| `resultPanel` | `ResultPanel` | 结算面板 |
| `countdownLabel` | `Label` | 倒计时文字 |
| `feedbackLabel` | `Label` | 反馈文字 |

### 方法

#### `startGame(): void`
开始游戏（通常由 UI 按钮触发）。

#### `onTouchStart(): void`
触摸开始事件（用于 IDLE 状态触发开始）。

---

## StartScene

启动场景控制器。

### 绑定节点

| 属性 | 类型 | 说明 |
|------|------|------|
| `startBtn` | `Node` | 开始按钮 |
| `titleNode` | `Node` | 标题节点 |

### 功能
- 点击开始按钮 → 加载 Game 场景
- 标题弹入动画
- 按钮呼吸动画
