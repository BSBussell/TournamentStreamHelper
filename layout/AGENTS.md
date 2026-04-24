# Layout Package Notes

## What This Repo Is

- This workspace is a collection of standalone stream/overlay layouts. Most layouts live in their own folder with local `index.html`, `index.css`, `index.js`, and `settings.json`.
- Layout pages generally load shared theme/runtime helpers from `../include/globals.js` and shared theme variables/fonts from `../main.css`.

## Shared Styling Reality

- `main.css` is the main theme anchor. It defines shared font choice, `--border-radius`, and the core color tokens like `--bg-color`, `--accent-color`, `--text-color`, `--p1-score-bg-color`, and `--p2-score-bg-color`.
- Many layouts already share a visual language: offset block shadows, plate-like containers, bold uppercase typography, and P1/P2 accent colors.
- Small visual passes are safest when they stay CSS-only and reuse those shared variables instead of introducing new palette systems.

## Important Layout Boundaries

- `scoreboard_JinTracker`, `versus_screen`, `player_presentation_revamp`, and `bracket` are classic overlay layouts driven by the TSH-style runtime and shared text/character helpers.
- `GLRA_StartSoon`, `GLRA_CrewWin`, and `GLRA_Thanks` are more self-contained screens with local GSAP-driven entrance/state animation in each folder’s `index.js`.
- `player_presentation_revamp` rotates between results/facts panels in JS and uses separate bottom-set cards; surface treatment changes should avoid affecting those opacity/slide transitions.
- The smaller player presentation package lives in `player_presentation_mini/`; it is not a reduced HTML variant inside `player_presentation_revamp/`.

## Verification Reality

- There is no single repo-wide automated test suite for visual integrity.
- Honest verification for polish work here usually means:
  1. inspect the target HTML/CSS/JS directly,
  2. review the diff carefully,
  3. preview in the overlay runtime when available.
- Without a live preview, visual changes should stay conservative: small gradients, subtle highlights, and readable contrast over busy backgrounds.

## Current Polish Guidance

- Favor warmth, glow, softness, and better layering over novelty.
- Preserve composition and broadcast readability; avoid structural rewrites for visual-only passes.
- Prefer subtle tinted shadows and faint surface variation over large new decorative elements.
