# Level 1 Kitchen Prototype

Level 1 is now an isolated kitchen-style test route. Levels 2–20 keep the existing Sushi Street rules while this prototype is tuned.

## Asset-driven rule

Level 1 should use the artwork already committed under `images/kitchen/` for the mechanics in this pass. Do not invent rolling sushi/cucumber hazards, wind streaks, wooden rollers, or other replacement obstacle art when an equivalent kitchen mechanic is not represented by the committed assets.

Current verified asset sets used by the prototype:

- `images/kitchen/boards/1.png`
- `images/kitchen/ingredients/1.png` through `6.png`
- `images/kitchen/pots/1.png` through `3.png`
- `images/kitchen/plates/1.png` through `4.png`
- `images/kitchen/knives/1.png`, `2.png`, and `6.png`
- `images/kitchen/backgrounds/leftside.png`, `rightside.png`, `bottomside.png`, and `topside.png`

The board list is intentionally explicit because a static browser build cannot enumerate a GitHub directory at runtime. When more board PNGs are added, update the `BOARD_FILES` list in `sushi-kitchen-level1.js`.

## Level 1 route

The route is 26 forward rows and uses a straight camera for the kitchen reference look. It alternates the following mechanisms:

- **Plate conveyors:** plate PNGs sit on conveyor rows. Touching a plate collects it once. Plate file number controls value: plate 1 is worth 5 points, plate 2 is 10, plate 3 is 20, and plate 4 is 35.
- **Water channels:** every water row contains moving board PNGs. The board is the only valid landing support; bare blue water always causes a splash failure. Boards travel across the channel and wrap back after leaving the opposite side.
- **Ingredient choice counters:** all six ingredient PNGs are shown. The first ingredient the chef touches on that counter is collected; the other choices immediately become gray and cannot be collected on that counter.
- **Pot rows:** pot PNGs occupy blocked grid cells. The chef must move through the open gaps between pots.
- **Prep rows:** the committed knife PNGs are used as visual prep-counter dressing in this first pass; they are not a separate invented projectile mechanic.

There are deliberately no generated sushi-roll/cucumber traffic hazards in this Level 1 prototype.

## Opening requirement

Level 1 contains four ingredient-choice counters. The restaurant requirement remains at least half of those choices, so the chef needs at least **2 ingredients**, plus at least **3 plates**, before reaching the top chef/finish area.

The Level 1 HUD changes to a compact kitchen status readout showing both ingredient and plate progress. Plate points still add directly to the normal score/high-score system.

## Responsive environment frame

The left and right kitchen background images stay fixed to the viewport edges at roughly 38–52 CSS/game pixels wide. Gameplay columns are inset from those strips so the chef does not run underneath the side art.

`bottomside.png` is anchored to the world around the Level 1 start area. `topside.png` is anchored around the finish/chef area. Both move with the world rather than remaining permanently on screen.

Level 1 disables the normal 5.5° camera rotation so the kitchen lanes read more like the supplied reference. Other levels retain the existing rotated street presentation.

## Implementation

The prototype is implemented in `sushi-kitchen-level1.js` and loaded after the general tuning/flow modules so its overrides apply only to Level 1. `sushi-kitchen-level1.css` contains Level 1 HUD/frame presentation tweaks. The module intentionally falls back to the original implementation for every level other than Level 1.
