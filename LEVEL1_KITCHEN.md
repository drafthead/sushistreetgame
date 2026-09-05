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

The browser build uses explicit asset lists. When more board or flying-sushi PNGs are added, update the corresponding arrays in the Level 1 module.

## Row presentation

The flat placeholder counter colors are replaced with repeated real tile artwork. Tile images are scaled uniformly by height and repeated edge-to-edge, so the artwork keeps its aspect ratio rather than being stretched.

- **Ingredient rows** use `tiles/2.png`; the transparent ingredient PNGs sit directly on top.
- **Pot rows** use `tiles/1.png`; the pot PNGs sit directly on top.
- **Plate rows** use `tiles/3.png`; the plate PNGs sit directly on top.

The first ingredient touched on an ingredient row is collected. Every other ingredient on that row immediately turns gray and cannot be collected from that station.

Plate values remain tied to plate file number: plate 1 = 5 points, plate 2 = 10, plate 3 = 20, and plate 4 = 35. Level 1 still requires at least 3 plates plus at least half of the four ingredient choices before the restaurant can open.

## Water boards

Water rows use the committed kitchen board image as the only valid support. Bare water is never walkable.

Boards move laterally across the water like the earlier logs, but are shorter and separated by visible gaps. A small repeating vertical/rotation tween gives each board a light floating motion while it travels.

## Hot pots

Pots are no longer passive blocked cells. The player can move onto a pot position, but touching one is fatal.

On contact the chef is input-locked, tinted bright red for a short burn beat, the camera gives a small shake, and the run ends with a **HOT POT!** failure message. The intended path is through the open gaps between pots.

## Flying sushi

Flying-sushi hazard rows use `images/kitchen/flyingsushi/1.png`. The image moves quickly across the row. Spacing is calculated from lane width and speed so a hazard crosses a given point roughly every two seconds. Contact ends the run.

Future `2.png`, `3.png`, and `4.png` assets can be added to the explicit asset list when they exist in the folder.

## Responsive kitchen frame

The side background images are no longer stretched into tall narrow strips. Each side image keeps its original aspect ratio and is scaled uniformly by viewport height, then positioned mostly outside the canvas so only about **20–40 pixels per side** remain visible.

`bottomside.png` is scaled uniformly so its width equals the viewport width, anchored to the bottom edge of the initial Level 1 view, and allowed to extend upward at its natural aspect ratio.

`topside.png` is also scaled uniformly to the viewport width and anchored above the goal row so the sushi-chef environment comes into view naturally near the end of the route.

Level 1 uses a straight camera. Other levels keep the normal Sushi Street camera presentation.

## Implementation

The original prototype remains in `sushi-kitchen-level1.js`. The current visual/mechanic polish is layered in `sushi-kitchen-level1-v2.js`, loaded immediately afterward and before `sushi-boot.js`, so these overrides affect Level 1 only.