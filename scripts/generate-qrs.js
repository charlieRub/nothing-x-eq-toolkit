#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadProfiles, writeQr, validateProfile } = require('../src/nothing-x-eq');

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const presetFile = argValue('presets', path.join('presets', 'default-profiles.json'));
  const outDir = argValue('out', 'qr');
  const profiles = await loadProfiles(presetFile);
  const manifest = [];

  for (const profile of profiles) {
    validateProfile(profile);
    const result = await writeQr(profile, outDir);
    manifest.push({
      ...result,
      png: path.relative(process.cwd(), result.png),
      svg: path.relative(process.cwd(), result.svg),
      payloadTxt: path.relative(process.cwd(), result.payloadTxt),
    });
    console.log(`OK ${profile.name}`);
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${manifest.length} profiles in ${outDir}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
