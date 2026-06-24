const { normalizeToken } = require('./profile-designer');

const GENRES = [
  { id: 'reggaeton', keywords: ['reggaeton', 'regueton', 'perreo', 'dembow', 'latin urban'] },
  { id: 'pop', keywords: ['pop', 'mainstream', 'taylor swift', 'dua lipa'] },
  { id: 'hip-hop', keywords: ['hiphop', 'hip-hop', 'rap', 'trap', 'drill'] },
  { id: 'electronic-club', keywords: ['electronic', 'edm', 'techno', 'club', 'dance', 'electronica'] },
  { id: 'house', keywords: ['house', 'tech house', 'deep house', 'progressive', 'groove'] },
  { id: 'hardstyle', keywords: ['hardstyle', 'rawstyle', 'hardcore', 'frenchcore', 'uptempo', 'hard'] },
  { id: 'rock', keywords: ['rock', 'indie', 'punk', 'guitarra electrica'] },
  { id: 'metal', keywords: ['metal', 'heavy', 'death metal', 'thrash', 'hardcore'] },
  { id: 'r-and-b', keywords: ['rnb', 'r&b', 'soul', 'the weeknd', 'sza', 'frank ocean'] },
  { id: 'latin-pop', keywords: ['latin', 'bachata', 'salsa', 'cumbia', 'merengue', 'shakira'] },
  { id: 'kpop', keywords: ['kpop', 'k-pop', 'bts', 'blackpink', 'twice'] },
  { id: 'jazz', keywords: ['jazz', 'bebop', 'miles davis', 'coltrane'] },
  { id: 'flamenco', keywords: ['flamenco', 'rumba', 'bulerias', 'rosalia'] },
  { id: 'lofi-chill', keywords: ['lofi', 'lo-fi', 'chill', 'ambient', 'study', 'relax', 'vaporwave', 'estudiar'] },
  { id: 'piano-acoustic', keywords: ['piano', 'acoustic', 'acustica', 'instrumental', 'classical', 'clasica'] },
  { id: 'video-voice', keywords: ['video', 'youtube', 'series', 'podcast', 'dialogue', 'dialogo', 'voz', 'voice', 'pelicula'] }
];

const INTENSITY_MODIFIERS = {
  high: ['mucho', 'muchos', 'fuerte', 'fuertes', 'extra', 'bastante', 'heavy', 'max', 'mas', 'muy'],
  low: ['poco', 'pocos', 'suave', 'suaves', 'light', 'menos'],
  none: ['sin', 'no', 'cero', 'none']
};

const PREFERENCE_KEYWORDS = {
  bass: ['bajo', 'bajos', 'bass', 'grave', 'graves', 'sub'],
  vocal: ['voz', 'voces', 'vocal', 'letras', 'dialogo', 'claridad'],
  treble: ['agudo', 'agudos', 'brillo', 'treble', 'highs', 'sibilancia', 'chillon'],
  energy: ['energia', 'energy', 'pegada', 'impacto', 'dinamico'],
  warmth: ['calidez', 'warm', 'calido', 'cuerpo', 'body']
};

const CONTEXT_KEYWORDS = {
  noisy: ['gym', 'gimnasio', 'calle', 'street', 'correr', 'running', 'metro', 'bus', 'ruido'],
  home: ['casa', 'home', 'sofa', 'desk', 'oficina'],
  'low-volume': ['noche', 'night', 'silencio', 'quiet', 'bajito', 'dormir'],
  'high-energy': ['fiesta', 'party', 'club']
};

const DEVICES = [
  { id: 'nothing-ear-a', keywords: ['nothing ear a', 'nothing ear (a)', 'ear a', 'ear(a)'] },
  { id: 'nothing-ear-2', keywords: ['nothing ear 2', 'nothing ear (2)', 'ear 2', 'ear(2)'] },
  { id: 'nothing-ear-1', keywords: ['nothing ear 1', 'nothing ear (1)', 'ear 1', 'ear(1)'] },
  { id: 'nothing-ear-3', keywords: ['nothing ear 3', 'ear 3'] },
  { id: 'nothing-ear-2024', keywords: ['nothing ear 2024', 'ear 2024', 'nothing ear'] }
];

const TARGETS = [
  { id: 'club-bass', keywords: ['club bass', 'club', 'fiesta', 'gym', 'bajos fuertes', 'mucha pegada'] },
  { id: 'vocal-clarity', keywords: ['voz clara', 'voces claras', 'claridad vocal', 'entender la voz', 'dialogo claro'] },
  { id: 'soft-treble', keywords: ['sin sibilancia', 'agudos suaves', 'no chillon', 'suave arriba'] },
  { id: 'low-volume', keywords: ['volumen bajo', 'bajito', 'noche', 'dormir'] },
  { id: 'natural', keywords: ['natural', 'balanceado', 'equilibrado', 'fiel'] }
];

/**
 * Helper to find if any keyword from a list exists in the text as a whole word.
 */
function findMatch(text, keywords) {
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(text)) return true;
  }
  return false;
}

/**
 * Searches near a matched preference keyword for intensity modifiers.
 */
function inferIntensity(text, prefKeywords) {
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (prefKeywords.some(pk => normalizeToken(pk) === words[i])) {
      // Look at the previous 2 words and next 1 word for modifiers
      const contextWords = words.slice(Math.max(0, i - 2), i + 2).join(' ');
      
      if (findMatch(contextWords, INTENSITY_MODIFIERS.high)) return 2;
      if (findMatch(contextWords, INTENSITY_MODIFIERS.none)) return -1; // -1 means "none/off" in our scale
      if (findMatch(contextWords, INTENSITY_MODIFIERS.low)) return -1;
      
      // If mentioned but no modifier, assume they want a boost
      return 1;
    }
  }
  return 0; // Default balanced
}

/**
 * Parses a natural language prompt into structured EQ parameters.
 * @param {string} prompt - The natural language request.
 * @returns {Object} Parsed parameters.
 */
function parsePrompt(prompt) {
  const normalized = normalizeToken(prompt);
  
  // 1. Detect Genre
  let detectedGenre = 'pop'; // Default fallback
  for (const g of GENRES) {
    if (findMatch(normalized, g.keywords)) {
      detectedGenre = g.id;
      break;
    }
  }

  // 2. Detect Device
  let detectedDevice;
  for (const device of DEVICES) {
    if (findMatch(normalized, device.keywords)) {
      detectedDevice = device.id;
      break;
    }
  }

  // 3. Detect Target
  let detectedTarget;
  for (const target of TARGETS) {
    if (findMatch(normalized, target.keywords)) {
      detectedTarget = target.id;
      break;
    }
  }

  // 4. Detect Context
  let detectedContext = 'general';
  for (const [ctx, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    if (findMatch(normalized, keywords)) {
      detectedContext = ctx;
      break;
    }
  }

  // 5. Detect Preferences
  const preferences = {};
  for (const [pref, keywords] of Object.entries(PREFERENCE_KEYWORDS)) {
    preferences[pref] = inferIntensity(normalized, keywords);
  }

  return {
    device: detectedDevice,
    genre: detectedGenre,
    target: detectedTarget,
    context: detectedContext,
    bass: preferences.bass,
    vocal: preferences.vocal,
    treble: preferences.treble,
    energy: preferences.energy,
    warmth: preferences.warmth
  };
}

module.exports = {
  parsePrompt,
  GENRES,
  DEVICES,
  TARGETS,
  PREFERENCE_KEYWORDS,
  CONTEXT_KEYWORDS
};
