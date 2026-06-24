const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const bandRanges = [
  [20, 100],
  [100, 200],
  [200, 400],
  [400, 1000],
  [1000, 3000],
  [3000, 6000],
  [6000, 12000],
  [12000, 20000],
];

const profiles = [
  {
    name: 'Pop Vocal Brillante',
    file: 'pop-vocal-brillante-compatible',
    bands: [
      { freq: 60, q: 1.1, gain: 2.0 },
      { freq: 150, q: 1.2, gain: 0.8 },
      { freq: 300, q: 1.7, gain: -1.2 },
      { freq: 750, q: 1.5, gain: -0.8 },
      { freq: 2300, q: 1.3, gain: 1.8 },
      { freq: 5000, q: 1.4, gain: 1.8 },
      { freq: 9000, q: 1.1, gain: 1.5 },
      { freq: 15000, q: 0.9, gain: 1.0 },
    ],
  },
  {
    name: 'Video Voz Clara',
    file: 'video-voz-clara-compatible',
    bands: [
      { freq: 60, q: 1.0, gain: -0.5 },
      { freq: 140, q: 1.2, gain: -1.0 },
      { freq: 300, q: 1.5, gain: -1.0 },
      { freq: 700, q: 1.3, gain: 0.5 },
      { freq: 2200, q: 1.2, gain: 1.7 },
      { freq: 4300, q: 1.2, gain: 2.2 },
      { freq: 8500, q: 1.1, gain: 1.1 },
      { freq: 15500, q: 0.9, gain: 0.3 },
    ],
  },
  {
    name: 'Piano Natural',
    file: 'piano-natural-compatible',
    bands: [
      { freq: 55, q: 1.0, gain: 0.7 },
      { freq: 130, q: 1.2, gain: 0.3 },
      { freq: 280, q: 1.6, gain: -0.6 },
      { freq: 650, q: 1.2, gain: 0.5 },
      { freq: 2200, q: 1.2, gain: 0.8 },
      { freq: 4300, q: 1.1, gain: 0.7 },
      { freq: 8500, q: 1.0, gain: 0.5 },
      { freq: 15500, q: 0.9, gain: 0.7 },
    ],
  },
];

function validateProfile(profile) {
  if (profile.bands.length !== 8) throw new Error(`${profile.name}: expected 8 bands`);
  profile.bands.forEach((band, index) => {
    const [min, max] = bandRanges[index];
    if (band.freq < min || band.freq > max) {
      throw new Error(`${profile.name}: band ${index + 1} frequency ${band.freq} outside ${min}-${max} Hz`);
    }
    if (band.q < 0.7 || band.q > 2.5) {
      throw new Error(`${profile.name}: band ${index + 1} Q ${band.q} outside safe range`);
    }
    if (band.gain < -6 || band.gain > 6) {
      throw new Error(`${profile.name}: band ${index + 1} gain ${band.gain} outside Nothing X range`);
    }
  });
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

async function main() {
  const outDir = path.join(process.cwd(), 'nothing-qr', 'compatible-last3');
  await fs.mkdir(outDir, { recursive: true });

  const manifest = [];
  for (const profile of profiles) {
    const payload = encodeProfile(profile);
    const pngFile = path.join(outDir, `${profile.file}.png`);

    await QRCode.toFile(pngFile, payload, {
      errorCorrectionLevel: 'M',
      margin: 8,
      scale: 18,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const roundTrip = await decodeQr(pngFile);
    if (roundTrip !== payload) throw new Error(`QR verification failed for ${profile.name}`);

    manifest.push({
      name: profile.name,
      png: path.relative(process.cwd(), pngFile),
      payload,
      bands: profile.bands,
    });
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated compatible QR profiles in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
