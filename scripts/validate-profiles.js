#!/usr/bin/env node
const path = require('node:path');
const { loadProfiles, validateProfile } = require('../src/nothing-x-eq');

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const presetFile = argValue('presets', path.join('presets', 'default-profiles.json'));
  const profiles = await loadProfiles(presetFile);
  for (const profile of profiles) {
    validateProfile(profile);
    console.log(`OK ${profile.name}`);
  }
  console.log(`Validated ${profiles.length} profiles`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
