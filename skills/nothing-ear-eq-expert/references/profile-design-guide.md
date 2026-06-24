# Profile Design Guide

## General philosophy

Tune for real listening. The profile should preserve musical intent, avoid fatigue, and account for Nothing Ear behavior: good bass capability and detail, but treble can become sharp if boosted too aggressively.

Prefer controlled boosts and strategic cuts. Cutting mud around 250-350 Hz often makes bass and vocals feel clearer without needing extreme treble.

## Band roles

| Band | Role | Common moves |
| --- | --- | --- |
| 1: 20-100 Hz | Sub-bass, rumble, deep kick | Boost for reggaeton/club; reduce for dialogue |
| 2: 100-200 Hz | Punch, warmth, bass body | Boost for body; avoid boom |
| 3: 200-400 Hz | Mud, boxiness, low-mid congestion | Often cut -0.5 to -2.5 dB |
| 4: 400-1000 Hz | Nasal/body region, lower vocal tone | Small cut for clarity or small boost for speech body |
| 5: 1-3 kHz | Main vocal intelligibility | Boost for lyrics, video, pop vocal |
| 6: 3-6 kHz | Presence, attack, consonants | Boost carefully; harsh if excessive |
| 7: 6-12 kHz | Brightness, detail, sibilance | Small boost for sparkle; cut if sharp |
| 8: 12-20 kHz | Air/openess | Gentle boost only; avoid fake hiss |

## Genre patterns

### Reggaeton vocal + bass

Goal: artist understandable, kick/sub strong, dembow base present.

- Band 1: +3 to +4.5 dB around 45-60 Hz.
- Band 2: +1.5 to +2.5 dB around 115-140 Hz.
- Band 3: -1.5 to -2.5 dB around 260-320 Hz.
- Band 4: -0.5 to -1.5 dB around 600-750 Hz.
- Band 5: +1.5 to +2.5 dB around 2000-2400 Hz.
- Band 6: +1.0 to +2.0 dB around 4200-5000 Hz.
- Band 7: +0.8 to +1.8 dB around 8500-9500 Hz.
- Band 8: +0.5 to +1.2 dB around 15000-16000 Hz.
- Bass Enhance: Off or 1. Use 2 only if vocals still stay clear.

### Pop / vocal pop

Goal: vocal forward, clean chorus, controlled bass, bright but not piercing.

- Mild boost in bands 1-2.
- Cut band 3 slightly.
- Boost band 5 and band 6 moderately.
- Keep band 7 under control for sibilant recordings.
- Bass Enhance: Off or 1.

### Video, YouTube, series, podcasts

Goal: dialogue intelligibility over impact.

- Reduce bands 1-3 slightly.
- Keep band 4 neutral or slightly positive for voice body.
- Boost band 5 and band 6 for clarity.
- Use mild band 7; do not over-brighten.
- Bass Enhance: Off.

### Piano, acoustic, instrumental

Goal: natural body, hammer attack, harmonic air, no artificial bass.

- Keep band 1 and 2 subtle.
- Slightly cut band 3 if the piano sounds cloudy.
- Use small boosts in bands 5-8 for attack and air.
- Avoid heavy sub-bass and aggressive 5 kHz boosts.
- Bass Enhance: Off.

## Combining profiles

When combining two profiles, do not average blindly. Determine the primary purpose:

- More vocals: preserve bands 5-6 from the vocal profile.
- More bass: borrow bands 1-2, but keep the mud cut from band 3.
- Less fatigue: reduce bands 6-7 before reducing vocal band 5.
- More natural: reduce extreme boosts and keep Q lower.

After combining, re-check all frequencies against Nothing X band ranges and reduce any gain stack that exceeds +4.5 dB unless the profile is intentionally bass-heavy.

