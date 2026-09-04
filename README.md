# Sushi Street

A mobile-first Phaser 3 arcade delivery game inspired by the lane-crossing readability of games like Crossy Road, with a different objective: collect ingredients from side shops before reaching the restaurant.

## MVP gameplay

- **Tap / Up / W / Space:** hop forward one row.
- **Swipe left/right / A/D / arrows:** hop one column sideways.
- **Swipe down / Down / S:** hop backward, limited to four rows behind your best progress.
- Roads contain cars and trucks moving at different speeds and directions.
- Ingredient shops appear on **safe market rows** so the player has time to move several columns sideways to collect an item.
- Every successful hop is **+1 point**.
- Ingredient pickups add their own score value: common pantry items are worth less, premium seafood is worth more.
- Level 1 ends after **30 forward rows**. Each subsequent level adds 4 rows, up to 20 levels.
- At the restaurant, the player must have collected **more than 50%** of the requested items.
  - 100%: full menu and full revenue.
  - >50% but <100%: restaurant opens with reduced revenue.
  - 50% or less: restaurant closes and the level must be retried.
- Completed levels unlock the next level. Earlier levels remain replayable.

## Run locally

This MVP has no build step.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Stack

- Phaser **3.90.0**, matching Slip and Jump's current web runtime.
- Plain HTML/CSS/JavaScript.
- `localStorage` for level unlocks and per-level best score/revenue.
- Mobile viewport and standalone-web-app metadata included so the web build can later be wrapped with Capacitor or another native shell for iOS/Android.

## Files

- `index.html` — mobile shell, HUD, level/result/pause UI, Phaser loader.
- `style.css` — responsive game shell and overlays.
- `game.js` — level generation, traffic, grid movement, scoring, ingredients, camera and progression.
- `lifecycle.js` — visibility/pause/warm-resume behavior and level-boundary cleanup.
- `PHASER_LIFECYCLE.md` — lifecycle practices copied conceptually from Slip and Jump and adapted for Sushi Street.
- `GAME_DESIGN.md` — mechanics, balance, scoring and future roadmap.

## External gameplay references

The implementation is original, but the MVP uses established lane-crossing conventions as references:

- Crossy Road official site: https://www.crossyroad.com/
- Disney Crossy Road support page describing tap-forward / swipe-sideways / swipe-back controls: https://appsupport.disney.com/hc/en-us/articles/360000716983-How-do-I-play-Disney-Crossy-Road
- Evan Bacon's MIT-licensed Expo Crossy Road clone (architecture/reference only; no assets or source copied): https://github.com/EvanBacon/Expo-Crossy-Road
- `phaser3-road-cross`, a small Phaser 3 crossing example: https://github.com/geocine/phaser3-road-cross

The MVP uses flat geometric artwork and its own restaurant/ingredient rules rather than copying Crossy Road characters, models, sounds, branding, or assets.
