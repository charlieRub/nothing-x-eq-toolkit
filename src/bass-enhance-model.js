const BASS_ENHANCE_LEVEL_1_EQ_OFFSET = [-0.7, -0.35, 0, 0, 0, 0, 0, 0];

function shouldConsiderLevel1(genre, target, context, preferences) {
  if (genre.id === 'video-voice' || genre.id === 'piano-acoustic' || genre.id === 'jazz' || genre.id === 'flamenco') return false;
  if (target.id === 'soft-treble' || target.id === 'vocal-clarity') return preferences.bass >= 1 && preferences.vocal < 2;
  return preferences.bass >= 1 || context === 'noisy' || target.id === 'club-bass';
}

function bassEnhanceCandidates(genre, target, context, preferences) {
  const candidates = [
    {
      id: 'off',
      level: 0,
      label: 'Off',
      note: 'Bass Enhance disabled; bass is handled by Advanced EQ for maximum control.',
      eqOffset: Array(8).fill(0),
    },
  ];

  if (shouldConsiderLevel1(genre, target, context, preferences)) {
    candidates.push({
      id: 'level-1',
      level: 1,
      label: 'Level 1',
      note: 'Bass Enhance level 1 adds physical low-end, so EQ bass is reduced to avoid masking and distortion.',
      eqOffset: BASS_ENHANCE_LEVEL_1_EQ_OFFSET,
    });
  }

  return candidates;
}

function formatBassEnhanceRecommendation(candidate) {
  if (candidate.level === 1) return 'Level 1; the EQ already compensates low bands to avoid stacking too much bass';
  return 'Off';
}

module.exports = {
  BASS_ENHANCE_LEVEL_1_EQ_OFFSET,
  bassEnhanceCandidates,
  formatBassEnhanceRecommendation,
};
