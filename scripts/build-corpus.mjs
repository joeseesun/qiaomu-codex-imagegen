#!/usr/bin/env node
// Build the local corpus pack from a 小小东 archive folder (archive.json + prompts/ + images/).
//   node scripts/build-corpus.mjs <archive-dir> [--out <dir>] [--width 360]
// Output (default ~/.local/share/qiaomu-codex-imagegen/corpus): corpus.json + thumbs/NNNN.webp (+ contact sheet).
// The pack stays on your machine: it holds third-party prompts and previews and is not part of this repository.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, width: { type: 'string' } } });
const src = positionals[0] && resolve(positionals[0]);
if (!src || !existsSync(join(src, 'archive.json'))) { console.error('usage: build-corpus.mjs <archive-dir containing archive.json> [--out dir] [--width 360]'); process.exit(2); }
const out = resolve(values.out || process.env.QIAOMU_CORPUS_DIR || join(homedir(), '.local', 'share', 'qiaomu-codex-imagegen', 'corpus'));
const width = Number(values.width) || 360;
mkdirSync(join(out, 'thumbs'), { recursive: true });

const archive = JSON.parse(readFileSync(join(src, 'archive.json'), 'utf8'));
const cwebp = spawnSync('cwebp', ['-version']).status === 0;
const sips = process.platform === 'darwin';
let thumbs = 0, withoutImage = 0;
const promptOf = file => { const t = readFileSync(join(src, file), 'utf8'); const i = t.indexOf('## 提示词'); return (i >= 0 ? t.slice(i + '## 提示词'.length) : t).trim(); };

const records = archive.map(a => {
  const n = Number(basename(a.localPrompt || a.localImage || '').match(/^(\d+)/)?.[1]);
  const prompt = a.localPrompt && existsSync(join(src, a.localPrompt)) ? promptOf(a.localPrompt) : String(a.prompt || '');
  let thumb;
  const image = a.localImage && join(src, a.localImage);
  if (image && existsSync(image)) {
    const name = `thumbs/${String(n).padStart(4, '0')}.webp`, target = join(out, name);
    if (!existsSync(target)) {
      let ok = false;
      if (cwebp) ok = spawnSync('cwebp', ['-quiet', '-q', '70', '-resize', String(width), '0', image, '-o', target]).status === 0;
      if (!ok && sips) { const jpg = target.replace(/\.webp$/, '.jpg'); ok = spawnSync('sips', ['-s', 'format', 'jpeg', '--resampleWidth', String(width), image, '--out', jpg], { stdio: 'ignore' }).status === 0; if (ok) { thumb = name.replace(/\.webp$/, '.jpg'); thumbs++; } }
      if (ok && !thumb) { thumb = name; thumbs++; }
    } else { thumb = name; thumbs++; }
  } else withoutImage++;
  return { n, id: a.promptId, title: a.promptTitle, style: a.styleName, channels: (a.labels || a.channels || []).map(x => x.name).filter(Boolean), prompt, source_url: a.source, thumb };
}).filter(r => r.n && r.prompt);

writeFileSync(join(out, 'corpus.json'), JSON.stringify(records));
const sheet = join(src, '代表样本联系表.jpg'); if (existsSync(sheet)) copyFileSync(sheet, join(out, 'contact-sheet.jpg'));
writeFileSync(join(out, 'README.txt'), `Local prompt corpus for qiaomu-codex-imagegen.\nBuilt ${new Date().toISOString()} from ${src}\nRecords: ${records.length}. Source: https://vip.xiaoxiaodong.ai/open-source (public-area samples of a paid prompt library; previews are not original images).\nThird-party content for personal reference on this machine. Do not commit or redistribute.\n`);
const bytes = readdirSync(join(out, 'thumbs')).reduce((sum, f) => sum + statSync(join(out, 'thumbs', f)).size, 0);
console.log(JSON.stringify({ out, records: records.length, thumbs, withoutImage, thumbMB: Math.round(bytes / 1e5) / 10, encoder: cwebp ? 'cwebp' : sips ? 'sips(jpeg)' : 'none' }));
