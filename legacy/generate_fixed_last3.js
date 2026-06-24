const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const profiles = [
  {
    name: 'Pop Vocal Brillante',
    file: 'pop-vocal-brillante',
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
    file: 'video-voz-clara-fixed',
    bands: [
      { freq: 80, q: 1.0, gain: -1.0 },
      { freq: 180, q: 1.2, gain: -1.5 },
      { freq: 320, q: 1.5, gain: -1.0 },
      { freq: 700, q: 1.3, gain: 0.7 },
      { freq: 1500, q: 1.2, gain: 1.6 },
      { freq: 2800, q: 1.1, gain: 2.5 },
      { freq: 4500, q: 1.2, gain: 1.6 },
      { freq: 8500, q: 1.0, gain: 0.4 },
    ],
  },
  {
    name: 'Piano Natural',
    file: 'piano-natural',
    bands: [
      { freq: 55, q: 1.0, gain: 0.8 },
      { freq: 130, q: 1.2, gain: 0.4 },
      { freq: 260, q: 1.6, gain: -0.6 },
      { freq: 500, q: 1.2, gain: 0.7 },
      { freq: 1000, q: 1.1, gain: 0.4 },
      { freq: 2500, q: 1.2, gain: 1.1 },
      { freq: 6000, q: 1.1, gain: 0.7 },
      { freq: 12000, q: 0.9, gain: 0.8 },
    ],
  },
];

function encodeProfile(profile) {
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
  const outDir = path.join(process.cwd(), 'nothing-qr', 'fixed-last3');
  await fs.mkdir(outDir, { recursive: true });

  const manifest = [];
  for (const profile of profiles) {
    const payload = encodeProfile(profile);
    const pngFile = path.join(outDir, `${profile.file}.png`);
    const svgFile = path.join(outDir, `${profile.file}.svg`);

    await QRCode.toFile(pngFile, payload, {
      errorCorrectionLevel: 'M',
      margin: 8,
      scale: 18,
      color: { dark: '#000000', light: '#ffffff' },
    });
    await QRCode.toFile(svgFile, payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 8,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const roundTrip = await decodeQr(pngFile);
    if (roundTrip !== payload) throw new Error(`QR verification failed for ${profile.name}`);

    manifest.push({
      name: profile.name,
      png: path.relative(process.cwd(), pngFile),
      svg: path.relative(process.cwd(), svgFile),
      payload,
      bands: profile.bands,
    });
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated fixed QR profiles in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
