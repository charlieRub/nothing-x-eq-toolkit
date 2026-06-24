# AutoEq Lite

This project uses a small, scoped subset of AutoEq data for Nothing/CMF devices.

## What is imported

`npm run import:autoeq` downloads only the CSV and README files listed in:

```text
autoeq-sources/manifest.json
```

The downloaded files are stored in:

```text
autoeq-sources/data/
```

## How it is adapted

AutoEq results use dense curves and/or flexible parametric filters. Nothing X requires exactly 8 bands, each locked to a frequency region. `src/autoeq-adapter.js` summarizes the AutoEq CSV `equalization` column into the safe Nothing X zones.

The profile designer then combines:

1. AutoEq compensation summarized to 8 bands;
2. tonal target;
3. genre rule;
4. user taste;
5. context and risk limits.

## Why not copy AutoEq filters directly

AutoEq filters may use low/high shelves, Q values above Nothing X-safe ranges, and frequencies outside Nothing X's per-band regions. Direct conversion would create QR payloads that may be technically readable but invalid or musically poor in Nothing X.
