const fs = require('node:fs/promises');
const path = require('node:path');
const { SAFE_ZONES, slugify, validateProfile } = require('./nothing-x-eq');
const { getAutoEqCompensation } = require('./autoeq-adapter');

const DEFAULT_DEVICE = 'generic-nothing-x';
const DEFAULT_GENRE = 'pop';
const PREFERENCE_KEYS = ['bass', 'vocal', 'treble', 'energy', 'warmth'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundGain(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Normalizes a string token by removing accents, lowercasing, and replacing non-alphanumeric chars with spaces.
 * @param {string|number} value - The value to normalize.
 * @returns {string} The normalized string.
 */
function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Parses a numeric level or descriptive word into a bounded level (-2 to 2).
 * Supports natural language terms like 'low', 'balanced', 'high', 'club'.
 * @param {string|number} value - The input value to parse.
 * @param {number} [fallback=0] - The default value if parsing fails.
 * @returns {number} The clamped level between -2 and 2.
 */
function parseLevel(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return clamp(value, -2, 2);
  const raw = String(value).trim();
  if (/^[+-]?\d+(\.\d+)?$/.test(raw)) return clamp(Number(raw), -2, 2);
  const normalized = normalizeToken(raw);
  if (['none', 'off', 'no', 'bajo', 'low', 'menos', 'light'].includes(normalized)) return -1;
  if (['normal', 'medium', 'medio', 'balanced', 'balanceado'].includes(normalized)) return 0;
  if (['high', 'alto', 'mas', 'more', 'fuerte'].includes(normalized)) return 1;
  if (['max', 'muy alto', 'very high', 'club', 'heavy'].includes(normalized)) return 2;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? clamp(parsed, -2, 2) : fallback;
}

async function loadJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
  const loaded = [];
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    loaded.push(JSON.parse(await fs.readFile(fullPath, 'utf8')));
  }
  return loaded;
}

async function loadJsonFilesIfExists(dir) {
  try {
    return await loadJsonFiles(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function matchByIdOrAlias(items, requested, fallbackId) {
  const normalized = normalizeToken(requested || fallbackId);
  return (
    items.find((item) => normalizeToken(item.id) === normalized) ||
    items.find((item) => normalizeToken(item.name) === normalized) ||
    items.find((item) => (item.aliases || []).some((alias) => normalizeToken(alias) === normalized)) ||
    items.find((item) => (item.aliases || []).some((alias) => normalized.includes(normalizeToken(alias)))) ||
    items.find((item) => item.id === fallbackId)
  );
}

function buildPreferences(options = {}) {
  return {
    bass: parseLevel(options.bass, 0),
    vocal: parseLevel(options.vocal, 0),
    treble: parseLevel(options.treble, 0),
    energy: parseLevel(options.energy, 0),
    warmth: parseLevel(options.warmth, 0),
  };
}

function inferContext(value = '') {
  const normalized = normalizeToken(value);
  if (!normalized) return 'general';
  if (/(gym|gimnasio|training|running|correr|calle|street|metro|bus)/.test(normalized)) return 'noisy';
  if (/(home|casa|sofa|desk|trabajo|office)/.test(normalized)) return 'home';
  if (/(night|noche|low volume|volumen bajo|quiet)/.test(normalized)) return 'low-volume';
  if (/(loud|alto|fiesta|club|party)/.test(normalized)) return 'high-energy';
  return normalized;
}

function inferTarget(options, genre, preferences, context, targets) {
  const requested = matchByIdOrAlias(targets, options.target, undefined);
  if (requested) return requested;
  if (context === 'low-volume') return matchByIdOrAlias(targets, 'low-volume', 'natural');
  if (preferences.treble < 0 || /suave|soft|sibil|chillon|chillones/.test(normalizeToken(options.taste || ''))) {
    return matchByIdOrAlias(targets, 'soft-treble', 'natural');
  }
  if (genre.id === 'video-voice' || preferences.vocal >= 2) return matchByIdOrAlias(targets, 'vocal-clarity', 'natural');
  if ((genre.id === 'reggaeton' || genre.id === 'electronic-club' || genre.id === 'hip-hop') && (preferences.bass >= 1 || preferences.energy >= 1 || context === 'noisy')) {
    return matchByIdOrAlias(targets, 'club-bass', 'natural');
  }
  return matchByIdOrAlias(targets, 'natural', 'natural');
}

function chooseBassEnhance(device, genre, preferences) {
  if (genre.bassEnhance === 'Off.' || genre.id === 'video-voice' || genre.id === 'piano-acoustic') return 'Off';
  if (preferences.bass >= 2) return 'Off or level 1; avoid stacking high EQ bass with Bass Enhance 2';
  if (preferences.bass >= 1) return 'Level 1 if vocals remain clear; otherwise Off';
  if (preferences.vocal >= 1) return 'Off';
  return device.defaultBassEnhance || genre.bassEnhance || 'Off';
}

function qualityReport(bands, device, genre, target, preferences, autoEqResult) {
  const risks = [];
  if (bands[0].gain + bands[1].gain > 7 && bands[2].gain > -1) {
    risks.push('Strong bass without enough low-mid cut can mask vocals; reduce Bass Enhance if voice gets covered.');
  }
  if (bands[5].gain + bands[6].gain > 4) {
    risks.push('Presence/brightness is elevated; sensitive listeners may prefer treble -1 or soft-treble target.');
  }
  if (bands[7].gain > 2) {
    risks.push('Air band is high; can sound artificial on bright masters.');
  }
  if (!risks.length) risks.push('No major EQ risk detected within Nothing X limits.');

  return {
    confidence: autoEqResult?.bands ? autoEqResult.source.confidence : device.measurementConfidence || 'low',
    source: autoEqResult?.bands ? autoEqResult.source.id : 'heuristic-device-profile',
    target: target.id,
    risks,
    checks: {
      nothingXBandRanges: 'pass',
      autoEqAvailable: Boolean(autoEqResult?.bands),
      genreRule: genre.id,
      deviceRiskBands: device.riskBands || {},
    },
  };
}

function designBands(device, genre, target, preferences, autoEqResult) {
  const compensation = device.bandGainCompensation || Array(8).fill(0);
  const gainCeiling = device.gainCeiling ?? 5;
  const explanations = [];
  const autoEqWeight = autoEqResult?.bands ? target.autoeqWeight ?? 0.45 : 0;
  const genreWeight = target.genreWeight ?? 1;
  const targetDeltas = target.bandDeltas || Array(8).fill(0);

  const bands = genre.baseBands.map((band, index) => {
    const deltas = PREFERENCE_KEYS.reduce((sum, key) => {
      const delta = genre.preferenceDeltas?.[key]?.[index] || 0;
      return sum + delta * preferences[key];
    }, 0);
    const autoEqGain = autoEqResult?.bands?.[index]?.gain || 0;
    const riskCut =
      (preferences.treble > 0 && (device.riskBands?.harshness || []).includes(index + 1) ? -0.2 * preferences.treble : 0) +
      (preferences.bass > 0 && (device.riskBands?.boom || []).includes(index + 1) ? -0.15 * preferences.bass : 0);
    const [safeMin, safeMax] = SAFE_ZONES[index];
    const freq = clamp(band.freq, safeMin, safeMax);
    const gain = roundGain(
      clamp(
        band.gain * genreWeight +
          deltas +
          (targetDeltas[index] || 0) +
          autoEqGain * autoEqWeight +
          (compensation[index] || 0) +
          riskCut,
        -6,
        gainCeiling
      )
    );
    const q = roundGain(clamp(band.q, 0.8, 2.2));
    return { freq, q, gain };
  });

  if (autoEqResult?.bands) {
    explanations.push(`Applied AutoEq source ${autoEqResult.source.id} (${autoEqResult.source.provider}) using ${autoEqResult.column} summarized to Nothing X bands.`);
  } else if (autoEqResult?.error) {
    explanations.push(`AutoEq source ${autoEqResult.source.id} is mapped but not imported yet: ${autoEqResult.error}`);
  } else {
    explanations.push('No direct AutoEq measurement available; used conservative device heuristics.');
  }
  explanations.push(`Target: ${target.name}. ${target.intent}`);
  if (preferences.bass > 0) explanations.push('Added low-end weight while keeping band 3 cut to prevent mud.');
  if (preferences.vocal > 0) explanations.push('Prioritized lyric/dialogue clarity through bands 5 and 6.');
  if (preferences.treble > 0) explanations.push('Added brightness with hardware-aware treble restraint.');
  if (preferences.warmth > 0) explanations.push('Added warmth and reduced some presence/brightness for softer listening.');
  if (preferences.energy > 0) explanations.push('Raised impact and presence for a more energetic presentation.');
  if (device.measurementConfidence !== 'high') {
    explanations.push(`Hardware compensation uses ${device.measurementConfidence || 'unknown'} confidence data for ${device.name}.`);
  }

  return { bands, explanations };
}

/**
 * Loads the core knowledge base (devices, genres, targets) from disk.
 * @param {string} [baseDir=process.cwd()] - The repository root directory.
 * @returns {Promise<{devices: Array<Object>, genres: Array<Object>, targets: Array<Object>}>} The loaded knowledge.
 */
async function loadKnowledge(baseDir = process.cwd()) {
  const devices = await loadJsonFiles(path.join(baseDir, 'devices'));
  const genres = await loadJsonFiles(path.join(baseDir, 'profiles', 'genre-rules'));
  const targets = await loadJsonFilesIfExists(path.join(baseDir, 'targets'));
  return { devices, genres, targets };
}

/**
 * Synthesizes an EQ profile based on hardware, genre, target, and user preferences.
 * @param {Object} [options={}] - Design preferences.
 * @param {string} [options.device] - Device ID or alias.
 * @param {string} [options.genre] - Genre ID or alias.
 * @param {string} [options.context] - Listening context (e.g. 'gym', 'home').
 * @param {string} [options.target] - Target curve ID or alias.
 * @param {number|string} [options.bass] - Bass preference level (-2 to 2).
 * @param {number|string} [options.vocal] - Vocal clarity level (-2 to 2).
 * @param {number|string} [options.treble] - Treble level (-2 to 2).
 * @param {number|string} [options.energy] - Energy level (-2 to 2).
 * @param {number|string} [options.warmth] - Warmth level (-2 to 2).
 * @param {string} [options.name] - Custom name for the profile.
 * @param {string} [baseDir=process.cwd()] - The repository root directory.
 * @returns {Promise<Object>} The final validated profile object.
 */
async function designProfile(options = {}, baseDir = process.cwd()) {
  const { devices, genres, targets } = await loadKnowledge(baseDir);
  const device = matchByIdOrAlias(devices, options.device, DEFAULT_DEVICE);
  const genre = matchByIdOrAlias(genres, options.genre, DEFAULT_GENRE);
  if (!device) throw new Error(`Unknown device: ${options.device || DEFAULT_DEVICE}`);
  if (!genre) throw new Error(`Unknown genre: ${options.genre || DEFAULT_GENRE}`);

  const preferences = buildPreferences(options);
  const context = inferContext(options.context);
  const target = inferTarget(options, genre, preferences, context, targets);
  const autoEqResult = await getAutoEqCompensation(device, baseDir);
  const { bands, explanations } = designBands(device, genre, target, preferences, autoEqResult);
  const report = qualityReport(bands, device, genre, target, preferences, autoEqResult);
  const name = options.name || `${genre.name} ${device.name}`.replace(/^Nothing\s+/i, '').slice(0, 32).trim();
  const profile = {
    name,
    slug: options.slug || slugify(name),
    device: device.id,
    genre: genre.id,
    context,
    target: target.id,
    targetUsed: target.id,
    sourceUsed: report.source,
    confidence: report.confidence,
    intent: `${genre.intent} Optimized for ${device.name}.`,
    bassEnhance: chooseBassEnhance(device, genre, preferences),
    designNotes: [
      `Device: ${device.name}. ${device.notes}`,
      `Genre: ${genre.name}. ${genre.intent}`,
      ...explanations,
    ],
    riskReport: report,
    preferences,
    bands,
  };

  validateProfile(profile);
  return profile;
}

module.exports = {
  DEFAULT_DEVICE,
  DEFAULT_GENRE,
  PREFERENCE_KEYS,
  normalizeToken,
  parseLevel,
  loadKnowledge,
  designProfile,
};
