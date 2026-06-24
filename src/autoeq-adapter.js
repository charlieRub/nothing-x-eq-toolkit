const fs = require('node:fs/promises');
const path = require('node:path');
const { SAFE_ZONES } = require('./nothing-x-eq');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundGain(value) {
  return Math.round(value * 10) / 10;
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
  getAutoEqCompensation,
};
