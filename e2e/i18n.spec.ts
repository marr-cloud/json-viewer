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
