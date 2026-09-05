# Sushi Street Game Design

## Elevator pitch

Sushi Street is a one-hop-per-lane delivery game. A blocky sushi chef crosses roads and canals, raids market shops for today's ingredients, and reaches the restaurant before traffic, water, or the giant sushi fish ends the run.

## Design principles

### 1. One hop must equal one readable unit

Each road row is one traffic lane and one movement step. If two road rows are adjacent, the dashed road line is drawn on the boundary between them. This makes the visual segmentation and gameplay grid agree.

### 2. Start with motion, not menus

The first screen after the loader is gameplay. Traffic and river supports are already moving. The timer and idle predator do not begin until the first valid player hop.

### 3. Voxel readability without a 3D engine

The reference look uses simple cuboid forms, a small palette, and consistent directional lighting. Sushi Street reproduces that design principle in Phaser 2D:

- brighter top face;
- darker front face;
- darkest right face;
- cast shadow down/right;
- crisp, square silhouettes;
- minimal surface detail.

The hero, vehicles, logs, scenery, pickups, and restaurant all share that rule.

### 4. Ingredient routing differentiates Sushi Street

Unlike a pure survival hopper, Sushi Street requires lateral movement. Safe shop rows give the player room to move several columns sideways to grab required ingredients.

## Current hazards

- **Roads**: moving cars and trucks.
- **Canals**: landing on open water triggers a splash death.
- **Moving river supports**: lily pads and logs carry the player sideways.
- **Idle predator**: after the run begins, waiting too long summons a giant sushi fish.

## Scoring

- Every hop = 1 point.
- Ingredient pickups add their item value.
- Delivery adds a small completion bonus.

Ingredient values:

- Rice 5
- Nori 6
- Cucumber 7
- Avocado 8
- Tuna 10
- Salmon 12
- Shrimp 14
- Uni 18

## Delivery result

- More than 50% of the required items = restaurant opens.
- 100% = full-menu result and maximum revenue.
- 50% or less = restaurant closes and the route must be retried.

## Progression

- 20 levels.
- Level 1 has 30 forward rows.
- Each later level adds two rows.
- Level 3 introduces night.
- Later levels rotate morning, day, sunset, and night.

## Result / menu flow

At the end of a run:

- primary action = replay the same level;
- secondary action = Menu / Levels;
- completing a level unlocks the next route in the level menu.
