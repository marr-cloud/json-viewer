import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureServer {
  url(path: string): string;
  /** Same server under a name the browser maps to 127.0.0.1; not a secure context. */
  insecureUrl(path: string): string;
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

interface Route {
  type: string;
  /** A function gets the server's origin, for documents that link back to it. */
  body: string | ((origin: string) => string);
  headers?: Record<string, string>;
}

const richJson = (origin: string) =>
  JSON.stringify({
    accent: '#ff5500',
    '#00ff00': 'a key, not a color',
    createdAt: 1728691200,
    updatedAt: '2024-10-12T09:30:00Z',
    icon: `${origin}/pixel.svg`,
  });

const richBrokenJson = (origin: string) => JSON.stringify({ icon: `${origin}/missing.svg` });

const routes: Record<string, Route> = {
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
  '/rich.json': { type: 'application/json', body: richJson },
  '/rich-csp.json': { type: 'application/json', body: richJson, headers: { 'content-security-policy': "img-src 'none'" } },
  '/rich-broken.json': { type: 'application/json', body: richBrokenJson },
  '/pixel.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>' },
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((req, res) => {
    const route = routes[req.url ?? ''];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    const origin = `http://${req.headers.host ?? '127.0.0.1'}`;
    res.writeHead(200, { 'content-type': route.type, ...route.headers });
    res.end(typeof route.body === 'function' ? route.body(origin) : route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    insecureUrl: (path) => `http://jv.test:${port}${path}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
