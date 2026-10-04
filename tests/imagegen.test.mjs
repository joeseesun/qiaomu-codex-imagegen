import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, catalog } from '../scripts/lib/prompt.mjs';
import { imageSize, parseRatio } from '../scripts/lib/codex.mjs';
import { runTool, TOOLS } from '../scripts/lib/tools.mjs';
import { composePrompt, library } from '../scripts/lib/templates.mjs';
import { decodePng, encodePng, flattenAlpha } from '../scripts/lib/png.mjs';
import { suggestDirections } from '../scripts/lib/suggest.mjs';
import { getRecord, resetCorpusCache, searchCorpus } from '../scripts/lib/corpus.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, 'fake-codex.mjs');
chmodSync(FAKE, 0o755); // a fresh checkout may not carry the executable bit
process.env.QIAOMU_CODEX_BIN = FAKE;

test('catalog: every preset points at a real style, ratios parse', () => {
  const { presets, styles } = catalog();
  for (const [key, preset] of Object.entries(presets)) { assert.ok(styles[preset.style], `${key} → ${preset.style}`); assert.ok(parseRatio(preset.aspect_ratio), key); }
  assert.ok(Object.keys(styles).length >= 86);
});

test('buildPrompt: preset adds ratio and safe-area rules, default is text-free', () => {
  const built = buildPrompt({ prompt: '一杯咖啡', preset: 'xiaohongshu' });
  assert.match(built.prompt, /aspect ratio exactly 3:4 \(vertical/); assert.match(built.prompt, /1080×1440/); assert.match(built.prompt, /no text, letters/i);
});

test('buildPrompt: explicit text replaces the no-text rules, ratio override beats the preset', () => {
  const built = buildPrompt({ prompt: 'Dune', preset: 'video-cover', style: 'minimalist-lines', aspectRatio: '9:16', text: ['DUNE'] });
  assert.match(built.prompt, /exactly 9:16/); assert.match(built.prompt, /“DUNE”/); assert.doesNotMatch(built.prompt, /不要任何文字/); assert.doesNotMatch(built.prompt, /about 1920/);
});

test('buildPrompt: wide-only style suffix is dropped for a vertical ratio; unknown style is free text; unknown preset throws', () => {
  const wide = Object.entries(catalog().styles).find(([, s]) => /横向|宽屏|宽度是高度/.test(s.suffix || ''));
  assert.ok(!buildPrompt({ prompt: 'x', style: wide[0], aspectRatio: '3:4' }).prompt.includes(wide[1].suffix));
  assert.ok(buildPrompt({ prompt: 'x', style: 'my own look' }).warnings[0].includes('free-text'));
  assert.throws(() => buildPrompt({ prompt: 'x', preset: 'nope' }), /unknown preset/);
});

test('imageSize reads PNG headers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-')); const p = join(dir, 'a.png');
  await writeFile(p, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
  assert.deepEqual(await imageSize(p), { width: 2, height: 1 });
});

test('generate_image: saves under out_dir, reports size, ratio check, structured content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-'));
  const result = await runTool('generate_image', { prompt: 'a circle', aspect_ratio: '2:1', out_dir: dir, file_name: 'circle' });
  assert.equal(result.isError, undefined); assert.match(result.content[0].text, /circle\.png\s+2×1/); assert.match(result.structuredContent.prompt, /exactly 2:1/); assert.doesNotMatch(result.content[0].text, /ratio differs/);
  assert.deepEqual((await readdir(dir)).sort(), ['circle.json', 'circle.png']);
  const off = await runTool('generate_image', { prompt: 'a circle', aspect_ratio: '3:4', out_dir: dir, file_name: 'off' });
  assert.match(off.content[0].text, /ratio differs/);
});

test('generate_image: count runs variants in parallel with distinct names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-'));
  const result = await runTool('generate_image', { prompt: 'a circle', count: 3, out_dir: dir, file_name: 'v' });
  assert.deepEqual((await readdir(dir)).filter(f => f.endsWith('.png')).sort(), ['v-v1.png', 'v-v2.png', 'v-v3.png']); assert.equal(result.structuredContent.images.length, 3);
});

test('generate_image: reference images are passed as localImage and must exist', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-')); const ref = join(dir, 'ref.png'); await writeFile(ref, 'x');
  const ok = await runTool('generate_image', { prompt: 'edit it', reference_images: [ref], out_dir: dir, file_name: 'e' });
  assert.equal(ok.isError, undefined);
  const bad = await runTool('generate_image', { prompt: 'edit it', reference_images: ['/nope/x.png'], out_dir: dir });
  assert.equal(bad.isError, true); assert.match(bad.content[0].text, /not found/);
});

test('generate_image: a turn without an image becomes a readable error', async () => {
  process.env.FAKE_CODEX_MODE = 'noimage';
  try { const r = await runTool('generate_image', { prompt: 'x', out_dir: await mkdtemp(join(tmpdir(), 'qci-')) }); assert.equal(r.isError, true); assert.match(r.content[0].text, /cannot draw/); }
  finally { delete process.env.FAKE_CODEX_MODE; }
});

test('MCP server speaks the protocol: initialize, tools/list, build_prompt call', async () => {
  const child = spawn('node', [join(here, '..', 'scripts', 'mcp-server.mjs')], { stdio: ['pipe', 'pipe', 'ignore'] });
  const replies = new Map(); let buf = '';
  child.stdout.setEncoding('utf8'); child.stdout.on('data', c => { buf += c; const ls = buf.split('\n'); buf = ls.pop(); for (const l of ls.filter(Boolean)) { const m = JSON.parse(l); replies.set(m.id, m); } });
  const ask = (id, method, params) => { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return new Promise(resolve => { const t = setInterval(() => { if (replies.has(id)) { clearInterval(t); resolve(replies.get(id)); } }, 10); }); };
  try {
    assert.equal((await ask(1, 'initialize', { protocolVersion: '2025-06-18' })).result.serverInfo.name, 'qiaomu-codex-imagegen');
    assert.deepEqual((await ask(2, 'tools/list', {})).result.tools.map(t => t.name), TOOLS.map(t => t.name));
    assert.match((await ask(3, 'tools/call', { name: 'build_prompt', arguments: { prompt: 'x', preset: 'poster' } })).result.content[0].text, /9:16/);
  } finally { child.kill(); }
});

test('CLI: --show-prompt and --list work offline', async () => {
  const run = args => new Promise(resolve => { const c = spawn('node', [join(here, '..', 'scripts', 'cli.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; c.stdout.on('data', d => { o += d; }); c.on('close', code => resolve({ code, o })); });
  const a = await run(['咖啡', '--preset', 'moments', '--show-prompt']); assert.equal(a.code, 0); assert.match(a.o, /4:5/);
  const b = await run(['--list']); assert.equal(b.code, 0); assert.match(b.o, /video-cover/);
});

const FILL = { topic: '社区阅读月', subject: '一名虚构成年读者', data: '仅三项：选摘录、写理解、建连接', headline: '慢读' };

test('templates: all 24 templates x 48 presets compose into clean prompts', () => {
  let presets = 0;
  for (const tpl of library().templates) for (const preset of tpl.presets) {
    presets++; const c = composePrompt({ template_id: tpl.id, preset_id: preset.id, variables: FILL });
    assert.equal(c.ok, true, `${preset.id} ${c.missing_required}`); assert.ok(c.prompt.length > 80, preset.id);
    assert.doesNotMatch(c.prompt, /[{}]/, `${preset.id} leaves a placeholder`); assert.doesNotMatch(c.prompt, /参考图无|依据无|undefined/, preset.id);
    assert.equal(c.settings.ratio, tpl.default_ratio); assert.ok(c.acceptance_checks.length >= 3);
  }
  assert.equal(presets, 48);
});

test('templates: missing identity / product / data inputs block instead of inventing', () => {
  const portrait = composePrompt({ template_id: 'T09', variables: { topic: '创作者' } });
  assert.equal(portrait.ok, false); assert.equal(portrait.prompt, ''); assert.match(portrait.missing_required.join(), /subject/);
  assert.match(composePrompt({ template_id: 'T20', variables: { topic: '峰会', subject: 'x' } }).missing_required.join(), /data/);
  assert.throws(() => composePrompt({ template_id: 'T99' }), /unknown template/); assert.throws(() => composePrompt({ template_id: 'T01', preset_id: 'T01-9' }), /unknown preset/);
});

test('templates: text modes and reference handling', () => {
  const none = composePrompt({ template_id: 'T12', variables: { topic: '可颂', subject: '原味可颂' } });
  assert.equal(none.text_mode, 'none'); assert.match(none.prompt, /完全无文字/); assert.doesNotMatch(none.prompt, /标题[“一]/);
  const exact = composePrompt({ template_id: 'T12', variables: { topic: '可颂', subject: '原味可颂', headline: '新鲜出炉', copy: ['限时 8 折'] } });
  assert.equal(exact.text_mode, 'exact_short'); assert.match(exact.prompt, /“新鲜出炉”/); assert.match(exact.prompt, /“限时 8 折”/); assert.match(exact.prompt, /仅出现提供的文字/);
  const later = composePrompt({ template_id: 'T01', variables: { topic: '赛事' } });
  assert.equal(later.text_mode, 'typeset_later'); assert.ok(later.typographic); assert.match(later.assumptions.join(), /依赖文字形体/);
  assert.match(composePrompt({ template_id: 'T09', variables: { topic: 'a', subject: 'b' } }).prompt, /不对应真实个人/);
  assert.match(composePrompt({ template_id: 'T09', variables: { topic: 'a', subject: 'b', reference: '附图 1（本人正脸）' } }).prompt, /参考图附图 1/);
  assert.equal(composePrompt({ template_id: 'T03-1', variables: { topic: '谷雨' } }).preset_id, 'T03-1');
});

test('templates: structural-override presets must be rewritten before generation', async () => {
  const c = composePrompt({ template_id: 'T09', preset_id: 'T09-2', variables: { topic: '创作者', subject: '一位虚构成年创作者' } });
  assert.equal(c.needs_rewrite, true); assert.match(c.structural_override, /深暗背景/);
  const blocked = await runTool('generate_image', { template_id: 'T09-2', variables: { topic: '创作者', subject: '虚构创作者' }, out_dir: await mkdtemp(join(tmpdir(), 'qci-')) });
  assert.equal(blocked.isError, true); assert.match(blocked.content[0].text, /raw_prompt/);
  const dir = await mkdtemp(join(tmpdir(), 'qci-'));
  const ok = await runTool('generate_image', { raw_prompt: '制作4:5的棚拍肖像。深暗背景……', template_id: 'T09-2', out_dir: dir, file_name: 'p' });
  assert.equal(ok.isError, undefined); assert.equal(JSON.parse(await readFile(join(dir, 'p.json'), 'utf8')).route, 'raw_prompt');
});

test('generate_image via a template writes a reproducible sidecar and lists acceptance checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-'));
  const r = await runTool('generate_image', { template_id: 'T03-1', variables: { topic: '谷雨与新芽', subject: '一枚嫩芽', action: '在通道下端展开', motif: '浅绿', primary: '浅绿', accent: '朱橙', background: '近白', lighting: '柔光' }, out_dir: dir, file_name: 't3' });
  assert.equal(r.isError, undefined); assert.match(r.content[0].text, /Check the image against/); assert.match(r.content[0].text, /中央狭长明亮通道/);
  const side = JSON.parse(await readFile(join(dir, 't3.json'), 'utf8'));
  assert.equal(side.template_id, 'T03'); assert.equal(side.preset_id, 'T03-1'); assert.match(side.prompt, /制作3:4的海报/); assert.match(side.prompt, /避免：/);
  assert.equal((await runTool('generate_image', { template_id: 'T09', variables: { topic: 'x' } })).isError, true);
});

test('suggest_directions: at least four, divergent families, Mondo option, exclude works', () => {
  const r = suggestDirections({ topic: '一个月的咖啡店阅读活动', deliverable: '视频封面' });
  assert.ok(r.directions.length >= 4); assert.ok(new Set(r.directions.map(d => d.family)).size >= 4);
  assert.ok(r.directions.some(d => d.kind === 'mondo')); assert.equal(new Set(r.directions.filter(d => d.kind === 'template').map(d => d.template_id)).size, r.directions.filter(d => d.kind === 'template').length);
  const more = suggestDirections({ topic: '一个月的咖啡店阅读活动', deliverable: '视频封面', exclude: r.directions.map(d => d.template_id).filter(Boolean) });
  assert.ok(more.directions.every(d => !r.directions.some(o => o.template_id && o.template_id === d.template_id)));
  assert.ok(suggestDirections({ topic: '小球员社区足球赛', deliverable: '海报' }).directions.slice(0, 2).some(d => d.template_id === 'T01'));
  assert.ok(suggestDirections({ topic: '新品蓝莓气泡水', deliverable: '电商首屏' }).directions.some(d => d.template_id === 'T13'));
  assert.equal(suggestDirections({ topic: '婚纱工作室主视觉', deliverable: '小红书' }).directions.some(d => d.template_id === 'T11'), true);
  assert.equal(suggestDirections({ topic: '随便', count: 99 }).directions.length <= 9, true);
  assert.throws(() => suggestDirections({ topic: '' }), /topic/);
});

test('corpus: optional local pack is searched, absent pack is reported not faked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-corpus-')); await mkdir(join(dir, 'thumbs'));
  await writeFile(join(dir, 'corpus.json'), JSON.stringify([
    { n: 1, id: 'a', title: '咖啡文化海报', style: '外形剖面网格', channels: ['咖啡'], prompt: '咖啡豆与杯形的剖面', source_url: 'https://example.com/1', thumb: 'thumbs/0001.webp' },
    { n: 2, id: 'b', title: '谷雨新茶', style: '中央光隙', channels: ['谷雨', '茶叶'], prompt: '两侧色域夹出通道', source_url: 'https://example.com/2' }]));
  const before = process.env.QIAOMU_CORPUS_DIR; process.env.QIAOMU_CORPUS_DIR = dir; resetCorpusCache();
  try {
    const hit = searchCorpus('咖啡 海报'); assert.equal(hit.available, true); assert.equal(hit.results[0].n, 1); assert.ok(hit.results[0].image.endsWith('0001.webp'));
    assert.equal(searchCorpus('茶', { channel: '谷雨' }).results[0].n, 2); assert.equal(getRecord(2).style, '中央光隙');
    assert.match((await runTool('get_prompt', { record: 2 })).content[0].text, /两侧色域夹出通道/); assert.equal((await runTool('get_prompt', { record: 99 })).isError, true);
    assert.match((await runTool('suggest_directions', { topic: '咖啡海报' })).content[0].text, /相近案例/);
    process.env.QIAOMU_CORPUS_DIR = join(dir, 'nope'); resetCorpusCache();
    assert.equal(searchCorpus('咖啡').available, false); assert.match((await runTool('search_prompts', { query: '咖啡' })).content[0].text, /No local corpus pack/);
  } finally { if (before === undefined) delete process.env.QIAOMU_CORPUS_DIR; else process.env.QIAOMU_CORPUS_DIR = before; resetCorpusCache(); }
});

test('MCP exposes the direction workflow tools', () => {
  assert.deepEqual(TOOLS.map(t => t.name), ['suggest_directions', 'compose_prompt', 'generate_image', 'search_prompts', 'get_prompt', 'build_prompt', 'list_catalog']);
});

test('png: transparent regions are flattened onto a solid background, opaque files are left alone', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-')); const file = join(dir, 'a.png');
  await writeFile(file, encodePng(2, 1, Buffer.from([255, 0, 0, 255, 0, 0, 0, 0]), 4));
  const r = await flattenAlpha(file, { background: '#ffffff' });
  assert.equal(r.flattened, true); assert.equal(r.transparent, 0.5);
  const out = decodePng(await readFile(file)); assert.equal(out.type, 2); assert.deepEqual([...out.pixels], [255, 0, 0, 255, 255, 255]);
  await writeFile(file, encodePng(2, 1, Buffer.from([255, 0, 0, 255, 0, 0, 255, 255]), 4));
  assert.equal((await flattenAlpha(file)).flattened, false); assert.equal(decodePng(await readFile(file)).type, 6);
  await writeFile(file, encodePng(2, 1, Buffer.from([255, 0, 0, 0, 0, 0, 0, 0]), 4));
  await flattenAlpha(file, { background: '#fff4e0' }); assert.deepEqual([...decodePng(await readFile(file)).pixels].slice(3, 6), [255, 244, 224]);
});

test('generate_image asks for an opaque background and flattens any transparency Codex returns', async () => {
  process.env.FAKE_CODEX_MODE = 'alpha';
  try {
    const dir = await mkdtemp(join(tmpdir(), 'qci-'));
    const r = await runTool('generate_image', { prompt: 'a poster', out_dir: dir, file_name: 'flat' });
    assert.equal(r.isError, undefined); assert.match(r.content[0].text, /flattened onto the background/);
    const side = JSON.parse(await readFile(join(dir, 'flat.json'), 'utf8')); assert.equal(side.flattened_transparency, true); assert.match(side.prompt, /背景不透明/);
    assert.equal(decodePng(await readFile(join(dir, 'flat.png'))).type, 2);
    const keep = await runTool('generate_image', { prompt: 'a sticker', out_dir: dir, file_name: 'sticker', transparent_background: true });
    assert.doesNotMatch(keep.content[0].text, /flattened/); assert.equal(decodePng(await readFile(join(dir, 'sticker.png'))).type, 6);
    assert.doesNotMatch(JSON.parse(await readFile(join(dir, 'sticker.json'), 'utf8')).prompt, /背景不透明/);
  } finally { delete process.env.FAKE_CODEX_MODE; }
});

test('templates: a copy set given as ｜-separated lines becomes an exact whitelist', () => {
  const c = composePrompt({ template_id: 'T06-1', variables: { topic: '社区咖啡市集', subject: '咖啡壶与小鸟', headline: '赶集', copy: '社区咖啡市集｜5月24日—26日 · 老仓库' } });
  assert.equal(c.text_mode, 'exact_short'); assert.match(c.prompt, /“赶集”、“社区咖啡市集”、“5月24日—26日 · 老仓库”/); assert.match(c.prompt, /除这些之外不生成任何其他文字/);
});
