# Sushi Street — MVP game design

## Core fantasy

You are the morning runner for a sushi restaurant. The chef gives you **Today's Menu**. You cross a busy market district, visit the correct side shops, collect ingredients, and deliver what you found to the restaurant.

The movement vocabulary is intentionally simple: every action is a hop.

## Why shops are on safe rows

A direct Crossy Road-style pressure model can punish lateral exploration because the player normally wants to keep moving forward. Sushi Street needs the opposite tension: the player should sometimes choose to spend several hops moving left or right.

The solution in this MVP is a repeating rhythm:

**traffic lanes → safe market row → traffic lanes → safe market row**

Ingredient pickups are placed on the far side of safe market rows. The player gets a readable planning beat, crosses sideways, collects the item, then chooses when to push into traffic again.

## Camera model

- Forward progress moves the camera target.
- Sideways movement does not push the camera forward.
- Backtracking is allowed, but only four rows behind the player's furthest progress.
- The player can get ahead of the camera temporarily; camera easing catches up.
- If the player gets very high on screen, the camera catch-up lerp becomes faster.

This keeps the “move ahead, camera catches up” arcade feel without a harsh scrolling deadline during shopping.

## Level curve

There are 20 levels.

| Level | Forward rows |
|---|---:|
| 1 | 30 |
| 2 | 34 |
| 3 | 38 |
| ... | +4 each level |
| 20 | 106 |

Difficulty also increases through traffic speed and, later, occasional 3-vehicle lanes.

## Menu size

- Levels 1–3: 4 pickups.
- Then the menu grows gradually, capped at 8 pickups.
- More ingredient types enter the available pool over the campaign.

## Ingredient values

| Ingredient | Points |
|---|---:|
| Rice | 5 |
| Nori | 6 |
| Cucumber | 7 |
| Avocado | 8 |
| Tuna | 10 |
| Salmon | 12 |
| Shrimp | 14 |
| Uni | 18 |

Every hop is also worth **1 point**.

## Restaurant result

At the finish:

- **More than 50% collected:** restaurant opens.
- **100% collected:** full menu / maximum revenue.
- **Partial pass:** restaurant opens with reduced revenue.
- **50% or less:** restaurant closes; retry the same level.

Revenue is separate from score so future versions can use it for restaurant upgrades, cosmetics, or progression without changing the arcade score model.

## Traffic design

Every road row owns a direction and speed. Cars/trucks wrap horizontally. Speed rises by level, and vehicle body lengths vary so players must judge gaps rather than memorize one cadence.

For the MVP, retrying a level reuses a deterministic seed. That means a player can learn a difficult layout instead of receiving a completely unrelated failure state.

## Input

### Mobile

- Tap: forward.
- Swipe left/right: side hop.
- Swipe down: backward.
- Swipe up: forward.

### Desktop

- Arrow keys or WASD.
- Space also moves forward.

## Future extensions

1. **Art pass:** original low-poly/voxel-inspired neighborhood, character and vehicle models.
2. **Shop identity:** fishmonger, produce stand, seaweed shop, rice pantry, specialty counter.
3. **Menu recipes:** convert raw ingredient counts into named dishes (salmon roll, tuna nigiri, uni special) so a missed ingredient visibly removes a dish from the opening menu.
4. **Restaurant economy:** spend revenue on restaurant decor, staff, signs, kitchen speed, and new districts.
5. **Districts:** 20 levels can be grouped into 4 districts of 5 levels, each with a new traffic/environment rule.
6. **Traffic telegraphing:** train tracks, delivery bikes, buses, lights or horns.
7. **Native wrapper:** Capacitor with iOS/Android lifecycle hooks routed into the same pause/resume ownership layer.
8. **Audio:** one reusable level/ambient audio owner, following Slip and Jump's “one element, explicit visibility pause” approach.
