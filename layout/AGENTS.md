# Layout Package Notes

## What This Repo Is

- This workspace is a collection of standalone stream/overlay layouts. Most layouts live in their own folder with local `index.html`, `index.css`, `index.js`, and `settings.json`.
- Layout pages generally load shared theme/runtime helpers from `../include/globals.js` and shared theme variables/fonts from `../main.css`.

## Shared Styling Reality

- `main.css` is the main theme anchor. It defines shared font choice, `--border-radius`, and the core color tokens like `--bg-color`, `--accent-color`, `--text-color`, `--p1-score-bg-color`, and `--p2-score-bg-color`.
- Many layouts already share a visual language: offset block shadows, plate-like containers, bold uppercase typography, and P1/P2 accent colors.
- Small visual passes are safest when they stay CSS-only and reuse those shared variables instead of introducing new palette systems.

## Important Layout Boundaries

- `scoreboard_HiveTracker` is a direct copy of JinTracker with an added `hive.css` and decorative portrait-frame SVGs in `index.html`. Preserve the shared colors, base controller, typography, logo, and placement; all hive accents use the existing P1/P2 CSS variables. Portrait hexes are always present: `index.js` uses a selected stock icon first, then `online_avatar`, then local `avatar`, and finally `player-placeholder.svg`. See root `AGENTS.md` for inherited caveats and verification scope.

- `scoreboard_JinTracker`, `versus_screen`, `player_presentation_revamp`, and `bracket` are classic overlay layouts driven by the TSH-style runtime and shared text/character helpers.
- `pr_presentation` carries a manually curated `player_placements_startgg.json` for presentation data. Its scene reads rank, start.gg gamer tag/prefix, account/profile image metadata, and local `mains` from that JSON instead of active TSH player identity fields. It now loads into a stream-safe teaser state first; the first click enters the configured starting placement, currently #10, and subsequent clicks advance toward #1 before showing the full leaderboard. Individual reveal screens resolve the current player’s JSON `mains` against `user_data/games/<game>/base_files/config.json` and default to the `webm` asset pack so the single-player motion treatment stays intact. The final leaderboard no longer builds a character collage from placement presets; it uses `layout/pr_presentation/collage/characters.png` as the top 85% poster image and renders a bottom 15% stock-icon character key from each player’s first local main.
- `pr_presentation` uses an angular `.ranking-plate` as the bottom-third broadcast graphic. `.rank-card` is player info mounted on that plate, not a standalone floating card; `.character-aura` and `.pr-character` sit above/through the plate so character renders can visually break the lower-third shape.
- `pr_presentation` reveal timing is split between GSAP scene transitions and CSS reveal classes. The first teaser-to-rank transition uses a temporary `.teaser-rank-transition` overlay created in `index.js`; rank-to-rank advances and reverses use the `"advance"`/`"back"` directions in `showPlayer` and should keep `.ranking-plate` visible as the stable rail while the rank card/badge/character slide across it. During those transitions, plate/theme color variables tween instead of jumping, and the raised right edge of the plate uses `--plate-raised-edge` to drop from `0%` to `21%` then settle back up while the left 0-56% edge stays fixed at `21%`. The final leaderboard lightning is driven by `.leaderboard-panel.is-revealing`, with `thunder.mp3` scheduled from JS to match the CSS flash timing. Keep `.rank-number` flicker continuous/eased rather than `steps()`-based so the glow can intensify near #1 without visible horizontal jitter. `getRankGlowSettings()` owns the computed CSS motion/glow variables for the rank number. Keep these effects crisp: avoid clipped gradient text fills, large blur radii, oversized #1 glow values, and pseudo-elements attached directly to `.rank-number` that can read as duplicated glyphs. Put broad energy behind `.rank-badge` instead.
- `pr_presentation` intentionally disables rank-number glow for placement #10 in `getRankGlowSettings()` because that glyph/font combination is prone to glow artifacts. Keep #10 crisp unless the font/rendering issue is fixed.
- `pr_presentation` prewarms the opening ranked character during the teaser via `prewarmOpeningPlayer()` and reuses the prepared hidden `.ranked-pr-character` for the first #10 reveal. `showPlayer(..., "opening")` restarts any video inside that reused character element before animating it in so the prewarm does not consume the character animation offscreen. Avoid removing that prewarm/restart pairing unless the first reveal stutter has been solved another way.
- When resolving `pr_presentation` character names, use literal bracket access for `character_to_codename` keys. Some SSBU names contain dots, notably `R.O.B.`, and lodash string paths treat dots as nested key separators.
- For `pr_presentation` character positioning, remember that `CenterVideo` does not consume the `custom_center` options used by `CenterImage`. With the default `webm` asset pack, the visible character placement is controlled by the `.pr-character` CSS lane, video `object-fit`/`object-position`, and transform rules.
- `pr_presentation/scripts/enrich_startgg_players.py` enriches each player with public start.gg metadata under a nested `startgg` key and local character preferences under top-level `mains` from `user_data/local_players.csv`. Profile images live under `startgg.images`; the old top-level `pfp` field is intentionally removed by the script, though the layout still tolerates a `pfp` key if one is manually present.
- `GLRA_StartSoon`, `GLRA_CrewWin`, and `GLRA_Thanks` are more self-contained screens with local GSAP-driven entrance/state animation in each folder’s `index.js`. `GLRA_StartSoon` and `GLRA_Thanks` are intended to sit over a moving OBS background (currently Maple Treeway): keep the stages transparent and text-led, reserve filled surfaces for the temporary follow toast, use the large floating hexagons only as background accents, and keep the backdrop as the scene's motion layer. `GLRA_StartSoon` preserves its countdown/status cycle and fades its overlay directly when time elapses; it no longer depends on a blur layer.
- `player_presentation_revamp` rotates between results/facts panels in JS and uses separate bottom-set cards; surface treatment changes should avoid affecting those opacity/slide transitions.
- `player_presentation_revamp/index.js` resolves the selected player's `team.color` on every update and updates the existing global `--text-color` token. It uses a color-distance test to switch to a muted, hue-matched off-black only for backgrounds genuinely close to white; all other backgrounds receive pure white. This deliberately covers the player card, results/facts panels, and run cards together; a missing or unparseable team color preserves the configured token.
- The smaller player presentation package lives in `player_presentation_mini/`; it is not a reduced HTML variant inside `player_presentation_revamp/`.

## Performance Controls

- Shared layout performance settings live in [`settings.json`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/settings.json) under `performance`. The JSON includes its own `_documentation` object describing every preset and override; keep that documentation synchronized with the resolver in `include/globals.js`.
- Use `performance.preset` for a named baseline (`quality`, `balanced`, `stable`, or `minimal`) and `performance.overrides` for explicit per-feature choices. A layout can add its own `performance` object in its local `settings.json`; local values win through the existing settings merge.
- `quality` preserves animation behavior. `balanced` only changes under-the-hood startup/hidden-source work. `stable` settles supported entrance and update animations immediately. `minimal` additionally stops Player Presentation Revamp panel rotation and bypasses the image-readiness reveal gate.
- Layout code should call `TSHPlayEntrance()` for initial GSAP timelines and `TSHAnimateTo()` / `TSHAnimateFromTo()` for update animations. These helpers preserve normal mode and apply the final state when the relevant override is enabled; do not add per-layout copies of the preset logic.
- `SetInnerHtml()` and `CharacterDisplay()` honor `skip_update_animations` centrally. Bee Bracket additionally honors `skip_bracket_connector_animations` by calculating and applying its existing `hidden` / `displayed` / `done` state directly, avoiding SVG path measurement and per-set timeline construction. Top 8's single-insert markup construction is an always-on equivalent-visual cleanup, not a toggle.

## Verification Reality

- There is no single repo-wide automated test suite for visual integrity.
- For `pr_presentation` data enrichment, at minimum run `python -m py_compile layout/pr_presentation/scripts/enrich_startgg_players.py`. Use `python layout/pr_presentation/scripts/enrich_startgg_players.py --skip-api` to refresh local `mains` without start.gg access, and `--dry-run` when start.gg API access is available. The script accepts optional bearer credentials from `STARTGG_TOKEN`, `START_GG_TOKEN`, `STARTGG_API_TOKEN`, or `SMASHGG_TOKEN`.
- Honest verification for polish work here usually means:
  1. inspect the target HTML/CSS/JS directly,
  2. review the diff carefully,
  3. preview in the overlay runtime when available.
- Without a live preview, visual changes should stay conservative: small gradients, subtle highlights, and readable contrast over busy backgrounds.

## Current Polish Guidance

- Favor warmth, glow, softness, and better layering over novelty.
- Preserve composition and broadcast readability; avoid structural rewrites for visual-only passes.
- Prefer subtle tinted shadows and faint surface variation over large new decorative elements.
