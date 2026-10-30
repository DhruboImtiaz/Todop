import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const output = resolve('dist');
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : path;
  }));
  return files.flat();
}

const template = await readFile('public/sw.js', 'utf8');
const files = (await filesIn(output)).filter(path => !['sw.js', '_redirects'].includes(relative(output, path))).sort();
const hash = createHash('sha256').update(template);
const urls = [];
for (const path of files) {
  const url = '/' + relative(output, path).split(sep).join('/');
  urls.push(url);
  hash.update(url).update(await readFile(path));
}
const worker = template
  .replace('__BUILD_ID__', hash.digest('hex').slice(0, 16))
  .replace('const PRECACHE_URLS = [];', `const PRECACHE_URLS = ${JSON.stringify(urls)};`);
await writeFile(join(output, 'sw.js'), worker);
console.log(`Service worker generated with ${urls.length} precached files.`);
