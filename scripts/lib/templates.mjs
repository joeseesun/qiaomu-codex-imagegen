// Scenario / style template library (24 templates, 48 presets) and prompt composition.
// Method and data: references/design-system (distilled from the 小小东 public prompt archive, see README there).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references', 'design-system');
let cache;
export function library() {
  if (!cache) {
    const data = JSON.parse(readFileSync(join(DIR, 'templates.json'), 'utf8'));
    cache = { version: data.version, templates: data.templates, byId: Object.fromEntries(data.templates.map(t => [t.id, t])), routing: JSON.parse(readFileSync(join(DIR, 'routing.json'), 'utf8')) };
  }
  return cache;
}
export const getTemplate = id => library().byId[String(id || '').toUpperCase()];
export const TEXT_MODES = ['none', 'exact_short', 'typeset_later'];
export const hasOverride = preset => Boolean(preset?.structural_override) && !/^无[；;，,]/.test(preset.structural_override) && preset.structural_override !== '无';

// Values used when a variable is not given. They are reported back as assumptions.
const DEFAULTS = {
  deliverable: '海报', audience: '社媒读者', action: '静置', scene: '干净概念空间', copy: '', data: '未提供，涉及事实的信息全部省略',
  background: '暖白高明度净色', primary: '低饱和主题色', accent: '暖橙色', ink: '深墨色', motif: '主题派生的单一轮廓', lighting: '左上方柔和漫射光',
};
const NOT_ASSUMPTIONS = new Set(['ratio', 'material', 'mood', 'text_rule', 'headline', 'copy', 'reference', 'topic', 'subject', 'data', 'deliverable']);

// When no reference image is given, the "keep identity / structure per reference" clauses must not promise anything.
const NO_REFERENCE = {
  T09: [['参考图{reference}用于保持相貌、年龄感和辨识特征', '人物为虚构，不对应真实个人，不宣称与真实个人一致']],
  T10: [['参考图{reference}用于身份一致', '人物为虚构，不对应真实个人']],
  T11: [['以{reference}保持身份与自然年龄感', '为虚构人物，不对应真实个人，保持自然年龄感']],
  T14: [['依据{reference}保持轮廓、包装文字与真实材质', '保持产品的整体轮廓与真实材质，不新增未提供的包装文字或标志']],
  T15: [['依据{reference}保留结构', '仅按文字描述表现结构，不添加未提供的接口、按钮或标志']],
  T18: [['依据{reference}保持可信', '保持可信，不虚构具体地标']],
  T20: [['照片按{reference}保持身份', '人物为虚构示意，不对应真实个人']],
};

const list = value => (Array.isArray(value) ? value.filter(Boolean).map(String).join('；') : String(value ?? '').trim());

function textRule(mode, headline, copy) {
  if (mode === 'none') return '完全无文字：不生成标题、说明、日期、标志、数字或页脚';
  if (mode === 'typeset_later') return '不生成任何文字，为标题与说明保留字位和留白，之后用排版工具加入准确文字';
  const allowed = [headline, ...(Array.isArray(copy) ? copy : copy ? [copy] : [])].filter(Boolean).map(t => `“${t}”`);
  return `仅出现提供的文字：${allowed.join('、')}，逐字准确、清晰可读；除这些之外不生成任何其他文字、英文、日期、价格、署名或标志`;
}

// Returns the expanded prompt, or an empty prompt with `missing_required` when something blocking is absent.
export function composePrompt({ template_id, preset_id, variables = {}, text_mode, ratio } = {}) {
  // "T03-1" names a preset: split it so either form works.
  const joined = String(template_id || '').toUpperCase().match(/^(T\d\d)-(\d)$/);
  if (joined) { template_id = joined[1]; preset_id = preset_id || `${joined[1]}-${joined[2]}`; }
  const tpl = getTemplate(template_id);
  if (!tpl) throw new Error(`unknown template "${template_id}". Use one of ${library().templates.map(t => t.id).join(', ')}`);
  const preset = preset_id ? tpl.presets.find(p => p.id === preset_id) : tpl.presets[0];
  if (!preset) throw new Error(`unknown preset "${preset_id}" for ${tpl.id}. Available: ${tpl.presets.map(p => p.id).join(', ')}`);
  const route = library().routing.templates[tpl.id] || {};
  const given = Object.fromEntries(Object.entries(variables || {}).map(([k, v]) => [k, Array.isArray(v) ? v : String(v ?? '').trim()]));
  const headline = list(given.headline);
  // `copy` is a list of short lines; a single string may separate them with ｜ or newlines.
  const copyList = Array.isArray(given.copy) ? given.copy.filter(Boolean).map(String) : given.copy ? String(given.copy).split(/[｜\n]/).map(t => t.trim()).filter(Boolean) : [];
  const mode = text_mode || (headline || copyList.length ? 'exact_short' : route.typographic ? 'typeset_later' : 'none');
  if (!TEXT_MODES.includes(mode)) throw new Error(`text_mode must be one of ${TEXT_MODES.join(', ')}`);

  const missing = [];
  if (tpl.variables.topic && !list(given.topic)) missing.push('topic（核心主题）');
  if ((route.identity || route.product) && !list(given.subject)) missing.push(route.identity ? 'subject（人物的可见特征；真实人物需另给身份参考图）' : 'subject（产品名称与外形）');
  if (route.needs_data && !list(given.data)) missing.push('data（要呈现的真实内容、名单或数值，逐字提供）');
  if (mode === 'exact_short' && !headline && !copyList.length) missing.push('headline 或 copy（exact_short 需要准确文字）');

  const base = { ratio: ratio || tpl.default_ratio, material: preset.material, mood: preset.mood };
  const params = { ...DEFAULTS, ...base };
  for (const [key, value] of Object.entries(given)) { const text = list(value); if (text) params[key] = text; }
  if (!params.subject) params.subject = `由${params.topic || '主题'}直接决定的主要可见对象，不添加无关对象`;
  params.headline = headline; params.copy = list(copyList);
  params.text_rule = list(given.text_rule) || textRule(mode, headline, copyList);

  let template = tpl.prompt_template;
  const hasReference = Boolean(list(given.reference));
  if (!hasReference) for (const [from, to] of NO_REFERENCE[tpl.id] || []) template = template.replace(from, to);
  // Drop the clauses that would mention text that does not exist; typographic templates keep a placeholder for it.
  const dropHeadline = !headline && !route.typographic, dropCopy = !params.copy, dropTextHierarchy = mode === 'none';
  template = template.split('。').map(sentence => {
    const parts = sentence.split(/([，；])/); const kept = [];
    for (let i = 0; i < parts.length; i += 2) {
      const clause = parts[i];
      if ((dropHeadline && clause.includes('{headline}')) || (dropCopy && clause.includes('{copy}')) || (dropTextHierarchy && clause.includes('文字层级'))) continue;
      kept.push(clause, parts[i + 1] ?? '');
    }
    while (kept.length && /^[，；]?$/.test(kept[kept.length - 1])) kept.pop();
    return kept.join('');
  }).filter(Boolean).join('。') + '。';
  if (!headline) template = template.replaceAll('“{headline}”', '一处留给后期排版的标题字位（画面内不生成文字）').replaceAll('{headline}', '后期排版的标题');
  if (dropCopy) template = template.replaceAll('{copy}', '一处留给后期排版的短说明');
  let prompt = template.replace(/\{(\w+)\}/g, (_, key) => (params[key] === undefined ? '' : params[key]));
  prompt = prompt.replace(/[，、]{2,}/g, '，').replace(/，。/g, '。').replace(/。{2,}/g, '。').replace(/\s{2,}/g, ' ').trim();

  const weak = ['motif', 'primary', 'accent', 'background', 'lighting', 'action', 'scene'].filter(k => tpl.variables[k] && !list(given[k]));
  const assumptions = Object.keys(DEFAULTS).filter(k => tpl.variables[k] && !NOT_ASSUMPTIONS.has(k) && !list(given[k])).map(k => `${k} 使用默认值：${DEFAULTS[k]}`);
  if (!hasReference && NO_REFERENCE[tpl.id]) assumptions.push('没有参考图：人物或产品按文字描述生成，不保证与真实对象一致');
  if (route.typographic && mode !== 'exact_short') assumptions.push('该模板的风格依赖文字形体：无字底图不能视为满足风格锁，需要后期排版实现字墙或字块');
  if (preset.mood === undefined) assumptions.push('预设未提供情绪描述');

  const override = hasOverride(preset) ? preset.structural_override : undefined;
  const blocked = missing.length > 0;
  return {
    ok: !blocked, template_id: tpl.id, template_name: tpl.name, preset_id: preset.id, preset_name: preset.name, selection_reason: tpl.identity,
    parameters: Object.fromEntries(Object.keys(tpl.variables).map(k => [k, params[k] ?? ''])), text_mode: mode,
    prompt: blocked ? '' : prompt, avoid: tpl.avoid, settings: { ratio: params.ratio, target_syntax: 'natural_language' },
    assumptions, missing_required: missing, acceptance_checks: [...tpl.invariants, '只出现输入允许的文字与事实'],
    structural_override: override, needs_rewrite: Boolean(override) && !blocked, typographic: Boolean(route.typographic), weak_variables: weak,
    evidence_records: tpl.evidence.map(e => e.record), validation_status: 'prompt_review_only',
  };
}

// What is sent to the image model: the expanded prompt plus the template's failure list.
export const promptForGeneration = composed => `${composed.prompt}\n避免：${composed.avoid}`;
