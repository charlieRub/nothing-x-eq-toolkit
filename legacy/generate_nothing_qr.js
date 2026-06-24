const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const profiles = [
  {
    name: 'Reggaeton Equilibrado',
    file: 'reggaeton-equilibrado',
    bands: [
      { freq: 55, q: 1.2, gain: 3.5 },
      { freq: 135, q: 1.3, gain: 1.5 },
      { freq: 280, q: 1.8, gain: -1.5 },
      { freq: 650, q: 1.6, gain: -1.0 },
      { freq: 2200, q: 1.4, gain: 1.5 },
      { freq: 4600, q: 1.5, gain: 2.0 },
      { freq: 8500, q: 1.2, gain: 2.0 },
      { freq: 15500, q: 0.9, gain: 1.5 },
    ],
  },
  {
    name: 'Reggaeton Fiesta Club',
    file: 'reggaeton-fiesta-club',
    bands: [
      { freq: 50, q: 1.0, gain: 5.0 },
      { freq: 125, q: 1.2, gain: 2.5 },
      { freq: 300, q: 2.0, gain: -2.5 },
      { freq: 700, q: 1.8, gain: -1.5 },
      { freq: 2400, q: 1.3, gain: 1.5 },
      { freq: 4800, q: 1.4, gain: 2.5 },
      { freq: 9000, q: 1.1, gain: 3.0 },
      { freq: 16000, q: 0.8, gain: 2.5 },
    ],
  },
  {
    name: 'Reggaeton Base Protagonista',
    file: 'reggaeton-base-protagonista',
    bands: [
      { freq: 45, q: 1.1, gain: 6.0 },
      { freq: 115, q: 1.2, gain: 3.5 },
      { freq: 260, q: 2.2, gain: -2.0 },
      { freq: 600, q: 1.8, gain: -2.0 },
      { freq: 2100, q: 1.4, gain: 1.0 },
      { freq: 4200, q: 1.5, gain: 1.5 },
      { freq: 8000, q: 1.1, gain: 2.0 },
      { freq: 15000, q: 0.8, gain: 1.5 },
    ],
  },
];

function encodeProfile(profile) {
  const name = Buffer.from(profile.name, 'utf8');
  if (profile.bands.length !== 8) throw new Error(`${profile.name}: expected 8 bands`);
  if (name.length > 255) throw new Error(`${profile.name}: name too long`);

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

async function renderPoster(profile, payload, outFile) {
  const qrSvg = await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#ffffff', light: '#000000' },
    width: 780,
  });

  const esc = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const qrBody = qrSvg.replace(new RegExp('</?svg[^>]*>', 'g'), '');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1500" viewBox="0 0 1080 1500">
  <rect width="1080" height="1500" fill="#050505"/>
  <text x="540" y="150" fill="#f2f2f2" font-family="monospace" font-size="64" text-anchor="middle" letter-spacing="8">NOTHING</text>
  <text x="540" y="220" fill="#b9b9b9" font-family="Arial, sans-serif" font-size="34" text-anchor="middle">Advanced equalizer profile</text>
  <g transform="translate(150 300)">${qrBody}</g>
  <circle cx="540" cy="690" r="54" fill="#e7e7e7"/>
  <circle cx="520" cy="674" r="19" fill="#9e9e9e"/>
  <circle cx="558" cy="704" r="16" fill="#e10018"/>
  <text x="540" y="1225" fill="#ffffff" font-family="Georgia, serif" font-size="58" text-anchor="middle">${esc(profile.name)}</text>
  <text x="540" y="1302" fill="#cfcfcf" font-family="Arial, sans-serif" font-size="34" text-anchor="middle">Scan using Nothing X app</text>
</svg>`;

  await fs.writeFile(outFile, svg);
}

async function main() {
  const outDir = path.join(process.cwd(), 'nothing-qr');
  await fs.mkdir(outDir, { recursive: true });

  const manifest = [];
  for (const profile of profiles) {
    const payload = encodeProfile(profile);
    const pngFile = path.join(outDir, `${profile.file}.png`);
    const svgFile = path.join(outDir, `${profile.file}.svg`);
    const posterFile = path.join(outDir, `${profile.file}-poster.svg`);
    const payloadFile = path.join(outDir, `${profile.file}.txt`);

    await QRCode.toFile(pngFile, payload, {
      errorCorrectionLevel: 'H',
      margin: 4,
      scale: 12,
      color: { dark: '#000000', light: '#ffffff' },
    });
    await QRCode.toFile(svgFile, payload, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' },
    });
    await renderPoster(profile, payload, posterFile);
    await fs.writeFile(payloadFile, `${payload}\n`);

    const roundTrip = await decodeQr(pngFile);
    if (roundTrip !== payload) throw new Error(`QR verification failed for ${profile.name}`);

    manifest.push({
      name: profile.name,
      png: path.relative(process.cwd(), pngFile),
      svg: path.relative(process.cwd(), svgFile),
      posterSvg: path.relative(process.cwd(), posterFile),
      payloadTxt: path.relative(process.cwd(), payloadFile),
      payload,
      bands: profile.bands,
    });
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${profiles.length} Nothing X QR profiles in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
