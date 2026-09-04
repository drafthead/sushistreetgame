(() => {
  if (window.SUSHI_RUNTIME_LIFECYCLE) return;

  const WARMUP_MS = 700;
  let sceneGetter = () => null;
  let autoPausedForVisibility = false;
  let warmTimer = 0;
  let pauseReason = '';

  const modal = () => document.getElementById('modal');
  const modalTitle = () => document.getElementById('modal-title');
  const modalBody = () => document.getElementById('modal-body');
  const primary = () => document.getElementById('primary-action');
  const secondary = () => document.getElementById('secondary-action');
  const levelGrid = () => document.getElementById('level-grid');
  const warmup = () => document.getElementById('warmup');

  function getScene() {
    try { return sceneGetter?.() || null; } catch (_) { return null; }
  }

  function isScenePaused(scene) {
    try { return !!scene?.scene?.isPaused?.(); } catch (_) { return false; }
  }

  function clearWarmTimer() {
    if (!warmTimer) return;
    clearTimeout(warmTimer);
    warmTimer = 0;
  }

  function hideWarmup() {
    clearWarmTimer();
    const layer = warmup();
    if (layer) layer.hidden = true;
  }

  function resetTransientInput(scene) {
    try { scene?.cancelGesture?.(); } catch (_) {}
    try { scene?.clearBufferedMove?.(); } catch (_) {}
  }

  function retireLevelWork(scene) {
    if (!scene) return;
    resetTransientInput(scene);
    try { scene.time?.removeAllEvents?.(); } catch (_) {}
    try { scene.tweens?.killAll?.(); } catch (_) {}
    try { scene.cameras?.main?.resetFX?.(); } catch (_) {}
    try { scene.destroyLevelObjects?.(); } catch (_) {}
  }

  function showPauseModal(reason = 'paused') {
    const scene = getScene();
    if (!scene?.runActive) return;
    pauseReason = reason;
    const layer = modal();
    if (!layer) return;
    const title = reason === 'background' ? 'Welcome Back' : 'Paused';
    const body = reason === 'background'
      ? 'The street was frozen while the app was away. Resume when you are ready.'
      : 'Traffic and the active-time clock are frozen.';
    modalTitle().textContent = title;
    modalBody().textContent = body;
    if (levelGrid()) levelGrid().hidden = true;
    const stats = document.getElementById('modal-stats');
    if (stats) stats.hidden = true;
    primary().textContent = 'RESUME';
    primary().dataset.action = 'resume';
    secondary().hidden = false;
    secondary().textContent = 'LEVEL SELECT';
    secondary().dataset.action = 'level-select';
    layer.classList.add('show');
  }

  function pause(reason = 'manual') {
    const scene = getScene();
    if (!scene?.runActive || scene.runEnded) return;
    hideWarmup();
    resetTransientInput(scene);
    if (!isScenePaused(scene)) {
      try { scene.scene.pause(); } catch (_) {}
    }
    showPauseModal(reason);
  }

  function resume(reason = 'resume') {
    const scene = getScene();
    if (!scene?.runActive || scene.runEnded || document.hidden) return;
    autoPausedForVisibility = false;
    const layer = modal();
    layer?.classList.remove('show');
    const warm = warmup();
    if (warm) warm.hidden = false;
    resetTransientInput(scene);

    // Match Slip and Jump's warm-resume approach: wake/resume immediately behind
    // a short blocking overlay so Phaser receives several clean frames before
    // player input is accepted again.
    try { scene.game?.loop?.wake?.(); } catch (_) {}
    try { if (isScenePaused(scene)) scene.scene.resume(); } catch (_) {}
    try { scene.onWarmResumeStart?.(reason); } catch (_) {}

    clearWarmTimer();
    warmTimer = setTimeout(() => {
      warmTimer = 0;
      if (warm) warm.hidden = true;
      try { scene.onWarmResumeEnd?.(reason); } catch (_) {}
    }, WARMUP_MS);
  }

  function handleHidden() {
    const scene = getScene();
    if (!scene?.runActive || scene.runEnded) return;
    hideWarmup();
    resetTransientInput(scene);
    if (isScenePaused(scene)) {
      autoPausedForVisibility = false;
      return;
    }
    autoPausedForVisibility = true;
    try { scene.scene.pause(); } catch (_) {}
  }

  function handleVisible() {
    const scene = getScene();
    if (!scene?.runActive || scene.runEnded) return;
    if (autoPausedForVisibility) showPauseModal('background');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleHidden();
    else handleVisible();
  });
  window.addEventListener('pagehide', handleHidden);
  window.addEventListener('pageshow', handleVisible);
  window.addEventListener('blur', () => resetTransientInput(getScene()));

  window.SUSHI_RUNTIME_LIFECYCLE = {
    warmupMs: WARMUP_MS,
    bind(getter) { sceneGetter = getter; },
    beforeLevelBuild(scene) { retireLevelWork(scene); },
    retireLevelWork,
    resetTransientInput,
    pause,
    resume,
    showPauseModal,
    hideWarmup,
    autoPausedForVisibility: () => autoPausedForVisibility,
    pauseReason: () => pauseReason,
  };
})();
