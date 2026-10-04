#!/usr/bin/env node
// Command line: for agents (or people) without MCP. Same tools, same options.
import { parseArgs } from 'node:util';
import { runTool } from './lib/tools.mjs';

const HELP = `qiaomu-codex-imagegen <prompt> [options]       generate an image with Codex's built-in image generation
  --preset <key>        scenario: xiaohongshu, video-cover, video-vertical, poster, wechat-cover, book-cover, album-cover …
  --style <key|text>    style key (66 styles + 20 Mondo artists) or free text
  --ratio <W:H>         override the ratio, e.g. 3:4, 16:9, 2.35:1
  --text <string>       exact text to render (repeatable); omit for a text-free image
  --ref <path>          reference / source image, absolute path (repeatable)
  --count <1-4>         variants in parallel          --out <dir>   --name <file>   --model <id>   --timeout <seconds>
  --show-prompt         print the final prompt and stop (free, no generation)
  --list                list presets and styles
  --json                machine-readable result
Requires the Codex CLI (logged in). Output: absolute path(s) and pixel size.`;

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  preset: { type: 'string' }, style: { type: 'string' }, ratio: { type: 'string' }, text: { type: 'string', multiple: true }, ref: { type: 'string', multiple: true },
  count: { type: 'string' }, out: { type: 'string' }, name: { type: 'string' }, model: { type: 'string' }, timeout: { type: 'string' },
  'show-prompt': { type: 'boolean' }, list: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} });
if (values.help) { console.log(HELP); process.exit(0); }
const out = result => { if (values.json) console.log(JSON.stringify(result.structuredContent ?? result, null, 2)); else console.log(result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')); process.exit(result.isError ? 1 : 0); };
if (values.list) out(await runTool('list_catalog'));
const prompt = positionals.join(' ').trim();
if (!prompt) { console.error(HELP); process.exit(2); }
const args = { prompt, preset: values.preset, style: values.style, aspect_ratio: values.ratio, text: values.text, reference_images: values.ref, count: values.count && Number(values.count), out_dir: values.out, file_name: values.name, model: values.model, timeout_seconds: values.timeout && Number(values.timeout) };
if (values['show-prompt']) out(await runTool('build_prompt', args));
out(await runTool('generate_image', args, message => console.error(`… ${message}`)));
