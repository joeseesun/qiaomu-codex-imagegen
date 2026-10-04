# Prior-art research (2026-10-04)

Runner: `research_prior_art.py --strict --summary`, queries: `codex image generation mcp`, `ai poster design prompt skill`, `xiaohongshu cover image generation`. Both catalogs answered (skills.sh and SkillsMP), 75 candidate families after de-duplication. Raw output: `prior-art-candidates.json`.

Metric semantics: skills.sh installs are ecosystem telemetry, not ratings or correctness. SkillsMP numbers are repository stars. They are not added together.

## Shortlist by installs (skills.sh), source not inspected unless stated

| Candidate | Installs | Relevance | Inspected |
| --- | ---: | --- | --- |
| anthropics/skills · frontend-design | 951.6K | design guidance for UI, not raster image generation | no |
| heygen-com/hyperframes · media-use | 659.4K | resolves BGM/SFX/image/voice assets for video projects | no (installed locally, not read for this task) |
| leonxlnx/taste-skill · imagegen-frontend-web / -mobile | 334.2K / 328.3K | image generation for front-end design references | no |
| msw-git/msw-ai-coding-plugins-official · msw-painter | 8.2K | image generation inside a game-dev plugin | no |
| freestylefly/xiaohongshu-skills · xiaohongshu-cover-generator | 1.9K | Xiaohongshu cover generation, closest in scenario | no (source path lookup failed) |
| cclank/xhs-cover-skill, ziguishian/xhs-visual-director-skill | 105 / 102 | Xiaohongshu covers | no |

No candidate found that exposes **Codex's built-in image generation** to other agents through MCP and CLI together; the nearest hits are scenario skills that assume the agent can already generate images.

## Studied in depth (source read)

- **qiaomu-agent** (Obsidian plugin, `src/services/native-agent-backend.ts`, `json-rpc-process.ts`): talks to `codex app-server --listen stdio://`, runs `thread/start` + `turn/start`, reads the `imageGeneration` item (`savedPath` / base64 `result`). **Adopted**: the whole transport. **Rejected**: its approval and question UI (this tool is non-interactive and declines requests).
- **lcu MCP** (local): one tool surface plus a persistent runtime, launched by a small node adapter. **Adopted**: single zero-config stdio server registered once, usable from any session. **Rejected**: a REPL surface; image generation needs three typed tools instead.
- **小小东提示词归档 · 提炼模板**（本地资料包，2026-10-04，源码与文档已通读）：689 条公开区记录、24 类模板、48 个预设、Agent 使用说明、填参示例。**Adopted**: 全部方法与模板（风格锁、变量约定、文字策略、事实约束、系列化、验收），作为 `references/design-system/` 与 `templates.mjs` 的数据和规则。**Adapted**: 把“只写提示词”改成“先给 ≥4 个方向，选定后展开并生成”；增加路由表（家族、关键词）实现方向的多样化。**Not redistributed**: 689 条原始提示词与预览图（来源是付费提示词库的公开样本，未见开放授权），只做本机数据包。
- **qiaomu-mondo-poster-design** (MIT, same author): Mondo aesthetic, negative-space techniques, 20 artist styles, patterns. **Adopted**: techniques and artist styles as references and style keys. **Rejected**: its Python generator scripts and AI-Gateway API path (needs keys; replaced by Codex).
- **qiaomu-image-generator** (local skill): scenario ratios, 66 style prompts, "one symbol, 2–5 colours, no text by default" decisions. **Adopted**: `styles.json` and the visual decisions. **Fixed**: its `colorful_sketch` default style does not exist in its own `styles.json`; presets here use `airy-illustration`.

## Original contributions

- Direction suggestion: ranks the 24 templates for a request and picks a spread across five mechanism families (≥4 directions, plus a Mondo option for poster-like work), instead of returning the single best match.
- Template composition that drops clauses about non-existent text, handles missing reference images without promising identity, blocks on missing identity/product/data, and refuses to send structural-override presets unrewritten.
- Local-only corpus pack with search, so the 689 cases are usable by any agent on the user's machine without being republished.

- Agent-agnostic delivery: MCP server, CLI and skill from one core.
- Preset layer that turns a platform (Xiaohongshu, video cover, vertical cover, Moments …) into ratio, pixel hint and safe-area rules, verified by reading the pixel size of the result.
- Ratio check on every output; parallel variants (`count`); reference-image editing through `localImage`.

## Missing evidence

- Source of the shortlisted third-party skills was not reviewed; no claim of superiority over them.
- No user ratings or blind review of image quality.
