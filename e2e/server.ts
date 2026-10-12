import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureServer {
  url(path: string): string;
  close(): Promise<void>;
}

const bigJson = JSON.stringify(
  Array.from({ length: 50_000 }, (_, i) => ({
    id: i,
    name: `item ${i}`,
    url: `https://example.com/${i}`,
    tags: ['a', 'b'],
  })),
);

const minifiedInvalid =
  '[' + Array.from({ length: 20_000 }, (_, i) => `{"id":${i}}`).join(',') + ',]';

const routes: Record<string, { type: string; body: string }> = {
  '/data.json': {
    type: 'application/json',
    body: '{"name":"x","url":"https://example.com/a","nested":{"list":[1,2,3]},"big":12345678901234567890}',
  },
  '/ld': { type: 'application/ld+json; charset=utf-8', body: '{"@context":"https://schema.org"}' },
  '/plain-json': { type: 'text/plain', body: '[{"a":1}]' },
  '/plain-log': { type: 'text/plain', body: '[INFO] server started' },
  '/page.html': { type: 'text/html', body: '<!doctype html><title>t</title><pre>{"a":1}</pre>' },
  '/invalid.json': { type: 'application/json', body: '{\n  "a": 1,\n}' },
  '/invalid-crlf.json': { type: 'application/json', body: '{\r\n  "a": 1,\r\n  "b": 2,\r\n}' },
  '/bom.json': { type: 'application/json', body: '\uFEFF{"a":1}' },
  '/minified-invalid.json': { type: 'application/json', body: minifiedInvalid },
  '/big.json': { type: 'application/json', body: bigJson },
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((req, res) => {
    const route = routes[req.url ?? ''];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': route.type });
    res.end(route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
