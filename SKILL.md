---
name: qiaomu-codex-imagegen
description: |
  Generate or edit images with Codex's built-in image generation from any agent, through an MCP tool or a plain CLI, with Qiaomu poster / video cover / Xiaohongshu prompt craft built in. Use for 生图, 配图, 海报, 视频海报, 视频封面, 小红书配图, 公众号封面, X 封面, 朋友圈海报, 书籍封面, 专辑封面, Mondo 风格, 图生图 and "用 Codex 画一张". Picks the scenario ratio and safe areas, a style from 86 bundled styles (66 general + 20 Mondo poster artists), writes the prompt, calls Codex, and returns the saved file path and pixel size. Excludes: editing photos with local tools, charts or diagrams from data, UI mockups, video generation, or anything that needs an API key-based image service.
license: MIT
metadata:
  version: 0.2.0
  author: 向阳乔木 (https://x.com/vista8)
---

# Qiaomu Codex ImageGen

Codex ships an image generator that other agents cannot call. This package relays to it (`codex app-server`) and adds the craft that makes the pictures usable: scenario presets, a style catalog, and Mondo poster techniques.

## Choose how to call it

1. **MCP tool present** (`generate_image`, `build_prompt`, `list_catalog`; in Claude Code they appear as `mcp__qiaomu-codex-imagegen__*`): use it.
2. **No MCP**: run the CLI from this skill's folder, same options:
   `node scripts/cli.mjs "<description>" --preset xiaohongshu --style airy-illustration --out <dir>`
3. Neither available: tell the user to install (see README: `claude mcp add …`). Requires the Codex CLI, logged in. Never fake an image with code.

## Workflow

1. **Scenario → preset.** Map the request with [references/scenarios.md](references/scenarios.md): 小红书 `xiaohongshu` (3:4), 视频封面 `video-cover` (16:9), 竖屏封面/海报 `video-vertical` (9:16), 公众号 `wechat-cover` (2.35:1), `x-cover`, `moments`, `poster`, `movie-poster`, `book-cover`, `album-cover`, `article`. The user's own ratio, size or style always wins.
2. **Style.** Posters, covers and anything that must look designed: read [references/mondo-poster.md](references/mondo-poster.md) and pick an artist key (olly-moss, saul-bass …) or `mondo-screenprint`. Other content: pick from `list_catalog` (66 styles). One style per image; do not stack.
3. **Description = content only.** One subject, one focal point, mood, composition (see [references/prompt-craft.md](references/prompt-craft.md)). Style and format go in `style` / `preset`, not in the description.
4. **Text.** Default is no text in the image. If a title is required, pass it in `text` (short, ≤ 8 characters, exact) and warn that image models can misspell it; otherwise leave room and add the title with a layout tool afterwards.
5. **Review first when it matters.** `build_prompt` shows the final prompt without spending quota; use it when the user wants to edit wording.
6. **Generate.** `generate_image` with `preset`, `style`, `prompt`, optional `reference_images` (absolute paths: style reference or the image to edit), `count` 2–3 when the user wants options, `out_dir` inside the user's project when they name one. Takes 30–180 s; say so before waiting.
7. **Check and report.** Read the returned path(s) and look at the image. Confirm the pixel size matches the preset (the tool flags a ratio mismatch). Give the user the absolute paths, not a description of what you meant to draw. If wrong, change the description or style once and regenerate; do not loop silently.

## Rules

- Each call spends the user's Codex image quota. No test generations, no `count` above 3 unless asked.
- Series (a set of Xiaohongshu cards, a campaign): generate the first, then pass it as `reference_images` for the rest so style stays consistent.
- Edit an existing image: pass it in `reference_images` and say what to keep ("keep the same pencil, change the background").
- People: prefer silhouettes, back views, hands or symbols unless the user asks for a face. Never use real people's likeness for deceptive material.
- Save location default: `~/Pictures/qiaomu-codex-imagegen/<date>`.

## Output contract

Reply with: the absolute file path(s), pixel size, preset and style used, and the revised prompt when the tool returns one. If generation failed, give the tool's error verbatim and the one fix to try (login to Codex, shorten the prompt, check the reference path).

## Resources

- [Scenarios and recipes](references/scenarios.md): ratios, safe areas, example commands for each platform
- [Prompt craft](references/prompt-craft.md): how to write the description, text policy, iteration
- [Mondo poster craft](references/mondo-poster.md) and [artist styles](references/mondo/artist-styles.md), [composition](references/mondo/composition-patterns.md), [genres](references/mondo/genre-templates.md), [book covers](references/mondo/book-covers.md)
- `references/styles.json`: 66 general styles; `references/mondo-artists.json`: 20 poster artists; `references/presets.json`: scenario presets

Copyright (c) 向阳乔木. X https://x.com/vista8, GitHub https://github.com/joeseesun/. Mondo material adapted from [qiaomu-mondo-poster-design](https://github.com/joeseesun/qiaomu-mondo-poster-design) (MIT).
