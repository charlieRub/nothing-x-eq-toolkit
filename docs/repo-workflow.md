# Repository workflow

This repository is designed so a human or coding agent can generate importable Nothing X EQ QR codes from versioned profile data.

## Main flow

1. Read `skills/nothing-ear-eq-expert/SKILL.md`.
2. Read the referenced files:
   - `skills/nothing-ear-eq-expert/references/nothing-x-qr-rules.md`
   - `skills/nothing-ear-eq-expert/references/profile-design-guide.md`
3. Import scoped AutoEq data when measurement-backed design is needed:

```powershell
npm run import:autoeq
```

4. Add or edit a profile in `presets/default-profiles.json` or a new JSON file under `presets/`.
5. Run validation:

```powershell
npm run validate
```

6. Generate clean QR images:

```powershell
npm run generate
```

7. Use PNG files from `qr/` for Nothing X import.

## Expert designer flow

Use this when a user gives a genre and taste rather than a finished preset:

```powershell
npm run import:autoeq
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --energy=1 --name="Reggaeton Expert"
```

The designer combines:

- `devices/*.json`: model-specific compensation and risk bands;
- `autoeq-sources/data/`: selected Nothing AutoEq measurements;
- `targets/*.json`: tonal target choice;
- `profiles/genre-rules/*.json`: genre base curve and preference deltas;
- `src/profile-designer.js`: compatibility-safe profile synthesis.

## Custom profile

Copy `presets/example-custom-profile.json`, edit the profile, then run:

```powershell
node scripts/validate-profiles.js --presets=presets/my-profile.json
node scripts/generate-qrs.js --presets=presets/my-profile.json --out=output/my-profile
```

## Output contract

Each generated output folder contains:

- `*.png`: clean import QR for Nothing X.
- `*.svg`: vector QR.
- `*.txt`: raw Base64 payload encoded by the QR.
- `manifest.json`: generated profile metadata, bands, payload, and file paths.

## Compatibility rule

The most important validation is per-band frequency range. Generic QR scanners may read an invalid profile, but Nothing X can still reject it. Never bypass `validateProfile()`.
