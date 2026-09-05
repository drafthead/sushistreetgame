# Level 1 Kitchen Prototype

Level 1 is an isolated kitchen-style test route. Levels 2–20 keep the existing Sushi Street rules while this prototype is tuned.

## Current kitchen assets

Level 1 uses the artwork already committed under `images/kitchen/`.

- Boards: `images/kitchen/boards/1.png`
- Ingredients: `images/kitchen/ingredients/1.png` through `6.png`
- Pots: `images/kitchen/pots/1.png` through `3.png`
- Plates: `images/kitchen/plates/1.png` through `4.png`
- Tiles: `images/kitchen/tiles/1.png`, `2.png`, `3.png`
- Flying sushi: `images/kitchen/flyingsushi/1.png`
- Backgrounds: `leftside.png`, `rightside.png`, `bottomside.png`, `topside.png`

The browser build uses explicit asset lists. When more board or flying-sushi PNGs are added, update the corresponding arrays in the Level 1 modules.

## Row presentation

Kitchen mechanism rows use the committed tile art instead of flat placeholder blocks.

- **Ingredient rows** use `tiles/2.png`.
- **Pot rows** use `tiles/1.png`.
- **Plate rows** use `tiles/3.png`.
- **Flying-sushi rows** also use the kitchen tile treatment.

The tile pass uses one continuous Phaser `TileSprite` per row. The source texture is scaled to about twice the first kitchen pass and clipped to exactly one logical row, so the entire strip is filled while adjacent repeats touch with no artificial gaps. Pickup and obstacle positions are derived from the repeated tile centers so the art sits in the middle of the underlying tile cells.

Ingredient art was reduced by **30% from the enlarged V4 pass**. The current target is approximately 48–64 px high depending on row geometry, with uniform scaling to preserve source aspect ratio. The first ingredient touched on an ingredient row is collected; every other ingredient on that row immediately turns gray and cannot be collected from that station.

Plate values remain tied to plate file number: plate 1 = 5 points, plate 2 = 10, plate 3 = 20, and plate 4 = 35. Level 1 still requires at least 3 plates plus at least half of the four ingredient choices before the restaurant can open.

## Water boards

Water rows use the committed kitchen board image as the only valid support. Bare water is never walkable.

Boards all keep one lane velocity, so they cannot catch one another and merge. Their initial positions now use deliberately uneven circular spacing with larger minimum gaps, which creates visibly different distances between successive boards while preserving those gaps for the whole run. A small repeating vertical/rotation tween gives each board a light floating motion while it travels.

## Hot pots

Pots are lethal hazards. The player can move onto a pot position, but touching one is fatal.

On contact the chef is input-locked, tinted bright red for a short burn beat, the camera gives a small shake, and the run ends with a **HOT POT!** failure message. The intended path is through the open gaps between pots.

## Flying sushi

Flying-sushi hazard rows use `images/kitchen/flyingsushi/1.png`. The current art is approximately four times the original flying-sushi prototype size while preserving source aspect ratio. It still crosses the lane quickly, with spacing intended to feel like roughly one pass every two seconds. Contact ends the run.

Future `2.png`, `3.png`, and `4.png` assets can be added to the explicit asset list when they exist in the folder.

## Responsive kitchen frame

The Level 1 side art is a fixed DOM overlay rather than a Phaser world object.

The earlier side-frame version hid the real `<img>` elements and replaced them with 28–40 px pseudo-element background crops taken from the extreme outer edge of each very wide source image. That made the implementation fragile: if the sampled edge was transparent/empty, the frame existed and had a valid z-index but still appeared visually blank. The issue was therefore primarily the crop strategy, not the Phaser camera.

The current pass renders the actual `leftside.png` and `rightside.png` elements again. Each one occupies a guaranteed **52–72 px viewport rail**, is bottom-anchored, uses `object-fit: cover` so the source aspect ratio is preserved, and samples farther inside the illustration (`object-position`) instead of the potentially empty outer edge. The side frame sits explicitly above the Phaser canvas, while the HUD is promoted above the side frame so controls remain readable.

`bottomside.png` remains a world-space start cap scaled uniformly to the viewport width. `topside.png` remains a world-space goal cap scaled the same way so it comes into view near the end of the route.

Level 1 uses a straight camera. Other levels keep the normal Sushi Street camera presentation.

## Implementation

The original prototype remains in `sushi-kitchen-level1.js`. Successive Level 1-only refinements are layered in `sushi-kitchen-level1-v2.js`, `sushi-kitchen-level1-v3.js`, `sushi-kitchen-level1-v4.js`, and `sushi-kitchen-level1-v5.js`, loaded in that order immediately before `sushi-boot.js`. V5 owns the current ingredient sizing, uneven board spacing, and explicit side-frame visibility enforcement.
