import { expect, test } from './fixtures';
import { getStorage } from './storage';

test('the options page switches language live and saves the choice', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await options.getByLabel('Language').selectOption('es');
  await expect(options.getByRole('link', { name: 'Apariencia' })).toBeVisible();
  await expect(options.locator('html')).toHaveAttribute('lang', 'es');
  await expect(options).toHaveTitle('Configuración de JSON Viewer');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ locale: 'es' });
  await options.getByLabel('Idioma').selectOption('auto');
  await expect(options.getByRole('link', { name: 'Appearance' })).toBeVisible();
});
