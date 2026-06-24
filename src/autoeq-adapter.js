const fs = require('node:fs/promises');
const path = require('node:path');
const { SAFE_ZONES } = require('./nothing-x-eq');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundGain(value) {
  return Math.round(value * 10) / 10;
}

function confidenceWeight(confidence) {
  return {
    high: 1,
    'medium-high': 0.85,
    medium: 0.7,
    low: 0.5,
  }[confidence] || 0.5;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map((header) => header.trim());
  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, index) => {
        const value = Number(values[index]);
        row[header] = Number.isFinite(value) ? value : values[index];
      });
      return row;
    })
    .filter((row) => Number.isFinite(row.frequency));
}

function summarizeRowsToBands(rows, column = 'equalization') {
  return SAFE_ZONES.map(([min, max], index) => {
    const selected = rows.filter((row) => row.frequency >= min && row.frequency <= max && Number.isFinite(row[column]));
    const sourceRows = selected.length ? selected : rows.filter((row) => Number.isFinite(row[column]));
    const weighted = sourceRows.reduce(
      (acc, row) => {
        const center = (min + max) / 2;
        const distance = Math.abs(Math.log2(row.frequency / center));
        const weight = selected.length ? 1 : 1 / (1 + distance);
        return { sum: acc.sum + row[column] * weight, weight: acc.weight + weight };
      },
      { sum: 0, weight: 0 }
    );
    const gain = weighted.weight ? weighted.sum / weighted.weight : 0;
    return {
      band: index + 1,
      range: [min, max],
      gain: roundGain(clamp(gain, -3.5, 3.5)),
      samples: selected.length,
    };
  });
}

async function loadAutoEqManifest(baseDir = process.cwd()) {
  const manifestPath = path.join(baseDir, 'autoeq-sources', 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return manifest;
}

function selectAutoEqSource(manifest, deviceId, preferredSourceId) {
  const candidates = manifest.sources.filter((source) => source.deviceId === deviceId);
  if (!candidates.length) return null;
  if (preferredSourceId) {
    const preferred = candidates.find((source) => source.id === preferredSourceId);
    if (preferred) return preferred;
  }
  const confidenceRank = { high: 4, 'medium-high': 3, medium: 2, low: 1 };
  return [...candidates].sort((a, b) => (confidenceRank[b.confidence] || 0) - (confidenceRank[a.confidence] || 0))[0];
}

async function loadAutoEqBands(source, baseDir = process.cwd(), column = 'equalization') {
  const localPath = path.join(baseDir, 'autoeq-sources', 'data', `${source.id}.csv`);
  const text = await fs.readFile(localPath, 'utf8');
  const rows = parseCsv(text);
  return {
    source,
    column,
    bands: summarizeRowsToBands(rows, column),
  };
}

async function loadAllAutoEqBandsForDevice(device, baseDir = process.cwd()) {
  const manifest = await loadAutoEqManifest(baseDir);
  const requested = device.autoeqSources || [];
  const sources = manifest.sources.filter((source) => source.deviceId === device.id && (!requested.length || requested.includes(source.id)));
  const loaded = [];
  const errors = [];

  for (const source of sources) {
    try {
      loaded.push(await loadAutoEqBands(source, baseDir, device.autoeqColumn || 'equalization'));
    } catch (error) {
      errors.push({ source: source.id, message: error.message });
    }
  }

  return { manifest, sources, loaded, errors };
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildConsensusBands(loaded) {
  if (!loaded.length) return null;
  return loaded[0].bands.map((_, index) => {
    const points = loaded
      .map((result) => ({
        gain: result.bands[index].gain,
        source: result.source.id,
        confidence: result.source.confidence,
        weight: confidenceWeight(result.source.confidence),
      }))
      .filter((point) => Number.isFinite(point.gain));
    const weightTotal = points.reduce((sum, point) => sum + point.weight, 0) || 1;
    const weightedGain = points.reduce((sum, point) => sum + point.gain * point.weight, 0) / weightTotal;
    const deviation = standardDeviation(points.map((point) => point.gain));
    const disagreementPenalty = index >= 5 ? deviation * 0.35 : deviation * 0.2;
    const confidence = clamp(1 - disagreementPenalty / 3.5, 0.25, 1);

    return {
      band: index + 1,
      range: loaded[0].bands[index].range,
      gain: roundGain(clamp(weightedGain * confidence, -3.5, 3.5)),
      sourceGains: points.map((point) => ({ source: point.source, gain: point.gain, confidence: point.confidence })),
      deviation: roundGain(deviation),
      confidence: roundGain(confidence),
      samples: loaded.reduce((sum, result) => sum + (result.bands[index].samples || 0), 0),
    };
  });
}

async function getAutoEqConsensus(device, baseDir = process.cwd()) {
  const all = await loadAllAutoEqBandsForDevice(device, baseDir);
  if (!all.loaded.length) {
    const preferred = selectAutoEqSource(all.manifest, device.id, device.preferredSource);
    return preferred
      ? {
          source: preferred,
          column: device.autoeqColumn || 'equalization',
          bands: null,
          consensus: false,
          sourcesUsed: [],
          errors: all.errors,
          error: all.errors.map((item) => `${item.source}: ${item.message}`).join('; ') || 'No AutoEq source data loaded',
        }
      : null;
  }

  const preferred = all.loaded.find((result) => result.source.id === device.preferredSource) || all.loaded[0];
  const consensusBands = buildConsensusBands(all.loaded);
  const sourceIds = all.loaded.map((result) => result.source.id);
  const avgConfidence = consensusBands.reduce((sum, band) => sum + band.confidence, 0) / consensusBands.length;
  const sourceConfidence = all.loaded.length > 1 && avgConfidence > 0.68 ? 'high' : preferred.source.confidence;

  return {
    source: {
      ...preferred.source,
      id: all.loaded.length > 1 ? `consensus:${sourceIds.join('+')}` : preferred.source.id,
      provider: all.loaded.length > 1 ? `Consensus (${all.loaded.map((result) => result.source.provider).join(' + ')})` : preferred.source.provider,
      confidence: sourceConfidence,
    },
    column: preferred.column,
    bands: consensusBands,
    consensus: all.loaded.length > 1,
    sourcesUsed: sourceIds,
    sourceCount: all.loaded.length,
    averageBandConfidence: roundGain(avgConfidence),
    errors: all.errors,
  };
}

async function getAutoEqCompensation(device, baseDir = process.cwd()) {
  const manifest = await loadAutoEqManifest(baseDir);
  const source = selectAutoEqSource(manifest, device.id, device.preferredSource);
  if (!source) return null;
  try {
    return await loadAutoEqBands(source, baseDir, device.autoeqColumn || 'equalization');
  } catch (error) {
    return {
      source,
      column: device.autoeqColumn || 'equalization',
      bands: null,
      error: error.message,
    };
  }
}

module.exports = {
  parseCsv,
  summarizeRowsToBands,
  loadAutoEqManifest,
  selectAutoEqSource,
  loadAutoEqBands,
  loadAllAutoEqBandsForDevice,
  buildConsensusBands,
  getAutoEqConsensus,
  getAutoEqCompensation,
};
