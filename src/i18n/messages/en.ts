// English messages: the source of every key. es.ts must have the same keys and {placeholders}.
// Plurals use `.one` / `.other` suffixes (Intl.PluralRules); `{count}` is filled in for them.
export const en = {
  'options.title': 'JSON Viewer Settings',
  'options.nav.label': 'Sections',
  'options.section.appearance': 'Appearance',
  'options.section.fonts': 'Fonts',
  'options.section.behavior': 'Behavior',
  'options.section.structure': 'Structure',
  'options.section.features': 'Features',
  'options.section.shortcuts': 'Shortcuts',
  'options.section.sites': 'Sites',
  'options.section.advanced': 'Advanced',
  'options.section.about': 'About',
  'options.preview.label': 'Live preview',

  'options.language.label': 'Language',
  'options.language.auto': 'Browser language',

  'options.reset.button': 'Reset to defaults',
  'options.reset.confirm': 'Reset all settings to their defaults? Custom themes are kept.',

  'options.backup.export': 'Export settings',
  'options.backup.import': 'Import settings',
  'options.backup.confirm': 'Replace your settings with the ones in “{file}”? Custom themes in the file are added to yours.',
  'options.backup.imported': 'Settings imported from “{file}”.',
  'options.backup.themesSaved.one': '{count} custom theme added or updated.',
  'options.backup.themesSaved.other': '{count} custom themes added or updated.',
  'options.backup.themesSkipped.one': '{count} theme in the file was left out.',
  'options.backup.themesSkipped.other': '{count} themes in the file were left out.',
  'options.backup.themesFailed.one': '{count} theme could not be saved: storage is full.',
  'options.backup.themesFailed.other': '{count} themes could not be saved: storage is full.',
  'options.backup.error.tooLarge': 'That file is too big to be a JSON Viewer settings file.',
  'options.backup.error.notJson': 'That file is not valid JSON.',
  'options.backup.error.notABackup': 'That file is not a JSON Viewer settings file.',
  'options.backup.error.newerVersion':
    'That file comes from a newer version of JSON Viewer. Update the extension and try again.',
  'options.backup.error.unreadable': 'The file could not be read.',
  'options.backup.hint': 'The file holds your settings, custom CSS and custom themes. Downloaded fonts are not included.',

  'options.about.version': 'JSON Viewer {version}',
  'options.about.inspired': 'Inspired by {link}.',
  'options.about.licenses': 'Built-in themes are converted from VS Code themes via tm-themes; see their {link}.',
  'options.about.licensesLink': 'licenses',
} as const;
