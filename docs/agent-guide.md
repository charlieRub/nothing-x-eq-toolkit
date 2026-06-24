# Agent guide

Use this guide when an agent is asked to create the best Nothing Ear EQ QR for a genre, artist, mood, or listening goal.

## Required behavior

- Behave as an audio engineer, not a random preset generator.
- Ask for clarification only when it materially changes the profile: genre, artist, device model, bass preference, vocal priority, fatigue sensitivity.
- Design the profile first, then map it to the valid Nothing X bands.
- Prefer the expert designer (`npm run design`) when the requested genre exists in `profiles/genre-rules/`.
- Run or assume `npm run import:autoeq` has populated AutoEq data before claiming measurement-backed confidence.
- Validate before generating.
- Tell the user Bass Enhance separately because it is not encoded in the QR.
- Show the generated PNG in chat when the user wants to import from mobile.

## Design checklist

1. Identify the musical target:
   - sub-bass and kick;
   - bass body;
   - low-mid mud;
   - vocal presence;
   - attack and consonants;
   - brightness and air.
2. Choose moderate gain values. Prefer clarity from small cuts plus modest boosts.
3. Keep treble controlled. Nothing Ear devices can become sharp if 4-10 kHz is over-boosted.
4. Keep every band in range:
   - 1: 20-100 Hz
   - 2: 100-200 Hz
   - 3: 200-400 Hz
   - 4: 400-1000 Hz
   - 5: 1000-3000 Hz
   - 6: 3000-6000 Hz
   - 7: 6000-12000 Hz
   - 8: 12000-20000 Hz
5. Run `npm run validate`.
6. Run `npm run generate`.

## Expert designer command

For new optimized profiles, use:

```powershell
npm run design -- --device=<device-id> --genre=<genre-id-or-alias> --context=<context> --target=<target-or-auto> --bass=<level> --vocal=<level> --treble=<level> --energy=<level> --warmth=<level> --name="<short name>"
```

Levels accept `-1`, `0`, `1`, `2` or words such as `low`, `balanced`, `high`, `club`.

Known device ids:

- `nothing-ear-2024`
- `nothing-ear-a`
- `nothing-ear-2`
- `nothing-ear-3`
- `generic-nothing-x`

Known genres are stored in `profiles/genre-rules/`.

Known targets are stored in `targets/`: `natural`, `vocal-clarity`, `club-bass`, `low-volume`, `soft-treble`.

## Required final response

When delivering a generated profile to a user, include:

- QR image or path to the clean PNG;
- final 8-band table;
- Bass Enhance recommendation;
- AutoEq source used or heuristic fallback;
- target used;
- confidence level;
- short explanation and risk report.

## Common mappings

- More lyric clarity: raise band 5 first, then band 6 gently.
- More bass weight: raise band 1 and band 2, then cut band 3 if it gets muddy.
- More club energy: add bands 1, 2, 6, and 7, but keep vocals present.
- Less fatigue: reduce bands 6 and 7 before reducing band 5.
- More natural piano/acoustic: small moves only, no Bass Enhance, gentle air in band 8.
