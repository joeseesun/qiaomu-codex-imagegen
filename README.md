# 乔木 Codex 生图 · qiaomu-codex-imagegen

**让任何 Agent 都能调用 Codex 内置的生图能力，并自带海报、视频封面、小红书配图的提示词技巧。**

Codex 的生图工具只在 Codex 里能用。这个项目把它接出来：一个 **MCP 服务**、一个**命令行**、一个 **Agent Skill**，共用同一套核心。Claude Code、Codex、Cursor，或者任何能执行命令的 Agent，都能说一句"做一张小红书配图"就拿到图片文件。

*Use Codex's built-in image generation from any agent through MCP, a CLI or a skill. Scenario presets (Xiaohongshu, video cover, poster …) and 86 styles including 20 Mondo poster artists are built in.*

## 能做什么

| 你说 | 它做 |
| --- | --- |
| 给这期视频做一张 16:9 视频封面 | 选 `video-cover`：缩略图逻辑、标题留白，用你指定的风格生成，返回文件路径和像素尺寸 |
| 做一张小红书配图，主题清晨读书 | 选 `xiaohongshu`：3:4 竖版，视觉重心偏上，顶部留标题位 |
| 用 Mondo 风格做《沙丘》海报，三个设计师各来一张 | 三个设计师风格并行生成，各自保存 |
| 把这张图的背景换成米色纸，主体不变 | 参考图改图（图生图） |
| 公众号头图、X 封面、朋友圈海报、书籍封面、专辑封面 | 各有预设比例和安全区 |

## 安装

前置条件：

- [ ] **Node.js 18+**（`node --version`）
- [ ] 已安装并登录的 **[Codex CLI](https://github.com/openai/codex)**（`codex --version` 能运行）
- [ ] Codex 账号可使用图片生成（先在 Codex 里手动生成一张试试）

### 1. 作为 Skill 安装（任何支持 Agent Skills 的工具）

```bash
npx skills add joeseesun/qiaomu-codex-imagegen
```

Skill 会让 Agent 知道怎么选场景、风格、怎么写描述，并通过下面的 MCP 或自带 CLI 出图。

### 2. 注册 MCP（推荐，Agent 直接调用工具）

Claude Code：

```bash
claude mcp add --scope user qiaomu-codex-imagegen -- node /绝对路径/qiaomu-codex-imagegen/scripts/mcp-server.mjs
```

其他 MCP 客户端（Cursor、Codex 等），在配置里加：

```json
{
  "mcpServers": {
    "qiaomu-codex-imagegen": {
      "command": "node",
      "args": ["/绝对路径/qiaomu-codex-imagegen/scripts/mcp-server.mjs"]
    }
  }
}
```

提供三个工具：

| 工具 | 作用 |
| --- | --- |
| `generate_image` | 生成或改图，返回绝对路径、像素尺寸、实际使用的提示词 |
| `build_prompt` | 只组装最终提示词，不生成、不花额度，用来先看一眼 |
| `list_catalog` | 列出场景预设和风格键 |

### 3. 只用命令行

```bash
git clone https://github.com/joeseesun/qiaomu-codex-imagegen && cd qiaomu-codex-imagegen
node scripts/cli.mjs "窗边翻开的书，书页上升起咖啡的热气" --preset xiaohongshu
```

## 你可以直接这样说

装好 Skill 和 MCP 后，对 Agent 说：

- 「给这期视频做一张 16:9 的封面，要有设计感，先出三个方案」
- 「做一组小红书配图，主题是清晨读书，第一张定风格，后面几张保持一致」
- 「用 Olly Moss 风格做《沙丘》的电影海报，不要放字」
- 「把这张图的背景换成米色纸张，主体不变」

## 用法示例（命令行）

```bash
# 视频封面，三个方案先看
node scripts/cli.mjs "一个巨大的红色播放键像日出一样升起" --preset video-cover --style saul-bass --count 3

# Mondo 风格电影海报，只出图不放字
node scripts/cli.mjs "沙漠中巨大的沙虫轮廓，渺小的人影" --preset movie-poster --style olly-moss

# 必须带标题时，逐字给出
node scripts/cli.mjs "一座灯塔" --preset wechat-cover --text "夜航船"

# 图生图
node scripts/cli.mjs "保持同一支铅笔，背景换成暖米色纸张" --ref /abs/pencil.png --ratio 1:1

# 先看提示词，不生成
node scripts/cli.mjs "咖啡和书" --preset xiaohongshu --show-prompt
```

参数：`--preset` 场景，`--style` 风格（键或自由文字），`--ratio` 覆盖比例，`--text` 图内文字（可重复），`--ref` 参考图（可重复，绝对路径），`--count` 并行变体 1–4，`--out` 输出目录，`--name` 文件名，`--model`、`--timeout`，`--json` 机器可读输出。默认保存到 `~/Pictures/qiaomu-codex-imagegen/<日期>`。

## 场景预设

| preset | 用途 | 比例 |
| --- | --- | --- |
| `xiaohongshu` / `xiaohongshu-square` | 小红书卡片 / 方形封面 | 3:4 / 1:1 |
| `video-cover` | YouTube、B 站横版封面 | 16:9 |
| `video-vertical` | 抖音、视频号、Reels 竖屏封面 | 9:16 |
| `wechat-cover` | 公众号头图 | 2.35:1 |
| `x-cover` | X 个人页封面 | 5:2 |
| `moments` | 朋友圈海报 | 4:5 |
| `poster` / `movie-poster` | 通用海报 / 电影海报 | 9:16 / 2:3 |
| `book-cover` / `album-cover` | 书籍 / 专辑封面 | 2:3 / 1:1 |
| `article` / `paper` | 文章配图 / 科普配图 | 16:9 |

每个预设带有安全区和构图规则（例如竖屏封面顶部约 12%、底部约 20% 留给界面）。详见 [references/scenarios.md](references/scenarios.md)。

## 内置风格

- **66 种通用风格**：极简线条、水彩、纸雕、等距、像素、低多边形……见 `references/styles.json`。
- **20 位海报设计师**（Mondo 技巧整合自 [qiaomu-mondo-poster-design](https://github.com/joeseesun/qiaomu-mondo-poster-design)）：Olly Moss、Saul Bass、Martin Ansin、Tyler Stout、Kilian Eng、Drew Struzan 等，另有丝网印刷、负空间、书籍与专辑封面专用风格。怎么选、怎么写，见 [references/mondo-poster.md](references/mondo-poster.md)。

## 它是怎么工作的

和乔木 Agent 的 Obsidian 插件同一思路：启动 `codex app-server --listen stdio://`（标准输入输出上的 JSON-RPC），发起一个回合要求调用图像生成，等 `imageGeneration` 项完成，把 Codex 保存的图片复制到你指定的目录。每次调用启动独立的临时会话，沙箱只允许写输出目录，审批策略为 never，遇到任何交互请求一律拒绝。

## 实测与限制

- **比例**：Codex 会遵守提示词里的比例。实测 3:4 得到 1086×1448，21:9 得到 1916×821；没有指定比例时默认出方图（实测 1254×1254）。工具会读取结果的像素尺寸，与要求不符时在结果里标出。
- **耗时与额度**：单张约 30–60 秒，每张消耗你的 Codex / OpenAI 账号额度。`count` 最多 4，并行运行，成倍消耗。
- **图内文字**：模型写中文和长句容易出错。默认不放字；需要标题时用 `--text`（短、逐字），并检查拼写，或留白后期排版。
- **依赖 Codex**：未安装、未登录，或账号没有图片生成权限时会返回明确错误。可用环境变量 `QIAOMU_CODEX_BIN` 指定 Codex 路径。
- 没有尺寸、数量等底层参数：这些由 Codex 的生图工具决定，写在描述或预设里。

## 排错（Troubleshooting）

| 现象 | 处理 |
| --- | --- |
| `cannot start codex` | 安装 Codex CLI，或设置 `QIAOMU_CODEX_BIN` |
| 返回"codex finished without producing an image" | Codex 未登录或账号无图片生成权限；先在 Codex 里手动生成一张试试 |
| `timed out` | 加大 `--timeout`，或简化描述 |
| 比例与要求不符 | 在描述里强调构图，或换 `--ratio`；工具不会静默裁剪 |
| 参考图报 not found | 必须是绝对路径 |

## 验证

```bash
npm test                                                  # 离线测试
node scripts/cli.mjs --list                               # 能看到预设和风格
node scripts/cli.mjs "一个红色圆" --show-prompt           # 不花额度，检查组装的提示词
```

## 开发

```bash
npm test      # 11 项测试，用假的 codex 模拟 app-server，不消耗额度
```

作为乔木 Skill 的发布门禁（`validate_skill.py`、触发评测）见 `reports/`。

零依赖，Node 18+。`scripts/lib/codex.mjs` 是核心，`prompt.mjs` 组装提示词，`tools.mjs` 是 MCP 与命令行共用的工具层。

## 致谢与参考

- Codex 通信方式参考乔木 Agent（Obsidian 插件）对 `codex app-server` 的接入。
- Mondo 海报技巧整合自 [qiaomu-mondo-poster-design](https://github.com/joeseesun/qiaomu-mondo-poster-design)（MIT；upstream: https://github.com/joeseesun/qiaomu-mondo-poster-design）；通用风格库来自乔木配图生成器。

<!-- qiaomu-profile:start -->
## 关于向阳乔木

向阳乔木（乔向阳 / Joe）是一位实践型 AI 产品与内容创作者，长期把前沿 AI 变化转译成可复用的工作流、产品判断、AI 编程实践、AI 搜索实践和 GEO/AI 营销方法。

- 个人网站: https://qiaomu.ai
- 博客: https://blog.qiaomu.ai
- X: https://x.com/vista8
- GitHub: https://github.com/joeseesun/
- 微信公众号: 向阳乔木推荐看

### 支持与关注

| 打赏支持 | 微信公众号 |
|---|---|
| <img src="assets/qiaomu-profile/qiaomu_reward_qr.png" alt="向阳乔木打赏二维码" width="180" /> | <img src="assets/qiaomu-profile/qiaomu_wechat_public_account_qr.jpg" alt="向阳乔木推荐看公众号二维码" width="180" /> |
| 感谢支持乔木持续分享 AI 实践 | 扫码关注「向阳乔木推荐看」 |

<!-- qiaomu-profile:end -->

## 许可证

Copyright (c) 向阳乔木 · X [@vista8](https://x.com/vista8) · GitHub [joeseesun](https://github.com/joeseesun/) · MIT License
