// Prompt assembly: scenario preset (ratio, safe areas) + style (from the bundled catalogs) + the user's own description.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REFS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'references');
const load = name => JSON.parse(readFileSync(join(REFS, name), 'utf8'));
let cache;
export function catalog() {
  if (!cache) { const styles = load('styles.json'), mondo = load('mondo-artists.json'); cache = { presets: load('presets.json'), styles: { ...styles, ...mondo } }; }
  return cache;
}

const WIDE = /横向|宽屏|宽度是高度/;
const ratioValue = r => { const m = String(r || '').match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/i); return m ? Number(m[1]) / Number(m[2]) : undefined; };
const orientation = value => (!value ? '' : value > 1.15 ? 'horizontal / landscape' : value < 0.87 ? 'vertical / portrait' : 'square');

// Returns { prompt, aspectRatio, preset, style, warnings }. Unknown style names are used as free text.
export function buildPrompt({ prompt, preset, style, aspectRatio, text } = {}) {
  const { presets, styles } = catalog(); const warnings = [];
  const description = String(prompt || '').trim();
  if (!description) throw new Error('prompt is required');
  let chosenPreset;
  if (preset) { chosenPreset = presets[preset]; if (!chosenPreset) throw new Error(`unknown preset "${preset}". Available: ${Object.keys(presets).join(', ')}`); }
  const ratio = aspectRatio || chosenPreset?.aspect_ratio;
  const value = ratioValue(ratio);
  if (ratio && value === undefined) warnings.push(`could not read aspect ratio "${ratio}"; use W:H such as 3:4`);
  const styleKey = style ?? chosenPreset?.style;
  let styleText = '', styleName = '';
  if (styleKey) {
    const entry = styles[styleKey];
    if (entry) {
      styleName = styleKey;
      const suffix = entry.suffix && WIDE.test(entry.suffix) && value !== undefined && value < 1.6 ? '' : (entry.suffix || '');
      styleText = [entry.prompt, suffix].filter(Boolean).join(' ');
    } else { styleText = String(styleKey); warnings.push(`"${styleKey}" is not a catalog style; used as free-text style`); }
  }
  const exactText = (Array.isArray(text) ? text : text ? [text] : []).map(String).filter(Boolean);
  // A style's own "no text" rule would fight an explicit text request.
  if (exactText.length) styleText = styleText.replace(/[，,]?\s*画面中不要任何文字[^。]*。?/g, '').replace(/\s*No text[^.]*\./gi, '').trim();
  const lines = [description];
  if (styleText) lines.push(`Style: ${styleText}`);
  if (ratio && value !== undefined) {
    const size = !aspectRatio && chosenPreset?.size ? `, about ${chosenPreset.size.replace('x', '×')} px` : '';
    lines.push(`Format: output aspect ratio exactly ${ratio} (${orientation(value)})${size}. ${chosenPreset?.notes || ''}`.trim());
  } else if (chosenPreset?.notes) lines.push(`Format: ${chosenPreset.notes}`);
  const exact = exactText;
  lines.push(exact.length
    ? `Text: render exactly these strings, spelled correctly, uncropped and legible, and no other text: ${exact.map(t => `“${t}”`).join(' / ')}.`
    : 'Text: no text, letters, numbers, logos or watermarks in the image.');
  return { prompt: lines.join('\n\n'), aspectRatio: ratio, preset, style: styleName || undefined, warnings };
}
