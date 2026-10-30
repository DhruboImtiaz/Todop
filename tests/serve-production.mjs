import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const configuration = await readFile('netlify.toml', 'utf8');
const policy = configuration.match(/Content-Security-Policy = "([^"]+)"/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
let workerRevision = '';

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'POST' && url.pathname === '/__test/worker-revision') {
    workerRevision = url.searchParams.get('value') || '';
    response.writeHead(204).end();
    return;
  }
  const path = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const file = await stat(path).then(info => info.isFile() ? path : resolve(root, 'index.html')).catch(() => resolve(root, 'index.html'));
    let contents = await readFile(file);
    if (url.pathname === '/sw.js' && workerRevision) {
      contents = Buffer.from(contents.toString().replace(/(todop-cache-[a-f0-9]+)/, `$1-${workerRevision}`));
    }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': policy,
      'Cache-Control': 'no-cache',
    }).end(contents);
  } catch {
    response.writeHead(500).end();
  }
}).listen(4173, '127.0.0.1');
