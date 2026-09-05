# Sushi Street

Sushi Street is a Phaser web game built around one-hop-per-lane movement, moving traffic, river crossings, ingredient delivery, and a camera that keeps pushing the route forward. It uses lightweight 2D Phaser shapes to create a voxel / block-like look suitable for the web now and a future iPhone / Android wrapper later.

## Start flow

The game opens directly into a live route. There is no level menu before play.

- Traffic and logs are already moving when the loader disappears.
- The run clock, camera pressure, and sushi-fish pressure begin on the player's first valid hop.
- Finishing or failing shows **Run Again / Try Again** and **Menu / Levels**.
- Level selection is only opened deliberately from **Menu / Levels**.

## Controls

- Tap / Up / W / Space = hop forward one row.
- Swipe left/right or Left/Right / A/D = move one column sideways.
- Swipe down or Down / S = move backward within the backtracking limit.

Every road row is one gameplay lane and one hop. Dashed road markings are drawn between adjacent road rows.

## Full-screen world sizing

Sushi Street now treats the launch viewport as the playable width instead of placing a narrow fixed-width road inside a larger canvas.

At startup:

1. `window.innerWidth` and `window.innerHeight` become the Phaser viewport dimensions.
2. The playable grid spans the full viewport width.
3. The number of columns is chosen dynamically from the viewport width so desktop hops do not become enormous.
4. Extra world-space **overscan** is generated beyond the visible left/right edges.
5. The camera sees only the real viewport, while the overscan prevents rotated corners from ever exposing a hard world boundary.

This is especially important on wide desktop screens: roads, canals, grass, traffic, and scenery continue across the entire visible screen instead of ending at a centered mobile-width strip.

## Diagonal camera / perspective

The Crossy Road reference is not viewed from a perfectly straight overhead camera. The world is presented at a slight diagonal so the block faces, vehicle depth, shadows, and lane movement all read together.

Sushi Street now applies a small camera rotation of approximately **5.5°**. Because the whole Phaser world is rotated by the camera:

- a forward hop appears slightly diagonal on screen;
- cars move along slightly diagonal screen-space paths;
- logs drift along the same angled lane direction;
- lane separators are angled consistently;
- cast shadows and block faces remain aligned with the environment;
- camera scrolling also carries the scene diagonally instead of looking like a flat vertical conveyor belt.

The gameplay grid and collision rules stay discrete and predictable underneath the presentation. The angled camera changes how the world is seen, not which logical lane the player occupies.

## Aspect-ratio and geometry rules

The renderer must **resize the universe, not stretch the picture**. Phaser now uses `Scale.RESIZE`, so the renderer backing buffer changes with the actual parent viewport instead of letting CSS scale a fixed canvas. World units are kept close to a constant size: wide screens gain more columns and more world area, while cars, text, the chef, lane height, and pickups keep approximately the same pixel proportions. Material width/orientation changes trigger a deterministic level rebuild using the new geometry.

## Vehicle direction

Cars and trucks have an explicit front and rear. The short low nose sits on the **direction-of-travel side**, while the taller body/cab sits toward the rear. A yellow headlight marks the travel end and a red tail light marks the rear. This makes the silhouette agree with the vehicle's motion even under the diagonal camera.

## River stepping-stone rule

Green lily pads are stationary. A two-row river section now separates support types by lane: the first water row contains moving logs, and the next water row contains stationary lily pads. Pads are deterministically randomized across gameplay columns and do not bunch directly beside one another. Because logs and pads are never spawned on the same logical water row, a moving log cannot pass over or through a fixed pad.

## Ingredient spacing rule

Every requested ingredient receives its own shop row. Consecutive ingredient rows are separated by at least **four row indices**, which means there are always at least **three complete gameplay lines between pickups**. This gives the player time to cross traffic or reposition laterally before the next required collection opportunity.

## Visual palette

The palette below was sampled approximately from the supplied reference screenshot. Large flat terrain colors establish readability; darker side faces and offset shadows create the block-like 3D illusion.

| Role | Hex | Use |
| --- | --- | --- |
| Road charcoal | `#484E5D` | Main asphalt |
| Road / cast shadow | `#272B37` | Road edges and deep vehicle shadows |
| General shadow | `#282229` | Lower-right cast shadows under chef, cars, scenery |
| Water blue | `#72D8FF` | Main canal surface |
| Water highlight | `#57BFFD` | Ripples / brighter water variation |
| Deep water | `#4886C1` | Water edge / depth |
| Bright grass | `#A7D861` | Main safe terrain |
| Mid grass | `#94BD50` | Alternating terrain / lily-pad family |
| Grass shadow | `#566A29` | Dark vegetation / extrusion face |
| Log brown | `#8B433A` | Floating log top face |
| Log dark | `#663B3C` | Log side face |
| Vehicle orange | `#F06030` | Warm car / truck accent |
| Vehicle red-orange | `#E84028` | Secondary warm vehicle accent / missed state |
| Lime vehicle | `#A1D15A` | Bright green vehicles |
| Cabin white | `#EFFAE8` | Car roofs and chef whites |
| Collectible yellow | `#F8F858` | Pickup / progress highlight |
| Cool mint accent | `#81D4C1` | Supporting cool accent |

### Shading rule

The fake-light model is consistent throughout the game:

1. light is treated as coming from the upper-left;
2. the top face is brightest;
3. front/lower faces are roughly 15–20% darker;
4. right-side faces are roughly 25–30% darker;
5. an offset dark silhouette is cast down/right as the ground shadow.

The chef, vehicles, logs, pickups, fish, and restaurant all use this rule. The chef also has a separate ground shadow that compresses during a hop.

## Traffic spacing

Vehicles inside one lane now use a fixed circular spacing model:

- every vehicle in the lane has the same lane speed;
- initial positions are evenly spaced around a wrap cycle;
- the wrap uses modulo arithmetic rather than teleporting each car independently;
- spacing is chosen using the maximum vehicle width plus a safety gap.

As a result, two cars in the same lane cannot slowly catch each other, overlap, or appear fused together.

## Rivers

River sections use two distinct support rows:

- the first water row contains **moving logs** that carry the chef;
- the next water row contains **stationary green lily pads**.

This keeps logs from crossing over lily pads and creates the intended log-to-pad jump. Missing every support causes the splash-down failure.

## Ingredient HUD

The HUD is intentionally compact. It no longer lists every requested ingredient across the top of the screen.

The visible HUD contains:

- **Score**
- one **Ingredients** progress bar
- **Pause**

The ingredient bar represents the entire menu from zero to all ingredients. A fixed marker at the midpoint reads **MIN 50%**. The live text shows `collected / total` plus the current percentage. Reaching at least half makes the progress state ready; reaching the end means all requested ingredients were collected.

Individual pickup names still appear in the world and in the short `GOT ...` collection effect, so the objective remains readable without permanently cluttering the top of the screen.

## Camera pressure

The camera is not passive. After the first hop it keeps creeping forward. Progress pulls the chef toward the intended lower-middle camera area and reveals more hazards ahead. If the chef falls too close to the bottom edge, the giant sushi fish ends the run. The idle timeout remains as an additional pressure system.

## Ingredient pickup / missed feedback

Ingredient shop rows use wide rectangular pickup areas rather than one exact grid slot. If the chef occupies the shop row and overlaps the marked rectangle, the ingredient is collected.

- Collection triggers a `GOT [ITEM] +POINTS` burst.
- Passing an uncollected ingredient row turns its area red and shows **MISSED**.
- Backtracking to that row or earlier clears the missed state so the ingredient can still be recovered.

The pickup itself is rendered as a larger market stall/storefront rather than a small package, and the old brown street-label-style target has been removed.

## Sushi master selection

The assets were verified on `origin/main`. The menu now exposes three Sushi Masters and remembers the selected one in the existing save object:

- **Slicey McDicey** — `images/sushimasters/1/front.png` / `images/sushimasters/1/back.png`
- **Kyoto O Sushi** — `images/sushimasters/2/front.png` / `images/sushimasters/2/back.png`
- **Nigiri McFlurry** — `images/sushimasters/3/front.png` / `images/sushimasters/3/back.png`

The **front** image is used in the Menu / Levels selector. During gameplay, the selected master's **back** image is used so the chef faces into the route. The sprite is scaled from a fixed target width with uniform scale, preserving the image's aspect ratio, and the separate gameplay shadow remains underneath it. Chef 1 is the default.

## Progression

- 20 levels.
- Level 1 = 30 forward rows.
- Later levels add two rows per level.
- Level 3 is the first night route.
- Later routes rotate morning, day, sunset, and night palettes.
- Completing a route unlocks the next route in Menu / Levels.

## Runtime / lifecycle

Sushi Street keeps the Slip and Jump lifecycle pattern:

- pause Phaser when the page/app is hidden;
- do not count background time as gameplay time;
- clear stale pointer and buffered input state;
- warm-resume behind a short input-blocking overlay;
- remove old scene timers, tweens, camera effects, and level-owned objects before rebuilding.

See `PHASER_LIFECYCLE.md` for details.

## Files

- `index.html` — full-screen shell, compact HUD, loader, result/menu modal.
- `style.css` — palette, compact progress HUD, loader, modal styling.
- `sushi-config.js` — viewport sizing, full-width world/overscan, diagonal camera constants, palette, themes, item and Sushi Master catalogs.
- `sushi-scene.js` — direct-start scene, Sushi Master preload/selection, input, full-width camera/world setup, level setup, menu flow.
- `sushi-visuals.js` — voxel terrain, corrected traffic silhouettes, separate log/pad river rows, Sushi Master sprite, market stalls, water effects, shadows.
- `sushi-gameplay.js` — movement, ingredient progress, camera pressure, pickups, MISSED feedback, scoring, hazards.
- `sushi-boot.js` — Phaser boot at the launch viewport dimensions.
- `lifecycle.js` — pause/resume/cleanup behavior.

## Research references

- Crossy Road official site: https://www.crossyroad.com/
- Crossy Road App Store listing: https://apps.apple.com/us/app/crossy-road/id924373886
- PocketGamer.biz, *Why did the chicken... the making of Crossy Road*: https://www.pocketgamer.biz/making-of-crossy-road/
- Phaser Camera: https://docs.phaser.io/phaser/concepts/cameras
- Phaser Graphics: https://docs.phaser.io/phaser/concepts/gameobjects/graphics

No Crossy Road art assets are included in this repository.
