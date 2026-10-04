# 乔木 Codex 生图 · qiaomu-codex-imagegen

**让任何 Agent 都能调用 Codex 内置的生图能力：每次生图先给出至少四种机制不同的风格方向，你选定后再出图。** 内置 24 类场景模板（48 个预设）、20 位 Mondo 海报设计师风格，以及一套防止编造事实、乱写文字的规则。

Codex 的生图工具只在 Codex 里能用。这个项目把它接出来：一个 **MCP 服务**、一个**命令行**、一个 **Agent Skill**，共用同一套核心。Claude Code、Codex、Cursor，或者任何能执行命令的 Agent，都能说一句"做一张小红书配图"就拿到图片文件。

*Use Codex's built-in image generation from any agent through MCP, a CLI or a skill. Every request first gets at least four divergent style directions (24 templates, 48 presets, 20 Mondo artists); you pick, it composes the prompt, generates, and checks the result.*

## 先给方案，再出图

对 Agent 说「给这期视频做一张封面」，它不会直接画，而是按下面的顺序走：

1. **推荐方向**：`suggest_directions` 给出 **至少四个机制各异的方向**，来自不同家族（文字主导、平面结构、摄影人物、产品近摄、材料空间，再加一个 Mondo 设计师方向），每个方向带风格锁、需要你补的信息和参考案例缩略图。
2. **你来选**：选一个、几个，或者说「你定」。想要更多就排除这几个再推荐。
3. **展开提示词**：`compose_prompt` 把变量填成完整提示词，同时给出避免项、验收条件、假设和缺失信息。带「结构替换」的预设会提示 Agent 改写，不会把冲突的句子硬拼在一起。
4. **生成**：每个选中的方向出一张，图旁边留一份 JSON，记录实际提示词，方便复现和做系列。
5. **验收**：Agent 看图，对着验收条件逐条检查；不合格就只改对应那一句再生成一次。

你已经指定了风格（「用 Mondo 风格」「T03」）或说「直接出」时，会跳过选择这一步。

## 能做什么

| 你说 | 它做 |
| --- | --- |
| 给这期视频做一张 16:9 视频封面 | 选 `video-cover`：缩略图逻辑、标题留白，用你指定的风格生成，返回文件路径和像素尺寸 |
| 做一张小红书配图，主题清晨读书 | 选 `xiaohongshu`：3:4 竖版，视觉重心偏上，顶部留标题位 |
| 用 Mondo 风格做《沙丘》海报，三个设计师各来一张 | 三个设计师风格并行生成，各自保存 |
| 把这张图的背景换成米色纸，主体不变 | 参考图改图（图生图） |
| 公众号头图、X 封面、朋友圈海报、书籍封面、专辑封面 | 各有预设比例和安全区 |
| 给我几个风格 / 帮我选个风格 | 四个以上机制不同的方向，附参考缩略图，选定后出图 |
| 找一下以前类似的案例 | 在本地 689 条参考提示词里检索，给出缩略图与原文 |

## 样例

下面所有图片都是用这个工具调用 Codex 生成的，没有后期修图；活动、品牌、人物和文案全部是**虚构的示例**。每张图的提示词和参数在 [docs/samples/prompts.json](docs/samples/prompts.json)。

### 同一个主题，五个方向

主题都是「咖啡店阅读月」。`suggest_directions` 给出的方向机制完全不同，所以出来的不是同一张图换个滤镜：

<img src="docs/samples/directions-strip.webp" alt="同一主题的五个风格方向" width="100%">

| 方向 | 机制 |
| --- | --- |
| 1 · T01 巨字与微小叙事 | 大字是场景的墙，水边的小读者提供尺度 |
| 2 · T02 物象破框 | 一枝咖啡树穿出细框，越界只发生一次 |
| 3 · T05 纸雕与织物地貌 | 书页的层叠被读成山河，微小读者坐在边缘 |
| 4 · T16 巨物微缩剧场 | 一杯拿铁放大成可进入的阅读小镇 |
| 5 · Mondo · Olly Moss | 两色丝网印，杯子的负空间里藏着一本书 |

### 24 个类别各一张

<img src="docs/samples/categories-24.webp" alt="24 个模板类别各一张样例" width="100%">

| 类别与预设 | 样例 | 机制与文字 |
| --- | --- | --- |
| **T01 巨字与微小叙事**<br>预设 T01-1 旧刊慢场 | <img src="docs/samples/T01-giant-type.webp" width="220" alt="巨字与微小叙事样例"> | 大字是场景的墙，微小行动提供尺度；静止水平面被一条斜线打破。<br><sub>文字：exact_short：标题 + 副标题 + 信息行</sub> |
| **T02 物象破框**<br>预设 T02-1 清透巨叶 | <img src="docs/samples/T02-breaking-frame.webp" width="220" alt="物象破框样例"> | 框线建立秩序，实体穿过框线制造一次明确的越界。<br><sub>文字：exact_short</sub> |
| **T03 中央光隙**<br>预设 T03-1 清润春生 | <img src="docs/samples/T03-center-light.webp" width="220" alt="中央光隙样例"> | 两侧巨大色域夹出中央通道，通道尽头的微小焦点表现希望。<br><sub>文字：exact_short</sub> |
| **T04 东方水墨编辑**<br>预设 T04-1 清透墨枝 | <img src="docs/samples/T04-ink-editorial.webp" width="220" alt="东方水墨编辑样例"> | 水墨是空间与版式的一部分，宋体大字、透明色域和留白互相穿插。<br><sub>文字：exact_short</sub> |
| **T05 纸雕与织物地貌**<br>预设 T05-1 纸雕田垄 | <img src="docs/samples/T05-paper-terrain.webp" width="220" alt="纸雕与织物地貌样例"> | 主题被转译成有材料厚度的地貌，微小物象为抽象层叠提供故事。<br><sub>文字：exact_short</sub> |
| **T06 民艺撞色招贴**<br>预设 T06-1 粗印民艺 | <img src="docs/samples/T06-folk-poster.webp" width="220" alt="民艺撞色招贴样例"> | 两枚朴拙图符以冷暖强色对话，手写线把图像区和跳跃资讯区缝合。<br><sub>文字：exact_short：标题 + 活动名 + 时间地点 + 亮点</sub> |
| **T07 童画与硬排版**<br>预设 T07-1 蜡笔展览 | <img src="docs/samples/T07-child-drawing.webp" width="220" alt="童画与硬排版样例"> | 粗重现代字与松软儿童笔触互相挤压，细框提供第三种秩序。<br><sub>文字：exact_short</sub> |
| **T08 摄影与花境拼贴**<br>预设 T08-1 柔彩花境 | <img src="docs/samples/T08-photo-floral.webp" width="220" alt="摄影与花境拼贴样例"> | 刊头、摄影焦点、手绘前景、底栏构成连续层次，照片与插画必须相互遮挡。<br><sub>文字：exact_short</sub> |
| **T09 克制棚拍肖像**<br>预设 T09-1 柔灰专注 | <img src="docs/samples/T09-studio-portrait.webp" width="220" alt="克制棚拍肖像样例"> | 一主一辅的柔光塑造骨相，动作支撑与皮肤细节决定可信度。<br><sub>文字：none：纯肖像无字</sub> |
| **T10 环境自然肖像**<br>预设 T10-1 暮阳天台 | <img src="docs/samples/T10-environment-portrait.webp" width="220" alt="环境自然肖像样例"> | 人物真实地处在环境中，动作先成立，光与景深再分离主体。<br><sub>文字：none：纯肖像无字</sub> |
| **T11 婚礼与仪式肖像**<br>预设 T11-1 晴天珍珠 | <img src="docs/samples/T11-wedding-portrait.webp" width="220" alt="婚礼与仪式肖像样例"> | 身份稳定是底座；薄纱、妆发和单一光线建立仪式感。<br><sub>文字：none：纯肖像无字</sub> |
| **T12 食品触感近摄**<br>预设 T12-2 暖纸酥香 | <img src="docs/samples/T12-food-macro.webp" width="220" alt="食品触感近摄样例"> | 放大可食用的断面与真实触感，信息退到留白而不覆盖食物。<br><sub>文字：exact_short</sub> |
| **T13 饮品微距风味**<br>预设 T13-2 气泡切面 | <img src="docs/samples/T13-drink-macro.webp" width="220" alt="饮品微距风味样例"> | 液体或果肉切面变成放大景观，气泡与水光体现风味而非替代产品事实。<br><sub>文字：exact_short</sub> |
| **T14 植物手绘产品广告**<br>预设 T14-1 清透水彩 | <img src="docs/samples/T14-botanical-product.webp" width="220" alt="植物手绘产品广告样例"> | 真实产品与平面手绘并置，水彩路径环抱并贴附载体而非均匀铺花。<br><sub>文字：exact_short</sub> |
| **T15 科技轨道产品主视觉**<br>预设 T15-1 清透未来 | <img src="docs/samples/T15-tech-orbit.webp" width="220" alt="科技轨道产品主视觉样例"> | 产品是稳定中心，环形波纹和局部光线共同指向它。<br><sub>文字：exact_short</sub> |
| **T16 巨物微缩剧场**<br>预设 T16-1 食品小镇 | <img src="docs/samples/T16-giant-miniature.webp" width="220" alt="巨物微缩剧场样例"> | 巨物真正承担可进入的空间功能，微型人物的动作必须回应它。<br><sub>文字：exact_short</sub> |
| **T17 建筑制图编辑**<br>预设 T17-1 圆规素纸 | <img src="docs/samples/T17-architectural-drawing.webp" width="220" alt="建筑制图编辑样例"> | 真实结构件与有依据的几何线共享轴线，文字保持疏远而精密。<br><sub>文字：exact_short：竖排标题</sub> |
| **T18 旅行与酒店框景**<br>预设 T18-1 温润拱窗 | <img src="docs/samples/T18-framed-view.webp" width="220" alt="旅行与酒店框景样例"> | 框景把观看者带入第二空间，说明围绕入口组织。<br><sub>文字：exact_short</sub> |
| **T19 文博材质巨像**<br>预设 T19-1 粗陶暗腔 | <img src="docs/samples/T19-museum-material.webp" width="220" alt="文博材质巨像样例"> | 材料孔隙与巨大的暗腔制造尺度，洁净空场和疏远文字维持静穆。<br><sub>文字：exact_short</sub> |
| **T20 会议与人物信息系统**<br>预设 T20-1 清爽斜带 | <img src="docs/samples/T20-lineup-system.webp" width="220" alt="会议与人物信息系统样例"> | 重复单元共享节奏，一组定向斜切将照片与信息连接。<br><sub>文字：exact_short：四位虚构嘉宾的姓名与头衔</sub> |
| **T21 九宫格日常手账**<br>预设 T21-1 绒线注释 | <img src="docs/samples/T21-nine-grid.webp" width="220" alt="九宫格日常手账样例"> | 统一矩阵中保留不同镜头密度，手绘标记必须回应格内内容。<br><sub>文字：exact_short</sub> |
| **T22 模块化演示视觉**<br>预设 T22-1 淡块作品集 | <img src="docs/samples/T22-slide.webp" width="220" alt="模块化演示视觉样例"> | 标题与数据先建立信息层级，图形按页的叙事功能进入共同网格。<br><sub>文字：exact_short：标题 + 四项目录</sub> |
| **T23 科普与商品信息卡**<br>预设 T23-1 友好研究卡 | <img src="docs/samples/T23-info-card.webp" width="220" alt="科普与商品信息卡样例"> | 每组图形只解释一个命题，图与文的换位节拍代替装饰密度。<br><sub>文字：exact_short：标题 + 三条步骤</sub> |
| **T24 日签与编辑纪念**<br>预设 T24-1 城市晨光 | <img src="docs/samples/T24-daily-card.webp" width="220" alt="日签与编辑纪念样例"> | 日期是锚点，实体照片是核心，一道问候跨过照片和纸面。<br><sub>文字：exact_short：标题 + 一句寄语</sub> |

### 场景样例

| 视频封面 16:9 | 竖屏封面 9:16 |
| --- | --- |
| <img src="docs/samples/scene-video-cover-16x9.webp" width="420" alt="视频封面"> | <img src="docs/samples/scene-video-vertical-9x16.webp" width="240" alt="竖屏封面"> |
| `--preset video-cover --style saul-bass`，标题压在左侧留白 | `--preset video-vertical --style kilian-eng`，标题在上部安全区 |

| 公众号头图 2.35:1 | 小红书 3:4 |
| --- | --- |
| <img src="docs/samples/scene-wechat-cover-2.35.webp" width="420" alt="公众号头图"> | <img src="docs/samples/T12-food-macro.webp" width="240" alt="小红书配图"> |
| `--preset wechat-cover`，标题在右侧天空 | T12 食品近摄 + `xiaohongshu` 尺寸 |

### 改图

| 原图 | 改后 |
| --- | --- |
| <img src="docs/samples/edit-before.webp" width="280" alt="改图前"> | <img src="docs/samples/edit-after.webp" width="280" alt="改图后"> |
| 一支铅笔 | `--ref` 原图，提示词：保持同一支铅笔，背景换成暖米色纸张，加柔和阴影 |

### 这些样例是怎么做出来的

- 每个类别都走完整流程：推荐方向、填变量、生成、**对着参考案例验收**。
- **第一版不合格，重做了**：最初我只给了标题甚至不给文字，出来的是干净的概念图，不是海报；并排对照参考案例后，补全了副标题、信息行和角标这一层文字，才有现在的完成度。肖像（T09–T11）按方法论保持无字。
- 第一版还暴露了一个工具缺陷：约四分之一的图带透明通道，在看图软件里显示成黑边。现在提示词会要求背景不透明，保存后检测到透明区域会自动压平到白底（`transparent_background: true` 可保留）。
- 图内文字：标题和主要文案已逐张核对；小字号的信息行仍可能有细微瑕疵，正式使用请放大检查。
- 肖像是 AI 生成的虚构人物，不对应真实个人。

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

提供七个工具：

| 工具 | 作用 |
| --- | --- |
| `suggest_directions` | 第一步：给出 ≥4 个机制各异的风格方向（免费、即时） |
| `compose_prompt` | 把选定的模板和预设展开成完整提示词，附避免项、验收条件、缺失信息（免费） |
| `generate_image` | 生成或改图；可用模板、`raw_prompt`（成品提示词）或简易的「描述 + 场景 + 风格」；返回路径、像素尺寸，并在图旁写 JSON |
| `search_prompts` / `get_prompt` | 检索与读取本地参考提示词语料（需要本地数据包） |
| `build_prompt` | 简易路线的提示词预览，不生成 |
| `list_catalog` | 场景预设、24 个模板、风格键、语料状态 |

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
# 先要方向（免费），再选
node scripts/cli.mjs suggest "一个月的咖啡店阅读活动" --for 视频封面

# 展开模板，看完整提示词和验收条件（免费）
node scripts/cli.mjs compose --template T03-1 --var topic=谷雨 --var subject=嫩芽 --var headline=谷雨

# 带模板生成
node scripts/cli.mjs generate --template T03-1 --var topic=谷雨 --var subject=嫩芽 --var headline=谷雨

# 搜本地案例
node scripts/cli.mjs search "节气 茶" --limit 5
```

简易路线（不走方向推荐）：

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

## 内置的设计资料

- **24 类模板、48 个预设**（`references/design-system/`）：巨字与微小叙事、物象破框、中央光隙、东方水墨、纸雕地貌、民艺撞色、童画、花境拼贴、棚拍与环境与婚礼肖像、食品与饮品近摄、植物手绘产品、科技轨道、巨物微缩、建筑制图、框景、文博材质、会议名录、九宫格、演示、科普信息卡、日签。每类带**风格锁**（成图必须满足的关系）、可替换变量、失败条件和验收项。
- **方法**：关系比物品稳定；颜色按角色替换；文字也是形体；材料有位置；一个异常足够；肖像先保身份，信息图先保事实。完整规则见 [agent-guide](references/design-system/agent-guide.md)，人类可读版见 [模板库](references/design-system/template-library.md) 与 [填参示例](references/design-system/filled-examples.md)。
- 模板由归档的 689 条公开记录提炼而来；**提炼的是机制和变量，不是原图的复刻**，没有证明能复现原图。

## 内置风格

- **66 种通用风格**：极简线条、水彩、纸雕、等距、像素、低多边形……见 `references/styles.json`。
- **20 位海报设计师**（Mondo 技巧整合自 [qiaomu-mondo-poster-design](https://github.com/joeseesun/qiaomu-mondo-poster-design)）：Olly Moss、Saul Bass、Martin Ansin、Tyler Stout、Kilian Eng、Drew Struzan 等，另有丝网印刷、负空间、书籍与专辑封面专用风格。怎么选、怎么写，见 [references/mondo-poster.md](references/mondo-poster.md)。

## 本地数据包（可选）

模板库随仓库发布。**689 条原始参考提示词和预览图不在仓库里**：它们来自 [小小东开放提示词](https://vip.xiaoxiaodong.ai/open-source) 的公开区（一个付费提示词库的免费样本），属于第三方内容，没有看到开放授权，所以只做成你本机的数据包，不随仓库分发。

有数据包时：`search_prompts` / `get_prompt` 可检索和读取原文，`suggest_directions` 会附上参考缩略图和相近案例。没有时一切照常，只是少了这部分。

```bash
# 用你自己的归档目录（含 archive.json、prompts/、images/）构建，默认装到 ~/.local/share/qiaomu-codex-imagegen/corpus
node scripts/build-corpus.mjs /path/to/小小东提示词归档
# 或用环境变量 QIAOMU_CORPUS_DIR 指向别处
```

数据包约 12 MB（缩略图 360 px 宽），只在本机使用，请不要提交或转发。

## 它是怎么工作的

和乔木 Agent 的 Obsidian 插件同一思路：启动 `codex app-server --listen stdio://`（标准输入输出上的 JSON-RPC），发起一个回合要求调用图像生成，等 `imageGeneration` 项完成，把 Codex 保存的图片复制到你指定的目录。每次调用启动独立的临时会话，沙箱只允许写输出目录，审批策略为 never，遇到任何交互请求一律拒绝。

## 实测与限制

- **比例**：Codex 会遵守提示词里的比例。实测 3:4 得到 1086×1448，21:9 得到 1916×821；没有指定比例时默认出方图（实测 1254×1254）。工具会读取结果的像素尺寸，与要求不符时在结果里标出。
- **耗时与额度**：单张约 30–60 秒，每张消耗你的 Codex / OpenAI 账号额度。`count` 最多 4，并行运行，成倍消耗。
- **图内文字**：海报、封面、卡片需要文字层次（标题、副标题、信息行、角标），只有标题的图是概念图，不是海报；所以这类用途用 `exact_short`，给一整套短文案（`copy` 用 `｜` 分隔）。模型写中文和长句容易出错：每句要短，生成后逐字检查。肖像、无信息的产品近摄可以不放字。
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
npm test      # 22 项测试：24 模板×48 预设全部可组装、文字模式、结构替换、方向多样性、语料检索、透明压平、协议；用假的 codex，不消耗额度
```

作为乔木 Skill 的发布门禁（`validate_skill.py`、触发评测）见 `reports/`。

零依赖，Node 18+。`scripts/lib/codex.mjs` 是核心，`prompt.mjs` 组装提示词，`tools.mjs` 是 MCP 与命令行共用的工具层。

## 致谢与参考

- Codex 通信方式参考乔木 Agent（Obsidian 插件）对 `codex app-server` 的接入。
- 场景与风格模板库提炼自小小东开放提示词公开区的 689 条记录（https://vip.xiaoxiaodong.ai/open-source），仅整合提炼出的机制与变量。
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
