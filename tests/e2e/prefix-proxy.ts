import { createServer, request } from 'node:http';

// Reproduce the production Route, which retains Host and removes /poksin.
const proxy = createServer((incoming, outgoing) => {
  const url = new URL(incoming.url ?? '/', 'http://localhost');
  if (url.pathname !== '/poksin' && !url.pathname.startsWith('/poksin/')) {
    outgoing.writeHead(404).end();
    return;
  }
  const upstream = request(
    {
      hostname: '127.0.0.1',
      port: 4183,
      path: `${url.pathname.slice('/poksin'.length) || '/'}${url.search}`,
      method: incoming.method,
      headers: incoming.headers,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  upstream.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  outgoing.on('close', () => upstream.destroy());
  incoming.pipe(upstream);
});

proxy.listen(4184, '127.0.0.1');
