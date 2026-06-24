const test = require('node:test');
const assert = require('node:assert/strict');
const { BAND_RANGES, validateProfile, ValidationError } = require('../src/nothing-x-eq');
const { designProfile, parseLevel } = require('../src/profile-designer');
const { loadAutoEqManifest, selectAutoEqSource, loadAutoEqBands } = require('../src/autoeq-adapter');

function assertBandsInRange(profile) {
  profile.bands.forEach((band, index) => {
    const [min, max] = BAND_RANGES[index];
    assert.ok(band.freq >= min && band.freq <= max, `${profile.name} band ${index + 1} out of range`);
  });
}

test('parseLevel correctly normalizes inputs', () => {
  assert.equal(parseLevel('-1'), -1);
  assert.equal(parseLevel('+1'), 1);
  assert.equal(parseLevel('club'), 2);
  assert.equal(parseLevel('balanced'), 0);
  assert.equal(parseLevel('bajo'), -1);
});

test('AutoEq Adapter loads correctly', async () => {
  const manifest = await loadAutoEqManifest();
  const source = selectAutoEqSource(manifest, 'nothing-ear-a', 'dhrme-nothing-ear-a');
  assert.equal(source.id, 'dhrme-nothing-ear-a');
  const autoEq = await loadAutoEqBands(source);
  assert.equal(autoEq.bands.length, 8);
  assert.ok(autoEq.bands.every((band) => typeof band.gain === 'number'));
});

test('Profile Designer generates valid profiles', async (t) => {
  const cases = [
    { device: 'nothing-ear-2024', genre: 'reggaeton', context: 'gym', target: 'club-bass', bass: 1, vocal: 1, energy: 1, name: 'Test Reggaeton', expectSource: true },
    { device: 'nothing-ear-2', genre: 'pop', target: 'soft-treble', vocal: 2, treble: -1, warmth: 1, name: 'Test Pop', expectSource: true },
    { device: 'nothing-ear-a', genre: 'video', context: 'home', bass: -1, vocal: 2, name: 'Test Video', expectSource: true },
    { device: 'nothing-ear-3', genre: 'piano', warmth: 1, treble: 0, name: 'Test Piano', expectSource: false },
    { device: 'generic', genre: 'electronic', context: 'club', bass: 2, energy: 2, treble: 1, name: 'Test Club', expectSource: false },
  ];

  for (const options of cases) {
    await t.test(`Profile: ${options.name}`, async () => {
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
    });
  }
});

test('Validation throws ValidationError on boundary violations', () => {
  const validProfile = {
    name: 'Valid',
    bands: [
      { freq: 50, q: 1.0, gain: 0 },
      { freq: 150, q: 1.0, gain: 0 },
      { freq: 300, q: 1.0, gain: 0 },
      { freq: 700, q: 1.0, gain: 0 },
      { freq: 2000, q: 1.0, gain: 0 },
      { freq: 4500, q: 1.0, gain: 0 },
      { freq: 9000, q: 1.0, gain: 0 },
      { freq: 15000, q: 1.0, gain: 0 }
    ]
  };

  assert.doesNotThrow(() => validateProfile(validProfile));

  // Test missing name
  assert.throws(() => validateProfile({ ...validProfile, name: '' }), ValidationError);

  // Test Q out of bounds
  const badQ = JSON.parse(JSON.stringify(validProfile));
  badQ.bands[0].q = 3.0; // max is 2.5
  assert.throws(() => validateProfile(badQ), ValidationError);

  // Test Gain out of bounds
  const badGain = JSON.parse(JSON.stringify(validProfile));
  badGain.bands[3].gain = 6.5; // max is 6
  assert.throws(() => validateProfile(badGain), ValidationError);

  // Test Long Name
  const longName = JSON.parse(JSON.stringify(validProfile));
  longName.name = 'A'.repeat(300); // max is 255 bytes
  assert.throws(() => validateProfile(longName), ValidationError);
});
