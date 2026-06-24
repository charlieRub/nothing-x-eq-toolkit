const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { Jimp } = require('jimp');

const profiles = [
  {
    name: 'Reggaeton Voz y Base',
    file: 'reggaeton-voz-y-base',
    note: 'Voz delante, bajo con peso y base limpia.',
    bassEnhance: 'Off o nivel 1 si quieres mas golpe sin tapar la voz.',
    bands: [
      { freq: 50, q: 1.0, gain: 4.2 },
      { freq: 120, q: 1.2, gain: 2.3 },
      { freq: 280, q: 1.9, gain: -1.8 },
      { freq: 700, q: 1.7, gain: -1.1 },
      { freq: 2100, q: 1.4, gain: 2.1 },
      { freq: 4300, q: 1.5, gain: 1.5 },
      { freq: 8500, q: 1.2, gain: 1.2 },
      { freq: 15500, q: 0.9, gain: 0.8 },
    ],
  },
  {
    name: 'Pop White Girl',
    file: 'pop-white-girl',
    note: 'Pop vocal brillante, pegada limpia y estribillos abiertos.',
    bassEnhance: 'Off para limpieza; nivel 1 si la cancion queda fina.',
    bands: [
      { freq: 60, q: 1.1, gain: 2.0 },
      { freq: 150, q: 1.2, gain: 0.8 },
      { freq: 300, q: 1.8, gain: -1.2 },
      { freq: 750, q: 1.5, gain: -0.8 },
      { freq: 2300, q: 1.3, gain: 1.8 },
      { freq: 5000, q: 1.4, gain: 2.0 },
      { freq: 9000, q: 1.1, gain: 1.8 },
      { freq: 15000, q: 0.9, gain: 1.2 },
    ],
  },
  {
    name: 'Video Voz Clara',
    file: 'video-voz-clara',
    note: 'Dialogo claro para YouTube, podcasts, series y directos.',
    bassEnhance: 'Off.',
    bands: [
      { freq: 80, q: 1.0, gain: -1.0 },
      { freq: 180, q: 1.3, gain: -1.5 },
      { freq: 320, q: 1.6, gain: -1.2 },
      { freq: 700, q: 1.4, gain: 0.8 },
      { freq: 1500, q: 1.2, gain: 1.7 },
      { freq: 2800, q: 1.1, gain: 2.8 },
      { freq: 4500, q: 1.3, gain: 1.8 },
      { freq: 8500, q: 1.0, gain: 0.5 },
    ],
  },
  {
    name: 'Piano Acustico Natural',
    file: 'piano-acustico-natural',
    note: 'Piano, acustica e instrumental con cuerpo, ataque y aire.',
    bassEnhance: 'Off.',
    bands: [
      { freq: 55, q: 1.0, gain: 0.8 },
      { freq: 130, q: 1.2, gain: 0.5 },
      { freq: 260, q: 1.8, gain: -0.7 },
      { freq: 500, q: 1.2, gain: 0.8 },
      { freq: 1000, q: 1.1, gain: 0.4 },
      { freq: 2500, q: 1.3, gain: 1.2 },
      { freq: 6000, q: 1.2, gain: 0.8 },
      { freq: 12000, q: 0.9, gain: 1.0 },
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
  const outDir = path.join(process.cwd(), 'nothing-qr', 'requested');
  await fs.mkdir(outDir, { recursive: true });

  const manifest = [];
  for (const profile of profiles) {
    const payload = encodeProfile(profile);
    const pngFile = path.join(outDir, `${profile.file}.png`);
    const svgFile = path.join(outDir, `${profile.file}.svg`);
    const txtFile = path.join(outDir, `${profile.file}.txt`);

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
    await fs.writeFile(txtFile, `${payload}\n`);

    const roundTrip = await decodeQr(pngFile);
    if (roundTrip !== payload) throw new Error(`QR verification failed for ${profile.name}`);

    manifest.push({
      name: profile.name,
      note: profile.note,
      bassEnhance: profile.bassEnhance,
      png: path.relative(process.cwd(), pngFile),
      svg: path.relative(process.cwd(), svgFile),
      payloadTxt: path.relative(process.cwd(), txtFile),
      payload,
      bands: profile.bands,
    });
  }

  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${profiles.length} requested Nothing X QR profiles in ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
