# Handoff — YC Search Product Tour

**Date:** 2026-04-18
**Preview:** `npx hyperframes preview` (from this directory)
**Render:** `npx hyperframes render --output renders/yc-search-tour.mp4`

## What's Built

One monolithic composition (`index.html`) with 6 scene divs + 5 transitions + audio track. Total duration: 39.0s.

| # | Beat                | Start   | End     | Status | Notes |
|---|---------------------|---------|---------|--------|-------|
| 1 | Hook                |  0.00s  |  6.58s  | Built  | Counter 0→5,851 odometer + search-bar reveal + cursor arrival |
| 2 | Semantic search     |  6.58s  | 13.46s  | Built  | Query clip-path typewriter + plate crossfade + "ranked by meaning" callout |
| 3 | Filter              | 13.46s  | 19.00s  | Built  | Industry popover + Healthcare click + counter 5,851→666 collapse |
| 4 | Companion graph     | 19.00s  | 27.20s  | Built  | 190-node Canvas 2D constellation + hover state canvas + Tsenta tooltip |
| 5 | Company profile     | 27.20s  | 34.84s  | Built  | Hero → vertical pan → embedding neighborhood + 4 similar-company rows + leader lines |
| 6 | Closer              | 34.84s  | 39.00s  | Built  | YC-orange logo lockup + avatar marquees + per-word tagline reveal |

All 5 scene-to-scene transitions are velocity-matched blur/scale crossfades. See `STORYBOARD.md` for per-transition easing.

## Audio

| Asset           | Status | Notes                                                                                |
| --------------- | ------ | ------------------------------------------------------------------------------------ |
| narration.wav   | Done   | **OpenAI TTS `onyx` voice** (gpt-4o-mini-tts), 38.9s. Gitignored — regen via command below. |
| transcript.json | Done   | 84 words, word-level Whisper small.en timestamps                                     |
| underscore      | Missing| No music bed — storyboard called for minimal ambient synth; add later if desired     |
| SFX             | Missing| Keystroke ticks, click pops, UI chimes per storyboard — not implemented              |

**Regenerate narration:**
```bash
# Requires OPENAI_API_KEY in ../.env
set -a && source ../.env && set +a
curl -s https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gpt-4o-mini-tts\",\"voice\":\"onyx\",\"response_format\":\"wav\",\"speed\":1.0,\"input\":\"$(cat narration.txt | tr -d '\n' | sed 's/\"/\\\"/g')\",\"instructions\":\"Dry, calm, technical delivery. Pause between sentences. Senior engineer showing a friend a tool they built. Apple-keynote register.\"}" \
  -o narration.wav

npx hyperframes transcribe narration.wav
```

## Assets

- Brand: `captures/yc-search/assets/yc-search-logo.svg`
- Screenshots: `captures/yc-search/screenshots/features/01..07-*.png`
- Company avatars (marquee): `captures/yc-search/assets/image-[1,4-11].png`
- Tsenta avatar: `captures/yc-search/assets/image-1.png`

## Fonts

- Space Grotesk (display, UI, body) — embedded by hyperframes compiler
- Space Mono (tabular numerics: counters, scores) — embedded

## Known Issues / Polish Notes

- **Linter warnings (4):** residual motionPath + opacity overlap flags on `#s3-cursor` and `#s3-popover`. False positives — motionPath does not animate opacity; tweens do not actually conflict at runtime.
- **Seek-safety refactor:** onUpdate / tl.call callbacks do NOT fire during snapshot/render seek passes in this project's version of hyperframes. Everything time-dependent was rewritten to use GSAP transforms, clip-path, or pre-rendered canvases. Do not reintroduce tween-level onUpdate callbacks.
- **Body content scroll:** Scene 5 pans the whole column by -640px. Hero scrolls off before neighborhood scrolls in — they are never co-visible. If you want both visible simultaneously, shorten the pan to ~-380 and make the body + neighborhood closer in y.
- **No underscore music:** the composition is VO-only. Add a `bed.mp3` audio track via `<audio data-volume="0.18" ...>` at the bottom of the root div for an ambient bed.
- **Contrast validator:** reports many `null:1` phantom warnings because all 6 scenes exist in the DOM at once (for seek-safe transitions) — invisible scenes report null bg. Real warnings are resolved.

## Commands

```bash
npx hyperframes preview                    # live studio
npx hyperframes lint                       # static checks
npx hyperframes validate                   # runtime + contrast checks
npx hyperframes snapshot --at 2.5,8.5,14,20,28,33.5  # per-beat visual check
npx hyperframes render --output renders/yc-search-tour.mp4
```

## Files

```
video/
├── index.html              # THE composition (~1400 lines, 6 scenes + audio)
├── DESIGN.md               # brand reference (DO NOT edit colors without updating)
├── SCRIPT.md               # narration text
├── STORYBOARD.md           # beat-by-beat creative direction + transcript anchors
├── HANDOFF.md              # this file
├── narration.wav           # 34.9s Kokoro TTS output
├── narration.txt           # source text for TTS
├── transcript.json         # 84-word timestamps
├── captures/yc-search/     # original Playwright + hyperframes site capture
├── snapshots/              # verification frames (git-ignorable)
├── scripts/
│   └── capture-features.mjs  # Playwright script for the non-landing screenshots
├── node_modules/
├── package.json
└── package-lock.json
```
