// "At least four divergent directions": rank the 24 templates for a request, then pick a spread across mechanism families.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { library, hasOverride, TEXT_MODES } from './templates.mjs';
import { getRecord, imagePath, searchCorpus, summary } from './corpus.mjs';

const REFS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references');
const DARK = ['暗', '夜', '冷峻', '神秘', '黑', '深色', '沉静', '仪式', '发布会'];
const has = (text, words) => words.filter(w => text.includes(w.toLowerCase()));

export function suggestDirections({ topic, deliverable = '', subject = '', audience = '', headline = '', text_mode, ratio, count = 5, exclude = [] } = {}) {
  if (!String(topic || '').trim()) throw new Error('topic is required');
  const { templates, routing } = library();
  const text = [topic, deliverable, subject, audience, headline].join(' ').toLowerCase();
  const mode = text_mode && TEXT_MODES.includes(text_mode) ? text_mode : headline ? 'exact_short' : undefined;
  const want = Math.min(8, Math.max(4, Math.floor(Number(count)) || 5));
  const posterish = new RegExp(routing.mondo.deliverable_pattern, 'i').test(`${deliverable} ${topic}`) || !deliverable;

  const scored = templates.filter(t => !exclude.includes(t.id)).map(t => {
    const route = routing.templates[t.id] || {};
    const hits = has(text, route.keywords || []);
    const sceneHits = has(text, t.scenes.split(/[、，,]/).map(s => s.trim()).filter(Boolean));
    let score = hits.length * 2 + sceneHits.length * 3;
    const why = [...new Set([...sceneHits, ...hits])];
    for (const [key, ids] of Object.entries(routing.deliverable_hints)) { const at = ids.indexOf(t.id); if (text.includes(key.toLowerCase()) && at >= 0) score += 3 - at * 0.4; }
    if (!why.length && posterish && ['T01', 'T02', 'T03', 'T05', 'T16', 'T19'].includes(t.id)) score += 1; // general concept-poster fallbacks
    if (route.identity && !hits.length) score -= 3;
    if (route.product && !hits.length) score -= 2;
    if (route.needs_data && !hits.length) score -= 5;
    if (route.typographic) score += mode === 'exact_short' ? 1 : mode === 'none' ? -2 : 0;
    return { t, route, score, why };
  }).sort((a, b) => b.score - a.score);

  // Greedy pick with a bonus for a new mechanism family, so the options really differ.
  const picked = []; const used = new Map();
  while (picked.length < want && picked.length < scored.length) {
    let best, bestValue = -Infinity;
    for (const c of scored) {
      if (picked.includes(c)) continue;
      const value = c.score + (used.has(c.route.family) ? -1.2 * used.get(c.route.family) : 2.5);
      if (value > bestValue) { best = c; bestValue = value; }
    }
    picked.push(best); used.set(best.route.family, (used.get(best.route.family) || 0) + 1);
  }
  const similar = searchCorpus(`${topic} ${subject} ${deliverable}`, { limit: 4 });
  const directions = picked.map(({ t, route, why }) => {
    const presetPick = pickPreset(t, text);
    return {
      kind: 'template', id: presetPick.id, template_id: t.id, preset_id: presetPick.id, name: `${t.name} · ${presetPick.name}`, family: route.family, family_note: routing.families[route.family],
      mechanism: t.identity, fits: t.scenes, why_matched: why, default_ratio: ratio || t.default_ratio, locks: t.invariants, typographic: Boolean(route.typographic),
      text_note: route.typographic ? '风格依赖文字形体：无字底图需要后期排版才算满足' : undefined,
      needs: [ ...(route.identity ? ['subject（人物特征；真实人物需给身份参考图）'] : []), ...(route.product ? ['subject（产品名称与外形）'] : []), ...(route.needs_data ? ['data（真实内容，逐字）'] : []), 'topic' ],
      presets: t.presets.map(p => ({ id: p.id, name: p.name, material: p.material, mood: p.mood, structural_override: hasOverride(p) ? p.structural_override : undefined })),
      structural_override: hasOverride(presetPick) ? presetPick.structural_override : undefined, avoid: t.avoid,
      references: t.evidence.slice(0, 3).map(e => { const r = getRecord(e.record); return { record: e.record, style: e.style, source_url: e.source_url, image: r ? imagePath(r) : undefined }; }),
    };
  });
  if (posterish) directions.push(mondoDirection(text, deliverable, ratio));
  return { topic, deliverable: deliverable || undefined, text_mode: mode, directions, similar_cases: similar.results, corpus_available: similar.available };
}

function pickPreset(t, text) {
  if (t.presets.length < 2) return t.presets[0];
  const dark = has(text, DARK).length > 0;
  const darkPreset = t.presets.find(p => /暗|冷峻|深|神秘|仪式|舷窗/.test(`${p.name}${p.mood}${p.structural_override || ''}`));
  const scoreOf = p => has(text, [...(p.name + p.mood + p.material).split(/[、，,；;\s·]/).filter(w => w.length > 1)]).length;
  if (dark && darkPreset) return darkPreset;
  const best = [...t.presets].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
  return scoreOf(best) > 0 ? best : t.presets[0];
}

function mondoDirection(text, deliverable, ratio) {
  const { routing } = library();
  const artists = JSON.parse(readFileSync(join(REFS, 'mondo-artists.json'), 'utf8'));
  const hit = routing.mondo.by_keyword.find(k => has(text, k.keywords).length);
  const key = hit?.artist || routing.mondo.default;
  const preset = /视频.*竖|竖屏|抖音|视频号/.test(text) ? 'video-vertical' : /视频|封面/.test(text) ? 'video-cover' : /书/.test(text) ? 'book-cover' : /专辑/.test(text) ? 'album-cover' : 'poster';
  return {
    kind: 'mondo', id: `mondo:${key}`, style: key, preset, name: `Mondo 海报 · ${artists[key].name}`, family: 'mondo', family_note: '设计师风格：有限色板、丝网印刷、符号化',
    mechanism: artists[key].prompt, fits: '海报、封面、视频封面、书籍与专辑封面', why_matched: hit ? hit.keywords.filter(k => text.includes(k)) : [], default_ratio: ratio || '见 preset',
    use: `generate_image { prompt: <内容描述>, style: "${key}", preset: "${preset}" }`, locks: ['一个标志性主体', '2–5 色有限色板', '大面积负空间'], references: [],
  };
}

export function formatDirections(result) {
  const lines = [`主题：${result.topic}${result.deliverable ? ` · 用途：${result.deliverable}` : ''}${result.text_mode ? ` · 文字：${result.text_mode}` : ''}`, ''];
  result.directions.forEach((d, i) => {
    lines.push(`方向 ${i + 1} · ${d.name}  [${d.kind === 'mondo' ? d.style : d.id}]  （${d.family_note}）`);
    lines.push(`  机制：${d.mechanism}`);
    if (d.why_matched?.length) lines.push(`  匹配：${d.why_matched.join('、')}`);
    lines.push(`  风格锁：${d.locks.join('；')}`);
    if (d.text_note) lines.push(`  注意：${d.text_note}`);
    if (d.needs) lines.push(`  需要你提供：${d.needs.join('；')}`);
    if (d.structural_override) lines.push(`  结构替换：${d.structural_override}`);
    if (d.presets && d.presets.length > 1) lines.push(`  可选预设：${d.presets.map(p => `${p.id} ${p.name}`).join(' / ')}`);
    if (d.references?.length) lines.push(`  参考：${d.references.map(r => `#${r.record} ${r.style}${r.image ? ` → ${r.image}` : ''}`).join('；')}`);
    if (d.use) lines.push(`  调用：${d.use}`);
    lines.push('');
  });
  if (result.similar_cases?.length) lines.push('相近案例（本地语料）：', ...result.similar_cases.map(c => `  #${c.n} ${c.title} · ${c.style}${c.image ? ` → ${c.image}` : ''}`), '');
  else if (!result.corpus_available) lines.push('（本机没有语料数据包，未列出相近案例；见 README“本地数据包”。）', '');
  return lines.join('\n');
}
export { summary };
