# Sushi Street

Sushi Street is a Phaser web game built around one-hop-per-lane movement, moving traffic, river crossings, and ingredient delivery. The visual direction uses a small, high-contrast voxel-style palette and fake 3D shading made from simple Phaser shapes so the game stays lightweight for web and future iPhone / Android wrapping.

## Start flow

The game now opens directly into a live route. Traffic and floating river platforms are already moving when the loader disappears. There is no level-select screen before play.

- The **active-time timer** starts on the player's first valid hop.
- The **giant sushi fish idle countdown** also starts on the first hop and resets whenever the player moves.
- Finishing or failing shows a result card with **Run Again / Try Again** and **Menu / Levels**.
- Level selection only appears after choosing Menu / Levels.

## Controls

- Tap / Up / W / Space = hop forward one row.
- Swipe left/right or Left/Right / A/D = move one column sideways.
- Swipe down or Down / S = step backward, up to the backtracking limit.

Every road row is one gameplay lane and one hop. Dashed road markings are drawn **between** adjacent road rows rather than through the center of a row, so the visual lane structure matches the movement grid.

## Visual palette

The palette below was sampled approximately from the supplied reference screenshot. It is intentionally compact: large flat color areas establish terrain, then darker side faces and cast shadows create the 3D block illusion.

| Role | Hex | Use |
| --- | --- | --- |
| Road charcoal | `#484E5D` | Main asphalt |
| Road / cast shadow | `#272B37` | Road edges and deep vehicle shadows |
| General shadow | `#282229` | Lower-right cast shadows under chef, cars, scenery |
| Water blue | `#72D8FF` | Main canal surface |
| Water highlight | `#57BFFD` | Ripples / brighter water variation |
| Deep water | `#4886C1` | Water edge / depth |
| Bright grass | `#A7D861` | Main safe terrain |
| Mid grass | `#94BD50` | Alternating ground tiles / vegetation |
| Grass shadow | `#566A29` | Extruded grass/tree sides |
| Log brown | `#8B443B` | Floating log top face |
| Log dark | `#6A3939` | Log side face |
| Vehicle orange | `#F06030` | High-energy car / truck accent |
| Vehicle red-orange | `#E84028` | Secondary warm vehicle accent |
| Lime vehicle | `#A1D15A` | Bright green vehicles |
| Cabin white | `#EFFAE8` | Car roofs and chef whites |
| Collectible yellow | `#F8F858` | Pickup / UI highlight |
| Cool mint accent | `#81D4C1` | Supporting cool accent |

### Shading rule

The game uses one consistent fake-light model instead of true 3D lighting:

1. Light comes from the **upper-left**.
2. The top face is the brightest face.
3. Front / lower faces are roughly 15–20% darker.
4. Right-side faces are roughly 25–30% darker.
5. A dark, offset silhouette is placed **down and to the right** as the cast shadow.

This same rule is used on the sushi chef, vehicles, logs, pickups, and restaurant. The chef therefore has a visible ground shadow plus shaded block faces instead of reading as a flat icon.

## Voxel / block philosophy

Crossy Road's developers have described its art as voxel-based, and interviews about the game's creation note that the angled presentation made the voxel world substantially more appealing while still preserving sharp, readable hitboxes. Sushi Street uses that principle rather than copying Crossy Road models: objects are reduced to simple boxy silhouettes, edges stay crisp, and depth comes from a repeatable top/front/right-face lighting system.

Implementation-wise, Sushi Street stays in Phaser 2D. The modular runtime (`sushi-scene.js`, `sushi-visuals.js`, and `sushi-gameplay.js`) draws simple cuboid-like forms with Phaser Graphics rather than requiring a 3D engine. This keeps the game fast, deterministic, and compatible with the existing Phaser lifecycle work.

## Full-screen layout

The Phaser canvas is created at the browser viewport size at launch and fills `100vw × 100dvh`.

- On phones, the playable street uses the whole useful width.
- On wide displays, the canvas still fills the screen but the active crossing is capped at a narrower centered width so the route retains a mobile / arcade feel instead of stretching excessively.
- A run does not change its world geometry mid-hop if the viewport changes; the future native wrapper can own orientation / resize policy.

## Core loop

- Collect the ingredients listed in Today's Menu.
- Cross cars and trucks one lane at a time.
- Cross canals on moving lily pads and logs.
- Falling into water creates a splash failure.
- Waiting too long after starting the run summons the giant sushi fish.
- Reach the restaurant with more than 50% of the required ingredients to open.
- A full menu earns the best revenue.

## Progression

- 20 levels.
- Level 1 = 30 forward rows.
- Later levels add two rows per level.
- Level 3 is the first night route.
- Later levels rotate morning, day, sunset, and night palettes.
- Completing a level unlocks the next level, accessible from Menu / Levels.

## Runtime / lifecycle

Sushi Street keeps the Slip and Jump lifecycle pattern:

- pause Phaser when the page / app is hidden;
- do not count background time as gameplay time;
- clear stale pointer / buffered input state;
- warm-resume behind a short input-blocking overlay;
- remove old scene timers, tweens, camera effects, and level-owned objects before rebuilding.

See `PHASER_LIFECYCLE.md` for details.

## Files

- `index.html` — full-screen shell, HUD, loader, result/menu modal.
- `style.css` — sampled palette, loader, HUD, modal styling.
- `sushi-config.js` — viewport sizing, palette, themes, item catalog, and constants.
- `sushi-scene.js` — direct-start scene, input, level setup, and menu flow.
- `sushi-visuals.js` — voxel-style roads, cars, chef, water, logs, lily pads, shops, and shadows.
- `sushi-gameplay.js` — movement, camera pressure, pickups, MISSED feedback, scoring, hazards, and progression.
- `sushi-boot.js` — full-screen Phaser boot.
- `lifecycle.js` — pause / resume / cleanup behavior.
- `GAME_DESIGN.md` — game rules and visual design notes.
- `PHASER_LIFECYCLE.md` — lifecycle practices adapted from Slip and Jump.

## Camera pressure and ingredient feedback

The camera is intentionally **not** a passive follow camera. After the first hop, it keeps creeping forward even while the chef waits. Forward progress pulls the chef back toward a lower-middle screen anchor and exposes more upcoming lanes at the top. If the chef falls to roughly the bottom 9% of the viewport, the giant sushi fish ends the run. This matches the pressure principle described in Crossy Road coverage: the bottom screen edge keeps advancing and waiting too long eventually becomes fatal.

The top HUD includes a **Minimum Ingredients** bar. The minimum is the smallest whole-number count greater than 50% of the menu (`floor(total × 0.5) + 1`). When the bar fills, the route is eligible to open the restaurant at the finish.

Ingredient shops use a wider rectangular pickup zone rather than requiring the chef to land on one exact grid column. Entering any part of that marked zone on the correct shop row collects the ingredient and triggers a pickup burst. If the chef advances past an uncollected ingredient row, that shop turns red and shows **MISSED**. Backtracking to the ingredient row or earlier removes the missed warning, so recovery is still possible.

## Research references

- Crossy Road official site: https://www.crossyroad.com/
- Crossy Road App Store listing: https://apps.apple.com/us/app/crossy-road/id924373886
- PocketGamer.biz, *Why did the chicken... the making of Crossy Road*: https://www.pocketgamer.biz/making-of-crossy-road/
- Apple Games We Love: https://apps.apple.com/us/story/id1392574563
- Phaser Scale Manager: https://docs.phaser.io/phaser/concepts/scale-manager
- Phaser Graphics: https://docs.phaser.io/phaser/concepts/gameobjects/graphics

No Crossy Road art assets are included in this repository.
