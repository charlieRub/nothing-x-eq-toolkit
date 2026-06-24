# Repository workflow

This repository is designed so a human or coding agent can generate importable Nothing X EQ QR codes from versioned profile data.

## Main flow

1. Read `skills/nothing-ear-eq-expert/SKILL.md`.
2. Import scoped AutoEq data when measurement-backed design is needed:

```powershell
npm run import:autoeq
```

3. Generate clean QR images:

```powershell
npm run generate
```

## AI Agent Auto-Designer flow

When a user requests a profile in natural language, use the Auto-Designer:

```powershell
npm run design:auto -- --device=nothing-ear-2024 --prompt="quiero perreo intenso para el gimnasio pero con voces claras" --json
```

The NLP wrapper (`scripts/design-auto.js` -> `src/prompt-parser.js`) will parse the intent, map it to the 16 internal genres, set the preference deltas, and run the expert designer engine.

## Explicit Expert designer flow

Use this when you want full manual control over the synthesis engine:

```powershell
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --energy=1 --name="Reggaeton Expert" --json
```

The designer combines:
- `devices/*.json`: model-specific compensation and risk bands
- `autoeq-sources/data/`: selected Nothing AutoEq measurements
- `targets/*.json`: tonal target choice and Q offsets
- `profiles/genre-rules/*.json`: genre base curve and preference deltas
- `src/profile-designer.js`: 10-layer compatibility-safe profile synthesis engine

## Output contract

Each generated output folder contains:
- `*.png`: clean import QR for Nothing X.
- `*.svg`: vector QR.
- `*.txt`: raw Base64 payload encoded by the QR.
- `manifest.json`: generated profile metadata, bands, payload, and file paths.

## Compatibility rule

The most important validation is per-band frequency range. The built-in validator (`validateProfile`) ensures compliance with Nothing X limits.
