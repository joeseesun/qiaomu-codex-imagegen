// The tool surface shared by the MCP server and the CLI.
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { catalog, buildPrompt } from './prompt.mjs';
import { generate, mimeOf, DEFAULT_TIMEOUT_S } from './codex.mjs';
import { composePrompt, library, promptForGeneration, TEXT_MODES } from './templates.mjs';
import { suggestDirections, formatDirections } from './suggest.mjs';
import { getRecord, imagePath, searchCorpus, loadCorpus, corpusDir } from './corpus.mjs';

const common = {
  prompt: { type: 'string', description: 'What the image should show. Be concrete: subject, mood, composition. Not the style or format; those have their own fields.' },
  preset: { type: 'string', description: 'Scenario preset that sets aspect ratio and safe-area rules: article, wechat-cover, xiaohongshu, xiaohongshu-square, x-cover, video-cover, video-vertical, poster, movie-poster, book-cover, album-cover, moments, paper. Call list_catalog for details.' },
  style: { type: 'string', description: 'Style key from list_catalog (66 styles + 20 Mondo poster artists such as olly-moss, saul-bass), or free text. Defaults to the preset\'s style.' },
  aspect_ratio: { type: 'string', description: 'Override the ratio, e.g. 3:4, 16:9, 2.35:1, 9:16.' },
  text: { type: 'array', items: { type: 'string' }, description: 'Exact strings to render in the image (titles). Omit for no text at all; image models misspell, so prefer adding titles afterwards.' },
};
const templateFields = {
  template_id: { type: 'string', description: 'Template from suggest_directions: T01–T24, or a preset id such as T03-1.' },
  preset_id: { type: 'string', description: 'Template preset, e.g. T03-1. Optional when template_id already carries it.' },
  variables: { type: 'object', description: 'Template variables as strings: topic (required), subject, action, scene, headline, copy, data, reference, motif, primary, accent, background, ink, lighting, material, mood, audience, deliverable. Fill them with concrete content; defaults are generic.' },
  text_mode: { type: 'string', enum: TEXT_MODES, description: 'none: no text at all. exact_short: only the given headline/copy. typeset_later: text-free base image with room for text.' },
};

export const TOOLS = [
  {
    name: 'suggest_directions',
    description: 'FIRST STEP for any image request. Returns at least four divergent style directions for the topic (different visual mechanisms, from the 24-template library plus a Mondo poster-artist option), each with its mechanism, style locks, what you must supply, and reference cases. Show them to the user and let them choose before generating. Free and instant.',
    inputSchema: { type: 'object', required: ['topic'], properties: {
      topic: { type: 'string', description: 'The subject of the image, in the user\'s words.' }, deliverable: { type: 'string', description: 'What it is for: 视频封面, 海报, 小红书配图, 头像, 公众号头图, PPT …' },
      subject: { type: 'string' }, audience: { type: 'string' }, headline: { type: 'string', description: 'Exact title text if the user gave one.' }, text_mode: { type: 'string', enum: TEXT_MODES },
      ratio: { type: 'string' }, count: { type: 'number', description: 'Number of directions, 4–8. Default 5.' }, exclude: { type: 'array', items: { type: 'string' }, description: 'Template ids to leave out (ask for more options).' },
    } },
  },
  {
    name: 'compose_prompt',
    description: 'Expand a chosen template + preset with variables into the final natural-language prompt, with avoid list, acceptance checks, assumptions and missing required inputs. If the preset has a structural_override, rewrite the prompt by hand as instructed and pass the result to generate_image as raw_prompt. Free and instant.',
    inputSchema: { type: 'object', required: ['template_id'], properties: { ...templateFields, ratio: { type: 'string' } } },
  },
  {
    name: 'generate_image',
    description: 'Generate (or edit, when reference_images are given) an image with Codex\'s built-in image generation and save it to disk. Returns absolute file path(s), pixel size and a JSON sidecar with the exact prompt. Takes 30–180 s. ' +
      'Three ways to describe the image: (1) template_id/preset_id + variables from suggest_directions; (2) raw_prompt, a finished prompt used verbatim; (3) prompt + preset + style for the simple scenario route. To view the result, Read the returned path.',
    inputSchema: {
      type: 'object',
      properties: {
        ...common, ...templateFields,
        raw_prompt: { type: 'string', description: 'A finished prompt, sent verbatim (nothing is added). Use after rewriting a structural_override.' },
        reference_images: { type: 'array', items: { type: 'string' }, description: 'Absolute paths of local images: style reference, identity/product reference, or the image to edit.' },
        count: { type: 'number', description: 'Variants to make in parallel, 1–4 (each costs quota). Default 1.' },
        out_dir: { type: 'string', description: 'Directory to save into. Default ~/Pictures/qiaomu-codex-imagegen/<date>.' },
        file_name: { type: 'string', description: 'Base file name without extension.' },
        model: { type: 'string', description: 'Optional Codex model override for the driving turn.' },
        include_image: { type: 'boolean', description: 'Also return the image inline (large). Default false.' },
        transparent_background: { type: 'boolean', description: 'Keep transparent regions (stickers, cut-outs). Default false: the prompt asks for an opaque full-bleed background and any transparency is flattened onto `background`.' },
        background: { type: 'string', description: 'Hex colour used to flatten transparency, default #ffffff.' },
        timeout_seconds: { type: 'number', description: `Default ${DEFAULT_TIMEOUT_S}.` },
      },
    },
  },
  {
    name: 'search_prompts',
    description: 'Search the local corpus of 689 reference prompts (titles, style names, channels, prompt text) and get matching cases with preview image paths. Needs the local data pack (see README); otherwise says so.',
    inputSchema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, channel: { type: 'string', description: 'Channel filter, e.g. 咖啡, 节气, 电影海报, 社媒封面.' }, limit: { type: 'number', description: 'Default 8.' } } },
  },
  {
    name: 'get_prompt',
    description: 'Return the full original prompt of one corpus record (by its number from search_prompts / suggest_directions) with style, channels, source link and preview image path. Use it to study a mechanism; do not paste it unchanged as the user\'s prompt.',
    inputSchema: { type: 'object', required: ['record'], properties: { record: { type: 'number' } } },
  },
  {
    name: 'build_prompt',
    description: 'Compose the simple-route prompt (description + style + scenario preset) WITHOUT generating. Free and instant.',
    inputSchema: { type: 'object', required: ['prompt'], properties: common },
  },
  {
    name: 'list_catalog',
    description: 'List scenario presets, styles, the 24 templates with their presets, and whether the local corpus pack is installed.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Tool arguments use snake_case; the prompt builder takes camelCase.
const promptArgs = args => ({ prompt: args.prompt, preset: args.preset, style: args.style, aspectRatio: args.aspect_ratio, text: args.text });
const text = value => ({ content: [{ type: 'text', text: value }] });
const fail = message => ({ isError: true, content: [{ type: 'text', text: message }] });
const ratioIn = prompt => String(prompt).match(/(\d+(?:\.\d+)?\s*[:：]\s*\d+(?:\.\d+)?)/)?.[1]?.replace('：', ':').replace(/\s/g, '');

function describeComposed(c) {
  const lines = [`模板 ${c.template_id} ${c.template_name} · 预设 ${c.preset_id} ${c.preset_name} · 比例 ${c.settings.ratio} · 文字 ${c.text_mode}`, `选择理由：${c.selection_reason}`, ''];
  if (c.missing_required.length) lines.push(`缺少必要信息，未生成提示词：\n- ${c.missing_required.join('\n- ')}`, '');
  else lines.push('提示词：', c.prompt, '', `避免：${c.avoid}`, '');
  if (c.structural_override) lines.push(`结构替换（必须改写）：${c.structural_override}`, '请删除被替换的基础句子，不要同时保留冲突结构；改写后用 generate_image 的 raw_prompt 提交（别忘了附上“避免：…”）。', '');
  if (c.weak_variables.length) lines.push(`以下变量用了通用默认值，请先按主题填成具体内容再生成：${c.weak_variables.join('、')}`, '');
  if (c.assumptions.length) lines.push('假设：', ...c.assumptions.map(a => `- ${a}`), '');
  lines.push('验收（成图后逐条检查）：', ...c.acceptance_checks.map(a => `- ${a}`));
  return lines.join('\n');
}

export async function runTool(name, args = {}, progress) {
  try {
    if (name === 'list_catalog') {
      const { presets, styles } = catalog(); const corpus = loadCorpus();
      return text(['## scenario presets', ...Object.entries(presets).map(([k, v]) => `- ${k}: ${v.name}, ${v.aspect_ratio}, default style ${v.style}`),
        '', '## templates (use with suggest_directions / compose_prompt)', ...library().templates.map(t => `- ${t.id} ${t.name} (${t.default_ratio}): ${t.scenes}; presets ${t.presets.map(p => `${p.id} ${p.name}`).join(' / ')}`),
        '', '## styles', ...Object.entries(styles).map(([k, v]) => `- ${k}: ${v.name || k}${v.description ? ' — ' + v.description : ''}`),
        '', corpus.available ? `## corpus: ${corpus.records.length} records at ${corpus.dir}` : `## corpus: not installed (looked in ${corpusDir()}); see README "本地数据包"`].join('\n'));
    }
    if (name === 'suggest_directions') { const result = suggestDirections(args); return { ...text(formatDirections(result)), structuredContent: result }; }
    if (name === 'compose_prompt') { const c = composePrompt({ template_id: args.template_id, preset_id: args.preset_id, variables: args.variables, text_mode: args.text_mode, ratio: args.ratio }); return { ...text(describeComposed(c)), structuredContent: c }; }
    if (name === 'search_prompts') {
      const found = searchCorpus(args.query, { limit: Number(args.limit) || 8, channel: args.channel });
      if (!found.available) return text(`No local corpus pack at ${corpusDir()}. Build it with: node scripts/build-corpus.mjs <archive-dir> (see README "本地数据包").`);
      return { ...text(found.results.length ? found.results.map(r => `#${r.n} ${r.title} · ${r.style} · ${r.channels.join('/')} (score ${r.score})${r.image ? `\n   ${r.image}` : ''}`).join('\n') : 'No matches.'), structuredContent: found };
    }
    if (name === 'get_prompt') {
      const r = getRecord(args.record);
      if (!loadCorpus().available) return text(`No local corpus pack at ${corpusDir()}.`);
      if (!r) return fail(`no record #${args.record}`);
      return { ...text(`#${r.n} ${r.title}\n风格：${r.style}\n分类：${r.channels.join(' / ')}\n来源：${r.source_url}\n预览：${imagePath(r) || '无'}\n\n${r.prompt}`), structuredContent: r };
    }
    if (name === 'build_prompt') { const built = buildPrompt(promptArgs(args)); return text(built.prompt + (built.warnings.length ? '\n\nNotes: ' + built.warnings.join('; ') : '')); }
    if (name !== 'generate_image') return fail(`unknown tool: ${name}`);

    let finalPrompt, aspectRatio, notes = [], meta = {};
    if (args.raw_prompt) {
      finalPrompt = String(args.raw_prompt).trim(); aspectRatio = args.aspect_ratio || ratioIn(finalPrompt); meta = { route: 'raw_prompt', template_id: args.template_id, preset_id: args.preset_id };
    } else if (args.template_id) {
      const c = composePrompt({ template_id: args.template_id, preset_id: args.preset_id, variables: args.variables, text_mode: args.text_mode, ratio: args.aspect_ratio });
      if (!c.ok) return fail(`generate_image needs more input:\n- ${c.missing_required.join('\n- ')}`);
      if (c.needs_rewrite) return fail(`Preset ${c.preset_id} ${c.preset_name} has a structural override, so the template text cannot be sent as is.\nOverride: ${c.structural_override}\nCall compose_prompt, rewrite the prompt following the override (remove the replaced base sentences), then call generate_image with raw_prompt.`);
      finalPrompt = promptForGeneration(c); aspectRatio = c.settings.ratio;
      if (c.weak_variables.length) notes.push(`generic defaults used for: ${c.weak_variables.join(', ')}`);
      meta = { route: 'template', template_id: c.template_id, preset_id: c.preset_id, parameters: c.parameters, text_mode: c.text_mode, assumptions: c.assumptions, acceptance_checks: c.acceptance_checks };
    } else {
      const built = buildPrompt(promptArgs(args)); finalPrompt = built.prompt; aspectRatio = built.aspectRatio; notes.push(...built.warnings); meta = { route: 'scenario', preset: built.preset, style: built.style };
    }
    if (args.transparent_background !== true) finalPrompt += '\n画面要求：背景不透明，纸面或底色铺满整个画面，不要透明、镂空或黑色边角区域。';
    const result = await generate({
      finalPrompt, transparentBackground: args.transparent_background === true, background: args.background, aspectRatio, referenceImages: Array.isArray(args.reference_images) ? args.reference_images.map(String) : [],
      count: args.count, outDir: args.out_dir, fileName: args.file_name, model: args.model ? String(args.model) : undefined, timeoutSeconds: args.timeout_seconds, progress,
    });
    for (const image of result.images) {
      const sidecar = image.path.slice(0, image.path.length - extname(image.path).length) + '.json';
      await writeFile(sidecar, JSON.stringify({ created_at: new Date().toISOString(), prompt: finalPrompt, aspect_ratio: aspectRatio, reference_images: args.reference_images || [], dimensions: image.dimensions, flattened_transparency: image.flattened || false, revised_prompt: image.revisedPrompt, ...meta }, null, 2)).catch(() => {});
      image.sidecar = sidecar;
    }
    const lines = result.images.map(i => `${i.path}  ${i.dimensions ? `${i.dimensions.width}×${i.dimensions.height}` : 'size unknown'}${i.ratioOk === false ? '  (ratio differs from requested)' : ''}${i.flattened ? `  (transparent areas, ${Math.round(i.transparent * 100)}%, flattened onto the background)` : ''}  ${Math.round(i.size / 1024)} KB`);
    const revised = result.images.find(i => i.revisedPrompt)?.revisedPrompt;
    const checks = meta.acceptance_checks?.length ? `\n\nCheck the image against:\n${meta.acceptance_checks.map(a => `- ${a}`).join('\n')}` : '';
    const content = [{ type: 'text', text: `Saved ${result.images.length} image(s):\n${lines.join('\n')}` + (result.failures.length ? `\n\n${result.failures.length} variant(s) failed: ${result.failures[0]}` : '') + (notes.length ? `\n\nNotes: ${notes.join('; ')}` : '') + checks + (revised ? `\n\nRevised prompt: ${revised}` : '') }];
    if (args.include_image) for (const image of result.images) content.push({ type: 'image', data: (await readFile(image.path)).toString('base64'), mimeType: mimeOf(image.path) });
    return { content, structuredContent: { images: result.images.map(({ path, dimensions, size, sidecar }) => ({ path, dimensions, bytes: size, sidecar })), prompt: finalPrompt } };
  } catch (error) { return fail(`${name} failed: ${error instanceof Error ? error.message : String(error)}`); }
}
