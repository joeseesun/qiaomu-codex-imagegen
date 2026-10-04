// The tool surface shared by the MCP server and the CLI.
import { readFile } from 'node:fs/promises';
import { catalog, buildPrompt } from './prompt.mjs';
import { generate, mimeOf, DEFAULT_TIMEOUT_S } from './codex.mjs';

const common = {
  prompt: { type: 'string', description: 'What the image should show. Be concrete: subject, mood, composition. Not the style or format; those have their own fields.' },
  preset: { type: 'string', description: 'Scenario preset that sets aspect ratio and safe-area rules: article, wechat-cover, xiaohongshu, xiaohongshu-square, x-cover, video-cover, video-vertical, poster, movie-poster, book-cover, album-cover, moments, paper. Call list_catalog for details.' },
  style: { type: 'string', description: 'Style key from list_catalog (66 styles + 20 Mondo poster artists such as olly-moss, saul-bass), or free text. Defaults to the preset\'s style.' },
  aspect_ratio: { type: 'string', description: 'Override the ratio, e.g. 3:4, 16:9, 2.35:1, 9:16.' },
  text: { type: 'array', items: { type: 'string' }, description: 'Exact strings to render in the image (titles). Omit for no text at all; image models misspell, so prefer adding titles afterwards.' },
};

export const TOOLS = [
  {
    name: 'generate_image',
    description: 'Generate (or edit, when reference_images are given) an image with Codex\'s built-in image generation and save it to disk. Returns absolute file path(s) and actual pixel size. Takes 30–180 s. ' +
      'Use preset for the scenario (Xiaohongshu, video cover, poster …) and style for the look. To view the result, Read the returned path.',
    inputSchema: {
      type: 'object', required: ['prompt'],
      properties: {
        ...common,
        reference_images: { type: 'array', items: { type: 'string' }, description: 'Absolute paths of local images: style reference, or the image to edit.' },
        count: { type: 'number', description: 'Variants to make in parallel, 1–4 (each costs quota). Default 1.' },
        out_dir: { type: 'string', description: 'Directory to save into. Default ~/Pictures/qiaomu-codex-imagegen/<date>.' },
        file_name: { type: 'string', description: 'Base file name without extension.' },
        model: { type: 'string', description: 'Optional Codex model override for the driving turn.' },
        include_image: { type: 'boolean', description: 'Also return the image inline (large). Default false.' },
        timeout_seconds: { type: 'number', description: `Default ${DEFAULT_TIMEOUT_S}.` },
      },
    },
  },
  {
    name: 'build_prompt',
    description: 'Compose the final prompt (description + style + format rules) WITHOUT generating, so it can be reviewed or edited first. Free and instant.',
    inputSchema: { type: 'object', required: ['prompt'], properties: common },
  },
  {
    name: 'list_catalog',
    description: 'List the scenario presets (ratio, safe-area notes) and the style keys available to generate_image/build_prompt.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// Tool arguments use snake_case; the prompt builder takes camelCase.
const promptArgs = args => ({ prompt: args.prompt, preset: args.preset, style: args.style, aspectRatio: args.aspect_ratio, text: args.text });
const text = value => ({ content: [{ type: 'text', text: value }] });
const fail = message => ({ isError: true, content: [{ type: 'text', text: message }] });

export async function runTool(name, args = {}, progress) {
  try {
    if (name === 'list_catalog') {
      const { presets, styles } = catalog();
      return text(['## presets', ...Object.entries(presets).map(([k, v]) => `- ${k}: ${v.name}, ${v.aspect_ratio}, default style ${v.style}`),
        '', '## styles', ...Object.entries(styles).map(([k, v]) => `- ${k}: ${v.name || k}${v.description ? ' — ' + v.description : ''}`)].join('\n'));
    }
    if (name === 'build_prompt') {
      const built = buildPrompt(promptArgs(args));
      return text(built.prompt + (built.warnings.length ? '\n\nNotes: ' + built.warnings.join('; ') : ''));
    }
    if (name !== 'generate_image') return fail(`unknown tool: ${name}`);
    const built = buildPrompt(promptArgs(args));
    const result = await generate({
      finalPrompt: built.prompt, aspectRatio: built.aspectRatio, referenceImages: Array.isArray(args.reference_images) ? args.reference_images.map(String) : [],
      count: args.count, outDir: args.out_dir, fileName: args.file_name, model: args.model ? String(args.model) : undefined, timeoutSeconds: args.timeout_seconds, progress,
    });
    const lines = result.images.map(i => `${i.path}  ${i.dimensions ? `${i.dimensions.width}×${i.dimensions.height}` : 'size unknown'}${i.ratioOk === false ? '  (ratio differs from requested)' : ''}  ${Math.round(i.size / 1024)} KB`);
    const revised = result.images.find(i => i.revisedPrompt)?.revisedPrompt;
    const content = [{ type: 'text', text: `Saved ${result.images.length} image(s):\n${lines.join('\n')}` + (result.failures.length ? `\n\n${result.failures.length} variant(s) failed: ${result.failures[0]}` : '') + (built.warnings.length ? `\n\nNotes: ${built.warnings.join('; ')}` : '') + (revised ? `\n\nRevised prompt: ${revised}` : '') }];
    if (args.include_image) for (const image of result.images) content.push({ type: 'image', data: (await readFile(image.path)).toString('base64'), mimeType: mimeOf(image.path) });
    return { content, structuredContent: { images: result.images.map(({ path, dimensions, size }) => ({ path, dimensions, bytes: size })), prompt: built.prompt } };
  } catch (error) { return fail(`${name} failed: ${error instanceof Error ? error.message : String(error)}`); }
}
