# Agent Guide

Use this guide when you (an AI Agent) are asked to create the best Nothing Ear EQ QR for a genre, artist, mood, or listening goal.

## The Auto-Design Workflow (Preferred)

You do NOT need to manually translate a user's natural language request into strict CLI arguments. Use the `design:auto` script which includes a built-in Natural Language Parsing layer:

```powershell
npm run design:auto -- --device=nothing-ear-a --prompt="quiero reggaeton con muchos bajos para el gym" --json
```

The script will automatically infer the genre, context, and taste levels and return a structured JSON response.

## Explicit Design Workflow

If you prefer full control, use the explicit designer:

```powershell
npm run design -- --device=<device-id> --genre=<genre-id-or-alias> --context=<context> --target=<target-or-auto> --bass=<level> --vocal=<level> --treble=<level> --energy=<level> --warmth=<level> --name="<short name>" --json
```

### Available Genres (14)
`reggaeton`, `pop`, `hip-hop`, `electronic-club`, `rock`, `metal`, `r-and-b`, `latin-pop`, `kpop`, `jazz`, `flamenco`, `lofi-chill`, `piano-acoustic`, `video-voice`.

### Available Devices (6)
- `nothing-ear-2024` (High confidence, AutoEQ B&K 5128)
- `nothing-ear-a` (High confidence, AutoEQ B&K 5128)
- `nothing-ear-2` (High confidence, AutoEQ HMS II.3)
- `nothing-ear-1` (Medium-High confidence, AutoEQ HMS II.3)
- `nothing-ear-3` (Low confidence heuristic fallback)
- `generic-nothing-x` (Low confidence fallback)

## Interpreting the Output

When you run the designer with `--json`, you receive a manifest. 

**Pay special attention to `riskReport.risks`**:
The engine will detect acoustic problems (e.g., "Air band is high") and **Preference Conflicts** (e.g., "Bass and vocal are both maximized"). If you see conflicts, communicate them to the user.

## Required final response to the User

When delivering a generated profile to a user, include:
- The **QR image embedded** so the user can scan it directly from the chat.
- The 8-band table.
- **Bass Enhance recommendation** (found in the JSON; remember this is NOT encoded in the QR!).
- Confidence level and Risk Report summary.
