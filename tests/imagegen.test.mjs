import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync } from 'node:fs';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompt, catalog } from '../scripts/lib/prompt.mjs';
import { imageSize, parseRatio } from '../scripts/lib/codex.mjs';
import { runTool, TOOLS } from '../scripts/lib/tools.mjs';

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
  assert.deepEqual(await readdir(dir), ['circle.png']);
  const off = await runTool('generate_image', { prompt: 'a circle', aspect_ratio: '3:4', out_dir: dir, file_name: 'off' });
  assert.match(off.content[0].text, /ratio differs/);
});

test('generate_image: count runs variants in parallel with distinct names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qci-'));
  const result = await runTool('generate_image', { prompt: 'a circle', count: 3, out_dir: dir, file_name: 'v' });
  assert.deepEqual((await readdir(dir)).sort(), ['v-v1.png', 'v-v2.png', 'v-v3.png']); assert.equal(result.structuredContent.images.length, 3);
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
