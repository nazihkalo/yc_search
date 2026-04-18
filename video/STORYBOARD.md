# STORYBOARD — YC Search Product Tour

**Format:** 1920×1080 landscape
**Duration target:** ~45s
**Audio:** ElevenLabs TTS VO + minimal ambient underscore + mechanical UI SFX
**VO direction:** calm, dry, technical, mid-range male. Think senior engineer walking a friend through a tool they built — Apple-keynote calm, Linear-launch pacing. Dead air is OK.
**Style basis:** `DESIGN.md` — deep navy surfaces, saturated chip palette, YC orange mark reserved for logo only. No glassmorphism, no drop shadows, no bouncy springs.

**Underscore direction:** minimal ambient synth bed — a single low pad + a quiet rising arp on a 5-note pentatonic loop. No drum hits. No drop. Sits under VO at about -22 LUFS. Imagine the Linear launch trailer or Replicate "Flux" drop — space, not hype. One gentle swell into Beat 4 (the graph reveal), back down through Beat 5, resolves on Beat 6.

**Global guardrails:**
- Every beat is the dashboard's own world — we don't cut to abstract metaphor scenes. The navy canvas, the 1px borders, the chip palette show up in every frame.
- Every beat has 8–10 visible layers: background dot-grid texture, midground UI surface, foreground content, cursor, floating chips, animated icon.
- Cursor-as-protagonist: a custom arrow cursor is the recurring character. It's the thread. Animate it like Apple does in keynote product demos.
- Techniques mixed per-beat: see per-beat "Techniques" line — always 2–3.

---

## Asset Audit

| Asset                                                            | Type       | Assign to Beat | Role                                                       |
| ---------------------------------------------------------------- | ---------- | -------------- | ---------------------------------------------------------- |
| `captures/yc-search/assets/yc-search-logo.svg`                   | SVG logo   | Beat 1, 6      | Brand mark opener + closer. YC orange square.              |
| `captures/yc-search/screenshots/features/01-table.png`           | Screenshot | Beat 1 → 2     | Background content — stays visible throughout typing       |
| `captures/yc-search/screenshots/features/02-semantic-search.png` | Screenshot | Beat 2         | Reranked-results plate after query types in                |
| `captures/yc-search/screenshots/features/03-filtered.png`        | Screenshot | Beat 3         | Post-filter 666-row table                                  |
| `captures/yc-search/screenshots/features/04-graph.png`           | Screenshot | Beat 4         | 3D constellation base plate                                |
| `captures/yc-search/screenshots/features/06-company-profile.png` | Screenshot | Beat 5         | Tsenta detail page hero                                    |
| `captures/yc-search/screenshots/features/07-company-profile-scroll.png` | Screenshot | Beat 5 | Embedding neighborhood section                         |
| `captures/yc-search/assets/image-1.png`                          | Company avatar | Beat 4 tooltip | "Hover any node" tooltip company image (Tsenta purple-A)|
| `captures/yc-search/assets/image-4,5,6,7,8,9,10,11.png`          | Company avatars| Beat 1, 4   | Scattered across table rows; graph-node halos               |
| `captures/yc-search/assets/svgs/lucide-search.svg`               | Icon       | Beat 2, 6      | Search icon in bar                                          |
| `captures/yc-search/assets/svgs/lucide-funnel.svg`               | Icon       | Beat 3         | Filter affordance next to column headers                    |
| `captures/yc-search/assets/svgs/lucide-network.svg`              | Icon       | Beat 4         | "Show graph" icon pulse                                     |
| `captures/yc-search/assets/svgs/lucide-arrow-up-down.svg`        | Icon       | Beat 3         | Sort affordance                                             |
| `captures/yc-search/assets/svgs/lucide-external-link.svg`        | Icon       | Beat 5         | Profile links row                                           |

Utilization: all 7 feature screenshots used; brand logo in first and last beat; graph (the signature feature) is the centerpiece of Beat 4.

---

## Production Architecture

```
video/
├── index.html                     root composition — VO + underscore + beat orchestration
├── DESIGN.md
├── SCRIPT.md
├── STORYBOARD.md                  THIS FILE
├── narration.wav                  TTS VO from Step 5
├── transcript.json                word-level timestamps from Step 5
├── captures/yc-search/            site capture artifacts + feature screenshots
├── assets/
│   ├── ui/cursor.svg              custom arrow cursor
│   └── music/bed.mp3              ambient bed (optional)
└── compositions/
    ├── beat-1-hook.html
    ├── beat-2-semantic.html
    ├── beat-3-filter.html
    ├── beat-4-graph.html
    ├── beat-5-profile.html
    └── beat-6-closer.html
```

---

## BEAT 1 — HOOK (0:00 → 0:07)

**VO:** "Five thousand, eight hundred, fifty-one Y Combinator companies. One search bar."

**Concept:** We're not fading in from black. We open mid-scroll — a greyed-out table of real YC companies, slightly blurred, slightly desaturated, floating in the navy vault. A counter in the top-left climbs fast: **0 → 5,851**, tabular-numerics flickering like a Bloomberg terminal. As the count lands, the world around it dissolves into a single component: the giant rounded search bar, sliding down from above and snapping into focus under a soft blue focus ring. The YC-orange logo mark crossfades into the top-left corner. Total surface: one bar. Everything else has been taken off the table.

**Visual description (layered):**
- **BG:** navy `#0A1018` canvas with a faint 40px dot-grid (0.03 alpha) that drifts diagonally at 6 px/s. Subtle vignette.
- **Far layer:** the full dashboard table (`01-table.png`), centered, 85% scale, 40% opacity, 8px blur — it reads as "there are thousands of these, we're going to collapse them into one query."
- **Midground:** the counter — massive tabular-numeric `5,851`, 180px, weight 600, color `#EBEFF5`. Counts up over the first 2s. Label underneath: `companies`, 14px, uppercase, `#A7ABB1`, letter-spacing 0.14em.
- **Foreground (arrives at 2.5s):** the search bar — 1200×88px, 22px radius, `#131822` fill, `#2F3640` border, leading `lucide-search` icon on the left, blinking text caret on the right. Slides down from y:-120 with blur:24→0.
- **Accent:** YC-search logo fades in top-left at 3.5s. Small, 36px, `#EA5B21`. Pulses gently (opacity 1 → 0.7 → 1 over 1.4s).
- **Cursor:** custom arrow cursor (`ui/cursor.svg`) flies in from bottom-right, arcs along a `MotionPath`, and lands in the search bar at 5.5s. A soft circular ripple expands from the click point.

**Mood:** the cold-open of a dev-tool demo. Linear's launch video. Replicate's Flux release. Understated, confident, numeric.

**Techniques:** (2) Canvas 2D dot-grid drift · (7) Character typing for the counter (count-up via proxy) · (9) MotionPath cursor arrival

**Animation choreography:**
- `00.0s` — counter proxy {val: 0} → {val: 5851, duration: 2.0, ease: "power2.out"}, render via `textContent = Math.round(val).toLocaleString()`.
- `00.0s` — table plate fades 0 → 0.4 opacity, blur 24 → 8px, 1.5s power2.out.
- `02.2s` — counter settles, slight scale bump to 1.02 and back (0.25s).
- `02.5s` — counter + label SLIDE up off-frame (y:-180, blur 0 → 20, 0.5s power2.in).
- `02.6s` — table plate fades to 0.1 opacity + 18px blur.
- `02.8s` — search bar DROPS in (y:-120 → 0, blur 24 → 0, opacity 0 → 1, 0.8s power3.out).
- `03.3s` — `lucide-search` icon stroke-draws inside the bar (SVG path drawing, 0.5s).
- `03.5s` — YC logo crossfade in top-left, pulse loop begins.
- `04.0s` — caret starts blinking inside the bar at 1Hz.
- `05.5s` — cursor follows a MotionPath arc to bar, lands at `06.0s`, 8px radial ripple scales 0 → 1, alpha 1 → 0 over 0.4s.
- `06.2s` — focus ring around the bar fades in (`box-shadow: 0 0 0 3px rgba(35,102,233,0.45)`).

**SFX:** soft rising hum at `0.0s`. Tiny tick-tick-tick through the counter run. Clean click on the cursor landing at `06.0s`.

**Transition OUT:** velocity-matched upward — focus ring pulses once and the search bar rides with the camera as if we're pulling forward into it. `scale: 1 → 1.02`, blur 0 → 6px, 0.3s power2.in.

---

## BEAT 2 — SEMANTIC SEARCH (0:07 → 0:16)

**VO:** "Type what you actually mean — 'A I agents for healthcare workflows' — and it ranks by meaning, not just keywords."

**Concept:** We're now camera-on-the-search-bar, close enough that only the top third of the dashboard is visible. The cursor taps, the caret engages, and the words TYPE in character-by-character at the natural VO cadence of the narrator reading the query. As the query completes, the ghosted table behind the bar CROSSFADES from the unfiltered `01-table.png` into the reranked `02-semantic-search.png`, with the top row — "Shift Health · 0.427" — RISING into position and its score-pill fading from blank → bright cyan. A tiny "ranking by meaning" floating label ticks on over the `Score` column for 1.5s then retires.

**Visual description (layered):**
- **BG:** same navy + dot-grid, slowly drifting.
- **Far layer:** table plate — starts as `01-table.png` 60% opacity, crossfades at 11.5s to `02-semantic-search.png`.
- **Midground:** giant search bar, pinned at y:260, same look as Beat 1 but 1.05× scaled because we're closer.
- **Foreground:** the query text appears character-by-character inside the bar. Font 28px, `#EBEFF5`. A teal caret blinks next to the final character as it types.
- **Floating annotation:** at `11.5s`, a tiny callout appears above the first reranked row — a thin 1px rounded-corner label "ranked by meaning" in `#599BFF` with a 1px border and a small leader line down to the score cell. It fades out at 14.5s.
- **Chip micro-sparkles:** as the reranked rows materialize, each `Healthcare` chip (pink) pulses once — scale 1 → 1.04 → 1, 0.35s, staggered 0.05s down the column.

**Mood:** cursor choreography. Watching the intent turn into the result. Think Vercel AI SDK demo — understated but precise.

**Techniques:** (7) Character-by-character typing · (4) Per-row staggered reveal on the reranked rows · (1) SVG path draw for the leader-line callout

**Animation choreography:**
- `00.0s` (beat-relative) — cursor sits inside bar, caret blinking. Search icon glows faintly.
- `00.4s` — query starts typing at ~17 chars/sec. Each character triggers a soft keystroke tick (see SFX). String: `AI agents for healthcare workflows`.
- `03.2s` — typing completes. Caret blinks twice, then hides.
- `03.3s → 04.0s` — table plate crossfades from `01-table.png` (0.6 opacity) to `02-semantic-search.png` (0.85 opacity). Simultaneously a top-to-bottom "sort shimmer" — a thin horizontal `#599BFF` line 2px tall sweeps once through the table from y:260 → y:1080 in 0.7s.
- `04.0s` — top 5 rows stagger in (y: 12 → 0, opacity 0 → 1, 0.25s each, 0.06s stagger).
- `04.5s` — score cells counter-animate from `0.000` → their actual values (0.427, 0.404, 0.404, 0.402) in 0.7s. Monospaced.
- `04.7s` — healthcare chips pulse, staggered.
- `04.8s` — callout leader line draws from score column down to label over 0.35s (SVG path draw). Label fades in at 0.35s.
- `07.5s` — callout fades out.

**SFX:** tight mechanical keystrokes during the typing (one short tap per char, 40ms each). A faint "swoosh" on the shimmer. A quiet click at each chip pulse.

**Transition OUT:** blur through — entire frame `blur: 0 → 14px` and the table pushes down and out in 0.35s power2.in.

---

## BEAT 3 — FILTERS (0:16 → 0:23)

**VO:** "Filter by batch, industry, or stage. The table updates on every keystroke."

**Concept:** We pull back slightly to see the full table + column headers. The cursor hovers over the `INDUSTRIES` column header, a little `lucide-funnel` icon EXPANDS into a compact popover listing `Healthcare`, `B2B`, `Industrials`, `Consumer`, `Fintech`. The cursor ticks `Healthcare`. Two things happen **simultaneously** at the moment of the click: (1) a `Healthcare ×` chip drops into the filter rail under the search bar, and (2) a huge tabular counter in the empty left margin COLLAPSES from **5,851 → 666** in 0.9s. The table itself re-populates with only Healthcare rows (`03-filtered.png` plate), the extra rows fading out upward while the remaining rows settle down. The point: filtering is instant and visible.

**Visual description (layered):**
- **BG:** same navy + dot-grid.
- **Far layer:** dashboard plate starts as Beat 2's end state (`02-semantic-search.png`), then crossfades at 19s to `03-filtered.png`.
- **Midground:** the column header row + funnel popover — rendered as real HTML (not an image) so we can animate the popover: 260×200px card, `#131822`, 12px radius, 1px `#2F3640` border, 5 checkbox rows with label + small tinted chip. The `Healthcare` row gets the cursor.
- **Foreground counter:** a single giant tabular-num — `5,851` — at x:80, y:120, size 148px. On filter-apply it animates through `666` (roughly: 5851 → 3200 → 1400 → 800 → 666) then settles. The word `companies` beneath it is unchanged.
- **Filter rail:** new element — a 44px-tall row below the search bar containing the `Healthcare ×` chip. Pink bg `#57193A`, pink fg `#F35863`, 12px radius, with a tiny `×` close-icon.
- **Pagination readout:** secondary text changes from "page 1 of 235" to "page 1 of 27" — counts down with the main counter.

**Mood:** instant feedback, dashboard rigor. Not flashy. The emotional beat is "wow, it's snappy" — communicated by motion latency rather than effects.

**Techniques:** (7) Counter collapse (proxy-driven textContent) · (4) Staggered row exit (filtered-out rows) · (1) Funnel-popover card draw-in

**Animation choreography:**
- `00.0s` — cursor arcs from search bar to `INDUSTRIES` column header via MotionPath. 0.5s.
- `00.5s` — `lucide-funnel` icon scales 1 → 1.15 with a soft cyan glow (1px shadow at `#599BFF`).
- `00.7s` — funnel popover BLOOMS open: `scale: 0.92 → 1`, `y: -8 → 0`, `opacity: 0 → 1`, 0.28s power3.out, origin top-right.
- `01.2s` — cursor moves to the `Healthcare` row inside popover.
- `01.6s` — click — checkbox fills with `#2366E9`, a 6px radial ripple expands + fades.
- `01.65s` — Healthcare chip spawns in the filter rail with a small y-drop (y:-24 → 0, 0.3s power3.out).
- `01.7s` — counter collapse begins. Numbers flicker via proxy, `5,851` → `666`, 0.9s power2.out, with a slight leftward motion blur suggesting mass being shed.
- `01.9s` — rows fade out (every row whose industry ≠ Healthcare): stagger 0.04s, opacity 1 → 0, y: 0 → -12, 0.3s power2.in. Remaining rows settle downward y: +12 → 0.
- `02.6s` — plate crossfades to `03-filtered.png` at 0.9 opacity.
- `02.8s` — pagination readout updates ("page 1 of 27") with a micro-slot-machine flick.
- `03.0s` — funnel popover retreats (opacity 0, y: -6, 0.2s).

**SFX:** soft mechanical "klik" at popover open. Clean tick at checkbox fill. A 3-note descending blip sequence during the counter collapse (5851→…→666). Short clean "thud" on chip drop.

**Transition OUT:** whip pan left — x:0 → -300, blur 0 → 20, 0.3s power3.in. The whole table fares off to the left, as if the camera pivots toward the graph panel.

---

## BEAT 4 — COMPANION GRAPH (0:23 → 0:33)

**VO:** "Open the companion graph, and the whole market shows up as a 3D constellation. Every node is a company. Hover one to peek."

**Concept:** The camera pivots. The left half of the frame still shows the filtered table pushed back (`03-filtered.png` at 60% opacity + 14° rotation perspective tilt, receding into depth). The right half is now a full-bleed **Canvas 2D galaxy**: ~220 soft-glow dots in 5 batch colors (teal / amber / pink / violet / bright-blue), distributed in a 3D-projected spherical cloud that slowly orbits. Thin gossamer links connect near-neighbors. On "Hover one to peek," a custom cursor arcs into the cloud, parks over one dot, and a **company tooltip card** pops up: a 200×220 pill-card containing Tsenta's purple-A avatar (`assets/image-1.png`), the name "Tsenta", a one-line description, and two color chips ("Consumer", "Artificial Intelligence"). As the card appears, the hovered node pulses and a glowing halo expands from it, with the 12 nearest nodes gently attracting toward it by 6–10px.

**Visual description (layered):**
- **BG:** navy `#0A1018` with a very subtle radial glow at 50%/50%, `#2366E9` at 0.08 alpha, feathered 600px — "there's something luminous in the middle."
- **Left third (12%–38% x):** the filtered table plate, pushed back with a perspective transform (`rotateY(-18deg) translateZ(-200px)`), clamped to 70% height, 60% opacity — it reads as "this table, visualized."
- **Right two-thirds:** the graph — a Canvas 2D simulation drawn live:
  - 220 dots, radii 2.5–6px, painted with a 2-pass radial glow (inner solid color, outer soft alpha 0.35). Colors drawn from the 5-batch palette: `#00BAAA` (Summer 2026), `#3D7EFC` (Spring 2026), `#F35863` (Winter 2026), `#C68BD3` (Fall 2025), `#AFAF00` (Summer 2025).
  - ~550 links, 1px, `rgba(150,170,220,0.10)`, drawn between dots within projected distance < 140.
  - Entire cloud slowly orbits on its y-axis at 3 deg/sec — subtle parallax that sells the 3D.
- **Midground:** the cursor, a larger-than-life arrow (1.2× scale), arcs in along a `MotionPath` that curves across the top-right quadrant into the center of the cloud.
- **Foreground tooltip card:** appears when cursor lands at `05.5s`. 200×220, `#131822`, 14px radius, 1px `#2F3640` border. Contents:
  - Avatar: `image-1.png` (purple A-arrow = Tsenta's logo), 56×56, 10px radius, top-center.
  - Name: `Tsenta`, 18px, weight 600, `#EBEFF5`.
  - One-liner: "Matches you to jobs and applies automatically" — 12px, `#A7ABB1`, 2-line clamp.
  - Chip row: `Consumer` (cyan) + `AI` (cyan) + `Summer 2026` (teal), all 11px.
  - A thin SVG leader line draws from the tooltip's bottom edge down to the hovered dot (SVG path drawing technique), settled at `05.85s`.
- **Halo:** on hover, the target dot's radius animates 4 → 10, then a ring expands from it (scale 0 → 2.6, alpha 0.6 → 0, 0.8s).
- **Legend card:** top-right of the graph — the real legend from the site, showing `● Summer 2026 · 212 · ● Spring 2026 · 180 · ...`. Fades in at `01.0s`.

**Mood:** cinematic "here's the big picture." Think Perplexity's sources graph, Obsidian's graph view, or TheFreeMap. Slow, graceful, informational.

**Techniques:** (2) Canvas 2D procedural graph simulation · (9) MotionPath for cursor-to-node arc · (1) SVG path-drawing for the tooltip leader line

**Animation choreography:**
- `00.0s` — on enter, left table plate locks into its perspective pose (`rotateY: 0 → -18deg`, 0.6s power2.out) while the right half fades up from black (1.0s power2.out). The graph canvas starts rendering nodes ASAP.
- `00.0 → 01.5s` — nodes RAIN IN: each node starts at a random offset within the cloud with radius 0, interpolates to its final radius over 0.6s with 0.005s stagger. As nodes settle, links are drawn progressively (fade in 0 → 0.10 alpha over 1.2s).
- `01.0s` — legend card fades in, top-right.
- `01.5 → 04.5s` — entire cloud orbits ~9 degrees total. Continuous slow breath.
- `04.0s` — cursor enters frame from top-right, follows a `MotionPath` curve toward a specific pre-selected node (the "Tsenta" node, positioned at projected x=1380, y=540).
- `05.4s` — cursor arrives on-target. The target node's radius pops 4 → 10 over 0.25s (elastic.out(1, 0.6)). Halo ring starts expanding.
- `05.5s` — tooltip card spawns (scale 0.92 → 1, y: -6 → 0, opacity 0 → 1, 0.3s power3.out). Positioned 28px above-right of the target node.
- `05.6s` — leader line draws from card to node (stroke-dashoffset 0.35s power2.out).
- `05.7s` — 12 nearest nodes experience a 6–10px attraction toward the target, easing in-and-out over 1.4s sinusoidally — then settle back. Creates a living "pull" feel.
- `07.0s` — orbit continues. Tooltip remains pinned.

**SFX:** soft swell-up pad as the graph fades in. A low whoosh at `00.0s`. A quiet "chnk" at the cursor arrival. A rising two-note UI chime when the tooltip pops.

**Transition OUT:** zoom-through on the target node — `scale: 1 → 1.3`, blur `0 → 18px`, the Tsenta tooltip pushes out of frame toward the viewer, and we land inside…

---

## BEAT 5 — COMPANY PROFILE (0:33 → 0:41)

**VO:** "Click through — you get the snapshot, the tags, the forty nearest semantic neighbors, pulled straight from embeddings."

**Concept:** The Tsenta tooltip keeps its avatar and name, but the card EXPANDS — as if the tooltip itself was a portal — into the full Tsenta company profile page. The page reveals itself in two vertical bands: (1) the hero card (back-to-search, purple-A avatar, name, one-liner, chip row) fading in at the top; (2) the two-column body sliding up from below, with the "What they do" + "From their website" content on the left and the Snapshot rail on the right. Then the camera pans down to reveal the **Embedding neighborhood** mini-graph and the **Similar companies** list next to it. As each similar-company row fades in, a faint blue 1px line draws from the central embedding graph out to the named row — you SEE the ranking source.

**Visual description (layered):**
- **BG:** navy.
- **Midground (0:33 → 0:37):** the hero card of `06-company-profile.png` — the purple avatar morphs from the Beat 4 tooltip (continuity trick: we animate the old tooltip element to the new position, then the full profile fades in around it). Back-to-search pill fades in top-left. Hero card border crisps in.
- **Midground (0:37 → 0:41):** camera pans vertically (translateY: -540) to reveal the embedding neighborhood section from `07-company-profile-scroll.png`. On the right: the Similar companies list (Tesora, Taiga, Techmate, Standout, Saffron).
- **Floating accent 1:** three small chips bloom into the hero row (Summer 2026, Early, Consumer, Active) — 0.1s stagger.
- **Floating accent 2:** during the embedding neighborhood reveal, 4 thin 1px lines animate from the central graph out to each of the visible similar-company rows (SVG path drawing, 0.35s each with 0.08s stagger). Color `#3D7EFC` at 0.6 alpha. They fade to 0.25 alpha after drawing.
- **Foreground callout:** a tiny floating annotation: "40 semantic neighbors" pinned above the neighborhood graph for 1.5s (small 11px `#A7ABB1` label with a 1px chevron underline).

**Mood:** editorial. Like the company page of a YC batch page or the company card on Crunchbase — restrained, a lot of whitespace, facts laid out cleanly. No "WOW" — just information-density reveal.

**Techniques:** (4) Staggered similar-companies list reveal · (1) SVG path drawing for the embedding → row leader lines · (3) Mild CSS 3D on the hero card (settles from rotateX:4deg to 0)

**Animation choreography:**
- `00.0s` — Tsenta tooltip position/scale from Beat 4 animates smoothly into the hero-card avatar position (x, y, scale interpolate over 0.5s power2.inOut, no hard cut).
- `00.2s` — rest of profile page fades in around the avatar. Hero card: opacity 0 → 1, y: 24 → 0, 0.45s power2.out.
- `00.5s` — chip row spawns chips in sequence (Summer 2026 → Early → Consumer → Active). Each: y:-8 → 0, opacity 0 → 1, 0.22s, stagger 0.08s.
- `00.9s` — two-column body fades in: left column first (0.35s), Snapshot rail second (0.35s, 0.08s stagger).
- `02.0s` — long vertical pan begins. `translateY: 0 → -540`, 1.8s power2.inOut.
- `03.6s` — embedding neighborhood graph fades into view — its own mini-Canvas rendering ~40 dots in a tight cluster (re-use graph canvas, same palette, smaller radius). Starts paused, then breathes gently.
- `03.9s` — similar-companies list stagger-reveals: y:12 → 0, opacity 0 → 1, 0.25s, 0.08s stagger.
- `04.2s` — 4 connection lines draw from neighborhood center out to the first 4 visible similar-company rows (SVG path draw, 0.35s each, 0.08s stagger).
- `04.6s` — "40 semantic neighbors" annotation fades in.
- `07.0s` — annotation fades out, leader lines fade to 0.18 alpha.

**SFX:** warm low drone carrying from Beat 4. Soft UI tick for each chip. A small "hush-in" for the pan. A very quiet chime on the "40 semantic neighbors" reveal.

**Transition OUT:** blur through + upward rise — `scale: 1 → 1.04`, blur `0 → 18px`, `y: 0 → -80`, 0.3s power2.in.

---

## BEAT 6 — CLOSER (0:41 → 0:46)

**VO:** "Y C Search. Every company, one query away."

**Concept:** All the dashboard content drops away. We're back in the navy vault. The YC Search logo (orange square + "YC" monogram) scales up to the center, flanked on either side by compact, horizontally-scrolling rows of company avatars — a ticker of the avatars we've been looking at the whole video. The tagline "Every company, one query away." fades in beneath the logo. A final blinking search-bar cursor blinks once on the final word and the frame holds.

**Visual description (layered):**
- **BG:** navy + dot-grid + a soft warm radial at center (`#EA5B21` at 0.06 alpha, feathered 800px — the only warm moment in the whole video).
- **Midground:** YC Search logo, centered, 180×180, fade in + subtle scale 0.92 → 1, 0.55s power3.out. Logo `#EA5B21`. After landing, a thin 1px white stroke briefly rims the logo (stroke-draw tracing the square outline, 0.7s).
- **Foreground top/bottom:** two thin horizontal marquees of company avatars (6 avatars above, 6 below) scrolling in opposite directions at 40 px/s, 0.7 opacity. Uses `image-4…image-11.png`. Each avatar 36×36, 8px radius, tightly spaced.
- **Typography:** wordmark "YC Search" typesets below the logo at 42px, weight 600, `#EBEFF5` — 0.18s after logo lands. Tagline "Every company, one query away." below that at 18px, weight 400, `#A7ABB1`.
- **Cursor:** a single search caret (2px tall, teal-blue) blinks once at the end of "away." — a nod back to the opening bar. 0.2s on, 0.2s off, 0.2s on — then held.

**Mood:** sign-off. Brand moment. No gimmicks.

**Techniques:** (1) SVG path-drawing outline around the logo · (2) Marquee scroll (CSS translateX loop) · (4) Per-word typography reveal for the tagline

**Animation choreography:**
- `00.0s` — logo scales in, warm radial blooms under it.
- `00.55s` — logo outline stroke-draws (0.7s power2.out).
- `00.7s` — avatar marquees slide in from left/right edges and begin scrolling.
- `01.1s` — "YC Search" wordmark appears (y: 12 → 0, opacity 0 → 1, 0.35s power2.out).
- `01.4s` — tagline per-word reveal: "Every" · "company," · "one" · "query" · "away." — each word 0.28s, stagger 0.14s (slide 24 → 0, opacity 0 → 1).
- `02.6s` — caret blink sequence on the final word.
- `04.0s` — hold — the frame is still, the bed resolves to a final chord.

**SFX:** final low pad resolution, a single clean tick on logo landing, a faint satisfied "shhhh" on the marquee start, and a last soft chime on the tagline completion.

**Transition OUT:** hard hold, then fade-to-black at 0:45.5 → 0:46 (1.5s).

---

## Beat Timing Summary (locked to transcript.json — OpenAI TTS `onyx` v2)

Narration duration: 38.9s. Beat boundaries land on word onsets; each beat ends at the onset of the next beat's first word.

| # | Beat                | Start   | End     | Duration | First word anchor        |
|---|---------------------|---------|---------|----------|--------------------------|
| 1 | Hook                |  0.00s  |  6.58s  |  6.58s   | "5,851" @ 0.11s          |
| 2 | Semantic search     |  6.58s  | 13.46s  |  6.88s   | "Type" @ 6.63s           |
| 3 | Filter              | 13.46s  | 19.00s  |  5.54s   | "Filter" @ 13.51s        |
| 4 | Companion graph     | 19.00s  | 27.20s  |  8.20s   | "Open" @ 19.05s          |
| 5 | Company profile     | 27.20s  | 34.84s  |  7.64s   | "Click" @ 27.25s         |
| 6 | Closer              | 34.84s  | 39.00s  |  4.16s   | "YC" @ 34.89s            |

Total composition duration: 39.00s (VO ends 38.39s; +0.6s tail for final hold + fade).

**Word-onset anchors per beat (OpenAI TTS `onyx`, locked to transcript.json):**

- Beat 1: "5,851" 0.11 · "Y" 1.91 · "Combinator" 2.09 · "Companies," 3.40 · "One" 4.79 · "search" 5.04 · "bar." 6.06
- Beat 2: "Type" 6.63 · "AI" 8.37 · "agents" 8.41 · "healthcare" 9.10 · "workflows" 9.86 · "ranks" 10.89 · "meaning," 11.34 · "keywords." 12.65
- Beat 3: "Filter" 13.51 · "batch," 14.08 · "industry" 14.75 · "stage." 15.70 · "table" 16.64 · "updates" 17.01 · "keystroke." 18.03
- Beat 4: "Open" 19.05 · "companion" 19.50 · "graph" 19.90 · "market" 21.39 · "3D" 22.46 · "constellation." 22.75 · "node" 24.35 · "company." 24.78 · "Hover" 25.69 · "peak." 26.47
- Beat 5: "Click" 27.25 · "snapshot," 28.93 · "40" 30.79 · "nearest" 31.17 · "semantic" 31.98 · "neighbors" 32.19 · "embeddings." 34.12
- Beat 6: "YC" 34.89 · "search," 35.04 · "every" 36.16 · "company," 36.56 · "one" 37.28 · "query" 37.51 · "away." 37.91

Note: the TTS and transcriber both render "peek" as "peak" — inconsequential, VO still sounds correct.
