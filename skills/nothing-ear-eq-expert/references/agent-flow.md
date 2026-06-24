# Agent Flow

Use this flow for natural user requests such as: "I want a profile for Nothing Ear (a), reggaeton, gym, strong bass but clear vocals."

## 1. Extract request fields

Extract:

- device model;
- genre/style/artist;
- context: general, gym, street, home, low-volume, party;
- preferences: bass, vocal, treble, energy, warmth;
- fatigue notes such as no harsh treble or sensitive to sibilance.

Ask only when device or genre cannot be inferred.

## 2. Generate with the expert designer

Run:

```powershell
npm run import:autoeq
npm run design:auto -- --prompt="<full user request including device, genre, context and taste>" --json
```

Use the explicit `npm run design -- ... --json` command only when you need to override the parsed fields.

Use `--target=club-bass` for gym/club/reggaeton with strong bass, `--target=vocal-clarity` for dialogue or lyric priority, `--target=soft-treble` for treble-sensitive users, and omit target for auto inference.

## 3. Verify and deliver

The output JSON must include:

- `sourceUsed`;
- `targetUsed`;
- `confidence`;
- `riskReport`;
- `optimizationReport`;
- `bassEnhancePlan`;
- `bassEnhance`;
- 8 `bands`.

Final response must include QR image/path, 8-band table, Bass Enhance recommendation, source/consensus, target, confidence, gain-budget summary, risk summary, and short explanation.
