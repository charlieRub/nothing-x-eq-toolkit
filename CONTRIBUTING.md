# Contributing

## Add a new profile

1. Add a profile object to `presets/default-profiles.json` or create a new file under `presets/`.
2. Keep exactly 8 bands.
3. Keep each band inside its Nothing X range.
4. Run:

```powershell
npm run validate
npm run generate
```

## Do not commit broken QR experiments

If Nothing X rejects a QR, keep it out of the recommended presets until the cause is fixed. Historical experiments can be kept locally, but the default preset file should contain only importable profiles.

