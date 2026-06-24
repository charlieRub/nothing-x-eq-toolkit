#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const examples = [
  {
    out: 'output/designed/reggaeton-gym-eara',
    args: [
      '--device=nothing-ear-a',
      '--genre=reggaeton',
      '--context=gym',
      '--target=club-bass',
      '--bass=2',
      '--vocal=1',
      '--treble=-1',
      '--name=Reggaeton Gym Voz',
    ],
  },
  {
    out: 'output/designed/video-voz-ear2',
    args: [
      '--device=nothing-ear-2',
      '--genre=video',
      '--context=home',
      '--target=vocal-clarity',
      '--bass=-1',
      '--vocal=2',
      '--treble=-1',
      '--name=Video Voz Ear 2',
    ],
  },
  {
    out: 'output/designed/piano-natural-ear',
    args: [
      '--device=nothing-ear-2024',
      '--genre=piano',
      '--context=home',
      '--target=natural',
      '--warmth=1',
      '--name=Piano Natural Ear',
    ],
  },
  {
    out: 'output/designed/edm-club-generic',
    args: [
      '--device=generic',
      '--genre=electronic',
      '--context=club',
      '--target=club-bass',
      '--bass=2',
      '--energy=2',
      '--treble=1',
      '--name=EDM Club Generic',
    ],
  },
];

for (const example of examples) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'design-profile.js'), ...example.args, `--out=${example.out}`],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
