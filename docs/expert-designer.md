# Expert Designer

The expert designer creates a Nothing X-compatible EQ profile from:

- Nothing Ear device model;
- optional AutoEq measurement source;
- music genre or use case;
- user taste preferences;
- compatibility constraints from the Nothing X QR format.

## Data model

### Device files

Device files live in `devices/*.json`.

```json
{
  "id": "nothing-ear-2024",
  "name": "Nothing Ear 2024",
  "aliases": ["ear", "nothing ear"],
  "measurementConfidence": "medium",
  "notes": "Hardware character and tuning risks.",
  "defaultBassEnhance": "Off or level 1",
  "gainCeiling": 5.5,
  "bandGainCompensation": [0, 0, -0.2, 0, 0.1, -0.2, -0.3, -0.2],
  "riskBands": {
    "mud": [3],
    "harshness": [6, 7]
  }
}
```

`bandGainCompensation` is applied after the genre curve. Positive values add gain; negative values reduce gain.

### Genre rule files

Genre files live in `profiles/genre-rules/*.json`.

```json
{
  "id": "reggaeton",
  "name": "Reggaeton",
  "aliases": ["reggaeton", "latin urban"],
  "intent": "Strong sub-bass and dembow base with clear vocals.",
  "bassEnhance": "Off or level 1.",
  "baseBands": [
    { "freq": 52, "q": 1.0, "gain": 3.8 }
  ],
  "preferenceDeltas": {
    "bass": [0.9, 0.5, -0.2, 0, 0, 0, 0, 0],
    "vocal": [-0.2, -0.2, -0.3, 0.1, 0.7, 0.3, -0.1, 0]
  }
}
```

`baseBands` must contain exactly 8 bands. `preferenceDeltas` arrays must have 8 values; each value is multiplied by the requested preference level.

## Generate a profile

```powershell
npm run import:autoeq
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --treble=0 --energy=1 --warmth=0 --name="Reggaeton Expert"
```

Output files are written to `output/designed/` by default.

## Preference levels

- `-1`: reduce that quality;
- `0`: balanced;
- `1`: emphasize;
- `2`: strong emphasis.

Accepted words include `low`, `balanced`, `high`, `club`, `heavy`, `warm`, and Spanish equivalents such as `bajo`, `medio`, `alto`, `mas`.

## Promotion workflow

After a designed profile works in Nothing X:

1. copy its JSON values into `presets/default-profiles.json`;
2. run `npm run validate`;
3. run `npm run generate`;
4. commit the generated `qr/` files and updated manifest.
