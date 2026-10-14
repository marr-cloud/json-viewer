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

// Themes tm-themes doesn't have, kept in scripts/themes/ next to their license. The id is stored in user settings.
const VENDORED = [
  {
    id: 'night-sky',
    name: 'Night Sky',
    file: 'one-dark-pro-night-flat.json',
    license: 'one-dark-pro-night-flat.LICENSE.txt',
    origin: 'One Dark Pro Night Flat by Binaryify (https://github.com/Binaryify/OneDark-Pro)',
    // One Dark Pro colors JSON URLs like other strings (green); its own link blue (textLink.foreground) makes them
    // stand out in the same palette.
    colors: { link: '#61afef' },
  },
] as const;

const outDir = fileURLToPath(new URL('../src/themes/builtin/', import.meta.url));
const themePath = (name: string) => require.resolve(`tm-themes/themes/${name}.json`);

const themes = THEMES.map((name) => {
  const { theme, warnings } = fromVSCode(readFileSync(themePath(name), 'utf8'), name);
  for (const warning of warnings) console.warn(`[${name}] ${warning}`);
  return { ...theme, source: 'builtin' as const };
});
const vendoredDir = fileURLToPath(new URL('./themes/', import.meta.url));
for (const { id, name, file, colors } of VENDORED) {
  const { theme, warnings } = fromVSCode(readFileSync(join(vendoredDir, file), 'utf8'), id);
  for (const warning of warnings) console.warn(`[${id}] ${warning}`);
  themes.push({ ...theme, name, colors: { ...theme.colors, ...colors }, source: 'builtin' as const });
}
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
  '# Third-party licenses',
  '',
  'The extension icon (`src/assets/icon.svg`) is `file-type-json` from',
  '[vscode-icons](https://github.com/vscode-icons/vscode-icons), under this license:',
  '',
  ['```text', readFileSync(fileURLToPath(new URL('../src/assets/icon.LICENSE.txt', import.meta.url)), 'utf8').trim(), '```', ''].join('\n'),
  'Dark+ and Light+ (`dark-plus.json`, `light-plus.json`) are hand-written from the VS Code defaults (MIT, Microsoft).',
  'The themes in `generated.json` are converted with `pnpm themes:build` from',
  '[tm-themes](https://github.com/shikijs/textmate-grammars-themes) (MIT), which redistributes them under their',
  'original licenses, reproduced below.',
  '',
  ...sections.map((section) => ['```text', section.trim(), '```', ''].join('\n')),
  ...VENDORED.flatMap(({ name, origin, license }) => [
    `${name} is converted from ${origin}, under this license:`,
    '',
    ['```text', readFileSync(join(vendoredDir, license), 'utf8').trim(), '```', ''].join('\n'),
  ]),
].join('\n');
writeFileSync(join(outDir, 'LICENSES.md'), `${licenses}\n`);
// Shipped inside the extension (WXT copies public/ to the build root), as the licenses require.
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(publicDir, { recursive: true });
writeFileSync(join(publicDir, 'THEME-LICENSES.md'), `${licenses}\n`);

console.log(`Wrote ${themes.length} themes and ${sections.length + VENDORED.length} license notices.`);
