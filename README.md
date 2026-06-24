<div align="center">
  <img src="assets/banner-v2.png" alt="Nothing X EQ Toolkit Banner" width="100%">
  <br/>
  <h1>Nothing Ear EQ QR Profiles</h1>
  <p>An <b>Agent-First</b> toolkit to generate custom Nothing X advanced EQ QR codes for Nothing Ear devices.</p>
</div>

## 🤖 Agent-First Workflow

This repository is designed to be operated by **AI Agents** (like Cursor, GitHub Copilot, ChatGPT, or Claude). You don't need to write code, configure Node.js, or run manual scripts. Simply provide this repository to your AI assistant and tell it what you want.

The repo includes a built-in skill (`skills/nothing-ear-eq-expert/SKILL.md`) that teaches your AI how to act as your personal audio engineer. It combines hardware tuning, genre rules, and your personal taste to generate an importable QR code.

### How to use it

1. **Open** this repository in an Agent-enabled IDE (like Cursor) or upload the files to your AI chat.
2. **Prompt the Agent** with your audio preferences (headphones model, genre, bass/treble preferences, etc.).
3. **Scan** the generated QR code with your Nothing X app.

### Example Prompt

Try pasting this prompt to your AI Agent:

> *"Diseña un perfil de ecualización para mis auriculares Nothing Ear (a). Escucho principalmente Reggaeton en el gimnasio y me gustan los bajos contundentes (club bass), pero que la voz siga siendo clara. Genera el código QR para importarlo."*

### Example Output

Once the agent generates the profile, it will provide the EQ settings and a QR code ready to be imported into the Nothing X App:

<div align="center">
  <img src="qr/reggaeton-base-protagonista.png" alt="Reggaeton Example EQ Profile" width="300">
</div>

---

## 🛠️ Developer & Manual Usage

If you prefer to run the tools manually without an AI agent, this repository contains:

- A reproducible Node.js generator for Nothing X QR payloads
- An expert profile designer that combines device tuning, genre rules, and user taste
- AutoEq-lite support for selected Nothing measurements
- Validated EQ presets

### Quick Start

```powershell
npm install
npm run import:autoeq
npm run validate
npm run generate
```

Generated QR codes are written to the `qr/` folder. Use the clean PNG files from that folder to import profiles in the Nothing X app.

### Expert Designer

Generate a new profile from hardware, genre and taste manually:

```powershell
npm run design -- --device=nothing-ear-2024 --genre=reggaeton --context=gym --target=club-bass --bass=1 --vocal=1 --treble=0 --energy=1 --name="Reggaeton Expert"
```

Or run the guided assistant:

```powershell
npm run design
```

Generate the acceptance examples for the agent workflow:

```powershell
npm run design:examples
```

## 🎧 Current Presets

The recommended profiles live in [presets/default-profiles.json](presets/default-profiles.json):

- `Reggaeton Equilibrado`
- `Reggaeton Fiesta Club`
- `Reggaeton Base Protagonista`
- `Reggaeton Voz y Base`
- `Pop Vocal Brillante`
- `Video Voz Clara`
- `Piano Natural`

Each preset includes:
- profile name shown in Nothing X;
- listening intent;
- Bass Enhance recommendation;
- 8 parametric EQ bands: frequency, Q, gain.

## 📁 Repository Structure

```text
src/
  nothing-x-eq.js              Core encoder, validator, QR writer
  autoeq-adapter.js            AutoEq CSV adapter to Nothing X bands
scripts/
  import-autoeq.js             Downloads selected Nothing AutoEq CSV/README files
  generate-qrs.js              Generate QR files from presets
  validate-profiles.js         Validate presets before QR generation
presets/
  default-profiles.json        Recommended profiles
  example-custom-profile.json  Template for a new profile
devices/
  *.json                       Nothing Ear model compensation data
autoeq-sources/
  manifest.json                Selected AutoEq Nothing sources
  data/                        Downloaded selected CSV/README source files
targets/
  *.json                       Tonal targets used by the expert designer
profiles/
  genre-rules/*.json           Genre and use-case tuning rules
docs/
  agent-guide.md               How an agent should design new profiles
  autoeq-lite.md               Scoped AutoEq import/adaptation details
  expert-designer.md           Device + genre + taste synthesis model
  nothing-x-format.md          QR payload format and compatibility rules
  repo-workflow.md             Clone/edit/generate workflow
legacy/
  README.md                    Historical one-off scripts and experiments
skills/
  nothing-ear-eq-expert/       Reusable Codex skill for this domain
qr/                            Clean generated QRs ready for Nothing X
```

## ⚙️ Nothing X Compatibility Rules

Nothing X can reject a QR even if a generic QR scanner reads it. The most important rule is that each band must stay inside its original frequency range:

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

The validator enforces this. Do not bypass validation.
More detail: [docs/nothing-x-format.md](docs/nothing-x-format.md).

## 📡 QR Payload

The QR encodes a Base64 string. The Base64 string is a gzip-compressed binary payload:

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

Bass Enhance is not encoded in the QR; it must be recommended separately.

## Notes

This project is not affiliated with Nothing. It generates QR payloads compatible with the Nothing X EQ import format observed and tested during this project.
