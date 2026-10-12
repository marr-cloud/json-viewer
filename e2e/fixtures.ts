import path from 'node:path';
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { startFixtureServer, type FixtureServer } from './server';

const extensionPath = path.resolve('.output/chrome-mv3');

export const test = base.extend<
  { context: BrowserContext; extensionId: string },
  { server: FixtureServer }
>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await startFixtureServer();
      await use(server);
      await server.close();
    },
    { scope: 'worker' },
  ],
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      colorScheme: 'dark',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
