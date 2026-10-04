# Mondo 风格海报技巧

内置自 [qiaomu-mondo-poster-design](https://github.com/joeseesun/qiaomu-mondo-poster-design)（MIT），改写为本工具的用法：风格用 `--style`，内容写进描述，比例用 `--preset`。深入资料见 [artist-styles](mondo/artist-styles.md)、[composition-patterns](mondo/composition-patterns.md)、[genre-templates](mondo/genre-templates.md)、[book-covers](mondo/book-covers.md)。

## 美学内核

1. **概念重释，不是剧照。** 画主题的视觉提炼，不画具体场景。
2. **丝网印刷质感。** 2–5 色有限色板、平涂色块、半调网点、轻微套印错位。
3. **极简符号。** 关键道具、剪影、负空间，代替人物面孔。
4. **复古字体与色彩。** 手绘字、窄体无衬线、装饰艺术；高饱和复古双色（橙/青、红/米）。

## 风格键

- `mondo-screenprint`：通用丝网海报（海报类 preset 的默认值）
- `negative-space-poster`、`literary-mondo-cover`（书）、`album-mondo-cover`（专辑）、`retro-poster`、`halftone-rock-poster`
- 20 位设计师：`olly-moss` `saul-bass` `martin-ansin` `tyler-stout` `kilian-eng` `drew-struzan` `laurent-durieux` `dan-mccarthy` `jock` `shepard-fairey` `jay-ryan` `paula-scher` `jules-cheret` `toulouse-lautrec` `alphonse-mucha` `steinlen` `eugene-grasset` `cassandre` `milton-glaser` `josef-muller-brockmann` `paul-rand`

怎么选：

| 想要 | 选 |
| --- | --- |
| 极简、聪明、一两个颜色 | `olly-moss` |
| 几何抽象、视觉隐喻 | `saul-bass` |
| 优雅复古、装饰艺术 | `martin-ansin` / `cassandre` |
| 密集拼贴、信息量大 | `tyler-stout` |
| 科幻、几何未来感 | `kilian-eng` |
| 手绘史诗电影感 | `drew-struzan` |
| 纯排版 | `paula-scher` / `josef-muller-brockmann` |
| 社会宣传、半调 | `shepard-fairey` |
| 新艺术花卉 | `alphonse-mucha` |

## 描述怎么配合风格

风格键已经带上"丝网印刷、有限色板、半调"等词。你的描述只写**内容与构图**，并明确这几项：

- **色数和具体颜色**：「3 色：烧橙、奶油、深蓝」，比"复古配色"有效。
- **年代**：60s / 70s / 80s，决定调子和字体气质。
- **构图一句话**：居中对称 / 剪影压在纯色背景上 / 几何框（圆、三角、拱门）/ 前中后景分层。
- **一个符号**：这张海报的唯一主角。

### 三个负空间手法

1. **图底反转（Olly Moss 式）**：剪影的负空间里藏着另一个场景。
   「一顶侦探礼帽的剪影，负空间里是夜晚的城市天际线，2 色：深蓝和暖黄」
2. **尺度对比**：很小的人 + 很大的物体，小的那个只占下方 20%，上方留 70% 空白，传达敬畏或孤独。
   「渺小的宇航员站在巨大的月亮前」
3. **单一形状叙事**：一个标志性形状讲完整个故事，周围全是留白（约 30% 图形 / 30% 文字区 / 40% 空）。
   「一个居中的红色圆，下方一道细小的地平线」

### 两个稳定出片的模式

- **单一焦点（极简）**：只有一个中心元素，2–3 色，四周负空间，干净、一眼认得出。
- **氛围单主体**：一个主体 + 简单背景，3–4 色营造氛围，主体在前景。

## 做与不做

做：写明颜色名和数量；用几何构图词；点名年代；符号代替字面；保留负空间。
不做：写写实或数码渐变；要求复杂面部（用剪影）；混多种风格；忘记年代；塞满画面。

## 工作流

1. 确定主题（电影、书、专辑、活动、概念）。
2. 选**一个**象征元素。
3. 选构图模式（极简符号 / 氛围单主体）。
4. 选 2–4 色，定年代。
5. 选风格键，用 `count 3` 先看三个方案。
6. 选定后用它做 `--ref` 精修或出系列。

## 对比三种风格

同一主题想比较风格时，用三个不同的设计师键各出一张（互相独立，可并行），例如：

```bash
for s in saul-bass olly-moss kilian-eng; do
  node scripts/cli.mjs "沙漠中的巨大沙虫轮廓" --preset poster --style $s --name dune-$s &
done; wait
```

每张都会消耗额度，先问用户要不要比较。
