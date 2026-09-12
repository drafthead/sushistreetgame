(() => {
  'use strict';

  const canvas = document.querySelector('#field');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const scoreEl = document.querySelector('#score');
  const signalEl = document.querySelector('#signal');
  const dock = document.querySelector('#dock');
  const sessionsButton = document.querySelector('#sessions-button');
  const settingsButton = document.querySelector('#settings-button');
  const sessionsPanel = document.querySelector('#sessions-panel');
  const settingsPanel = document.querySelector('#settings-panel');
  const backdrop = document.querySelector('#backdrop');
  const sessionsList = document.querySelector('#sessions-list');
  const currentSessionEl = document.querySelector('#session-current');
  const newSessionButton = document.querySelector('#new-session-button');
  const timeoutSlider = document.querySelector('#session-timeout');
  const timeoutOutput = document.querySelector('#session-timeout-value');
  const trailsToggle = document.querySelector('#trails-toggle');
  const assistToggle = document.querySelector('#assist-toggle');
  const tutorialButton = document.querySelector('#tutorial-button');

  const STORAGE = {
    SETTINGS: 'particles-settings-v1',
    CURRENT: 'particles-current-session-v1',
    HISTORY: 'particles-session-history-v1',
    TUTORIAL: 'particles-tutorial-seen-v1'
  };

  const RULES = [
    'bottomDwell', 'edgeSweep', 'verticalTraverse', 'zigzag',
    'centerCross', 'loop', 'spread', 'converge',
    'parallel', 'triple', 'quietHold', 'fastSlow'
  ];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const nowWall = () => Date.now();
  const safeJSON = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  };
  const readJSON = (key, fallback) => {
    try { return safeJSON(localStorage.getItem(key), fallback); } catch (_) { return fallback; }
  };

  let settings = Object.assign({
    timeoutMinutes: 5,
    trails: true,
    assist: true
  }, readJSON(STORAGE.SETTINGS, {}));

  timeoutSlider.value = String(settings.timeoutMinutes);
  timeoutOutput.textContent = `${settings.timeoutMinutes} min`;
  trailsToggle.checked = Boolean(settings.trails);
  assistToggle.checked = Boolean(settings.assist);

  let width = 1;
  let height = 1;
  let dpr = 1;
  let lastFrame = performance.now();
  let paused = false;
  let hiddenAt = 0;
  let particles = null;
  let particleCount = 0;
  let sprites = [];
  let scoreFlash = 0;

  const pointers = new Map();
  let pointerOrder = [];
  let ambientDistance = 0;
  let pairAnchor = null;
  let pairLastAt = 0;
  let parallelMs = 0;
  let tripleStart = null;
  let bottomMs = 0;
  let quietMs = 0;
  let lastPrimaryAwardAt = performance.now();
  let hintUntil = 0;
  let hintStartedAt = 0;

  let primaryRule = RULES[0];
  let secondaryRule = RULES[1];
  let ruleEndsAt = 0;
  const featureHits = Object.fromEntries(RULES.map(r => [r, 0]));
  const awardCooldown = Object.fromEntries(RULES.map(r => [r, 0]));

  function randomId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function newSession() {
    return {
      id: randomId(),
      startedAt: nowWall(),
      lastActiveAt: nowWall(),
      score: 0,
      activeMs: 0
    };
  }

  let session = readJSON(STORAGE.CURRENT, null);
  if (!session || !session.startedAt || nowWall() - (session.lastActiveAt || 0) > settings.timeoutMinutes * 60_000) {
    if (session && (session.score > 0 || session.activeMs > 3_000)) archiveSession(session);
    session = newSession();
  }
  scoreEl.textContent = String(session.score || 0);

  function archiveSession(s) {
    if (!s) return;
    const history = readJSON(STORAGE.HISTORY, []);
    if (history.some(item => item.id === s.id)) return;
    history.unshift({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.lastActiveAt || nowWall(),
      score: s.score || 0,
      activeMs: Math.max(0, s.activeMs || 0)
    });
    saveJSON(STORAGE.HISTORY, history.slice(0, 50));
  }

  function persistSession() {
    session.lastActiveAt = nowWall();
    saveJSON(STORAGE.CURRENT, session);
  }

  function closeAndStartSession() {
    archiveSession(session);
    session = newSession();
    saveJSON(STORAGE.CURRENT, session);
    scoreEl.textContent = '0';
    lastPrimaryAwardAt = performance.now();
    setRuleWindow(true);
    renderSessions();
  }

  function createSprites() {
    const defs = ['mote', 'dash', 'diamond', 'glint'];
    return defs.map((type, index) => {
      const c = document.createElement('canvas');
      c.width = c.height = 28;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(14, 14, 0, 14, 14, 12);
      grad.addColorStop(0, index === 3 ? 'rgba(255,255,238,1)' : 'rgba(255,245,200,.98)');
      grad.addColorStop(.2, 'rgba(255,218,112,.98)');
      grad.addColorStop(.55, 'rgba(210,154,45,.54)');
      grad.addColorStop(1, 'rgba(120,72,12,0)');
      g.fillStyle = grad;
      if (type === 'mote') {
        g.beginPath(); g.ellipse(14, 14, 3.1, 1.9, 0, 0, Math.PI * 2); g.fill();
      } else if (type === 'dash') {
        g.roundRect(9, 12.4, 10, 3.1, 1.5); g.fill();
      } else if (type === 'diamond') {
        g.beginPath(); g.moveTo(14, 8); g.lineTo(18.5, 14); g.lineTo(14, 20); g.lineTo(9.5, 14); g.closePath(); g.fill();
      } else {
        g.fillRect(13.25, 6, 1.5, 16);
        g.fillRect(6, 13.25, 16, 1.5);
        g.beginPath(); g.arc(14, 14, 2.5, 0, Math.PI * 2); g.fill();
      }
      return c;
    });
  }

  function seeded(index, salt) {
    const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildParticles() {
    const area = width * height;
    const density = clamp(Math.round(area / 620), 720, 1650);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.72 : 1;
    particleCount = Math.round(density * reduced);

    particles = {
      x: new Float32Array(particleCount),
      y: new Float32Array(particleCount),
      vx: new Float32Array(particleCount),
      vy: new Float32Array(particleCount),
      angle: new Float32Array(particleCount),
      radius: new Float32Array(particleCount),
      spring: new Float32Array(particleCount),
      damping: new Float32Array(particleCount),
      phase: new Float32Array(particleCount),
      size: new Float32Array(particleCount),
      alpha: new Float32Array(particleCount),
      sprite: new Uint8Array(particleCount)
    };

    const cx = width * .5;
    const cy = height * .47;
    const maxR = Math.min(width, height) * .24;

    for (let i = 0; i < particleCount; i++) {
      const a = seeded(i, 1) * Math.PI * 2;
      const radial = Math.sqrt(seeded(i, 2));
      const r = mix(7, maxR, radial);
      particles.angle[i] = a;
      particles.radius[i] = r;
      particles.x[i] = cx + Math.cos(a) * r * mix(.72, 1.08, seeded(i, 3));
      particles.y[i] = cy + Math.sin(a) * r * mix(.62, 1.02, seeded(i, 4));
      particles.spring[i] = mix(.0055, .024, Math.pow(seeded(i, 5), 1.8));
      particles.damping[i] = mix(.86, .955, seeded(i, 6));
      particles.phase[i] = seeded(i, 7) * Math.PI * 2;
      particles.size[i] = mix(.42, 1.18, seeded(i, 8));
      particles.alpha[i] = mix(.18, .91, Math.pow(seeded(i, 9), .7));
      particles.sprite[i] = Math.floor(seeded(i, 10) * sprites.length);
    }
    ctx.fillStyle = '#030305';
    ctx.fillRect(0, 0, width, height);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sprites = createSprites();
    buildParticles();
    tutorial.layout();
  }

  function refreshPointerOrder() {
    pointerOrder = Array.from(pointers.values()).slice(0, 5);
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp(e.clientX - r.left, 0, width), y: clamp(e.clientY - r.top, 0, height) };
  }

  function onPointerDown(e) {
    if (panelOpen()) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    const p = pointFromEvent(e);
    const now = performance.now();
    pointers.set(e.pointerId, {
      id: e.pointerId, x: p.x, y: p.y, px: p.x, py: p.y,
      startX: p.x, startY: p.y, lastAt: now, travelled: 0,
      horizontalSign: 0, zigzags: 0,
      touchedTop: p.y < height * .18, touchedBottom: p.y > height * .82,
      touchedEdge: edgeFor(p.x, p.y), fastAt: 0, slowAfterFastMs: 0, loopAwardedAt: 0
    });
    refreshPointerOrder();
    pairAnchor = null;
    tripleStart = null;
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const pt = pointFromEvent(e);
    const now = performance.now();
    const dt = Math.max(1, now - p.lastAt);
    const dx = pt.x - p.x;
    const dy = pt.y - p.y;
    const dist = Math.hypot(dx, dy);
    const speed = dist / dt * 1000;
    p.px = p.x; p.py = p.y; p.x = pt.x; p.y = pt.y;
    p.travelled += dist; ambientDistance += dist; session.lastActiveAt = nowWall();

    const sign = Math.abs(dx) > 5 ? Math.sign(dx) : 0;
    if (sign && p.horizontalSign && sign !== p.horizontalSign) {
      p.zigzags += 1;
      if (p.zigzags >= 3) { considerEvent('zigzag', p.x, p.y, now); p.zigzags = 0; }
    }
    if (sign) p.horizontalSign = sign;

    if (p.y < height * .16) p.touchedTop = true;
    if (p.y > height * .84) p.touchedBottom = true;
    if (p.touchedTop && p.touchedBottom) {
      considerEvent('verticalTraverse', p.x, p.y, now);
      p.touchedTop = p.y < height * .5;
      p.touchedBottom = p.y >= height * .5;
    }

    const edge = edgeFor(p.x, p.y);
    if (edge && p.touchedEdge && edge !== p.touchedEdge && p.travelled > Math.min(width, height) * .32) {
      considerEvent('edgeSweep', p.x, p.y, now); p.touchedEdge = edge; p.travelled = 0;
    } else if (edge && !p.touchedEdge) p.touchedEdge = edge;

    if (!isCenter(p.px, p.py) && isCenter(p.x, p.y)) considerEvent('centerCross', p.x, p.y, now);

    const startDistance = Math.hypot(p.x - p.startX, p.y - p.startY);
    if (p.travelled > Math.min(width, height) * .62 && startDistance < Math.min(width, height) * .11 && now - p.loopAwardedAt > 2400) {
      p.loopAwardedAt = now; p.travelled = 0; p.startX = p.x; p.startY = p.y;
      considerEvent('loop', p.x, p.y, now);
    }

    if (speed > Math.max(650, Math.min(width, height) * 1.2)) p.fastAt = now;
    if (p.fastAt && now - p.fastAt < 1200 && speed < 105) {
      p.slowAfterFastMs += dt;
      if (p.slowAfterFastMs > 230) {
        considerEvent('fastSlow', p.x, p.y, now); p.fastAt = 0; p.slowAfterFastMs = 0;
      }
    } else if (speed >= 105) p.slowAfterFastMs = 0;

    p.lastAt = now;
    refreshPointerOrder();
    evaluateMultiTouch(now, dt);
    if (tutorial.active && tutorial.index === 0 && dist > 4) tutorial.markMoved();
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId); refreshPointerOrder(); pairAnchor = null; tripleStart = null; bottomMs = 0; quietMs = 0;
  }

  function edgeFor(x, y) {
    const bx = width * .10, by = height * .10;
    if (x < bx) return 'left'; if (x > width - bx) return 'right';
    if (y < by) return 'top'; if (y > height - by) return 'bottom'; return '';
  }
  function isCenter(x, y) { return x > width * .38 && x < width * .62 && y > height * .36 && y < height * .64; }

  function evaluateMultiTouch(now, dt) {
    if (pointerOrder.length >= 2) {
      const a = pointerOrder[0], b = pointerOrder[1];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pairAnchor == null) pairAnchor = d;
      const delta = d - pairAnchor, threshold = Math.min(width, height) * .17;
      const mx = (a.x + b.x) * .5, my = (a.y + b.y) * .5;
      if (delta > threshold) { considerEvent('spread', mx, my, now); pairAnchor = d; }
      else if (delta < -threshold) { considerEvent('converge', mx, my, now); pairAnchor = d; }

      if (pairLastAt) {
        const adx = a.x - a.px, ady = a.y - a.py, bdx = b.x - b.px, bdy = b.y - b.py;
        const amag = Math.hypot(adx, ady), bmag = Math.hypot(bdx, bdy);
        if (amag > 2 && bmag > 2) {
          const alignment = (adx * bdx + ady * bdy) / (amag * bmag);
          parallelMs = alignment > .84 ? parallelMs + dt : Math.max(0, parallelMs - dt * 1.5);
          if (parallelMs > 650) { considerEvent('parallel', mx, my, now); parallelMs = 0; }
        }
      }
      pairLastAt = now;
    } else { pairAnchor = null; pairLastAt = 0; parallelMs = 0; }

    if (pointerOrder.length >= 3) {
      const c = centroid(pointerOrder.slice(0, 3));
      if (!tripleStart) tripleStart = c;
      if (Math.hypot(c.x - tripleStart.x, c.y - tripleStart.y) > Math.min(width, height) * .20) {
        considerEvent('triple', c.x, c.y, now); tripleStart = c;
      }
    } else tripleStart = null;
  }

  function centroid(list) {
    let x = 0, y = 0;
    for (const p of list) { x += p.x; y += p.y; }
    const n = Math.max(1, list.length); return { x: x / n, y: y / n };
  }

  function setRuleWindow(force = false) {
    const now = performance.now();
    if (!force && now < ruleEndsAt) return;
    const candidates = RULES.filter(r => r !== primaryRule);
    primaryRule = candidates[Math.floor(Math.random() * candidates.length)];
    const ranked = RULES.filter(r => r !== primaryRule).sort((a, b) => featureHits[b] - featureHits[a]);
    secondaryRule = ranked[0] || candidates[0];
    for (const rule of RULES) featureHits[rule] *= .55;
    ruleEndsAt = now + mix(10_000, 20_000, Math.random());
  }

  function considerEvent(rule, x, y, now) {
    featureHits[rule] += 1;
    if (now < awardCooldown[rule]) return;
    awardCooldown[rule] = now + 850;
    if (rule === primaryRule) {
      addScore(8 + Math.floor(Math.random() * 7), x, y, true); lastPrimaryAwardAt = now;
    } else if (rule === secondaryRule) addScore(3 + Math.floor(Math.random() * 3), x, y, false);
  }

  function addAmbientScore(now) {
    const step = Math.max(92, Math.min(width, height) * .16);
    if (ambientDistance < step) return;
    ambientDistance %= step;
    if (now > (awardCooldown.motion || 0)) {
      awardCooldown.motion = now + 650;
      const c = pointerOrder.length ? centroid(pointerOrder) : { x: width * .5, y: height * .5 };
      addScore(1, c.x, c.y, false);
    }
  }

  function addScore(points, x, y, primary) {
    session.score = (session.score || 0) + points; session.lastActiveAt = nowWall(); scoreEl.textContent = String(session.score);
    scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump');
    setTimeout(() => scoreEl.classList.remove('bump'), 150);
    signalEl.style.left = `${x}px`; signalEl.style.top = `${y}px`; signalEl.classList.remove('flash'); void signalEl.offsetWidth; signalEl.classList.add('flash');
    scoreFlash = Math.max(scoreFlash, primary ? 1 : .45); persistSession();
  }

  function evaluateTimedRules(now, dtMs) {
    if (pointerOrder.length) {
      let inBottom = false, speedSum = 0;
      for (const p of pointerOrder) {
        if (p.y > height * .78) inBottom = true;
        const elapsed = Math.max(1, now - p.lastAt);
        speedSum += Math.hypot(p.x - p.px, p.y - p.py) / elapsed * 1000;
      }
      bottomMs = inBottom ? bottomMs + dtMs : Math.max(0, bottomMs - dtMs * 2);
      if (bottomMs > 900) { const c = centroid(pointerOrder); considerEvent('bottomDwell', c.x, c.y, now); bottomMs = 0; }
      const avgSpeed = speedSum / pointerOrder.length;
      quietMs = avgSpeed < 55 ? quietMs + dtMs : Math.max(0, quietMs - dtMs * 1.5);
      if (quietMs > 1350) { const c = centroid(pointerOrder); considerEvent('quietHold', c.x, c.y, now); quietMs = 0; }
    } else { bottomMs = 0; quietMs = 0; }

    addAmbientScore(now); setRuleWindow();
    if (settings.assist && now - lastPrimaryAwardAt > 30_000 && now > hintUntil) {
      hintStartedAt = now; hintUntil = now + 5_000; lastPrimaryAwardAt = now - 20_000;
    }
  }

  function simulateAndDraw(now, dtMs) {
    if (!particles) return;
    const dt = clamp(dtMs / 16.6667, .15, 1.5), active = pointerOrder, count = active.length;
    const cx = width * .5, cy = height * .47, time = now * .00016;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(3,3,5,${settings.trails ? .20 : .42})`; ctx.fillRect(0, 0, width, height);
    if (settings.assist && now < hintUntil) drawHint(now);
    ctx.globalCompositeOperation = 'lighter';
    const p = particles, maxR = Math.min(width, height) * .26, touchScale = count ? .78 : 1;

    for (let i = 0; i < particleCount; i++) {
      const source = count ? active[i % count] : null;
      const baseX = source ? source.x : cx, baseY = source ? source.y : cy;
      const swirl = p.angle[i] + time * mix(.45, 1.35, seeded(i, 11));
      const breath = 1 + Math.sin(time * 6 + p.phase[i]) * .025;
      const r = Math.min(p.radius[i], maxR) * touchScale * breath;
      const tx = baseX + Math.cos(swirl) * r, ty = baseY + Math.sin(swirl) * r * (source ? .76 : .84);
      const dx = tx - p.x[i], dy = ty - p.y[i], dist = Math.max(1, Math.hypot(dx, dy));
      const spring = p.spring[i] * (source ? 1.12 : .72), curl = source ? mix(.001, .0042, seeded(i, 12)) : .0012;
      p.vx[i] += dx * spring * dt + (-dy / dist) * curl * dist * dt;
      p.vy[i] += dy * spring * dt + ( dx / dist) * curl * dist * dt;
      const damp = Math.pow(p.damping[i], dt); p.vx[i] *= damp; p.vy[i] *= damp; p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt;
      const twinkle = .72 + .28 * Math.sin(now * .004 + p.phase[i] * 2.7), flash = 1 + scoreFlash * .48;
      ctx.globalAlpha = clamp(p.alpha[i] * twinkle * flash, .08, 1);
      const s = p.size[i] * mix(5.8, 9.2, seeded(i, 13));
      ctx.drawImage(sprites[p.sprite[i]], p.x[i] - s, p.y[i] - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; scoreFlash *= Math.pow(.88, dt);
  }

  function drawHint(now) {
    const t = clamp((now - hintStartedAt) / 450, 0, 1), alpha = .055 + Math.sin(now * .004) * .018;
    ctx.save(); ctx.strokeStyle = `rgba(245,210,116,${alpha * t})`; ctx.fillStyle = `rgba(245,210,116,${alpha * .55 * t})`; ctx.lineWidth = 1.2;
    if (primaryRule === 'bottomDwell') ctx.fillRect(0, height * .78, width, height * .22);
    else if (primaryRule === 'verticalTraverse') { ctx.fillRect(0, 0, width, height * .11); ctx.fillRect(0, height * .89, width, height * .11); }
    else if (primaryRule === 'centerCross') { ctx.beginPath(); ctx.arc(width * .5, height * .5, Math.min(width, height) * .15, 0, Math.PI * 2); ctx.stroke(); }
    else if (primaryRule === 'loop') { ctx.beginPath(); ctx.arc(width * .5, height * .48, Math.min(width, height) * .23, 0, Math.PI * 2); ctx.stroke(); }
    else if (primaryRule === 'edgeSweep') { ctx.fillRect(0, 0, width * .06, height); ctx.fillRect(width * .94, 0, width * .06, height); }
    else if (primaryRule === 'zigzag' || primaryRule === 'fastSlow') { ctx.beginPath(); ctx.moveTo(width * .24, height * .62); ctx.lineTo(width * .42, height * .40); ctx.lineTo(width * .58, height * .62); ctx.lineTo(width * .76, height * .40); ctx.stroke(); }
    else if (primaryRule === 'spread' || primaryRule === 'converge' || primaryRule === 'parallel') { ctx.beginPath(); ctx.arc(width * .35, height * .52, 24, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(width * .65, height * .52, 24, 0, Math.PI * 2); ctx.stroke(); }
    else if (primaryRule === 'triple') { ctx.beginPath(); ctx.moveTo(width * .5, height * .34); ctx.lineTo(width * .32, height * .64); ctx.lineTo(width * .68, height * .64); ctx.closePath(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(width * .5, height * .5, Math.min(width, height) * .1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (paused) { lastFrame = now; return; }
    const dtMs = clamp(now - lastFrame, 0, 25); lastFrame = now; session.activeMs = (session.activeMs || 0) + dtMs;
    evaluateTimedRules(now, dtMs); simulateAndDraw(now, dtMs);
  }

  function panelOpen() { return !sessionsPanel.hidden || !settingsPanel.hidden; }
  function openPanel(panel) { closePanels(); panel.hidden = false; backdrop.hidden = false; dock.style.opacity = '.18'; if (panel === sessionsPanel) renderSessions(); }
  function closePanels() { sessionsPanel.hidden = true; settingsPanel.hidden = true; backdrop.hidden = true; dock.style.opacity = ''; }
  function formatDuration(ms) { const total = Math.max(0, Math.round(ms / 1000)), m = Math.floor(total / 60), s = total % 60; return m ? `${m}m ${s}s` : `${s}s`; }

  function renderSessions() {
    currentSessionEl.innerHTML = `<strong>Current session</strong><div class="session-card"><span>${formatDuration(session.activeMs || 0)} active</span><span class="session-score">${session.score || 0} pts</span></div>`;
    const history = readJSON(STORAGE.HISTORY, []);
    if (!history.length) { sessionsList.innerHTML = '<p class="empty-state">Completed sessions will appear here. A return after the resume window automatically starts a new one.</p>'; return; }
    sessionsList.innerHTML = history.map(item => {
      const label = new Date(item.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `<div class="session-card"><div><strong>${label}</strong><br><span>${formatDuration(item.activeMs || 0)} active</span></div><span class="session-score">${item.score || 0} pts</span></div>`;
    }).join('');
  }

  function saveSettings() {
    settings.timeoutMinutes = Number(timeoutSlider.value); settings.trails = trailsToggle.checked; settings.assist = assistToggle.checked;
    timeoutOutput.textContent = `${settings.timeoutMinutes} min`; saveJSON(STORAGE.SETTINGS, settings);
  }

  function handleVisibility() {
    if (document.hidden) {
      hiddenAt = nowWall(); paused = true; pointers.clear(); refreshPointerOrder(); persistSession(); return;
    }
    const wall = nowWall(), gap = hiddenAt ? wall - hiddenAt : 0;
    if (gap > settings.timeoutMinutes * 60_000) closeAndStartSession();
    session.lastActiveAt = wall; saveJSON(STORAGE.CURRENT, session); hiddenAt = 0; lastFrame = performance.now();
    if (particles) for (let i = 0; i < particleCount; i++) { particles.vx[i] *= .18; particles.vy[i] *= .18; }
    paused = false;
  }

  const tutorial = {
    active: false, index: 0, moved: false,
    root: document.querySelector('#tutorial'), spot: document.querySelector('#tutorial-spotlight'),
    arrow: document.querySelector('#tutorial-arrow-path'), tag: document.querySelector('#tutorial-tag'),
    card: document.querySelector('#tutorial-card'), title: document.querySelector('#tutorial-title'),
    body: document.querySelector('#tutorial-body'), progress: document.querySelector('#tutorial-progress'), next: document.querySelector('#tutorial-next'),
    steps: [
      { title: 'Move your finger', body: 'Drag anywhere in the field. The center follows you; the outer particles keep a little memory of where you were.', tag: 'MOVE HERE', target: () => ({ left: width * .19, top: height * .27, width: width * .62, height: height * .42 }), requiresMove: true },
      { title: 'Notice the score', body: 'Sometimes movement makes this number climb. The scoring rule changes. You are meant to discover it by playing, not by reading instructions.', tag: 'YOUR SCORE', target: () => rectOf(document.querySelector('#score-wrap'), 10) },
      { title: 'Your sessions stay', body: 'See recent sessions here and try to beat your own previous score whenever you feel like it.', tag: 'SESSIONS', target: () => rectOf(sessionsButton, 8) },
      { title: 'Tune the rhythm', body: 'Settings includes the resume window. Return within that window and this session continues; return later and a new one starts.', tag: 'SETTINGS', target: () => rectOf(settingsButton, 8) }
    ],
    start(force = false) {
      if (!force) { try { if (localStorage.getItem(STORAGE.TUTORIAL) === '1') return; } catch (_) {} }
      closePanels(); this.active = true; this.index = 0; this.moved = false; this.root.hidden = false; this.render();
    },
    markMoved() { this.moved = true; if (this.active && this.index === 0) this.next.disabled = false; },
    render() {
      if (!this.active) return; const step = this.steps[this.index]; this.title.textContent = step.title; this.body.textContent = step.body; this.tag.textContent = step.tag;
      this.progress.textContent = `${this.index + 1} OF ${this.steps.length}`; this.next.textContent = this.index === this.steps.length - 1 ? 'Play' : 'Next'; this.next.disabled = Boolean(step.requiresMove && !this.moved); requestAnimationFrame(() => this.layout());
    },
    layout() {
      if (!this.active) return; let r = this.steps[this.index].target(); if (!r) return;
      r = { left: clamp(r.left, 7, innerWidth - 31), top: clamp(r.top, 7, innerHeight - 31), width: clamp(r.width, 24, innerWidth - r.left - 7), height: clamp(r.height, 24, innerHeight - r.top - 7) };
      Object.assign(this.spot.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      this.card.style.left = '14px'; this.card.style.top = '14px'; const cr0 = this.card.getBoundingClientRect(), centerX = r.left + r.width * .5;
      let left = clamp(centerX - cr0.width * .5, 14, innerWidth - cr0.width - 14), top = r.top + r.height + 23;
      if (top + cr0.height > innerHeight - 14) top = r.top - cr0.height - 23;
      if (top < 14) top = clamp((innerHeight - cr0.height) * .5, 14, innerHeight - cr0.height - 14);
      this.card.style.left = `${left}px`; this.card.style.top = `${top}px`;
      const cr = this.card.getBoundingClientRect(), above = cr.bottom <= r.top, startX = clamp(centerX, cr.left + 34, cr.right - 34), startY = above ? cr.bottom : cr.top, endX = centerX, endY = above ? r.top - 5 : r.top + r.height + 5;
      const bend = Math.min(54, Math.max(18, Math.abs(endY - startY) * .2)), controlX = startX + (endX >= startX ? bend : -bend), controlY = startY + (endY - startY) * .5;
      this.arrow.setAttribute('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`); this.tag.style.left = `${clamp(endX + 11, 10, innerWidth - 94)}px`; this.tag.style.top = `${clamp(endY - 20, 10, innerHeight - 24)}px`;
    },
    forward() { if (!this.active) return; const step = this.steps[this.index]; if (step.requiresMove && !this.moved) return; if (this.index >= this.steps.length - 1) return this.finish(); this.index += 1; this.render(); },
    finish() { this.active = false; this.root.hidden = true; try { localStorage.setItem(STORAGE.TUTORIAL, '1'); } catch (_) {} }
  };

  function rectOf(el, pad = 0) { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 }; }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  sessionsButton.addEventListener('click', () => openPanel(sessionsPanel)); settingsButton.addEventListener('click', () => openPanel(settingsPanel)); backdrop.addEventListener('click', closePanels);
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closePanels)); newSessionButton.addEventListener('click', () => { closeAndStartSession(); closePanels(); });
  timeoutSlider.addEventListener('input', saveSettings); trailsToggle.addEventListener('change', saveSettings); assistToggle.addEventListener('change', saveSettings); tutorialButton.addEventListener('click', () => tutorial.start(true));
  document.querySelector('#tutorial-next').addEventListener('click', () => tutorial.forward()); document.querySelector('#tutorial-skip').addEventListener('click', () => tutorial.finish()); document.querySelector('#tutorial-close').addEventListener('click', () => tutorial.finish());
  document.addEventListener('visibilitychange', handleVisibility); window.addEventListener('pagehide', () => { paused = true; persistSession(); }); window.addEventListener('pageshow', () => { lastFrame = performance.now(); if (!document.hidden) paused = false; }); window.addEventListener('beforeunload', persistSession); window.addEventListener('resize', resize, { passive: true });
  setInterval(() => { if (!document.hidden) persistSession(); }, 2500);

  resize(); setRuleWindow(true); requestAnimationFrame(frame); setTimeout(() => tutorial.start(false), 420);
})();
