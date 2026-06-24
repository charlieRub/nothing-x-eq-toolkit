const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const BAND_RANGES = [
  [20, 100],
  [100, 200],
  [200, 400],
  [400, 1000],
  [1000, 3000],
  [3000, 6000],
  [6000, 12000],
  [12000, 20000],
];

const SAFE_ZONES = [
  [45, 70],
  [115, 160],
  [260, 330],
  [600, 800],
  [1800, 2600],
  [4000, 5200],
  [8000, 10000],
  [14500, 16000],
];

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') {
    throw new Error('Profile must be an object');
  }
  if (!profile.name || typeof profile.name !== 'string') {
    errors.push('Profile name is required');
  }
  if (!Array.isArray(profile.bands) || profile.bands.length !== 8) {
    errors.push('Profile must contain exactly 8 bands');
  }

  if (Array.isArray(profile.bands)) {
    profile.bands.forEach((band, index) => {
      const label = `band ${index + 1}`;
      const [min, max] = BAND_RANGES[index] || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
      for (const key of ['freq', 'q', 'gain']) {
        if (typeof band?.[key] !== 'number' || Number.isNaN(band[key])) {
          errors.push(`${label}: ${key} must be a number`);
        }
      }
      if (typeof band?.freq === 'number' && (band.freq < min || band.freq > max)) {
        errors.push(`${label}: frequency ${band.freq} Hz is outside ${min}-${max} Hz`);
      }
      if (typeof band?.q === 'number' && (band.q < 0.7 || band.q > 2.5)) {
        errors.push(`${label}: Q ${band.q} is outside safe range 0.7-2.5`);
      }
      if (typeof band?.gain === 'number' && (band.gain < -6 || band.gain > 6)) {
        errors.push(`${label}: gain ${band.gain} dB is outside Nothing X range -6 to +6 dB`);
      }
    });
  }

  const nameBytes = Buffer.byteLength(profile.name || '', 'utf8');
  if (nameBytes > 255) errors.push('Profile name is too long for the QR payload');
  if (nameBytes > 36) errors.push('Profile name should be short for QR reliability');

  if (errors.length) {
    throw new Error(`${profile.name || 'Profile'} is not Nothing X compatible:\n- ${errors.join('\n- ')}`);
  }
}

function encodeProfile(profile) {
  validateProfile(profile);
  const name = Buffer.from(profile.name, 'utf8');
  const data = Buffer.alloc(2 + 8 * 12 + 2 + name.length);
  data[0] = 0x00;
  data[1] = 0x60;

  let offset = 2;
  for (const band of profile.bands) {
    data.writeFloatLE(band.gain, offset);
    data.writeFloatLE(band.freq, offset + 4);
    data.writeFloatLE(band.q, offset + 8);
    offset += 12;
  }

  data[offset] = 0x01;
  data[offset + 1] = name.length;
  name.copy(data, offset + 2);

  return zlib.gzipSync(data).toString('base64');
}

async function decodeQr(file) {
  const img = await Jimp.read(file);
  const { data, width, height } = img.bitmap;
  const decoded = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height);
  return decoded?.data;
}

async function writeQr(profile, outDir, options = {}) {
  const payload = encodeProfile(profile);
  const fileBase = profile.slug || slugify(profile.name);
  const pngPath = path.join(outDir, `${fileBase}.png`);
  const svgPath = path.join(outDir, `${fileBase}.svg`);
  const txtPath = path.join(outDir, `${fileBase}.txt`);

  await fs.mkdir(outDir, { recursive: true });
  const qrOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel || 'M',
    margin: options.margin ?? 8,
    scale: options.scale ?? 18,
    color: { dark: '#000000', light: '#ffffff' },
  };

  await QRCode.toFile(pngPath, payload, qrOptions);
  await QRCode.toFile(svgPath, payload, { ...qrOptions, type: 'svg' });
  await fs.writeFile(txtPath, `${payload}\n`);

  const roundTrip = await decodeQr(pngPath);
  if (roundTrip !== payload) {
    throw new Error(`QR verification failed for ${profile.name}`);
  }

  return {
    name: profile.name,
    slug: fileBase,
    intent: profile.intent || '',
    bassEnhance: profile.bassEnhance || 'Not specified',
    png: pngPath,
    svg: svgPath,
    payloadTxt: txtPath,
    payload,
    bands: profile.bands,
  };
}

async function loadProfiles(file) {
  const raw = await fs.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.profiles)) return parsed.profiles;
  throw new Error(`${file} must be a JSON array or an object with a profiles array`);
}

module.exports = {
  BAND_RANGES,
  SAFE_ZONES,
  slugify,
  validateProfile,
  encodeProfile,
  decodeQr,
  writeQr,
  loadProfiles,
};
