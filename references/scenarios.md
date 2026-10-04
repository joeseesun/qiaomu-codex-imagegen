# 场景与配方

比例由 preset 决定，实测 Codex 会遵守提示词里的比例（3:4 → 1086×1448，21:9 → 1916×821）。工具会在结果里标出与要求不符的比例。

| preset | 用途 | 比例 | 默认风格 | 要点 |
| --- | --- | --- | --- | --- |
| `xiaohongshu` | 小红书配图（竖版卡片） | 3:4 | airy-illustration | 视觉重心在上 2/3；顶部或底部留一条干净区域，后期加标题 |
| `xiaohongshu-square` | 小红书方形封面 | 1:1 | airy-illustration | 主体居中，四周均匀留白 |
| `video-cover` | YouTube / B 站横版封面、视频海报 | 16:9 | mondo-screenprint | 缩到 320 px 宽仍然看得清：一个巨大主体、高对比、背景简单；左侧或下 1/3 留给标题 |
| `video-vertical` | 抖音 / 视频号 / Reels 竖屏封面与竖版海报 | 9:16 | mondo-screenprint | 重要内容放中间安全区：顶部约 12%、底部约 20% 留给界面和字幕 |
| `wechat-cover` | 公众号头图 | 2.35:1 | paper-watercolor-cover | 主体在中间 60%，方形缩略图裁切后仍成立 |
| `x-cover` | X 个人页封面 | 5:2 | paper-watercolor-cover | 左下角有头像，保持安静 |
| `moments` | 朋友圈海报 | 4:5 | mondo-screenprint | 一个想法，粗大形状，安全边距 |
| `poster` | 通用海报 | 9:16 | mondo-screenprint | 一个标志性主体、有限色板、大面积留白 |
| `movie-poster` | 电影海报 | 2:3 | mondo-screenprint | 概念重释而非剧照；剪影与符号优先 |
| `book-cover` | 书籍封面 | 2:3 | literary-mondo-cover | 给书名和作者留版面 |
| `album-cover` | 专辑封面 | 1:1 | album-mondo-cover | 缩到 120 px 仍醒目 |
| `article` | 文章配图 | 16:9 | minimalist | 一图一个意思 |
| `paper` | 论文 / 科普配图 | 16:9 | newyorker | 机智胜过细节 |

## 配方

### 视频海报 / 视频封面

```bash
node scripts/cli.mjs "一个巨大的红色播放键像日出一样从地平线升起，下方一个小小的人影仰望" \
  --preset video-cover --style saul-bass --count 3
```

- 先出 2–3 个方案（`count`），选定后再精修，不要一上来精雕一张。
- 标题怎么处理：图里不放字，后期用排版工具叠；确实要图内文字时用 `--text "标题"`，≤ 8 个字，并检查拼写。
- 一个系列的视频封面保持同一风格：第一张定调，后面把它作为 `--ref`。

### 小红书一组卡片

```bash
node scripts/cli.mjs "封面：一杯咖啡和翻开的书，清晨光线" --preset xiaohongshu --name card-1
node scripts/cli.mjs "内页：书页上的三个关键词悬浮起来" --preset xiaohongshu --ref /abs/card-1.png --name card-2
```

第一张定风格，之后用 `--ref` 保持统一；标题和正文用排版工具叠上去，不要让模型写正文。

### 电影海报 / 书籍封面 / 专辑封面

读 [mondo-poster.md](mondo-poster.md)，用 `--style olly-moss` 等设计师键。海报类默认不放字。

### 图生图 / 改图

```bash
node scripts/cli.mjs "保持同一支铅笔不变，把背景换成暖米色纸张，加柔和阴影" --ref /abs/pencil.png --ratio 1:1
```

明确写"保持什么、改什么"。
