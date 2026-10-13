import type { Messages } from '../translate';

export const es: Messages = {
  'options.title': 'Configuración de JSON Viewer',
  'options.nav.label': 'Secciones',
  'options.section.appearance': 'Apariencia',
  'options.section.fonts': 'Fuentes',
  'options.section.behavior': 'Comportamiento',
  'options.section.structure': 'Estructura',
  'options.section.features': 'Funciones',
  'options.section.shortcuts': 'Atajos',
  'options.section.sites': 'Sitios',
  'options.section.advanced': 'Avanzado',
  'options.section.about': 'Acerca de',
  'options.preview.label': 'Vista previa',

  'options.language.label': 'Idioma',
  'options.language.auto': 'Idioma del navegador',

  'options.reset.button': 'Restablecer valores',
  'options.reset.confirm': '¿Restablecer todos los ajustes a sus valores por defecto? Los temas personalizados se conservan.',

  'options.backup.export': 'Exportar configuración',
  'options.backup.import': 'Importar configuración',
  'options.backup.confirm':
    '¿Reemplazar tu configuración por la de «{file}»? Los temas personalizados del archivo se añaden a los tuyos.',
  'options.backup.imported': 'Configuración importada de «{file}».',
  'options.backup.themesSaved.one': 'Se añadió o actualizó {count} tema personalizado.',
  'options.backup.themesSaved.other': 'Se añadieron o actualizaron {count} temas personalizados.',
  'options.backup.themesSkipped.one': 'Se omitió {count} tema del archivo.',
  'options.backup.themesSkipped.other': 'Se omitieron {count} temas del archivo.',
  'options.backup.themesFailed.one': 'No se pudo guardar {count} tema: el almacenamiento está lleno.',
  'options.backup.themesFailed.other': 'No se pudieron guardar {count} temas: el almacenamiento está lleno.',
  'options.backup.error.tooLarge': 'Ese archivo es demasiado grande para ser una configuración de JSON Viewer.',
  'options.backup.error.notJson': 'Ese archivo no es JSON válido.',
  'options.backup.error.notABackup': 'Ese archivo no es una configuración de JSON Viewer.',
  'options.backup.error.newerVersion':
    'Ese archivo viene de una versión más nueva de JSON Viewer. Actualiza la extensión y vuelve a intentarlo.',
  'options.backup.error.unreadable': 'No se pudo leer el archivo.',
  'options.backup.hint':
    'El archivo guarda tus ajustes, el CSS propio y los temas personalizados. No incluye las fuentes descargadas.',

  'options.about.version': 'JSON Viewer {version}',
  'options.about.inspired': 'Inspirado en {link}.',
  'options.about.licenses': 'Los temas incluidos se convierten desde temas de VS Code con tm-themes; consulta sus {link}.',
  'options.about.licensesLink': 'licencias',
};
