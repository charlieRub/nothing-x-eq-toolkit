#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { designProfile } = require('../src/profile-designer');
const { writeQr } = require('../src/nothing-x-eq');

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasDirectArgs() {
  return ['device', 'genre', 'context', 'target', 'taste', 'bass', 'vocal', 'treble', 'energy', 'warmth', 'name'].some((name) =>
    process.argv.some((arg) => arg.startsWith(`--${name}=`))
  );
}

async function askGuided() {
  const rl = readline.createInterface({ input, output });
  try {
    const device = await rl.question('Device [nothing-ear-2024, nothing-ear-a, nothing-ear-2, nothing-ear-3, generic]: ');
    const genre = await rl.question('Genre/style [reggaeton, pop, video, piano, hip-hop, electronic, rock]: ');
    const context = await rl.question('Listening context [general, gym, street, home, low-volume, party]: ');
    const target = await rl.question('Target [auto, natural, vocal-clarity, club-bass, low-volume, soft-treble]: ');
    const taste = await rl.question('Taste note [optional, e.g. no harsh treble, strong bass]: ');
    const bass = await rl.question('Bass preference [-1 low, 0 balanced, 1 high, 2 heavy]: ');
    const vocal = await rl.question('Vocal clarity [-1 relaxed, 0 balanced, 1 clear, 2 very clear]: ');
    const treble = await rl.question('Treble/brightness [-1 soft, 0 balanced, 1 bright, 2 very bright]: ');
    const energy = await rl.question('Energy [-1 relaxed, 0 balanced, 1 energetic, 2 club]: ');
    const warmth = await rl.question('Warmth [-1 lean, 0 balanced, 1 warm, 2 very warm]: ');
    const name = await rl.question('Profile name [auto]: ');
    return { device, genre, context, target, taste, bass, vocal, treble, energy, warmth, name };
  } finally {
    rl.close();
  }
}

async function main() {
  const guided = process.argv.includes('--guided') || !hasDirectArgs();
  const answers = guided
    ? await askGuided()
    : {
        device: argValue('device', undefined),
        genre: argValue('genre', undefined),
        context: argValue('context', undefined),
        target: argValue('target', undefined),
        taste: argValue('taste', undefined),
        bass: argValue('bass', undefined),
        vocal: argValue('vocal', undefined),
        treble: argValue('treble', undefined),
        energy: argValue('energy', undefined),
        warmth: argValue('warmth', undefined),
        name: argValue('name', undefined),
      };

  let rawOutDir = argValue('out', path.join('output', 'designed'));
  const outDir = path.resolve(process.cwd(), rawOutDir);
  if (!outDir.startsWith(process.cwd())) {
    throw new Error('Output directory must be within the current working directory for security.');
  }

  const outputJson = process.argv.includes('--json');
  const profile = await designProfile(answers);
  const result = await writeQr(profile, outDir);
  const manifest = {
    ...result,
    png: path.relative(process.cwd(), result.png),
    svg: path.relative(process.cwd(), result.svg),
    payloadTxt: path.relative(process.cwd(), result.payloadTxt),
    device: profile.device,
    genre: profile.genre,
    context: profile.context,
    preferences: profile.preferences,
    targetUsed: profile.targetUsed,
    sourceUsed: profile.sourceUsed,
    confidence: profile.confidence,
    riskReport: profile.riskReport,
    designNotes: profile.designNotes,
  };
  await fs.writeFile(path.join(outDir, `${profile.slug}.json`), `${JSON.stringify(profile, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify([manifest], null, 2)}\n`);

  if (outputJson) {
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`Generated ${profile.name}`);
    console.log(`Device: ${profile.device}`);
    console.log(`Genre: ${profile.genre}`);
    console.log(`Context: ${profile.context}`);
    console.log(`Target: ${profile.targetUsed}`);
    console.log(`Source: ${profile.sourceUsed}`);
    console.log(`Confidence: ${profile.confidence}`);
    console.log(`Bass Enhance: ${profile.bassEnhance}`);
    console.log(`PNG: ${manifest.png}`);
    console.log('Risk report:');
    for (const risk of profile.riskReport.risks) console.log(`- ${risk}`);
    console.log('Design notes:');
    for (const note of profile.designNotes) console.log(`- ${note}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
