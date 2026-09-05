# Sushi Prep Kitchen Levels

The former Level 1 kitchen prototype is now the main gameplay format across the 20-level route.

## Level structure

Kitchen-prep gameplay is used on every level except every fifth level. Levels **5, 10, 15, and 20** keep the original Sushi Street traffic route as bonus crossings. Reaching the end of a bonus street level clears it; kitchen ingredient and plate quotas do not apply there.

Kitchen levels keep the straight camera, kitchen side artwork, wooden safe-floor strips, tile rows, moving boards, hot pots, flying sushi, ingredient rows, and plate rows developed in the Level 1 prototype.

## Sushi prep quota

A kitchen level requires **both** enough ingredients and enough plates before the finish can be marked ready for sushi prep.

Level 1 starts at **3 ingredients and 3 plates**. The quota rises with each successive kitchen-prep stage and caps at 10/10 so the requirement remains achievable with the current four plate rows on smaller screens.

The internal ingredient target is twice the visible quota, preserving the original 50% minimum concept. The player-facing HUD shows the clearer minimum directly, for example:

`ING 0/3 · PLATES 0/3`

Collecting beyond the minimum is encouraged. Extra ingredients and plates add normal pickup value plus an additional **EXTRA PREP** bonus. A one-time `SUSHI PREP READY!` notification appears as soon as both minimums are met.

At the finish, kitchen status uses **READY FOR SUSHI PREP** or **NOT READY FOR SUSHI PREP** instead of restaurant OPEN/CLOSED language. Result cards show ingredient quota, plate quota, extra-prep bonus, and score.

## Chef progression

Chef selection now defaults to **AUTO CHEF**. In auto mode the Sushi Master rotates by level through the available chef roster. The Chefs tab also lets the player select a specific chef; that becomes a persistent manual override until AUTO CHEF is selected again.

## Current kitchen assets

- Boards: `images/kitchen/boards/1.png`
- Ingredients: `images/kitchen/ingredients/1.png` through `6.png`
- Pots: `images/kitchen/pots/1.png` through `3.png`
- Plates: `images/kitchen/plates/1.png` through `4.png`
- Tiles: `images/kitchen/tiles/1.png`, `2.png`, `3.png`
- Flying sushi: `images/kitchen/flyingsushi/1.png`
- Backgrounds: `leftside.png`, `rightside.png`, `bottomside.png`, `topside.png`

## Kitchen interactions

Ingredients are individually collectible. Picking one does not gray out the rest of its row, and horizontal hops collect any ingredient actually crossed by the chef's movement path.

Water is never walkable. Moving kitchen boards are the only support. Landings use the chef's real X position with a small 6–10 px edge tolerance so visually valid landings are forgiving without snapping to distant boards. Water misses create a visible splash.

Flying sushi carries the red-tinted chef offscreen with it on impact before the failure card appears. Hot-pot contact tints the chef red, shakes the camera, and fails the run.

The side artwork repeats vertically and moves downward opposite the player's forward progress. Its movement is eased and deliberately slower than the chef so it reads as continuous parallax rather than stepping with each hop.

## Plate conveyor

Plate rows now behave like slow conveyor belts. Uncollected plates move laterally at a steady, low speed and wrap around the row while preserving their spacing. The `tiles/3.png` band also drifts subtly in the same lane direction to reinforce the conveyor effect.

Each available plate has a pulsing warm-yellow/white glow behind it so it reads immediately as a target worth hitting. The glow disappears as soon as that plate is collected.

The old charcoal color visible beneath the dimensional plate tiles has been replaced with a warm medium wood base. The connected TileSprite still spans the entire row; the wood underlay now fills any transparent/3D gaps in the source art so adjacent tiles visually merge instead of exposing dark gray. The plate tile artwork itself is also warmed toward a wooden-brown tone. Existing moving board artwork is similarly warmed so it reads more like wood while the final replacement board asset is pending.

## Onboarding cues

At the beginning of each route, two yellow-white chevrons pulse just ahead of the chef to communicate the forward direction. They follow the chef for the first few hops and then disappear.

A bottom-screen orange/red gradient prompt modeled on the supplied reference shows a dedicated tap-hand SVG icon plus **Tap to hop**. The prompt does not intercept pointer events, so tapping directly on it still performs the game hop. It fades away after the player makes the first few moves.

## Visual floor

Neutral `kitchenSafe` rows use a warm light-brown plank treatment instead of the earlier light-grey floor, giving the route a more sushi-restaurant wooden-floor feel.

## Implementation

`sushi-kitchen-mode.js` loads before the original kitchen prototype and establishes the new route rule early enough for kitchen rows to build on non-bonus levels.

The original prototype and refinements remain layered in `sushi-kitchen-level1.js` through `sushi-kitchen-level1-v9.js`. `sushi-kitchen-levels-v10.js` owns multi-level quotas, bonus street completion, prep READY/NOT READY results, extra-prep bonuses, and AUTO/manual chef selection. `sushi-kitchen-levels-v11.js` owns the plate conveyor motion, target glow, warm wooden plate/board treatment, forward chevrons, and tap-to-hop onboarding UI.