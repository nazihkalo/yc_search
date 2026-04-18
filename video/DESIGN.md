# Design System — YC Search

## Overview

YC Search is a dense, data-native developer dashboard for hybrid keyword + semantic search across Y Combinator's 5,851 companies. The visual personality is editorial and tech-forward: deep navy-black surfaces, thin dividers, a single vivid blue primary for focus/rings, and a saturated "chip palette" (green/cyan/violet/pink/amber) used to color-code industries, tags, and graph nodes by batch. The layout is organized around one big rounded search bar, a 12-column table with small round company logos, and a 3D force-graph companion that mirrors the filters in real time. YC's signature orange mark (`#EA5B21`) is the one warm accent — it anchors the brand against the cool, almost-black canvas.

## Colors

- **Primary Surface**: `#0A1018` — app background (near-black navy)
- **Surface Deep**: `#090D15` / `#080D16` — page gradient base
- **Card Surface**: `#131822` — elevated panels, tooltips, popovers
- **Card Surface Alt**: `#212730` — secondary rows, chip ghost
- **Border**: `#2F3640` — 1px dividers between table rows + card edges
- **Muted Foreground**: `#A7ABB1` — secondary text, labels
- **Foreground**: `#EBEFF5` — primary text, headings
- **Primary (Focus Blue)**: `#2366E9` — interactive ring, CTA, selected tab
- **Primary Bright**: `#599BFF` / `#3D7EFC` — focus glow, link hover
- **YC Orange**: `#EA5B21` (with `#F0804D` stroke) — logo mark only
- **Chip Green**: `#00BC80` / `#195735` bg — "Active" status, B2B tag
- **Chip Cyan**: `#5999FF` / `#192E57` bg — Consumer / AI chips
- **Chip Violet**: `#C68BD3` / `#4B1957` bg — Fintech / SaaS chips
- **Chip Pink**: `#F35863` / `#57193A` bg — Healthcare / Hiring
- **Chip Amber**: `#AFAF00` / `#574F19` bg — Hard Tech, Industrials
- **Graph Batch Colors**: teal `#00BAAA`, amber `#AFAF00`, pink `#F35863`, violet `#C68BD3`, bright blue `#3D7EFC` — node color-by-batch

## Typography

- **Sans-Serif**: `ui-sans-serif` system stack (renders as Inter / SF on macOS). Used for everything.
- **Display**: 36px / weight 600, `#EBEFF5`, tight tracking — hero "YC Search" title.
- **Body**: 14–16px / weight 400–500 — table rows, descriptions.
- **Labels**: 11–12px / weight 500, uppercase letter-spaced `0.06em`, muted — section labels like "BROWSE", "COMPANION", "DISPLAY", "SORT", column headers.
- **Numerics**: tabular-nums at 14px for score cells (e.g. `0.427`).

## Elevation

Depth comes from flat surface shifts, not shadows. Three tiers: page bg (`#0A1018`) → card surface (`#131822`) with 1px `#2F3640` border and 28px/22px radii → chip/pill (`#192E57`-family) with 12px radius. The only "glow" on the site is a very subtle focus ring (`#2366E9` at ~40% alpha) around the active search input and the selected node in the companion graph. No drop shadows, no glass blur, no bloom — this is a hard-edged dashboard.

## Components

- **Big Rounded Search Bar**: 64px tall, 22px radius, `#131822` fill, leading `lucide-search` icon, rotating "Try …" placeholder hint in muted text (cycles through example queries).
- **Segmented Tab Groups**: `BROWSE: [Results] [Analytics]` and `COMPANION: [Show graph]` — pill buttons with outline/filled states.
- **Sort / Display Pills**: `Relevance · Newest · Team · Name` and `Table · Cards` — small rounded-full pills, filled when active.
- **Data Table**: 12-col dense table — avatar + Company / Score / Industries / Tags / Batch / Stage / Team / Status / Links. 1px row dividers at `#2F3640`. Column headers show sort/filter affordance icons (`lucide-arrow-up-down`, `lucide-funnel`).
- **Company Avatar Badge**: 28–40px rounded-square, colored backgrounds (purples, greens, blacks), white monogram — consistent grid rhythm in the leftmost column.
- **Color-Coded Chips**: small rounded-full pills — each industry/tag has a fixed dark-tinted background + bright foreground label. Size ~20px tall, tight tracking.
- **Status Chip**: green "Active" pill; red "Hiring" pill; muted "N/A".
- **Score Cell**: tabular number + faint progress-bar bg based on value.
- **Companion Graph Pane**: right-side panel titled "Companies graph", contains a full-bleed 3D force-graph (`<canvas>`) with a stacked legend top-right (dots + batch + count) and three small toggle pills (`Batch · Industry · Stage`). Nodes are colored circles; links are faint lines.
- **Company Profile Card** (`/companies/:id`): back-to-search breadcrumb, hero card with large avatar + name + one-liner + chip row; two-column body with "What they do" + "From their website" snapshot on the left and a right rail of metadata (Snapshot, Industries, Regions). Further down: "Embedding neighborhood" 3D mini-graph with a Batch/Industry/Stage toggle, and a "Similar companies" vertical list with relevance scores.
- **Legend Card (Graph)**: small card showing `●` + batch name + integer count, top-right of the graph.

## Do's and Don'ts

### Do's

- Use `#0A1018` as the canvas; let it swallow the frame.
- Use `#131822` cards with 1px `#2F3640` borders and 22–28px radius for any surface.
- Use YC orange (`#EA5B21`) sparingly — only for the logo mark and one intentional accent.
- Use the chip palette (green / cyan / violet / pink / amber over dark-tinted bgs) to signal semantic categories — color means something here.
- Use tabular-nums for any numeric column (scores, counts, page numbers).
- Keep motion subtle and mechanical: table rows highlight on hover, focus rings fade in, graph nodes pulse softly — no bouncy springs.
- Render graph nodes as small solid-color dots at batch-specific hues; keep link lines thin and low-alpha.

### Don'ts

- Do not introduce a bright solid background — stay inside the navy "vault."
- Do not use drop shadows or glassmorphism — depth is via flat surface shifts + 1px borders.
- Do not rewrite type at display sizes — hero is 36–56px max; bigger reads marketing-y, not tool-y.
- Do not use gradients on chips — they're flat color-on-dark-tint.
- Do not animate entire table rows flying in; this is a dashboard, not a landing page. Animate cursors, focus states, and node highlights instead.
- Do not use the YC orange for text or chips — it's reserved for the mark.
