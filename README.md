<div align="center">
  <img src="assets/banner.png?v=2" alt="Nothing X EQ Toolkit Banner" width="100%">
  <br/>
  <h1>Nothing Ear EQ QR Profiles</h1>
  <p>Generate importable Nothing X advanced EQ QR codes for Nothing Ear devices.</p>
</div>

This repository contains:

- a reproducible Node.js generator for Nothing X QR payloads;
- an expert profile designer that combines device tuning, genre rules, and user taste;
- AutoEq-lite support for selected Nothing measurements;
- validated EQ presets for reggaeton, pop, video/dialogue, and piano/acoustic music;
- technical compatibility rules for Nothing X import;
- an agent skill that teaches Codex-style agents how to design new profiles from a genre and user taste.

## Quick Start

```powershell
npm install
npm run import:autoeq
npm run validate
npm run generate
```

Generated QR codes are written to:

```text
qr/
```

Use the clean PNG files from that folder to import profiles in the Nothing X app.

### Example Profile

<div align="center">
  <img src="qr/reggaeton-base-protagonista.png" alt="Reggaeton Example EQ Profile" width="300">
</div>

## Expert Designer

Generate a new profile from hardware, genre and taste:

```powershell
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --treble=0 --energy=1 --name="Reggaeton Expert"
```

Or run the guided assistant:

```powershell
npm run design
```

Generate the acceptance examples for the agent workflow:

```powershell
npm run design:examples
```

Designed profiles are written to `output/designed/` by default. The designer uses:

- `devices/*.json` for Nothing Ear hardware compensation;
- `autoeq-sources/manifest.json` and `autoeq-sources/data/` for selected AutoEq Nothing measurements;
- `targets/*.json` for tonal targets such as natural, vocal clarity and club bass;
- `profiles/genre-rules/*.json` for genre-specific tuning;
- `src/profile-designer.js` to combine hardware, style and preferences safely.

## Current Presets

The recommended profiles live in [presets/default-profiles.json](presets/default-profiles.json):

- `Reggaeton Equilibrado`
- `Reggaeton Fiesta Club`
- `Reggaeton Base Protagonista`
- `Reggaeton Voz y Base`
- `Pop Vocal Brillante`
- `Video Voz Clara`
- `Piano Natural`

Each preset includes:

- profile name shown in Nothing X;
- listening intent;
- Bass Enhance recommendation;
- 8 parametric EQ bands: frequency, Q, gain.

## Repository Structure

```text
src/
  nothing-x-eq.js              Core encoder, validator, QR writer
  autoeq-adapter.js            AutoEq CSV adapter to Nothing X bands
scripts/
  import-autoeq.js             Downloads selected Nothing AutoEq CSV/README files
  generate-qrs.js              Generate QR files from presets
  validate-profiles.js         Validate presets before QR generation
presets/
  default-profiles.json        Recommended profiles
  example-custom-profile.json  Template for a new profile
devices/
  *.json                       Nothing Ear model compensation data
autoeq-sources/
  manifest.json                Selected AutoEq Nothing sources
  data/                        Downloaded selected CSV/README source files
targets/
  *.json                       Tonal targets used by the expert designer
profiles/
  genre-rules/*.json           Genre and use-case tuning rules
docs/
  agent-guide.md               How an agent should design new profiles
  autoeq-lite.md               Scoped AutoEq import/adaptation details
  expert-designer.md           Device + genre + taste synthesis model
  nothing-x-format.md          QR payload format and compatibility rules
  repo-workflow.md             Clone/edit/generate workflow
legacy/
  README.md                    Historical one-off scripts and experiments
skills/
  nothing-ear-eq-expert/       Reusable Codex skill for this domain
qr/                            Clean generated QRs ready for Nothing X
```

## Generate a Custom Profile

Copy the example preset:

```powershell
Copy-Item presets\example-custom-profile.json presets\my-profile.json
```

Edit `presets\my-profile.json`, then run:

```powershell
node scripts/validate-profiles.js --presets=presets/my-profile.json
node scripts/generate-qrs.js --presets=presets/my-profile.json --out=output/my-profile
```

## Nothing X Compatibility Rules

Nothing X can reject a QR even if a generic QR scanner reads it. The most important rule is that each band must stay inside its original frequency range:

| Band | Valid range |
| --- | --- |
| 1 | 20-100 Hz |
| 2 | 100-200 Hz |
| 3 | 200-400 Hz |
| 4 | 400-1000 Hz |
| 5 | 1000-3000 Hz |
| 6 | 3000-6000 Hz |
| 7 | 6000-12000 Hz |
| 8 | 12000-20000 Hz |

The validator enforces this. Do not bypass validation.

More detail: [docs/nothing-x-format.md](docs/nothing-x-format.md).

## For Agents

When an agent is asked to create a profile for a genre, artist, or taste:

1. Read [skills/nothing-ear-eq-expert/SKILL.md](skills/nothing-ear-eq-expert/SKILL.md).
2. Read the referenced files:
   - [skills/nothing-ear-eq-expert/references/nothing-x-qr-rules.md](skills/nothing-ear-eq-expert/references/nothing-x-qr-rules.md)
   - [skills/nothing-ear-eq-expert/references/profile-design-guide.md](skills/nothing-ear-eq-expert/references/profile-design-guide.md)
3. Design the profile as an audio engineer.
4. Prefer `src/profile-designer.js` / `npm run design` for new optimized profiles.
5. Keep every frequency in its band range.
6. Run validation and generation.
7. Return QR, final table, Bass Enhance, AutoEq source, target, confidence and risk report.
8. Show the generated PNG if the user wants mobile import.

Agent-specific workflow: [docs/agent-guide.md](docs/agent-guide.md).

## QR Payload

The QR encodes a Base64 string. The Base64 string is a gzip-compressed binary payload:

```text
00 60
8 bands:
  gain float32 little-endian
  frequency float32 little-endian
  Q float32 little-endian
01
profile_name_length_bytes
profile_name_utf8
```

Bass Enhance is not encoded in the QR; it must be recommended separately.

## Notes

This project is not affiliated with Nothing. It generates QR payloads compatible with the Nothing X EQ import format observed and tested during this project.
