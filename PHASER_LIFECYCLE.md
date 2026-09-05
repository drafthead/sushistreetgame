# Phaser Lifecycle Notes for Sushi Street

This document records the Slip and Jump practices carried into Sushi Street.

## Problem to avoid

When a mobile web game goes to the background and comes back, Phaser projects often suffer from one or more of these issues:

- traffic or timers appear to "catch up" all at once;
- stale pointer gestures block the next tap;
- old tweens or timers survive a level reset;
- overlays and gameplay disagree about whether the run is paused.

Slip and Jump solved this by **freezing the scene**, **separating pause ownership**, and **resuming through a warm-up path instead of an instant jump back into active play**.

## The Sushi Street version

`lifecycle.js` provides the same structure.

### 1) Visibility pause freezes gameplay

On `visibilitychange` / `pagehide`:

- the active scene is paused;
- transient input is cleared;
- warmup overlays are hidden;
- the game does **not** continue simulating while off-screen.

This means time away from the app is not gameplay time. Traffic can animate before the first hop, but the active-time and idle-fish counters begin only after the player's first valid move.

### 2) Explicit resume path

When the app becomes visible again:

- Sushi Street does not immediately hand control back to the player;
- a **Welcome Back** modal is shown;
- pressing Resume wakes the game loop and resumes the scene;
- a short **700ms warm-resume overlay** blocks input while Phaser settles.

This is intentionally similar to Slip and Jump's warm-resume behavior.

### 3) Per-level cleanup

Before a new level is built, `beforeLevelBuild(scene)` calls:

- `scene.time.removeAllEvents()`
- `scene.tweens.killAll()`
- `scene.cameras.main.resetFX()`
- `scene.destroyLevelObjects()`
- transient input reset helpers

That prevents stale callbacks or objects from surviving a retry or level transition.

### 4) Clamp frame delta in active simulation

Inside `update()`:

- gameplay movement uses `Math.min(delta, 40)` for simulation;
- the active timer uses `Math.min(delta, 50)`.

So even if the browser returns an unusually large frame, the game does not leap forward in a single update.

### 5) Reset transient gestures

The lifecycle helper calls scene methods like:

- `cancelGesture()`
- `clearBufferedMove()`

This prevents a stale drag or queued move from being inherited after a pause or rebuild.

## Integration checklist for future features

Any new Sushi Street mechanic should follow these rules:

1. **Level-owned objects must be destroyable** through `destroyLevelObjects()`.
2. **Timers** should be registered on `scene.time` so they are removable during rebuilds.
3. **Input state** must be clearable; do not leave hidden gesture state in closures.
4. **Resume safety first**: after foregrounding, do not accept gameplay input until the warm resume finishes.
5. **Never rely on background catch-up** for movement, score, or progress.

## Why this matters for iPhone / Android wrapping later

Because Sushi Street is being built as a web app first and may later be wrapped for native containers, visibility and lifecycle behavior needs to already be mobile-safe.

These patterns keep the game stable in Safari / Chrome mobile tabs now, and they also map cleanly to wrapped app shells where pause/resume events are even more common.
