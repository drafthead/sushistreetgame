# Particles

**Working codename.** This is a separate project living inside the Sushi Street repository while the idea is developed on the `dev` branch.

Particles is a calm, touch-first discovery game. A luminous particle cloud follows one or several fingers with inertia and lag. Hidden scoring rules change over time, so the player discovers what the world is currently rewarding by moving naturally rather than reading a task list.

The first prototype is intentionally browser-native and dependency-free so the interaction can be tuned quickly. The production architecture recommendation is **Expo / React Native + React Native Skia + Reanimated/Worklets + React Native Gesture Handler**, with the renderer isolated so web can use a different GPU renderer if profiling proves that necessary.

## Run the feel prototype

Serve the repository over HTTP, then open:

```text
/Particles/
```

For example, from the repository root:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/Particles/`.

The prototype includes:

- gold-on-black holographic particle field;
- Pointer Events multi-touch, including independent three-finger input;
- spring/drag/inertia with deliberately varied particle response times;
- hidden primary and secondary scoring rules plus a small ambient movement reward;
- 10–20 second primary-rule windows;
- five-second visual discovery assistance after a long stretch without a primary hit;
- session score and local session history;
- five-minute default session-continuity behavior, configurable from 1–15 minutes;
- background/foreground resume without replaying missed physics time;
- first-run spotlight tutorial, replayable from Settings.

## Interaction principles

1. The particle field must be satisfying with the score ignored.
2. Score should feel like recognition, not instruction.
3. The hidden rule system is allowed to surprise the player, but recent player behavior should influence secondary rewards and future rule selection.
4. Multi-touch is a core mechanic, not a bonus feature.
5. Backgrounding the app must never cause a catch-up burst or jerky resume.
6. Reduce visual complexity before sacrificing touch latency.

## Prototype rule library

The current browser prototype can recognize variants of:

- bottom dwell;
- edge-to-edge sweep;
- top/bottom traversal;
- zigzag;
- center crossing;
- approximate loop closure;
- two-finger spread and converge;
- roughly parallel two-finger motion;
- moving a three-finger centroid;
- quiet hold;
- fast-to-slow motion.

The active primary rule is deliberately not shown in the UI.

## Production direction

Do **not** treat the current Canvas 2D prototype as the final renderer. It is a fast interaction sketch.

The intended production stack is:

- **Expo SDK 57 / React Native 0.86** for the application shell;
- **React Native Skia** for native particle rendering;
- **Skia Atlas or a custom shader** for the high-volume particle draw path;
- **React Native Gesture Handler** touch events for stable IDs and all active touches;
- **Reanimated / Worklets** to keep native input-adjacent animation off the JS thread;
- a renderer interface so web can fall back to **PixiJS v8 ParticleContainer** if CanvasKit/main-thread profiling warrants it.

Phaser remains a strong web-game framework, including its much faster Phaser 4 renderer, but it is not the recommended production core here because the product is fundamentally a native-feeling, full-screen touch surface rather than a conventional scene/game-object game.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the technical boundaries and performance rules.

## Reference patterns already in the other projects

The design intentionally carries forward two patterns already proven in the user's games:

- **Pitch Recognition**: first-run spotlight tutorial, curved arrows, target measurement, resize-aware positioning, persisted seen state, and replay from Settings.
- **Slip and Jump**: lifecycle ownership, discard background time, clear stale pointers, reset the simulation clock, and never animate a backlog of missed frames on foreground.

## Naming directions

Current creative shortlist, not trademark-cleared:

- **Driftform** — leading candidate; motion creates temporary forms and rules.
- **Mote** — minimal and literally particle-sized.
- **Murmur** — quiet emergent swarm motion.
- **Glint**
- **Lumen Drift**
- **Haloform**
- **Trace**
- **Aureline**

Keep the repository folder `Particles` until naming research is complete.

## Research references

- Feelsy: https://feelsy.life/
- Expo SDK 57: https://expo.dev/changelog/sdk-57
- React Native Skia Atlas: https://shopify.github.io/react-native-skia/docs/shapes/atlas/
- React Native Skia web support: https://shopify.github.io/react-native-skia/docs/getting-started/web/
- React Native Reanimated worklets: https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets/
- React Native Gesture Handler touch events: https://docs.swmansion.com/react-native-gesture-handler/docs/2.x/gestures/touch-events/
- Phaser: https://docs.phaser.io/
- PixiJS ParticleContainer: https://pixijs.com/8.x/guides/components/scene-objects/particle-container

No Feelsy assets, code, or exact visual materials are included here.
