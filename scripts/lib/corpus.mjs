// Local prompt corpus (optional data pack). The pack is built on the user's machine from their own archive
// (scripts/build-corpus.mjs) and is never shipped with this repository.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const corpusDir = () => process.env.QIAOMU_CORPUS_DIR || join(homedir(), '.local', 'share', 'qiaomu-codex-imagegen', 'corpus');
let loaded;
export function resetCorpusCache() { loaded = undefined; }

export function loadCorpus() {
  const dir = corpusDir();
  if (loaded?.dir === dir) return loaded;
  const file = join(dir, 'corpus.json');
  if (!existsSync(file)) { loaded = { dir, records: [], available: false }; return loaded; }
  const records = JSON.parse(readFileSync(file, 'utf8'));
  const docs = records.map(r => ({ r, headline: `${r.title} ${r.style} ${(r.channels || []).join(' ')}`.toLowerCase(), full: String(r.prompt || '').toLowerCase(), title: tokens(r.title), style: tokens(r.style), channels: tokens((r.channels || []).join(' ')), body: tokens(r.prompt) }));
  const df = new Map();
  for (const d of docs) for (const t of new Set([...d.title, ...d.style, ...d.channels, ...d.body])) df.set(t, (df.get(t) || 0) + 1);
  loaded = { dir, records, docs, df, available: true, byN: new Map(records.map(r => [r.n, r])) };
  return loaded;
}

// CJK bigrams plus latin words, lower-cased.
export function tokens(text) {
  const out = []; const s = String(text || '').toLowerCase();
  for (const word of s.match(/[a-z0-9]+/g) || []) out.push(word);
  for (const run of s.match(/[一-鿿]+/g) || []) { if (run.length === 1) out.push(run); for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2)); }
  return out;
}

export function searchCorpus(query, { limit = 8, channel } = {}) {
  const c = loadCorpus(); if (!c.available) return { available: false, results: [] };
  const q = [...new Set(tokens(query))]; if (!q.length) return { available: true, results: [] };
  const N = c.records.length; const scored = [];
  for (const d of c.docs) {
    if (channel && !(d.r.channels || []).some(x => x.includes(channel))) continue;
    let score = 0;
    for (const t of q) {
      const idf = Math.log(1 + N / (1 + (c.df.get(t) || 0)));
      // A single Chinese character (e.g. 茶) has no bigram: match it as a substring instead.
      if (t.length === 1 && /[\u4e00-\u9fff]/.test(t)) { score += idf * ((d.headline.includes(t) ? 3 : 0) + (d.full.includes(t) ? 1 : 0)); continue; }
      const inTitle = d.title.includes(t) ? 3 : 0, inStyle = d.style.includes(t) ? 3 : 0, inChan = d.channels.includes(t) ? 2 : 0, inBody = d.body.includes(t) ? 1 : 0;
      score += idf * (inTitle + inStyle + inChan + inBody);
    }
    if (score > 0) scored.push([score, d.r]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return { available: true, results: scored.slice(0, limit).map(([score, r]) => ({ ...summary(r), score: Math.round(score * 10) / 10 })) };
}

export const summary = r => ({ n: r.n, title: r.title, style: r.style, channels: r.channels, source_url: r.source_url, image: imagePath(r) });
export function imagePath(r) { const c = loadCorpus(); return r.thumb && c.available ? join(c.dir, r.thumb) : undefined; }
export function getRecord(n) { const c = loadCorpus(); return c.available ? c.byN.get(Number(n)) : undefined; }
