#!/usr/bin/env node
// Command line for agents (or people) without MCP. Same tools, same options.
import { parseArgs } from 'node:util';
import { runTool } from './lib/tools.mjs';

const HELP = `qiaomu-codex-imagegen <command> …

  suggest "<topic>" [--for <deliverable>] [--text-mode none|exact_short|typeset_later] [--headline <t>] [--count 4-8] [--exclude T01,T02]
        ≥4 divergent style directions (templates + a Mondo option). Run this first, let the user choose.
  compose --template T03-1 --var topic=谷雨 --var subject=嫩芽 … [--text-mode …] [--ratio 3:4]
        expand a template into the final prompt, avoid list and acceptance checks (no image, no quota)
  generate "<description>" [--preset xiaohongshu] [--style olly-moss] [--ratio 3:4] [--text "标题"]      simple scenario route
  generate --template T03-1 --var … | --raw-prompt "<finished prompt>"                                   template route / verbatim prompt
        shared: --ref <abs path> (repeatable)  --count 1-4  --out <dir>  --name <file>  --model <id>  --timeout <s>  --json
  search "<query>" [--channel 咖啡] [--limit 8]      search the local corpus pack of reference prompts
  prompt <record>                                   full original prompt + preview path of one record
  show "<description>" --preset … --style …         print the simple-route prompt only
  list                                              presets, templates, styles, corpus status

Bare "<description>" with options is the same as "generate". Needs the Codex CLI (logged in) for generate.`;

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  preset: { type: 'string' }, style: { type: 'string' }, ratio: { type: 'string' }, text: { type: 'string', multiple: true }, ref: { type: 'string', multiple: true },
  template: { type: 'string' }, 'preset-id': { type: 'string' }, var: { type: 'string', multiple: true }, 'text-mode': { type: 'string' }, 'raw-prompt': { type: 'string' },
  for: { type: 'string' }, headline: { type: 'string' }, exclude: { type: 'string' }, channel: { type: 'string' }, limit: { type: 'string' },
  count: { type: 'string' }, out: { type: 'string' }, name: { type: 'string' }, model: { type: 'string' }, timeout: { type: 'string' },
  'show-prompt': { type: 'boolean' }, list: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} });
if (values.help) { console.log(HELP); process.exit(0); }
const out = result => { if (values.json) console.log(JSON.stringify(result.structuredContent ?? result, null, 2)); else console.log(result.content.filter(c => c.type === 'text').map(c => c.text).join('\n')); process.exit(result.isError ? 1 : 0); };
const COMMANDS = new Set(['suggest', 'compose', 'generate', 'search', 'prompt', 'show', 'list']);
let [command, ...rest] = positionals;
if (values.list) command = 'list';
else if (!COMMANDS.has(command)) { rest = positionals; command = 'generate'; } // legacy: bare description generates
const words = rest.join(' ').trim();
const variables = Object.fromEntries((values.var || []).map(v => { const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)]; }));

if (command === 'list') out(await runTool('list_catalog'));
if (command === 'suggest') { if (!words) { console.error(HELP); process.exit(2); } out(await runTool('suggest_directions', { topic: words, deliverable: values.for, headline: values.headline, text_mode: values['text-mode'], ratio: values.ratio, count: values.count && Number(values.count), exclude: values.exclude?.split(',').map(s => s.trim()).filter(Boolean) })); }
if (command === 'compose') { if (!values.template) { console.error('compose needs --template T01-1'); process.exit(2); } out(await runTool('compose_prompt', { template_id: values.template, preset_id: values['preset-id'], variables, text_mode: values['text-mode'], ratio: values.ratio })); }
if (command === 'search') { if (!words) { console.error(HELP); process.exit(2); } out(await runTool('search_prompts', { query: words, channel: values.channel, limit: values.limit && Number(values.limit) })); }
if (command === 'prompt') { if (!words) { console.error(HELP); process.exit(2); } out(await runTool('get_prompt', { record: Number(words) })); }
if (command === 'show' || values['show-prompt']) { if (!words) { console.error(HELP); process.exit(2); } out(await runTool('build_prompt', { prompt: words, preset: values.preset, style: values.style, aspect_ratio: values.ratio, text: values.text })); }
if (!words && !values.template && !values['raw-prompt']) { console.error(HELP); process.exit(2); }
out(await runTool('generate_image', {
  prompt: words || undefined, preset: values.preset, style: values.style, aspect_ratio: values.ratio, text: values.text, reference_images: values.ref,
  template_id: values.template, preset_id: values['preset-id'], variables: values.template ? variables : undefined, text_mode: values['text-mode'], raw_prompt: values['raw-prompt'],
  count: values.count && Number(values.count), out_dir: values.out, file_name: values.name, model: values.model, timeout_seconds: values.timeout && Number(values.timeout),
}, message => console.error(`… ${message}`)));
