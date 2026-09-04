# Phaser lifecycle and return-from-background practices

This document captures the runtime patterns in **Slip and Jump** that matter for Sushi Street, especially mobile browsers and eventual iOS/Android wrappers.

## What we are carrying over from Slip and Jump

### 1. Pause the Phaser Scene when the app becomes hidden

Slip and Jump's runtime treats `visibilitychange` / `pagehide` as ownership boundaries. If gameplay is active and the document becomes hidden, the Scene is paused.

Sushi Street does the same in `lifecycle.js`.

Why:

- Phaser's Scene clock stops while paused.
- Scene timers do not race ahead while the user is away.
- traffic movement does not simulate minutes of missing frames.
- a return from background cannot create one giant animation/physics catch-up frame.

### 2. Never blindly auto-resume

Slip and Jump distinguishes **who paused the game**. A visibility pause should not accidentally override a pause the player chose, a death state, or another modal state.

Sushi Street tracks `autoPausedForVisibility`. On return, it shows a **Welcome Back** pause card. Gameplay only resumes after the player presses Resume.

This is important for native wrappers too: app foregrounding can happen while another UI owns the session.

### 3. Warm-resume behind a blocking overlay

Slip and Jump wakes/resumes Phaser behind a temporary “getting ready” overlay so the runtime receives clean frames before player input is accepted.

Sushi Street uses a shorter 700 ms warmup because this MVP has lighter scenes, but the principle is identical:

1. clear stale input;
2. wake Phaser's loop;
3. resume the Scene;
4. block player input briefly;
5. remove the warmup overlay;
6. accept input again.

### 4. Clamp frame delta in moving systems

Slip and Jump's moving platforms use a capped delta instead of trusting a potentially huge frame delta after tab throttling or device stalls.

Sushi Street traffic does the same:

```js
const dt = Math.min(delta, 40) / 1000;
```

The active run timer also caps individual deltas. The timer therefore represents active gameplay time, not wall-clock time spent with the app backgrounded.

### 5. Retire old stage-owned work before rebuilding

Slip and Jump clears Scene timer events, kills active tweens, resets camera effects, destroys stage-owned objects and clears transient pointer state before a new stage is built.

Sushi Street centralizes the same responsibilities in `SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(scene)`:

- clear buffered/swipe input;
- remove Scene timer events;
- kill all old level tweens;
- reset camera effects;
- destroy old road/shop/player/traffic objects;
- then build the next attempt.

This avoids callbacks from a previous level mutating a new level.

### 6. Clear transient pointer state at boundaries

A captured or half-finished touch gesture can make the first touch after a transition appear “missed.” Slip and Jump explicitly resets transient input at stage boundaries.

Sushi Street clears its pointer id and buffered move:

- on blur/background;
- before a level rebuild;
- when pausing;
- at warm-resume start;
- after a failure/finish.

### 7. Use Scene time for gameplay, browser time only for UI/lifecycle ownership

Gameplay-affecting time should live inside Phaser so it honors Scene pause semantics. Browser `setTimeout` is reserved for the warm-resume overlay itself, which is outside gameplay.

Do not build traffic spawning, ingredient expiry, level timers or scoring deadlines on wall-clock `Date.now()` unless the design explicitly wants offline progression.

## Sushi Street-specific runtime rules

### Traffic

Traffic positions advance only from Phaser `update(delta)`, with delta clamped. Nothing tries to “replay” missed traffic motion when returning from background.

### Active-time clock

The HUD clock is accumulated only from active Phaser frames. Leaving the app for five minutes does **not** add five minutes to the run.

### Camera

The camera follows the highest forward row reached, not every sideways/backward hop. It eases toward the player and accelerates slightly if the player gets too far ahead on screen. This creates the Crossy-style “camera catches up” feeling while preserving enough lateral time for shop collection.

### Level rebuilds

A retry always gets the same deterministic level layout for that level number. This makes failures learnable while cleanup ensures no traffic/tween from the previous attempt survives.

## QA checklist

### Background / foreground

- Start moving through a road lane.
- Background the browser/app for at least 30 seconds.
- Return.
- Verify the Welcome Back modal is visible and traffic is frozen.
- Press Resume.
- Verify the short sync overlay appears.
- Verify traffic resumes at normal speed with no teleport or fast-forward.
- Verify the active-time clock did not include background time.

### Player-owned pause

- Press Pause.
- Background and foreground the app.
- Verify the game stays paused.
- Resume once; verify no double-pause or stuck Scene.

### Retry / level transitions

- Fail repeatedly on traffic.
- Retry quickly several times.
- Switch between unlocked levels repeatedly.
- Verify no duplicate vehicles or old pickups remain.
- Verify the first tap after every transition works.

### Long session

- Replay/switch levels 20+ times.
- Verify traffic speed remains stable.
- Verify no increasing delay on taps/swipes.
- Verify no old level callback changes a new level's score or UI.

## Slip and Jump source areas reviewed

The patterns above were derived from these existing files in `drafthead/slipandjump`:

- `AUDIO_AND_LIFECYCLE.md`
- `runtime-lifecycle.js`
- `session-polish.js`
- `stage-resource-reset.js`
- `game.js`
- `index.html`
