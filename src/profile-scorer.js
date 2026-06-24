const BASS_HEAVY_GENRES = new Set(['reggaeton', 'electronic-club', 'hip-hop', 'house', 'hardstyle', 'r-and-b', 'kpop']);
const VOCAL_GENRES = new Set(['pop', 'latin-pop', 'video-voice', 'flamenco']);
const NATURAL_GENRES = new Set(['piano-acoustic', 'jazz', 'lofi-chill']);

function roundGain(value) {
  return Math.round(value * 10) / 10;
}

function positiveGainTotal(bands) {
  return roundGain(bands.reduce((sum, band) => sum + Math.max(0, band.gain), 0));
}

function gainBudgetFor(genre, target, context) {
  if (genre.id === 'video-voice' || target.id === 'vocal-clarity') return 10.5;
  if (NATURAL_GENRES.has(genre.id) || target.id === 'natural' || target.id === 'soft-treble') return 11.5;
  if (target.id === 'low-volume') return 12;
  if (BASS_HEAVY_GENRES.has(genre.id) && (target.id === 'club-bass' || context === 'noisy' || context === 'high-energy')) return 15;
  if (BASS_HEAVY_GENRES.has(genre.id)) return 13.5;
  return 12.5;
}

function bandPriority(index, genre, target, preferences) {
  const band = index + 1;
  let priority = 1;

  if ((target.id === 'club-bass' || preferences.bass > 0) && (band === 1 || band === 2)) priority += 0.65;
  if ((target.id === 'vocal-clarity' || preferences.vocal > 0) && (band === 5 || band === 6)) priority += 0.75;
  if ((target.id === 'soft-treble' || preferences.treble < 0) && band >= 6) priority -= 0.45;
  if (NATURAL_GENRES.has(genre.id) && band >= 6) priority -= 0.25;
  if (VOCAL_GENRES.has(genre.id) && band === 5) priority += 0.35;
  if (band === 8) priority -= 0.35;

  return Math.max(0.35, priority);
}

function applyGainBudget(bands, genre, target, context, preferences) {
  const budget = gainBudgetFor(genre, target, context);
  const before = positiveGainTotal(bands);
  if (before <= budget) {
    return {
      bands,
      budget,
      before,
      after: before,
      reduction: 0,
      applied: false,
    };
  }

  const excess = before - budget;
  const reducers = bands.map((band, index) => {
    if (band.gain <= 0) return 0;
    const priority = bandPriority(index, genre, target, preferences);
    return band.gain / priority;
  });
  const reducerTotal = reducers.reduce((sum, value) => sum + value, 0) || 1;

  const normalized = bands.map((band, index) => {
    if (band.gain <= 0) return band;
    const reduction = excess * (reducers[index] / reducerTotal);
    return { ...band, gain: roundGain(Math.max(0, band.gain - reduction)) };
  });

  return {
    bands: normalized,
    budget,
    before,
    after: positiveGainTotal(normalized),
    reduction: roundGain(before - positiveGainTotal(normalized)),
    applied: true,
  };
}

function scoreProfile({ bands, genre, target, context, preferences, autoEqResult, bassEnhancePlan, budgetReport }) {
  let score = 100;
  const total = positiveGainTotal(bands);
  const sub = bands[0].gain + bands[1].gain;
  const mud = bands[2].gain + Math.max(0, bands[3].gain);
  const vocal = bands[4].gain + 0.65 * bands[5].gain;
  const presence = bands[5].gain + bands[6].gain;
  const air = bands[7].gain;

  if (budgetReport.applied) score -= 2;
  if (total > budgetReport.budget) score -= (total - budgetReport.budget) * 4;
  if (presence > 4.2) score -= (presence - 4.2) * 5;
  if (bands[4].gain + bands[5].gain > 5.2) score -= (bands[4].gain + bands[5].gain - 5.2) * 4;
  if (air > 2.2) score -= (air - 2.2) * 4;
  if (sub > 6.8 && bands[2].gain > -0.8) score -= 6;
  if (mud > 0.5) score -= mud * 4;

  if (target.id === 'club-bass' || preferences.bass > 0) score += Math.min(8, Math.max(0, sub - 2.5));
  if (target.id === 'vocal-clarity' || preferences.vocal > 0) score += Math.min(8, Math.max(0, vocal - 1.5));
  if (context === 'low-volume' && bands[7].gain > 0.4) score += 1.5;
  if (autoEqResult?.consensus) score += 4;
  if (autoEqResult?.source?.confidence === 'high') score += 2;
  if (bassEnhancePlan.level === 1 && (target.id === 'club-bass' || BASS_HEAVY_GENRES.has(genre.id))) score += 1.5;
  if (bassEnhancePlan.level === 1 && preferences.vocal >= 2) score -= 2;

  return roundGain(score);
}

module.exports = {
  positiveGainTotal,
  gainBudgetFor,
  applyGainBudget,
  scoreProfile,
};
