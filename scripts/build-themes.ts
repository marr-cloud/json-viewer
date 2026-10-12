import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromVSCode } from '../src/themes/fromVSCode';

const require = createRequire(import.meta.url);

// tm-themes file names; they double as our theme ids, which are stored in user settings — never rename.
const THEMES = [
  'one-dark-pro', 'dracula', 'github-dark', 'github-light', 'monokai', 'tokyo-night', 'catppuccin-mocha',
  'catppuccin-latte', 'nord', 'night-owl', 'solarized-dark', 'solarized-light', 'ayu-dark', 'material-theme',
] as const;

const outDir = fileURLToPath(new URL('../src/themes/builtin/', import.meta.url));
const themePath = (name: string) => require.resolve(`tm-themes/themes/${name}.json`);

const themes = THEMES.map((name) => {
  const { theme, warnings } = fromVSCode(readFileSync(themePath(name), 'utf8'), name);
  for (const warning of warnings) console.warn(`[${name}] ${warning}`);
  return { ...theme, source: 'builtin' as const };
});
writeFileSync(join(outDir, 'generated.json'), `${JSON.stringify(themes, null, 2)}\n`);

// Copy each bundled theme's license notice from tm-themes' NOTICE file.
const notice = readFileSync(join(dirname(themePath('dracula')), '..', 'NOTICE'), 'utf8');
const files = THEMES.map((name) => `${name}.json`);
const sections = notice.split(/^=+$/m).filter((section) => {
  // A section can list several files on one `Files:` line, comma-separated.
  const line = section.match(/^Files:[ \t]+(.+)$/m)?.[1] ?? '';
  return line.split(',').some((file) => files.includes(file.trim()));
});
const licenses = [
  '# Third-party theme licenses',
  '',
  'Dark+ and Light+ (`dark-plus.json`, `light-plus.json`) are hand-written from the VS Code defaults (MIT, Microsoft).',
  'The themes in `generated.json` are converted with `pnpm themes:build` from',
  '[tm-themes](https://github.com/shikijs/textmate-grammars-themes) (MIT), which redistributes them under their',
  'original licenses, reproduced below.',
  '',
  ...sections.map((section) => ['```text', section.trim(), '```', ''].join('\n')),
].join('\n');
writeFileSync(join(outDir, 'LICENSES.md'), `${licenses}\n`);
// Shipped inside the extension (WXT copies public/ to the build root), as the licenses require.
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'THEME-LICENSES.md'), `${licenses}\n`);

console.log(`Wrote ${themes.length} themes and ${sections.length} license notices.`);
