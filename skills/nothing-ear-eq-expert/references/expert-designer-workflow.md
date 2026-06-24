# Expert Designer Workflow

Use the expert designer when the user provides a music style, artist, mood, or sound preference rather than exact EQ bands.

## Inputs

Collect or infer:

- device: `nothing-ear-2024`, `nothing-ear-a`, `nothing-ear-2`, `nothing-ear-3`, or `generic-nothing-x`;
- genre/use case: a genre id or alias from `profiles/genre-rules/`;
- context: `general`, `gym`, `street`, `home`, `low-volume`, `party`;
- target: `natural`, `vocal-clarity`, `club-bass`, `low-volume`, `soft-treble`, or auto;
- preferences: `bass`, `vocal`, `treble`, `energy`, `warmth`;
- short profile name.

Preference levels accept `-1`, `0`, `1`, `2`:

- `-1`: less than normal;
- `0`: balanced;
- `1`: more;
- `2`: strong/club/heavy.

## Command

```powershell
npm run import:autoeq
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --treble=0 --energy=1 --warmth=0 --name="Reggaeton Expert"
```

The generated PNG, SVG, raw payload, JSON profile and manifest are written under `output/designed/` unless `--out=` is provided.

## Decision rules

- Use device compensation from `devices/*.json` before applying style preference.
- Use AutoEq data when available and imported.
- Use target data from `targets/*.json`.
- Use genre base curves and deltas from `profiles/genre-rules/*.json`.
- Keep every frequency inside the safe zone for its Nothing X band.
- Treat device measurement confidence honestly; do not claim lab-grade precision when data is medium or low confidence.
- Recommend Bass Enhance separately because it is not encoded in the QR.

## Promotion to preset

Only promote a designed profile into `presets/default-profiles.json` after:

1. `npm run design` generated it successfully;
2. the QR decodes locally;
3. the user or tester confirms Nothing X imports it;
4. `npm run validate` and `npm run generate` pass.
