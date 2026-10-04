# Creation handoff: qiaomu-codex-imagegen 0.3.0

## 1. Result

- **qiaomu-codex-imagegen 0.3.0**: lets any agent generate or edit images with Codex's built-in image generation (MCP tools, CLI, skill), with Xiaohongshu / video cover / poster craft built in.
- Local path `/Users/joe/Documents/ChatGPT/qiaomu-codex-imagegen`; publication status: see the final response (published only on explicit request).

## 2. Reference skills studied (source read)

| Reference | Why | Mechanism learned | Where it lands |
| --- | --- | --- | --- |
| qiaomu-agent (Obsidian plugin, local source) | Already drives Codex image generation | `codex app-server` JSON-RPC: `thread/start`, `turn/start`, read `imageGeneration.savedPath` | `scripts/lib/codex.mjs` |
| qiaomu-mondo-poster-design (MIT, same author) | The poster craft the user wants built in | Mondo aesthetic, negative-space techniques, 20 artist styles | `references/mondo-poster.md`, `mondo-artists.json`, `references/mondo/*` |
| qiaomu-image-generator (local skill) | Scenario ratios and 66 style prompts | "one focal point, 2–5 colours, no text by default", style catalog | `references/styles.json`, `presets.json`, `prompt-craft.md` |
| 小小东提示词归档 · 提炼模板 (local pack) | Distilled 24 templates / 48 presets, rules for facts, text, identity, series | style locks, variables, structural overrides, text strategy, acceptance checks | `references/design-system/*`, `scripts/lib/templates.mjs`, `suggest.mjs` |
| lcu MCP (local) | The model for "one registered server, usable everywhere" | single stdio server launched by a small node entry | `scripts/mcp-server.mjs` |

Third-party catalog candidates (frontend-design, taste-skill imagegen-*, xiaohongshu cover skills) were found by the research runner but their sources were **not inspected**; no lessons are claimed from them. See `reports/prior-art-research.md`.

## 3. Absorbed and rejected

- keep: Codex app-server transport; Mondo techniques; style catalog; text-free-by-default rule.
- adapt: Mondo scripts became style keys + prompt assembly; scenario templates became presets with safe areas and a pixel hint; approvals UI became "decline everything" (non-interactive).
- keep (0.3): the full template method; adapt: “prompt only” became suggest ≥4 directions → choose → compose → generate → check; **not redistributed**: the 689 raw prompts and previews (third-party, paid library samples) live in a local-only pack.
- reject: AI-Gateway/API-key generation path; Python generators; interactive question cards; REPL-style tool surface.
- invent: one core shared by MCP, CLI and skill; result-size ratio check; parallel variants; presets for video cover, vertical cover, Moments; fixed the dangling `colorful_sketch` default found in the old config.

## 4. Advantages

| Label | Statement | Evidence |
| --- | --- | --- |
| design advantage | Works from any agent (MCP or plain shell) instead of only inside Codex | package layout |
| validated advantage | Ratio is honoured and reported: 3:4 → 1086×1448, 21:9 → 1916×821; edit with a reference image works (35 s) | real runs on 2026-10-04 |
| validated advantage | 11/11 offline tests (prompt assembly, MCP protocol, parallel variants, failure paths) | `npm test` |
| validated advantage | 11/11 trigger cases | `reports/trigger-eval.json` |
| validated advantage | Template route generates on real Codex: T03-1 “谷雨” produced two large colour fields, a central channel, a tiny sprout at its foot and exactly the two requested characters (1086×1448) | real run 2026-10-04 |
| validated advantage | 22/22 offline tests incl. all 48 presets composing without placeholders, ≥4 divergent families per suggestion, alpha flattening | `npm test` |
| validated advantage | 24 template categories each generated once on real Codex (plus 5 divergent directions for one topic, 4 scenario covers, 1 edit); ratios honoured (3:4 → 1086×1448, 4:5 → 1122×1402, 16:9 → 1672×941, 9:16 → 941×1672, 2.35:1 → 1921×819) | `docs/samples/`, `prompts.json` |
| validated finding | Round 1 of the samples failed the methodology's own check: headline-only / text-free posters read as concept art next to the reference cases, and 6 of 24 PNGs carried transparency that viewers render black. Fixed by requiring a full short-copy layer for poster-type outputs and by an opaque-background instruction plus flattening; all 18 redone images came back opaque | side-by-side sheets against reference thumbnails, 2026-10-04 |
| hypothesis | Presets and Mondo styles make covers and posters better than un-styled prompts | no blind comparison done |

## 5. Verification and limits

- Package validation, trigger eval, offline tests: see reports.
- Real Codex runs: text-to-image (44 s), edit (35 s), 3:4 and 21:9 ratio probes. Not run: MCP `include_image`, `count` > 1 against real Codex, Windows/Linux.
- missing evidence: one preset per template (24 of 48) has been generated on real Codex; the second presets compose cleanly but are `prompt_review_only` until generated; small-print text lines in the samples were not all checked character by character; image quality comparison, third-party skill sources, other Codex versions (tested with codex-cli 0.157.1).
- Excluded deliberately: API-key image services, video generation, editing with local photo tools.
