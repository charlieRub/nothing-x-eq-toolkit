# Nothing X EQ QR format

This project reproduces the import payload format used by Nothing X advanced equalizer sharing.

## Binary structure

The QR contains a Base64 string. That string is a gzip-compressed binary payload:

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

## Band validation

Nothing X appears to validate not only that the QR payload is readable, but also that each of the 8 bands stays in its expected frequency region:

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

Profiles that move a frequency to the wrong band can produce a QR that decodes locally but fails inside Nothing X with a "valid QR not found" style message.

## QR rendering

Use clean black-on-white PNGs with large quiet zone. The generator uses:

```js
{
  errorCorrectionLevel: 'M',
  margin: 8,
  scale: 18,
  color: { dark: '#000000', light: '#ffffff' }
}
```

Decorated QR posters are not recommended for import. Use clean PNGs.

