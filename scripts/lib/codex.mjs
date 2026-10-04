// Core: run one image generation through `codex app-server` (JSON-RPC over stdio).
// Same mechanism as the Qiaomu Agent Obsidian plugin: start a turn, read the `imageGeneration` item's saved file.
import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { flattenAlpha } from './png.mjs';

export const CLIENT = { name: 'qiaomu_codex_imagegen', title: 'Qiaomu Codex ImageGen', version: '0.3.0' };
export const DEFAULT_TIMEOUT_S = 600;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
export const mimeOf = path => MIME[extname(path).toLowerCase()] || 'image/png';
const exists = p => access(p).then(() => true, () => false);

export const defaultOutDir = () => join(homedir(), 'Pictures', 'qiaomu-codex-imagegen', new Date().toISOString().slice(0, 10));
export const expandHome = p => String(p).replace(/^~(?=\/|$)/, homedir());

// Minimal JSON-RPC client for `codex app-server` (newline-delimited JSON, no "jsonrpc" field).
class CodexProcess {
  constructor(bin, args, cwd) {
    this.child = spawn(bin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    this.nextId = 1; this.pending = new Map(); this.buffer = ''; this.stderr = ''; this.closed = false;
    this.onNotification = () => {}; this.onClose = () => {};
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk; const lines = this.buffer.split(/\r?\n/); this.buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) this.handle(line);
    });
    this.child.stderr.on('data', c => { this.stderr = (this.stderr + c).slice(-8000); });
    this.child.on('error', e => this.fail(new Error(`cannot start codex (${bin}): ${e.message}. Install the Codex CLI or set QIAOMU_CODEX_BIN.`)));
    this.child.on('exit', (code, sig) => this.fail(new Error(`codex exited (${sig || code})${this.stderr ? ': ' + this.stderr.trim().slice(-500) : ''}`)));
  }
  fail(error) { this.closed = true; for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error); } this.pending.clear(); this.onClose(error); }
  write(message) { if (!this.closed) this.child.stdin.write(JSON.stringify(message) + '\n'); }
  handle(line) {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error) && !msg.method) {
      const p = this.pending.get(msg.id); if (!p) return; this.pending.delete(msg.id); clearTimeout(p.timer);
      msg.error ? p.reject(new Error(msg.error.message || 'codex request failed')) : p.resolve(msg.result); return;
    }
    if (msg.method && msg.id !== undefined) { // approvals / questions: this tool is non-interactive, so decline.
      this.write({ id: msg.id, error: { code: -32601, message: 'not supported (non-interactive image generation)' } }); return;
    }
    if (msg.method) this.onNotification(msg.method, msg.params);
  }
  request(method, params = {}, ms = 30000) {
    if (this.closed) return Promise.reject(new Error('codex is not running'));
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, ms);
      this.pending.set(id, { resolve: resolvePromise, reject, timer }); this.write({ id, method, params });
    });
  }
  notify(method, params = {}) { this.write({ method, params }); }
  stop() { this.closed = true; try { this.child.kill('SIGTERM'); } catch { /* gone */ } setTimeout(() => { try { this.child.kill('SIGKILL'); } catch { /* gone */ } }, 2000).unref(); }
}

const RELAY = 'You are an image-generation relay. Call the built-in image generation tool exactly once for the user\'s request, then reply with one short sentence. Do not run shell commands, write code, browse, or ask questions.';

// One generation. Returns [{ path, size, revisedPrompt }]. `prompt` is final text (see prompt.mjs for building it).
export async function generateOne({ prompt, referenceImages = [], outDir, baseName, model, timeoutSeconds, progress, codexBin }) {
  const text = (referenceImages.length ? 'The attached image(s) are references: use them as the style reference or as the image to edit, as the prompt says.\n\n' : '') + 'Generate this image:\n' + prompt;
  const timeoutMs = Math.max(30, Number(timeoutSeconds) || DEFAULT_TIMEOUT_S) * 1000;
  const codex = new CodexProcess(codexBin || process.env.QIAOMU_CODEX_BIN || 'codex', ['app-server', '--listen', 'stdio://'], outDir);
  const images = []; let agentText = '', turn = null, failure = null;
  let finish; const done = new Promise((resolvePromise, reject) => { finish = resolvePromise; codex.onClose = reject; });
  codex.onNotification = (method, params) => {
    if (method === 'item/completed') {
      const item = params?.item || {};
      if (item.type === 'imageGeneration') { images.push(item); progress?.(`image ${item.status || 'done'}`); }
      else if (item.type === 'agentMessage' && typeof item.text === 'string') agentText = item.text;
    } else if (method === 'item/started' && params?.item?.type === 'imageGeneration') progress?.('generating image…');
    else if (method === 'turn/completed') { turn = params?.turn || {}; finish(); }
    else if (method === 'error' && params?.error) failure = params.error.message || JSON.stringify(params.error);
  };
  const timer = setTimeout(() => finish('timeout'), timeoutMs);
  try {
    await codex.request('initialize', { clientInfo: CLIENT }, 20000);
    codex.notify('initialized', {});
    const thread = await codex.request('thread/start', {
      cwd: outDir, approvalPolicy: 'never', sandbox: 'workspace-write', ephemeral: true, serviceName: 'qiaomu_codex_imagegen',
      ...(model ? { model } : {}), developerInstructions: RELAY,
    }, 30000);
    const threadId = thread?.thread?.id; if (!threadId) throw new Error('codex did not return a thread id');
    progress?.('asking codex…');
    await codex.request('turn/start', {
      threadId, cwd: outDir, approvalPolicy: 'never', sandboxPolicy: { type: 'workspaceWrite', writableRoots: [outDir], networkAccess: false },
      ...(model ? { model } : {}),
      input: [{ type: 'text', text, text_elements: [] }, ...referenceImages.map(path => ({ type: 'localImage', path }))],
    }, 30000);
    if ((await done) === 'timeout') throw new Error(`timed out after ${timeoutMs / 1000}s without a finished image`);
  } finally { clearTimeout(timer); codex.stop(); }

  const saved = [];
  for (const [index, item] of images.entries()) {
    if (item.failure) throw new Error('image generation failed: ' + (item.failure.message || JSON.stringify(item.failure)));
    const suffix = images.length > 1 ? `-${index + 1}` : '';
    let source = typeof item.savedPath === 'string' ? item.savedPath.replace(/^file:\/\//, '') : '';
    try { source = decodeURIComponent(source); } catch { /* keep as given */ }
    const ext = (source && extname(source).toLowerCase()) || '.png';
    const target = join(outDir, `${baseName}${suffix}${MIME[ext] ? ext : '.png'}`);
    if (source && (await exists(source))) await copyFile(source, target);
    else if (typeof item.result === 'string' && item.result) await writeFile(target, Buffer.from(item.result.replace(/^data:[^;]+;base64,/, ''), 'base64'));
    else continue;
    saved.push({ path: target, size: (await stat(target)).size, revisedPrompt: item.revisedPrompt || undefined });
  }
  if (!saved.length) throw new Error(failure || (turn?.status && turn.status !== 'completed' ? `turn ${turn.status}` : '') || agentText || 'codex finished without producing an image (image generation may be unavailable for this account or model)');
  return saved;
}

// Dimensions straight from the file header (PNG / JPEG / WebP), so callers can confirm the ratio without extra tools.
export async function imageSize(path) {
  const b = await readFile(path);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) { let o = 2; while (o + 9 < b.length) { if (b[o] !== 0xff) { o++; continue; } const m = b[o + 1]; if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: b.readUInt16BE(o + 5), width: b.readUInt16BE(o + 7) }; o += 2 + b.readUInt16BE(o + 2); } }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (k === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (k === 'VP8L') { const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
  }
  return undefined;
}

const parseRatio = r => { const m = String(r || '').match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/i); return m ? Number(m[1]) / Number(m[2]) : undefined; };
export { parseRatio };

// Full request: resolves paths, runs `count` generations in parallel, reports sizes and whether the ratio was honoured.
export async function generate(options) {
  const { finalPrompt, referenceImages = [], outDir: rawOut, fileName, count = 1, aspectRatio } = options;
  if (!String(finalPrompt || '').trim()) throw new Error('prompt is required');
  for (const ref of referenceImages) if (!ref.startsWith('/') || !(await exists(ref))) throw new Error(`reference image not found (use an absolute path): ${ref}`);
  const outDir = resolve(expandHome(rawOut || defaultOutDir()));
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const baseName = String(fileName || `image-${stamp}`).replace(/[^\w.\-一-龥]+/g, '_').replace(/\.(png|jpe?g|webp)$/i, '');
  const n = Math.min(4, Math.max(1, Math.floor(Number(count)) || 1));
  const runs = await Promise.allSettled(Array.from({ length: n }, (_, i) => generateOne({
    prompt: finalPrompt, referenceImages, outDir, baseName: n > 1 ? `${baseName}-v${i + 1}` : baseName, model: options.model, timeoutSeconds: options.timeoutSeconds,
    progress: options.progress && (m => options.progress(n > 1 ? `v${i + 1}: ${m}` : m)), codexBin: options.codexBin,
  })));
  const images = runs.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  if (!images.length) throw (runs[0].reason instanceof Error ? runs[0].reason : new Error(String(runs[0].reason)));
  const want = parseRatio(aspectRatio);
  for (const image of images) {
    image.size = image.size; image.dimensions = await imageSize(image.path).catch(() => undefined);
    if (want && image.dimensions) { const got = image.dimensions.width / image.dimensions.height; image.ratioOk = Math.abs(got - want) / want < 0.06; }
  }
  // A poster must be opaque: Codex sometimes returns transparent regions, which viewers show as black or checkerboard.
  if (options.transparentBackground !== true) for (const image of images) { const r = await flattenAlpha(image.path, { background: options.background || '#ffffff' }).catch(() => ({ flattened: false })); if (r.flattened) { image.flattened = true; image.transparent = r.transparent; image.size = (await stat(image.path)).size; } }
  const failures = runs.filter(r => r.status === 'rejected').map(r => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
  return { images, failures, outDir };
}
