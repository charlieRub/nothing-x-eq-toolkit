const fs = require('node:fs/promises');
const path = require('node:path');
const { SAFE_ZONES, slugify, validateProfile } = require('./nothing-x-eq');
const { getAutoEqConsensus } = require('./autoeq-adapter');
const { bassEnhanceCandidates, formatBassEnhanceRecommendation } = require('./bass-enhance-model');
const { applyGainBudget, scoreProfile } = require('./profile-scorer');

const DEFAULT_DEVICE = 'generic-nothing-x';
const DEFAULT_GENRE = 'pop';
const PREFERENCE_KEYS = ['bass', 'vocal', 'treble', 'energy', 'warmth'];

/** AutoEQ confidence multipliers — scales autoeqWeight by source quality. */
const CONFIDENCE_MULTIPLIERS = {
  high: 1.0,
  'medium-high': 0.85,
  medium: 0.7,
  low: 0.5,
};

/** Context-driven post-target gain offsets per band (8 values). */
const CONTEXT_ADJUSTMENTS = {
  noisy:       [0.3, 0.1, 0, 0, 0.2, 0.3, 0.1, 0],
  'high-energy': [0.2, 0.1, 0, 0, 0.1, 0.2, 0.2, 0.1],
  'low-volume':  [0.4, 0.2, 0, 0, 0.1, 0.1, 0.2, 0.3],
  home:        [0, 0, 0, 0, 0, 0, 0, 0],
  general:     [0, 0, 0, 0, 0, 0, 0, 0],
};

/** Q offsets per target — allows targets to modify bandwidth. */
const TARGET_Q_OFFSETS = {
  'vocal-clarity': [0, 0, 0, 0, 0.3, 0.2, 0, 0],
  'club-bass':     [-0.1, -0.1, 0.1, 0, 0, 0, 0, 0],
  'soft-treble':   [0, 0, 0, 0, 0, -0.1, -0.1, 0],
  'low-volume':    [0, 0, 0, 0, 0, 0, 0, 0],
  natural:         [0, 0, 0, 0, 0, 0, 0, 0],
};

/** Bass-heavy genre IDs that qualify for club-bass target inference. */
const BASS_HEAVY_GENRES = new Set([
  'reggaeton', 'electronic-club', 'hip-hop', 'r-and-b', 'kpop',
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundGain(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Soft saturation function. Applies smooth compression when the raw gain
 * exceeds a threshold (75% of ceiling), instead of hard-clipping.
 * @param {number} raw - The raw gain value before clamping.
 * @param {number} ceiling - The maximum allowed gain (device-specific).
 * @returns {number} The soft-saturated gain value.
 */
function softSaturate(raw, ceiling) {
  const floor = -6;
  if (raw <= floor) return floor;
  if (raw <= ceiling * 0.75) return raw;
  if (raw >= ceiling) return ceiling;
  const knee = ceiling * 0.75;
  const range = ceiling - knee;
  const overshoot = raw - knee;
  const ratio = overshoot / range;
  return knee + range * (1 - Math.exp(-ratio * 1.5)) / (1 - Math.exp(-1.5));
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
  if (BASS_HEAVY_GENRES.has(genre.id) && (preferences.bass >= 1 || preferences.energy >= 1 || context === 'noisy')) {
    return matchByIdOrAlias(targets, 'club-bass', 'natural');
  }
  return matchByIdOrAlias(targets, 'natural', 'natural');
}

function chooseBassEnhance(device, genre, preferences) {
  if (genre.bassEnhance === 'Off.' || genre.id === 'video-voice' || genre.id === 'piano-acoustic' || genre.id === 'flamenco' || genre.id === 'jazz') return 'Off';
  if (preferences.bass >= 2) return 'Off or level 1; avoid stacking high EQ bass with Bass Enhance 2';
  if (preferences.bass >= 1) return 'Level 1 if vocals remain clear; otherwise Off';
  if (preferences.vocal >= 1) return 'Off';
  return device.defaultBassEnhance || genre.bassEnhance || 'Off';
}

/**
 * Detects conflicting preference combinations and returns warnings.
 * @param {Object} preferences - The parsed preference levels.
 * @returns {string[]} Array of conflict warning strings.
 */
function detectPreferenceConflicts(preferences) {
  const conflicts = [];
  if (preferences.bass >= 2 && preferences.vocal >= 2) {
    conflicts.push('Bass and vocal are both maximized; sub-bass may mask vocal clarity. Consider reducing one to level 1.');
  }
  if (preferences.warmth >= 1 && preferences.energy >= 1) {
    conflicts.push('Warmth and energy partially counteract each other on bands 6-7. The net effect may be subtle.');
  }
  if (preferences.warmth >= 1 && preferences.treble >= 1) {
    conflicts.push('Warmth reduces brightness while treble increases it. Consider choosing one direction.');
  }
  if (preferences.bass >= 2 && preferences.warmth >= 2) {
    conflicts.push('Bass and warmth both heavily boost bands 1-2. Risk of low-end saturation.');
  }
  return conflicts;
}

/**
 * Enhanced quality report with expanded risk detection.
 * @param {Array<{freq:number,q:number,gain:number}>} bands - The 8 computed EQ bands.
 * @param {Object} device - Device definition object.
 * @param {Object} genre - Genre rule object.
 * @param {Object} target - Target curve object.
 * @param {Object} preferences - Parsed preference levels.
 * @param {Object|null} autoEqResult - AutoEQ compensation result.
 * @param {string[]} preferenceConflicts - Detected preference conflicts.
 * @returns {Object} Complete quality report.
 */
function qualityReport(bands, device, genre, target, preferences, autoEqResult, preferenceConflicts, optimization) {
  const risks = [];

  // Bass masking check
  if (bands[0].gain + bands[1].gain > 7 && bands[2].gain > -1) {
    risks.push('Strong bass without enough low-mid cut can mask vocals; reduce Bass Enhance if voice gets covered.');
  }

  // Presence/brightness check
  if (bands[5].gain + bands[6].gain > 4) {
    risks.push('Presence/brightness is elevated; sensitive listeners may prefer treble -1 or soft-treble target.');
  }

  // Artificial air check
  if (bands[7].gain > 2) {
    risks.push('Air band is high; can sound artificial on bright masters.');
  }

  // Total positive energy check
  const totalPositiveGain = bands.reduce((sum, band) => sum + Math.max(0, band.gain), 0);
  const gainBudgetLimit = optimization?.gainBudget?.budget || 14;
  if (totalPositiveGain > gainBudgetLimit + 0.2) {
    risks.push(`Total positive gain is ${roundGain(totalPositiveGain)} dB; risk of overall loudness imbalance and distortion at high volume.`);
  }

  if (optimization?.gainBudget?.applied) {
    risks.push(`Gain budget applied: reduced positive gain from ${optimization.gainBudget.before} dB to ${optimization.gainBudget.after} dB for cleaner headroom.`);
  }

  if (autoEqResult?.consensus && autoEqResult.averageBandConfidence < 0.75) {
    risks.push(`AutoEq sources disagree on some bands; consensus confidence is ${autoEqResult.averageBandConfidence}.`);
  }

  // Low-mid mud check (bands 3-4)
  if (bands[2].gain > 0 && bands[3].gain > 0) {
    risks.push('Bands 3-4 are both positive; low-mid region may sound muddy or congested.');
  }

  // Auditory fatigue check (sustained presence)
  if (bands[4].gain + bands[5].gain > 5) {
    risks.push('High presence energy in bands 5-6 may cause auditory fatigue during extended listening.');
  }

  // Include preference conflicts as risks
  risks.push(...preferenceConflicts);

  if (!risks.length) risks.push('No major EQ risk detected within Nothing X limits.');

  return {
    confidence: autoEqResult?.bands ? autoEqResult.source.confidence : device.measurementConfidence || 'low',
    source: autoEqResult?.bands ? autoEqResult.source.id : 'heuristic-device-profile',
    target: target.id,
    totalPositiveGain: roundGain(totalPositiveGain),
    risks,
    checks: {
      nothingXBandRanges: 'pass',
      autoEqAvailable: Boolean(autoEqResult?.bands),
      genreRule: genre.id,
      deviceRiskBands: device.riskBands || {},
      preferenceConflicts: preferenceConflicts.length,
      gainBudget: optimization?.gainBudget?.budget,
      qualityScore: optimization?.score,
      bassEnhancePlan: optimization?.bassEnhancePlan?.id,
      autoEqSourcesUsed: autoEqResult?.sourcesUsed || (autoEqResult?.source ? [autoEqResult.source.id] : []),
    },
  };
}

/**
 * Core synthesis engine. Combines genre base curve, user preferences,
 * target deltas, AutoEQ data, device compensation, context adjustments,
 * risk attenuation, and soft saturation to produce 8 optimized EQ bands.
 * @param {Object} device - Device definition.
 * @param {Object} genre - Genre rule.
 * @param {Object} target - Target curve.
 * @param {Object} preferences - Parsed preference levels.
 * @param {Object|null} autoEqResult - AutoEQ compensation result.
 * @param {string} context - Inferred listening context.
 * @returns {{bands: Array<{freq:number,q:number,gain:number}>, explanations: string[]}}
 */
function designBands(device, genre, target, preferences, autoEqResult, context, bassEnhancePlan = { eqOffset: Array(8).fill(0) }) {
  const compensation = device.bandGainCompensation || Array(8).fill(0);
  const gainCeiling = device.gainCeiling ?? 5;
  const explanations = [];

  // Dynamic AutoEQ weight: base weight from target, modulated by source confidence
  const sourceConfidence = autoEqResult?.source?.confidence || 'low';
  const confidenceMultiplier = CONFIDENCE_MULTIPLIERS[sourceConfidence] || 0.5;
  const autoEqWeight = autoEqResult?.bands ? (target.autoeqWeight ?? 0.45) * confidenceMultiplier : 0;

  const genreWeight = target.genreWeight ?? 1;
  const targetDeltas = target.bandDeltas || Array(8).fill(0);
  const contextGains = CONTEXT_ADJUSTMENTS[context] || Array(8).fill(0);
  const qOffsets = TARGET_Q_OFFSETS[target.id] || Array(8).fill(0);

  const bands = genre.baseBands.map((band, index) => {
    // Sum preference deltas across all 5 keys
    const deltas = PREFERENCE_KEYS.reduce((sum, key) => {
      const delta = genre.preferenceDeltas?.[key]?.[index] || 0;
      return sum + delta * preferences[key];
    }, 0);

    const autoEqGain = autoEqResult?.bands?.[index]?.gain || 0;

    // Strengthened risk attenuation (doubled coefficients)
    const riskCut =
      (preferences.treble > 0 && (device.riskBands?.harshness || []).includes(index + 1) ? -0.4 * preferences.treble : 0) +
      (preferences.bass > 0 && (device.riskBands?.boom || []).includes(index + 1) ? -0.3 * preferences.bass : 0) +
      (preferences.treble > 0 && (device.riskBands?.sibilance || []).includes(index + 1) ? -0.3 * preferences.treble : 0);

    const [safeMin, safeMax] = SAFE_ZONES[index];
    const freq = clamp(band.freq, safeMin, safeMax);

    // Raw gain before saturation
    const rawGain =
      band.gain * genreWeight +
      deltas +
      (targetDeltas[index] || 0) +
      autoEqGain * autoEqWeight +
      (compensation[index] || 0) +
      (contextGains[index] || 0) +
      (bassEnhancePlan.eqOffset?.[index] || 0) +
      riskCut;

    // Apply soft saturation instead of hard clamp
    const gain = roundGain(softSaturate(rawGain, gainCeiling));

    // Q responsive to target
    const baseQ = band.q;
    const qOffset = qOffsets[index] || 0;
    const q = roundGain(clamp(baseQ + qOffset, 0.8, 2.2));

    return { freq, q, gain };
  });

  // Build explanations
  if (autoEqResult?.bands) {
    explanations.push(`Applied AutoEq source ${autoEqResult.source.id} (${autoEqResult.source.provider}) with confidence ${sourceConfidence} (weight: ${roundGain(autoEqWeight)}).`);
  } else if (autoEqResult?.error) {
    explanations.push(`AutoEq source ${autoEqResult.source.id} is mapped but not imported yet: ${autoEqResult.error}`);
  } else {
    explanations.push('No direct AutoEq measurement available; used conservative device heuristics.');
  }
  explanations.push(`Target: ${target.name}. ${target.intent}`);

  if (context !== 'general' && context !== 'home') {
    explanations.push(`Context adjustment applied for ${context} listening environment.`);
  }
  if (bassEnhancePlan.level === 1) {
    explanations.push('Bass Enhance level 1 candidate selected; low EQ bands were reduced to keep bass powerful but clean.');
  }
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
 * @param {string} [options.taste] - Free-text taste note (e.g. 'no harsh treble', 'warm').
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
  const autoEqResult = await getAutoEqConsensus(device, baseDir);
  const preferenceConflicts = detectPreferenceConflicts(preferences);
  const candidates = bassEnhanceCandidates(genre, target, context, preferences).map((bassEnhancePlan) => {
    const designed = designBands(device, genre, target, preferences, autoEqResult, context, bassEnhancePlan);
    const gainBudget = applyGainBudget(designed.bands, genre, target, context, preferences);
    const score = scoreProfile({
      bands: gainBudget.bands,
      genre,
      target,
      context,
      preferences,
      autoEqResult,
      bassEnhancePlan,
      budgetReport: gainBudget,
    });

    return {
      ...designed,
      bands: gainBudget.bands,
      optimization: {
        score,
        gainBudget,
        bassEnhancePlan,
      },
    };
  });

  const selected = candidates.sort((a, b) => b.optimization.score - a.optimization.score)[0];
  const { bands, explanations, optimization } = selected;
  const report = qualityReport(bands, device, genre, target, preferences, autoEqResult, preferenceConflicts, optimization);
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
    bassEnhance: formatBassEnhanceRecommendation(optimization.bassEnhancePlan),
    bassEnhancePlan: {
      id: optimization.bassEnhancePlan.id,
      level: optimization.bassEnhancePlan.level,
      note: optimization.bassEnhancePlan.note,
    },
    optimizationReport: {
      score: optimization.score,
      gainBudget: optimization.gainBudget,
      candidateCount: candidates.length,
      autoEqConsensus: autoEqResult
        ? {
            enabled: Boolean(autoEqResult.consensus),
            sourcesUsed: autoEqResult.sourcesUsed || [autoEqResult.source.id],
            averageBandConfidence: autoEqResult.averageBandConfidence || null,
          }
        : null,
    },
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
  CONFIDENCE_MULTIPLIERS,
  CONTEXT_ADJUSTMENTS,
  TARGET_Q_OFFSETS,
  normalizeToken,
  parseLevel,
  softSaturate,
  detectPreferenceConflicts,
  loadKnowledge,
  designProfile,
};
