import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

test('the options page switches language live and saves the choice', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await options.getByLabel('Language').selectOption('es');
  await expect(options.getByRole('link', { name: 'Apariencia' })).toBeVisible();
  await expect(options.locator('html')).toHaveAttribute('lang', 'es');
  await expect(options).toHaveTitle('Configuración de JSON Viewer');
  await expect(options.getByRole('heading', { name: 'Comportamiento' })).toBeVisible();
  await expect(options.getByRole('switch', { name: 'Ordenar las claves de los objetos' })).toBeVisible();
  await expect(options.getByRole('button', { name: 'Exportar configuración' })).toBeVisible();
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ locale: 'es' });
  await options.getByLabel('Idioma').selectOption('auto');
  await expect(options.getByRole('link', { name: 'Appearance' })).toBeVisible();
});

test('the viewer speaks the chosen language and follows a change live', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { locale: 'es' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const viewer = page.locator('json-viewer-app');
  await expect(viewer.getByRole('button', { name: 'Plegar todo', exact: true })).toBeVisible();
  await expect(viewer.locator('.jv-status')).toContainText('líneas');
  await setStorage(context, 'sync', { settings: { locale: 'en' } });
  await expect(viewer.getByRole('button', { name: 'Fold all', exact: true })).toBeVisible();
  await expect(viewer.locator('.jv-status')).toContainText('lines');
});

test('the scratchpad speaks the chosen language', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', { settings: { locale: 'es' } });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/scratchpad.html`);
  await expect(page.getByRole('heading', { name: 'Bloc de JSON' })).toBeVisible();
  await expect(page).toHaveTitle('Bloc de JSON');
  await page.getByLabel('Entrada JSON').fill('{"a": 1}');
  await expect(page.locator('.sp-output').getByRole('button', { name: 'Plegar todo', exact: true })).toBeVisible();
});

test('the manifest texts come from _locales', async ({ context }) => {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  type Chrome = { chrome: { i18n: { getMessage(key: string): string; getUILanguage(): string } } };
  // chrome.i18n follows the browser's UI language (the machine's), not the page locale Playwright sets.
  const { language, messages } = await worker.evaluate(() => {
    const { i18n } = (globalThis as unknown as Chrome).chrome;
    return {
      language: i18n.getUILanguage(),
      messages: ['extName', 'extDescription', 'actionTitle'].map((key) => i18n.getMessage(key)),
    };
  });
  expect(messages).toEqual(
    language.startsWith('es')
      ? ['JSON Viewer', 'Visor de JSON rápido y personalizable, con temas de VS Code y Google Fonts.', 'Abrir el bloc de JSON']
      : ['JSON Viewer', 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.', 'Open the JSON scratchpad'],
  );
});
