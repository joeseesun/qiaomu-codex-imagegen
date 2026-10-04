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
- **qiaomu-mondo-poster-design** (MIT, same author): Mondo aesthetic, negative-space techniques, 20 artist styles, patterns. **Adopted**: techniques and artist styles as references and style keys. **Rejected**: its Python generator scripts and AI-Gateway API path (needs keys; replaced by Codex).
- **qiaomu-image-generator** (local skill): scenario ratios, 66 style prompts, "one symbol, 2–5 colours, no text by default" decisions. **Adopted**: `styles.json` and the visual decisions. **Fixed**: its `colorful_sketch` default style does not exist in its own `styles.json`; presets here use `airy-illustration`.

## Original contributions

- Agent-agnostic delivery: MCP server, CLI and skill from one core.
- Preset layer that turns a platform (Xiaohongshu, video cover, vertical cover, Moments …) into ratio, pixel hint and safe-area rules, verified by reading the pixel size of the result.
- Ratio check on every output; parallel variants (`count`); reference-image editing through `localImage`.

## Missing evidence

- Source of the shortlisted third-party skills was not reviewed; no claim of superiority over them.
- No user ratings or blind review of image quality.
