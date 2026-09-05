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

The tile pass uses one continuous Phaser `TileSprite` per row. The source texture is scaled up and clipped to exactly one logical row, so the entire strip is filled while adjacent repeats touch with no artificial gaps. Pickup and obstacle positions are derived from the repeated tile centers so the art sits in the middle of the underlying tile cells.

Ingredient art is currently about 48–64 px high depending on row geometry. Ingredients are now **individually collectible**: taking one ingredient does not gray out or disable the other ingredients on that row. Each visible ingredient can be collected once, so the player can move along or revisit the row and collect several different ingredients.

Plate values remain tied to plate file number: plate 1 = 5 points, plate 2 = 10, plate 3 = 20, and plate 4 = 35. Level 1 still requires at least 3 plates plus at least half of the four base ingredient requirement before the restaurant can open; extra ingredients continue to add score.

## Water boards

Water rows use the committed kitchen board image as the only valid support. Bare water is never walkable.

Boards all keep one lane velocity, so they cannot catch one another and merge. Their initial positions use deliberately uneven circular spacing with larger minimum gaps, which creates visibly different distances between successive boards while preserving those gaps for the whole run. A small repeating vertical/rotation tween gives each board a light floating motion while it travels.

Level 1 vertical movement uses the chef's **actual world X** rather than snapping to the center of the nearest logical column. This matters after a moving board has carried the chef sideways: pressing forward/back produces a straight hop and never intentionally shifts the chef sideways.

Board landing checks also use the chef's real X. The current pass accepts the full visible board footprint plus a small **6–10 px edge tolerance**, which compensates for the board moving slightly during the hop without snapping the player to a genuinely distant board. If no board is under that real landing position, the chef falls in the water.

Water deaths now render a visible splash: expanding white/blue rings plus small droplets at the chef's actual fall position, alongside the existing splash sound/death flow.

## Hot pots

Pots are lethal hazards. The player can move onto a pot position, but touching one is fatal.

On contact the chef is input-locked, tinted bright red for a short burn beat, the camera gives a small shake, and the run ends with a **HOT POT!** failure message. The intended path is through the open gaps between pots.

## Flying sushi

Flying-sushi hazard rows use `images/kitchen/flyingsushi/1.png`. The current art is approximately four times the original flying-sushi prototype size while preserving source aspect ratio. It still crosses the lane quickly, with spacing intended to feel like roughly one pass every two seconds.

A flying-sushi hit is now a physical impact animation instead of an instant disappear. The chef turns red, is pulled onto the sushi's path, and both the sushi and chef travel together off the side of the screen before the failure result is shown.

Future `2.png`, `3.png`, and `4.png` assets can be added to the explicit asset list when they exist in the folder.

## Responsive kitchen frame and parallax

The Level 1 side art is a fixed DOM overlay above the Phaser canvas and below the HUD. The visible rails extend roughly **172–192 px** inward from each physical screen edge.

The side artwork is now treated as **infinitely repeating vertical scenery**. `leftside.png` and `rightside.png` repeat down the side rails rather than being stretched to a single viewport-height image. As the chef progresses upward through the level, the side art moves downward in the opposite direction at slightly different rates on the left and right. This creates the feeling that the player is moving forward through a long kitchen environment, and repeating the source image prevents the effect from running out of artwork.

`bottomside.png` remains a world-space start cap scaled uniformly to the viewport width. `topside.png` remains a world-space goal cap scaled the same way so it comes into view near the end of the route.

Level 1 uses a straight camera. Other levels keep the normal Sushi Street camera presentation.

## Implementation

The original prototype remains in `sushi-kitchen-level1.js`. Successive Level 1-only refinements are layered in `sushi-kitchen-level1-v2.js` through `sushi-kitchen-level1-v7.js`, loaded in that order immediately before `sushi-boot.js`.

V5 owns ingredient sizing and uneven board spacing. V6 owns straight-X forward/back hopping and the first real-position board landing correction. V7 owns the latest forgiving board-edge tolerance, water splash feedback, individually collectible ingredients, flying-sushi carry-off death animation, and infinite downward-moving side parallax.