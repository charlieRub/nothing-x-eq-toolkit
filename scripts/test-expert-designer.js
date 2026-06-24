#!/usr/bin/env node
const assert = require('node:assert/strict');
const { BAND_RANGES, validateProfile } = require('../src/nothing-x-eq');
const { designProfile, parseLevel } = require('../src/profile-designer');
const { loadAutoEqManifest, selectAutoEqSource, loadAutoEqBands } = require('../src/autoeq-adapter');

function assertBandsInRange(profile) {
  profile.bands.forEach((band, index) => {
    const [min, max] = BAND_RANGES[index];
    assert.ok(band.freq >= min && band.freq <= max, `${profile.name} band ${index + 1} out of range`);
  });
}

async function main() {
  assert.equal(parseLevel('-1'), -1);
  assert.equal(parseLevel('+1'), 1);
  assert.equal(parseLevel('club'), 2);
  assert.equal(parseLevel('balanced'), 0);

  const manifest = await loadAutoEqManifest();
  const source = selectAutoEqSource(manifest, 'nothing-ear-a', 'dhrme-nothing-ear-a');
  assert.equal(source.id, 'dhrme-nothing-ear-a');
  const autoEq = await loadAutoEqBands(source);
  assert.equal(autoEq.bands.length, 8);
  assert.ok(autoEq.bands.every((band) => typeof band.gain === 'number'));

  const cases = [
    { device: 'nothing-ear-2024', genre: 'reggaeton', context: 'gym', target: 'club-bass', bass: 1, vocal: 1, energy: 1, name: 'Test Reggaeton', expectSource: true },
    { device: 'nothing-ear-2', genre: 'pop', target: 'soft-treble', vocal: 2, treble: -1, warmth: 1, name: 'Test Pop', expectSource: true },
    { device: 'nothing-ear-a', genre: 'video', context: 'home', bass: -1, vocal: 2, name: 'Test Video', expectSource: true },
    { device: 'nothing-ear-3', genre: 'piano', warmth: 1, treble: 0, name: 'Test Piano', expectSource: false },
    { device: 'generic', genre: 'electronic', context: 'club', bass: 2, energy: 2, treble: 1, name: 'Test Club', expectSource: false },
  ];

  for (const options of cases) {
    const profile = await designProfile(options);
    validateProfile(profile);
    assertBandsInRange(profile);
    assert.equal(profile.preferences.bass, options.bass ?? 0);
    assert.equal(profile.preferences.vocal, options.vocal ?? 0);
    assert.ok(profile.confidence);
    assert.ok(profile.sourceUsed);
    assert.ok(profile.targetUsed);
    assert.ok(profile.riskReport?.risks?.length);
    if (options.expectSource) assert.notEqual(profile.sourceUsed, 'heuristic-device-profile');
  }

  console.log(`Expert designer tests passed (${cases.length} profiles)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
