#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

async function download(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'nothing-ear-eq-qr-profiles' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function main() {
  const manifestPath = path.join(process.cwd(), 'autoeq-sources', 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const dataDir = path.join(process.cwd(), 'autoeq-sources', 'data');
  await fs.mkdir(dataDir, { recursive: true });

  for (const source of manifest.sources) {
    const csvUrl = manifest.rawBaseUrl + encodeURI(source.csvPath);
    const readmeUrl = manifest.rawBaseUrl + encodeURI(source.readmePath);
    const csv = await download(csvUrl);
    const readme = await download(readmeUrl);
    await fs.writeFile(path.join(dataDir, `${source.id}.csv`), csv);
    await fs.writeFile(path.join(dataDir, `${source.id}.README.md`), readme);
    console.log(`Imported ${source.id}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
