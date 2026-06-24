#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const { parsePrompt } = require('../src/prompt-parser');
const { designProfile } = require('../src/profile-designer');
const { writeQr } = require('../src/nothing-x-eq');

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const prompt = argValue('prompt', undefined);
  if (!prompt) {
    throw new Error('Please provide a natural language prompt using --prompt="your text here"');
  }

  const device = argValue('device', 'generic-nothing-x');
  let rawOutDir = argValue('out', path.join('output', 'auto-designed'));
  const outDir = path.resolve(process.cwd(), rawOutDir);
  if (!outDir.startsWith(process.cwd())) {
    throw new Error('Output directory must be within the current working directory for security.');
  }

  const outputJson = process.argv.includes('--json');

  // Parse the prompt into structured parameters
  const parsed = parsePrompt(prompt);
  
  const options = {
    ...parsed,
    device: parsed.device || device,
    name: argValue('name', undefined), // allow override, otherwise auto-generated
  };

  // Run the core engine
  const profile = await designProfile(options);
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
    bassEnhancePlan: profile.bassEnhancePlan,
    optimizationReport: profile.optimizationReport,
    riskReport: profile.riskReport,
    designNotes: profile.designNotes,
  };

  await fs.writeFile(path.join(outDir, `${profile.slug}.json`), `${JSON.stringify(profile, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify([manifest], null, 2)}\n`);

  if (outputJson) {
    // Inject the parsed parameters into the output so the caller knows what was inferred
    manifest.inferredFromPrompt = parsed;
    console.log(JSON.stringify(manifest, null, 2));
  } else {
    console.log(`\n--- Auto-Design Report ---`);
    console.log(`Prompt: "${prompt}"`);
    console.log(`Inferred Genre: ${parsed.genre}`);
    console.log(`Inferred Context: ${parsed.context}`);
    console.log(`Inferred Preferences: Bass(${parsed.bass}), Vocal(${parsed.vocal}), Treble(${parsed.treble}), Energy(${parsed.energy}), Warmth(${parsed.warmth})`);
    console.log(`--------------------------\n`);
    
    console.log(`Generated Profile: ${profile.name}`);
    console.log(`Device: ${profile.device}`);
    console.log(`Target: ${profile.targetUsed}`);
    console.log(`Bass Enhance: ${profile.bassEnhance}`);
    console.log(`QR Image: ${manifest.png}`);
    console.log('\nRisk report:');
    for (const risk of profile.riskReport.risks) console.log(`- ${risk}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
