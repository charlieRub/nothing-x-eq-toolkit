const test = require('node:test');
const assert = require('node:assert/strict');
const { BAND_RANGES, validateProfile, ValidationError } = require('../src/nothing-x-eq');
const { designProfile, parseLevel, softSaturate, detectPreferenceConflicts, CONFIDENCE_MULTIPLIERS } = require('../src/profile-designer');
const { loadAutoEqManifest, selectAutoEqSource, loadAutoEqBands } = require('../src/autoeq-adapter');
const { parsePrompt } = require('../src/prompt-parser');

function assertBandsInRange(profile) {
  profile.bands.forEach((band, index) => {
    const [min, max] = BAND_RANGES[index];
    assert.ok(band.freq >= min && band.freq <= max, `${profile.name} band ${index + 1} freq ${band.freq} out of range ${min}-${max}`);
    assert.ok(band.gain >= -6 && band.gain <= 6, `${profile.name} band ${index + 1} gain ${band.gain} out of Nothing X range`);
    assert.ok(band.q >= 0.7 && band.q <= 2.5, `${profile.name} band ${index + 1} Q ${band.q} out of range`);
  });
}

// ── Unit Tests ──

test('parseLevel correctly normalizes inputs', () => {
  assert.equal(parseLevel('-1'), -1);
  assert.equal(parseLevel('+1'), 1);
  assert.equal(parseLevel('club'), 2);
  assert.equal(parseLevel('balanced'), 0);
  assert.equal(parseLevel('bajo'), -1);
  assert.equal(parseLevel('fuerte'), 1);
});

test('softSaturate applies smooth compression', () => {
  // Below knee: pass-through
  assert.equal(softSaturate(2.0, 5.0), 2.0);
  // Above ceiling: clamp
  assert.equal(softSaturate(6.0, 5.0), 5.0);
  // In the knee zone: compressed but not clipped
  const saturated = softSaturate(4.5, 5.0);
  assert.ok(saturated > 3.75, `Expected > 3.75, got ${saturated}`);
  assert.ok(saturated < 5.0, `Expected < 5.0, got ${saturated}`);
  // Negative floor
  assert.equal(softSaturate(-7.0, 5.0), -6);
});

test('detectPreferenceConflicts catches opposing preferences', () => {
  const conflicts1 = detectPreferenceConflicts({ bass: 2, vocal: 2, treble: 0, energy: 0, warmth: 0 });
  assert.ok(conflicts1.length > 0, 'Should detect bass+vocal conflict');

  const conflicts2 = detectPreferenceConflicts({ bass: 0, vocal: 0, treble: 0, energy: 1, warmth: 1 });
  assert.ok(conflicts2.length > 0, 'Should detect warmth+energy conflict');

  const noConflicts = detectPreferenceConflicts({ bass: 1, vocal: 0, treble: 0, energy: 0, warmth: 0 });
  assert.equal(noConflicts.length, 0, 'Should have no conflicts');
});

test('CONFIDENCE_MULTIPLIERS are properly defined', () => {
  assert.equal(CONFIDENCE_MULTIPLIERS['high'], 1.0);
  assert.equal(CONFIDENCE_MULTIPLIERS['medium-high'], 0.85);
  assert.equal(CONFIDENCE_MULTIPLIERS['medium'], 0.7);
  assert.equal(CONFIDENCE_MULTIPLIERS['low'], 0.5);
});

// ── Prompt Parser Tests ──

test('parsePrompt extracts genre, context and preferences', () => {
  const p1 = parsePrompt("quiero reggaeton con muchos bajos para el gym");
  assert.equal(p1.genre, 'reggaeton');
  assert.equal(p1.context, 'noisy');
  assert.equal(p1.bass, 2); // "muchos bajos" -> 2

  const p2 = parsePrompt("podcast para dormir sin agudos chillones");
  assert.equal(p2.genre, 'video-voice');
  assert.equal(p2.context, 'low-volume');
  assert.equal(p2.treble, -1); // "sin agudos" -> -1

  const p3 = parsePrompt("metal pesado con voces claras");
  assert.equal(p3.genre, 'metal');
  assert.equal(p3.vocal, 1); // "voces" sin modificador alto -> 1

  const p4 = parsePrompt("algo normalito para estudiar");
  assert.equal(p4.genre, 'lofi-chill'); // "estudiar" mapped to lofi-chill
  assert.equal(p4.context, 'general');
});

// ── AutoEQ Tests ──

test('AutoEq Adapter loads correctly', async () => {
  const manifest = await loadAutoEqManifest();
  const source = selectAutoEqSource(manifest, 'nothing-ear-a', 'dhrme-nothing-ear-a');
  assert.equal(source.id, 'dhrme-nothing-ear-a');
  const autoEq = await loadAutoEqBands(source);
  assert.equal(autoEq.bands.length, 8);
  assert.ok(autoEq.bands.every((band) => typeof band.gain === 'number'));
});

// ── Original Genre Profile Tests ──

test('Original genres generate valid profiles', async (t) => {
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

// ── New Genre Profile Tests ──

test('New genres generate valid profiles across all devices', async (t) => {
  const newGenres = ['r-and-b', 'latin-pop', 'jazz', 'metal', 'lofi-chill', 'kpop', 'flamenco', 'house', 'hardstyle'];
  const devices = ['nothing-ear-2024', 'nothing-ear-a', 'nothing-ear-2', 'nothing-ear-1', 'nothing-ear-3', 'generic'];

  for (const genre of newGenres) {
    for (const device of devices) {
      await t.test(`${genre} on ${device}`, async () => {
        const profile = await designProfile({ device, genre, name: `Test ${genre} ${device}` });
        validateProfile(profile);
        assertBandsInRange(profile);
        assert.equal(profile.genre, genre);
        assert.ok(profile.riskReport);
        assert.ok(profile.riskReport.totalPositiveGain >= 0, 'totalPositiveGain should be computed');
      });
    }
  }
});

// ── Context Adjustment Tests ──

test('Context adjustments modify gain', async () => {
  const gym = await designProfile({ device: 'nothing-ear-2024', genre: 'reggaeton', context: 'gym', name: 'Gym Test' });
  const home = await designProfile({ device: 'nothing-ear-2024', genre: 'reggaeton', context: 'home', name: 'Home Test' });
  // Gym (noisy) should have higher band 1 gain than home
  assert.ok(gym.bands[0].gain >= home.bands[0].gain, 'Noisy context should boost sub-bass');
});

// ── Nothing Ear (1) Device Tests ──

test('Nothing Ear (1) device is recognized and uses AutoEQ', async () => {
  const profile = await designProfile({ device: 'nothing-ear-1', genre: 'pop', name: 'Ear 1 Pop Test' });
  validateProfile(profile);
  assertBandsInRange(profile);
  assert.equal(profile.device, 'nothing-ear-1');
  // Ear 1 has an AutoEQ source mapped
  assert.notEqual(profile.sourceUsed, 'heuristic-device-profile');
});

// ── Preference Conflict Integration ──

test('Conflicting preferences are reported in risk report', async () => {
  const profile = await designProfile({ device: 'nothing-ear-2024', genre: 'reggaeton', bass: 2, vocal: 2, name: 'Conflict Test' });
  validateProfile(profile);
  assertBandsInRange(profile);
  assert.ok(profile.riskReport.checks.preferenceConflicts > 0, 'Should detect bass+vocal conflict');
  assert.ok(profile.riskReport.risks.some(r => r.includes('Bass and vocal')), 'Risk report should mention the conflict');
});

// ── Soft Saturation Integration ──

test('Extreme preferences do not exceed gain ceiling', async () => {
  const profile = await designProfile({ device: 'nothing-ear-2024', genre: 'electronic', bass: 2, energy: 2, warmth: 2, name: 'Extreme Test' });
  validateProfile(profile);
  assertBandsInRange(profile);
  // No band should exceed the device ceiling (5.5)
  for (const band of profile.bands) {
    assert.ok(band.gain <= 5.5, `Gain ${band.gain} exceeds ceiling 5.5`);
  }
});

// ── Validation Edge Cases ──

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
  assert.throws(() => validateProfile({ ...validProfile, name: '' }), ValidationError);

  const badQ = JSON.parse(JSON.stringify(validProfile));
  badQ.bands[0].q = 3.0;
  assert.throws(() => validateProfile(badQ), ValidationError);

  const badGain = JSON.parse(JSON.stringify(validProfile));
  badGain.bands[3].gain = 6.5;
  assert.throws(() => validateProfile(badGain), ValidationError);

  const longName = JSON.parse(JSON.stringify(validProfile));
  longName.name = 'A'.repeat(300);
  assert.throws(() => validateProfile(longName), ValidationError);
});
