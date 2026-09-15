# TournamentStreamHelper Working Notes

## Layout: `layout/scoreboard_HiveTracker`

- HiveTracker is based on `scoreboard_JinTracker`; its base `index.css` and auxiliary files remain preserved. Its small JS divergence intentionally prevents incoming TSH team colors from overwriting HiveTracker’s local palette when enabled.
- `index.html` adds `hive.css` after the original stylesheets and decorative SVGs inside the existing player containers. `hive.css` provides 98×84 rounded-hex portrait surrounds that overlap the original slanted panel. Portraits sit 30px beyond each outer panel edge and 25px above the panel top; the scoreboard assembly is lowered 12px while camera borders stay in place. Their colored surface uses the same vertical highlight/lower-shade gradient as JinTracker's player containers. Player plates, their border layers, and the exposed score-end blocks use the global `--border-radius`; the score blocks are rounded directly because the player plates must stay `overflow: visible` for the hex shadow. `rounded-hex.svg` masks both the hex surface and its black character well. The shadow is a separate, same-sized SVG layer—down-left for P1 and down-right for P2 by 2.5×5px—so it is not clipped or enlarged into a second rim. All accents derive from `--p1-score-bg-color` / `--p2-score-bg-color`; the shared logo remains `../logo.png`.
- The separate P1/P2 shadow layers carry JinTracker's `fade_right` / `fade_left` classes so they participate in the same entrance animation as their player plates.
- `hive.css` owns a page-local palette: edit `--hive-p1-score-bg-color` and `--hive-p2-score-bg-color` there. `--hive-use-custom-score-colors: 1` is the default and keeps the colors confined to this overlay; set it to `0` to resume TSH team colors. `index.js` checks that switch before applying TSH’s runtime background-color write.
- HiveTracker's local `settings.json` intentionally selects `base_files/icon` for SSBU, so the hexes use small stock icons rather than mural/full character art. `GetCharacterAsset` falls back to the largest available asset when a game lacks that key.
- The stock icons are 64px raster source assets. `hive.css` renders them at 92% scale and applies modest contrast, saturation, brightness, and tight dark drop shadows to improve their apparent edge clarity at the portrait size; it deliberately avoids pixelated scaling or artificial sharpening.
- The portrait well keeps a black base but now uses the same vertical highlight/lower-shade gradient as the P1 name plate, giving the icon background the shared material depth.
- Keep the base stylesheet at stylesheet index 1: the inherited controller mutates rules there for contrast switching. The original character/name/score logic, fixed 1920×1080 canvas, game-history timers/localStorage, and limitations remain inherited from JinTracker. `noCharacter.html` is the unmodified copied alternative, without the hive decorations.
- Browser preview loaded real program state and showed the hex frames with the runtime’s orange/gray colors. External Google font requests were blocked for that preview after they delayed initial loading. Earlier tests of the discarded renderer do not apply to this implementation. OBS was not tested.

## Layout: `layout/pr_presentation`

- Theme tokens are now split into [`theme.css`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/theme.css), loaded before [`index.css`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/index.css) in all PR presentation HTML entrypoints.
- [`index.css`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/index.css) should prefer CSS custom properties for presentation styling. Keep layout logic in `index.css`, but keep configurable visual identity in `theme.css`.
- Collage image selection is theme-driven through `--pr-collage-image` in `theme.css`.
- [`index.js`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/index.js) reads placement accent values from CSS variables (`--rank-accent-place-*`) and reads the final collage path from `--pr-collage-image`.
- The final leaderboard/collage screen is intentionally layered rather than boxed: the two-line `East TN PR` / `Spring 2026` title sits above the left ranking rail, the collage artwork floats freely on the right side without a visible container, and the rail uses individual translucent beveled rows with drop shadow. Final rail rows include stock icons, compact location chips, and top-three visual hierarchy; #1 has a warmer gold treatment and #2 has a distinct bright-silver treatment. Keep this final rail visually ornate but avoid turning it back into a single boxed sidebar.
- The final collage artwork has only localized bloom/glitter around the characters. Keep this effect scoped to `.collage-stage` pseudo-elements so it does not become a full-page haze that hides the OBS background layer.
- The final leaderboard reveal uses `sfx/magicThud.mp3` and an ethereal bloom/sparkle animation. Avoid restoring the old thunder/lightning flash feel unless explicitly requested.
- `index.css` now includes additional theme hooks for `--pr-panel-*`, `--pr-star-dust-*`, `--pr-ranking-plate-bg`, and `--pr-chip-bg` so material feel can be changed mostly from `theme.css`.
- Teaser/loading visuals are tokenized through `--pr-teaser-*` variables (panel shell, transition flashes/clouds/streak/haze, ember particles, loading fill, and title/subtitle/tip shadows). Keep teaser look in `theme.css` and avoid reintroducing hardcoded warm RGBs in `index.css`.
- Teaser entrypoints (`p1`, `p2`, `facts_*`, `rot_*`) now use a countdown block instead of tip/loading-bar copy. `index.js` updates `.teaser-countdown-value` every second toward the next local `6:05 PM`; when it reaches zero, or when the teaser is clicked before reveal progression, all teaser text fades out and a Tennessee subregion map fades in with unlabeled Knoxville, Chattanooga, and Tri-Cities nodes.
- The countdown Tennessee map is pre-rendered during `showTeaser()` through `prepareTeaserRegionMap()` so the SVG mask, nodes, and map layers rasterize before the countdown/click reveal. Keep the reveal animation to compositor-friendly opacity/scale changes; avoid adding blur/filter animation back to this transition because it stutters in OBS.
- The PR presentation is intended to work over an OBS background layer. `theme.css` keeps `--pr-body-bg` transparent and controls the local pixel-art backing through `--pr-stage-image-opacity`; avoid reintroducing opaque full-screen backgrounds unless the OBS composition changes.
- Twinkle star overlays are currently disabled. Keep any future star treatment subtle and non-grid.
- Location-aware PR styling is opt-in through `location_mode` in [`settings.json`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/settings.json). `index.js` defaults this to `"off"` for location-agnostic PRs; this East Tennessee setup currently uses `"map_prelude"`.
- In `location_mode: "region_color"` or `"map_prelude"`, [`index.js`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/index.js) resolves player regions from top-level `location`, then `area`, then Start.gg city. It animates the bottom [`ranking-plate`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/index.css) through `--pr-location-plate-*` color-stop variables and adds a region chip in the existing player metadata row.
- `location_mode: "map_prelude"` adds a short interstitial before the opening ranked player and between ranked players using [`tennessee-outline.svg`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/tennessee-outline.svg) as a themed CSS mask, manually adjusted region coordinates, and the player's first main stock icon from `user_data/games/.../base_files/icon`. The SVG was generated from Tennessee GeoJSON boundary data from `glynnbird/usstatesgeojson`; this avoids Leaflet/map-tile dependencies in OBS browser sources.
- Region plate colors live in [`theme.css`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/theme.css): Knoxville is orange, Chattanooga is green, and Tri-Cities is blue. Keep future region palette changes tokenized there through the per-region `start`, `mid`, and `end` variables.

## PR Presentation Entrypoints

- These files all include `theme.css` before `index.css`:
  - [`p1.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/p1.html)
  - [`p2.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/p2.html)
  - [`facts_p1.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/facts_p1.html)
  - [`facts_p2.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/facts_p2.html)
  - [`rot_p1.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/rot_p1.html)
  - [`rot_p2.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/rot_p2.html)
  - [`teaser.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/teaser.html) (standalone teaser card without loading UI or reveal progression script)
  - [`final.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/final.html) (direct final graphic entrypoint; sets `window.PR_PRESENTATION_START_VIEW = "leaderboard"` before loading `index.js`)
  - [`THX.html`](/Users/bbussell/Documents/UltTO/TournamentStreamHelper/layout/pr_presentation/THX.html) (standalone thanks-for-watching scene; reuses theme/index CSS but does not load the reveal controller)

## Verification Reality

- No browser/runtime preview was executed in this change; updates were verified by static inspection and grep for variable wiring.

## Upstream Integration Notes

- The upstream root repository still models `layout/` as the `TournamentStreamHelper-layouts` submodule, but this fork intentionally tracks a fully materialized and substantially customized `layout/` directory. Do not run `git submodule update --init layout` on this fork: it would replace the local layout tree with the upstream submodule checkout.
- Integrate upstream root-code changes and upstream layout changes separately. Layout updates require a file-level comparison because shared files include `include/globals.js`, `include/assetUtils.js`, `main.css`, and numerous customized scoreboards. Preserve local-only layouts and resolve shared layout files according to their runtime state contract rather than bulk replacing them.
- `safe-sync` is the isolated branch for the current upstream integration. Its Start.gg recent-set path retains the local 20-page, both-direction H2H history window on top of upstream's Worker API; it collects workers from both directions and waits for at most 30 seconds before deduplicating and sorting results.
- Current integration verification is static only: Python source and the merged JSON assets parsed successfully. App launch, authenticated Start.gg queries, and OBS/browser overlay previews remain required before promotion.
