# Particles — Architecture Notes

This file is the technical handoff for the Particles project. The product/design source of truth is the living Google Doc; this repository file records implementation boundaries that should remain stable as the renderer evolves.

## Core decision

The production application should be a universal React Native app, not a Phaser scene wrapped inside a native shell.

Recommended stack:

```text
Expo SDK 57 / React Native 0.86
  ├─ React: navigation, overlays, Settings, Sessions, tutorial
  ├─ Gesture Handler: all active pointers + stable pointer IDs
  ├─ Reanimated/Worklets: native-thread input-adjacent animation
  ├─ Skia: particle renderer
  │    ├─ Atlas for many repeated particle sprites, or
  │    └─ RuntimeEffect/custom shader if the visual target requires it
  ├─ Rule engine: low-cadence motion feature extraction + scoring
  └─ Local persistence: settings + session history
```

Web starts with the same app/model and Skia's CanvasKit renderer. Reanimated worklets resolve to normal JavaScript on web, so web must be profiled as a distinct performance target. Keep rendering behind an interface so a web-only PixiJS v8 renderer can be substituted without changing rules, sessions, tutorial, or navigation.

## Why the browser prototype is plain Canvas 2D

`index.html`, `styles.css`, and `app.js` are a low-friction **feel prototype**, not the production stack. They let us tune:

- particle lag versus directness;
- particle density;
- multi-touch semantics;
- rule thresholds;
- score cadence;
- discovery-assist visibility;
- session behavior;
- tutorial pacing.

Once the feel is accepted, move the render/simulation contract into the React Native app. Do not spend weeks turning the Canvas 2D sketch into a framework.

## Data flow

```text
touches
  ↓
PointerState (stable IDs, x/y, velocity)
  ↓
┌─────────────────────────────┐
│ Simulation                  │  frame cadence
│ particle position/velocity  │
└─────────────────────────────┘
  ↓
Renderer (Skia Atlas / shader)

PointerState
  ↓
MotionFeatureSampler            lower cadence
  ↓
RuleEngine
  ├─ primary hidden rule
  ├─ secondary habit rule
  └─ tertiary ambient reward
  ↓
ScoreEvents
  ↓
SessionStore + minimal UI
```

React state must never sit in the per-particle loop.

## Multi-touch

Gesture Handler touch events expose `allTouches`, `changedTouches`, and stable touch IDs. Maintain an attractor per active touch, up to the supported maximum.

Do not collapse multi-touch into an average position. The renderer may use the centroid for some effects, but individual attractors remain independent.

When touch count changes, particles may be reassigned to attractors, but reassignment should be eased; it should not teleport entire particle groups.

## Particle simulation

Start with a deliberately simple, tunable physical model:

```text
target = pointer + per-particle orbit/noise offset
acceleration = spring * (target - position) + curl
velocity = (velocity + acceleration * dt) * damping
position += velocity * dt
```

Particle diversity comes from bounded variation in spring coefficient, damping, orbit radius, curl strength, visual size, sprite/material choice, depth/alpha, and response delay.

The important perceptual rule is that the field bends and trails. It must not behave like a rigid circle translated under a finger.

## Frame-time rules

- 60 FPS is the minimum product bar.
- 120 Hz hardware should naturally receive more temporal samples if the device can sustain them.
- Never set React state every frame.
- Never create one React component per particle.
- Avoid new objects/arrays in the hot loop.
- Prefer preallocated typed arrays or GPU buffers.
- Use as few draw submissions as practical.
- Pre-create/prewarm particle textures and shader programs.
- Dynamic particle density is allowed; dynamic input latency is not.
- Scoring and persistence never block rendering.
- Persist scores outside the critical frame path.

## Delta-time policy

The simulation clock is monotonic active-play time, not wall-clock time.

At normal runtime:

1. compute a frame delta;
2. clamp it;
3. use a small bounded number of physics substeps if needed;
4. discard excess time rather than attempting to catch up.

At background/foreground:

1. persist `hiddenAt`;
2. freeze simulation and input;
3. clear stale touch IDs;
4. on return, decide whether the same session continues;
5. reset `lastFrameTime` to **now**;
6. optionally damp residual particle velocity;
7. render the next frame from current state.

Never pass the full background gap into the integrator.

## Session contract

Default resume window: **5 minutes**.

State:

```ts
type Session = {
  id: string;
  startedAt: number;
  lastActiveAt: number;
  activeMs: number;
  score: number;
};
```

If `returnAt - lastActiveAt <= resumeWindow`, continue the same session. Otherwise archive the current session, create a new one, reset score, and keep settings/unlocks. The window is a user setting; the prototype exposes 1–15 minutes.

## Rule engine boundary

Rules operate on normalized motion features rather than raw rendering state. Initial features include normalized position, velocity/acceleration, path distance, direction changes, dwell by screen band, edge visits, center crossings, active pointer count, pairwise distance, centroid travel, and approximate loop closure.

A rule emits a score event. The renderer may respond visually, but rendering never decides whether points were earned.

Primary windows begin in the 10–20 second range. Secondary rules prefer frequently observed recent behaviors. A roughly 30-second dry spell can enable a five-second assist that makes a current rule easier to infer without displaying its name.

## Tutorial

Port the Pitch Recognition spotlight model conceptually rather than copying DOM code directly. Required capabilities are first-run state, forced replay from Settings, target measurement, dim mask with bright cutout, curved arrow/tag, responsive relayout, and an interaction step that can require a real drag before advancing.

In React Native, use an overlay view plus measured layout coordinates and a mask/Skia overlay. Keep tutorial state outside the particle simulation.

## Web fallback criteria

Stay with Skia/CanvasKit unless profiling shows sustained frame-time failure at accepted density, noticeably worse touch-to-visual latency than native, unacceptable CanvasKit startup cost, or fragile Safari behavior.

If fallback is needed, use PixiJS v8 `ParticleContainer` behind the renderer interface. Do **not** fork the rule engine or session model.

## Phaser decision

Phaser 4 is substantially stronger than Phaser 3 and can render huge sprite counts efficiently. It is still explicitly web-first. Particles does not need scenes, cameras, world collision, tilemaps, or a conventional game-object hierarchy; its core is a full-screen tactile field.

For that reason Phaser is not the production default. It remains a reasonable browser-only experiment if the product later becomes web-only.

## QA matrix

Minimum coverage before declaring the feel stable:

- recent iPhone Pro with 120 Hz display;
- non-Pro iPhone;
- mid-range Android;
- lower-end supported Android;
- iOS Safari;
- Android Chrome;
- desktop Chrome/Safari for the browser build.

Measure input-to-visible-response latency, p50/p95 frame time, dropped-frame percentage, particle count under load, memory growth across long use, background/foreground resume, 1/2/3/5 simultaneous pointers, orientation changes, and tutorial target alignment.

The experience fails QA if a returning foreground frame “catches up,” if a third finger is ignored, or if scoring causes a visible hitch.
