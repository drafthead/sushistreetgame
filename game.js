(() => {
  const W = Math.max(390, Math.round(window.innerWidth || 390));
  const H = Math.max(640, Math.round(window.innerHeight || 844));
  const COLS = 9;
  const SIDE_MARGIN = 12;
  const CELL_W = (W - SIDE_MARGIN * 2) / COLS;
  const ROW_H = Phaser.Math.Clamp(Math.round(H * 0.084), 58, 74);
  const PLAYER_W = Math.min(36, CELL_W * 0.72);
  const MAX_BACKTRACK = 4;
  const MAX_LEVEL = 20;
  const SAVE_KEY = 'sushi-street-save-v1';

  const ITEMS = [
    { key: 'rice', label: 'RICE', shop: 'PANTRY', points: 5, color: 0xf1d7a0 },
    { key: 'nori', label: 'NORI', shop: 'SEAWEED', points: 6, color: 0x456b56 },
    { key: 'cucumber', label: 'CUCUMBER', shop: 'PRODUCE', points: 7, color: 0x83b85c },
    { key: 'avocado', label: 'AVOCADO', shop: 'PRODUCE', points: 8, color: 0xa8c76d },
    { key: 'tuna', label: 'TUNA', shop: 'FISH SHOP', points: 10, color: 0xd96666 },
    { key: 'salmon', label: 'SALMON', shop: 'FISH SHOP', points: 12, color: 0xf08b69 },
    { key: 'shrimp', label: 'SHRIMP', shop: 'FISH SHOP', points: 14, color: 0xf3a19a },
    { key: 'uni', label: 'UNI', shop: 'SPECIALTY', points: 18, color: 0xe5a34f },
  ];

  const ui = {
    hud: document.getElementById('hud'),
    level: document.getElementById('hud-level'),
    jumps: document.getElementById('hud-jumps'),
    score: document.getElementById('hud-score'),
    time: document.getElementById('hud-time'),
    progress: document.getElementById('hud-progress'),
    menuItems: document.getElementById('menu-items'),
    modal: document.getElementById('modal'),
    title: document.getElementById('modal-title'),
    body: document.getElementById('modal-body'),
    levelGrid: document.getElementById('level-grid'),
    stats: document.getElementById('modal-stats'),
    primary: document.getElementById('primary-action'),
    secondary: document.getElementById('secondary-action'),
    hint: document.getElementById('modal-hint'),
    pause: document.getElementById('pause-button'),
  };

  function loadSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        unlockedLevel: Phaser.Math.Clamp(Number(parsed.unlockedLevel) || 1, 1, MAX_LEVEL),
        bestScores: parsed.bestScores || {},
        bestRevenue: parsed.bestRevenue || {},
      };
    } catch (_) {
      return { unlockedLevel: 1, bestScores: {}, bestRevenue: {} };
    }
  }

  function saveProgress(data) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function rngFor(level) {
    let seed = (0x9e3779b9 ^ (level * 0x85ebca6b)) >>> 0;
    return () => {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  class SushiScene extends Phaser.Scene {
    constructor() {
      super('SushiStreet');
      this.save = loadSave();
      this.selectedLevel = 1;
      this.runActive = false;
      this.runEnded = true;
      this.inputLocked = false;
      this.levelObjects = [];
      this.vehicles = [];
      this.pickups = [];
      this.gesture = { id: null, x: 0, y: 0 };
      this.bufferedMove = null;
    }

    create() {
      window.__SUSHI_SCENE = this;
      window.SUSHI_RUNTIME_LIFECYCLE.bind(() => window.__SUSHI_SCENE);
      this.cameras.main.setBackgroundColor('#dcebd9');
      this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE');
      this.installInput();
      this.installUi();
      ui.hud.style.opacity = '0';
      this.openLevelSelect(1);
    }

    installUi() {
      ui.pause.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        window.SUSHI_RUNTIME_LIFECYCLE.pause('manual');
      }, { passive: false });

      ui.primary.addEventListener('click', () => {
        const action = ui.primary.dataset.action || 'start';
        if (action === 'resume') {
          window.SUSHI_RUNTIME_LIFECYCLE.resume('player');
        } else if (action === 'retry') {
          this.startLevel(this.selectedLevel);
        } else if (action === 'next') {
          this.startLevel(Math.min(MAX_LEVEL, this.selectedLevel + 1));
        } else {
          this.startLevel(this.selectedLevel);
        }
      });

      ui.secondary.addEventListener('click', () => this.openLevelSelect(this.selectedLevel));
    }

    installInput() {
      this.input.on('pointerdown', pointer => {
        if (!this.canAcceptInput()) return;
        this.gesture.id = pointer.id;
        this.gesture.x = pointer.x;
        this.gesture.y = pointer.y;
      });

      this.input.on('pointerup', pointer => {
        if (!this.canAcceptInput() || this.gesture.id !== pointer.id) return;
        const dx = pointer.x - this.gesture.x;
        const dy = pointer.y - this.gesture.y;
        this.cancelGesture();
        const distance = Math.hypot(dx, dy);
        if (distance < 22) {
          this.requestMove(0, 1);
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) this.requestMove(dx < 0 ? -1 : 1, 0);
        else this.requestMove(0, dy > 0 ? -1 : 1);
      });

      this.input.on('pointerupoutside', () => this.cancelGesture());
      this.input.on('pointercancel', () => this.cancelGesture());
    }

    canAcceptInput() {
      return this.runActive && !this.runEnded && !this.inputLocked && !ui.modal.classList.contains('show');
    }

    cancelGesture() {
      this.gesture.id = null;
      this.gesture.x = 0;
      this.gesture.y = 0;
    }

    clearBufferedMove() {
      this.bufferedMove = null;
    }

    onWarmResumeStart() {
      this.inputLocked = true;
      this.clearBufferedMove();
      this.cancelGesture();
    }

    onWarmResumeEnd() {
      if (this.runActive && !this.runEnded) this.inputLocked = false;
    }

    track(object) {
      if (object) this.levelObjects.push(object);
      return object;
    }

    destroyLevelObjects() {
      const objects = this.levelObjects.splice(0);
      objects.forEach(obj => {
        try { obj?.destroy?.(true); } catch (_) {}
      });
      this.vehicles = [];
      this.pickups = [];
      this.player = null;
      this.finishMarker = null;
    }

    openLevelSelect(preferred = 1) {
      window.SUSHI_RUNTIME_LIFECYCLE.hideWarmup();
      window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);
      try { if (this.scene.isPaused()) this.scene.resume(); } catch (_) {}
      this.runActive = false;
      this.runEnded = true;
      this.inputLocked = true;
      ui.hud.style.opacity = '0';
      this.selectedLevel = Phaser.Math.Clamp(Math.min(preferred, this.save.unlockedLevel), 1, MAX_LEVEL);
      ui.title.textContent = 'Choose Today’s Run';
      ui.body.textContent = 'Each level sends you farther through the market. Collect more than half the requested ingredients to open the restaurant.';
      ui.stats.hidden = true;
      ui.levelGrid.hidden = false;
      ui.levelGrid.innerHTML = '';

      for (let level = 1; level <= MAX_LEVEL; level++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-button';
        button.textContent = String(level);
        const locked = level > this.save.unlockedLevel;
        if (locked) button.classList.add('locked');
        if (level === this.selectedLevel) button.classList.add('current');
        button.disabled = locked;
        button.addEventListener('click', () => {
          this.selectedLevel = level;
          [...ui.levelGrid.children].forEach(el => el.classList.remove('current'));
          button.classList.add('current');
          this.renderLevelSelectAction();
        });
        ui.levelGrid.appendChild(button);
      }
      this.renderLevelSelectAction();
      ui.secondary.hidden = true;
      ui.hint.textContent = 'Tap = forward · swipe left/right = side hop · swipe down = back up to 4 rows.';
      ui.modal.classList.add('show');
    }

    renderLevelSelectAction() {
      const goal = this.goalRowsFor(this.selectedLevel);
      ui.primary.dataset.action = 'start';
      ui.primary.textContent = `START LEVEL ${this.selectedLevel}`;
      ui.body.textContent = `Level ${this.selectedLevel}: deliver after ${goal} forward rows. Shop rows are safe, so use them to cross sideways for ingredients.`;
    }

    goalRowsFor(level) {
      return 30 + (level - 1) * 4;
    }

    buildMenu(level) {
      const rng = rngFor(level * 101 + 17);
      const total = Math.min(8, 4 + Math.floor((level - 1) / 3));
      const availableCount = Math.min(ITEMS.length, 4 + Math.floor((level - 1) / 4));
      const available = ITEMS.slice(0, availableCount);
      const list = [];
      for (let i = 0; i < total; i++) {
        const offset = (level + i * 2 + Math.floor(rng() * available.length)) % available.length;
        list.push(available[offset]);
      }
      return list;
    }

    startLevel(level) {
      level = Phaser.Math.Clamp(Number(level) || 1, 1, this.save.unlockedLevel);
      try { if (this.scene.isPaused()) this.scene.resume(); } catch (_) {}
      window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);
      this.selectedLevel = level;
      this.level = level;
      this.goalRows = this.goalRowsFor(level);
      this.rng = rngFor(level);
      this.menuList = this.buildMenu(level);
      this.menuRequired = {};
      this.menuCollected = {};
      this.menuList.forEach(item => { this.menuRequired[item.key] = (this.menuRequired[item.key] || 0) + 1; });
      Object.keys(this.menuRequired).forEach(key => { this.menuCollected[key] = 0; });

      this.runActive = true;
      this.runEnded = false;
      this.inputLocked = false;
      this.playerRow = 0;
      this.playerCol = Math.floor(COLS / 2);
      this.maxRow = 0;
      this.totalJumps = 0;
      this.score = 0;
      this.itemScore = 0;
      this.activeMs = 0;
      this.moving = false;
      this.bufferedMove = null;
      this.cancelGesture();

      this.worldH = H + (this.goalRows + 5) * ROW_H + 120;
      this.startY = this.worldH - H * 0.24;
      this.cameras.main.setBounds(0, 0, W, this.worldH);
      this.cameras.main.setScroll(0, Math.max(0, this.worldH - H));
      this.cameraTargetY = this.cameras.main.scrollY;

      this.buildStreet();
      this.buildPlayer();
      this.updateHud(true);
      ui.hud.style.opacity = '1';
      ui.modal.classList.remove('show');
    }

    rowY(row) {
      return this.startY - row * ROW_H;
    }

    colX(col) {
      return SIDE_MARGIN + CELL_W * (col + 0.5);
    }

    buildStreet() {
      const shopRows = new Map();
      const usable = Math.max(1, this.goalRows - 8);
      this.menuList.forEach((item, index) => {
        let row = 4 + Math.round((usable * (index + 0.55)) / this.menuList.length);
        row = Phaser.Math.Clamp(row, 3, this.goalRows - 2);
        while (shopRows.has(row)) row = Math.min(this.goalRows - 2, row + 1);
        shopRows.set(row, { item, index });
      });
      this.shopRows = shopRows;

      for (let row = 0; row <= this.goalRows + 2; row++) {
        const y = this.rowY(row);
        const isFinish = row === this.goalRows;
        const hasShop = shopRows.has(row);
        const safe = row < 3 || isFinish || hasShop || row % 5 === 0;
        const laneColor = isFinish ? 0xf0d6b6 : safe ? (row % 10 === 0 ? 0xb8d4b9 : 0xcfe1c9) : 0x58636a;
        this.track(this.add.rectangle(W / 2, y, W, ROW_H - 2, laneColor).setDepth(-20));

        if (safe) {
          for (let col = 0; col < COLS; col++) {
            if ((col + row) % 3 === 0 && !hasShop && !isFinish) {
              this.track(this.add.circle(this.colX(col), y + ROW_H * 0.2, 3, 0x91b48f, 0.45).setDepth(-18));
            }
          }
        } else {
          for (let x = 22; x < W; x += 72) {
            this.track(this.add.rectangle(x, y, 34, 3, 0xe8dfbc, 0.55).setDepth(-18));
          }
          this.spawnTraffic(row, y);
        }

        if (hasShop) this.spawnShopPickup(row, y, shopRows.get(row));
        if (isFinish) this.spawnRestaurant(y);
      }
    }

    spawnTraffic(row, y) {
      const direction = this.rng() < 0.5 ? -1 : 1;
      const base = 105 + this.level * 5 + this.rng() * 100;
      const speed = base * direction;
      const count = this.level > 10 && this.rng() > 0.55 ? 3 : 2;
      const spacing = W / count;

      for (let i = 0; i < count; i++) {
        const truck = this.rng() > 0.62;
        const width = truck ? Math.min(88, CELL_W * 2.05) : Math.min(64, CELL_W * 1.55);
        const height = Math.min(34, ROW_H * 0.5);
        const x = (i * spacing + this.rng() * spacing) % W;
        const color = [0xd75c4b, 0x6f93b8, 0xe6ad4f, 0x6fa47b, 0x806aa3][Math.floor(this.rng() * 5)];
        const shadow = this.add.rectangle(3, 4, width, height, 0x1f2a2d, 0.2).setOrigin(0.5);
        const body = this.add.rectangle(0, 0, width, height, color).setStrokeStyle(2, 0xffffff, 0.22).setOrigin(0.5);
        const cab = this.add.rectangle(direction > 0 ? width * 0.23 : -width * 0.23, -2, width * 0.28, height * 0.68, 0xf2ead8, 0.82).setOrigin(0.5);
        const vehicle = this.track(this.add.container(x, y, [shadow, body, cab]).setDepth(8));
        vehicle.__traffic = { row, vx: speed, width, height, pad: width + 22 };
        this.vehicles.push(vehicle);
      }
    }

    spawnShopPickup(row, y, data) {
      const side = data.index % 2 === 0 ? 0 : COLS - 1;
      const col = side;
      const x = this.colX(col);
      const item = data.item;
      const shopX = side === 0 ? Math.min(W * 0.22, x + CELL_W * 1.1) : Math.max(W * 0.78, x - CELL_W * 1.1);
      const awning = this.track(this.add.rectangle(shopX, y - ROW_H * 0.2, CELL_W * 2.4, ROW_H * 0.56, 0xf8eedc).setStrokeStyle(2, item.color, 0.95).setDepth(-5));
      const shopLabel = this.track(this.add.text(shopX, y - ROW_H * 0.33, item.shop, {
        fontFamily: 'Arial,system-ui,sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#243638', align: 'center'
      }).setOrigin(0.5).setDepth(-4));
      const tokenBg = this.add.rectangle(0, 0, Math.min(44, CELL_W * 0.85), Math.min(44, CELL_W * 0.85), item.color).setStrokeStyle(3, 0xffffff, 0.9);
      const tokenText = this.add.text(0, 0, item.label.slice(0, 3), {
        fontFamily: 'Arial,system-ui,sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#17252b'
      }).setOrigin(0.5);
      const container = this.track(this.add.container(x, y, [tokenBg, tokenText]).setDepth(12));
      this.pickups.push({ row, col, item, object: container, collected: false });
      awning.__pickupDecoration = true;
      shopLabel.__pickupDecoration = true;
    }

    spawnRestaurant(y) {
      const roof = this.track(this.add.rectangle(W / 2, y - ROW_H * 0.22, Math.min(W * 0.72, 390), ROW_H * 0.72, 0xf8eee0).setStrokeStyle(4, 0xe65345, 0.9).setDepth(-6));
      this.track(this.add.rectangle(W / 2, y - ROW_H * 0.48, Math.min(W * 0.76, 410), 10, 0xe65345).setDepth(-5));
      this.track(this.add.text(W / 2, y - ROW_H * 0.25, 'SUSHI STREET · DELIVERY', {
        fontFamily: 'Arial,system-ui,sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#293d3e'
      }).setOrigin(0.5).setDepth(-4));
      roof.__finish = true;
    }

    buildPlayer() {
      const shadow = this.add.ellipse(0, PLAYER_W * 0.48, PLAYER_W * 0.92, PLAYER_W * 0.32, 0x1f2c2c, 0.18);
      const body = this.add.rectangle(0, 0, PLAYER_W, PLAYER_W, 0xf7f1df).setStrokeStyle(3, 0x17252b, 0.22);
      const sash = this.add.rectangle(0, 4, PLAYER_W * 0.88, PLAYER_W * 0.16, 0xe65345, 0.9);
      const headband = this.add.rectangle(0, -PLAYER_W * 0.28, PLAYER_W * 0.78, PLAYER_W * 0.1, 0x17252b, 0.9);
      this.player = this.track(this.add.container(this.colX(this.playerCol), this.rowY(0), [shadow, body, sash, headband]).setDepth(20));
    }

    requestMove(dc, dr) {
      if (!this.canAcceptInput()) return;
      if (this.moving) {
        this.bufferedMove = { dc, dr };
        return;
      }
      this.performMove(dc, dr);
    }

    performMove(dc, dr) {
      if (!this.canAcceptInput()) return;
      let targetCol = Phaser.Math.Clamp(this.playerCol + dc, 0, COLS - 1);
      let targetRow = Phaser.Math.Clamp(this.playerRow + dr, 0, this.goalRows);
      if (targetRow < this.maxRow - MAX_BACKTRACK) targetRow = this.maxRow - MAX_BACKTRACK;
      if (targetCol === this.playerCol && targetRow === this.playerRow) return;

      this.playerCol = targetCol;
      this.playerRow = targetRow;
      this.maxRow = Math.max(this.maxRow, targetRow);
      this.totalJumps += 1;
      this.score += 1;
      this.moving = true;
      this.updateHud();

      const targetX = this.colX(targetCol);
      const targetY = this.rowY(targetRow);
      const forward = dr > 0;
      this.player.setScale(1.05, 0.9);
      this.tweens.add({
        targets: this.player,
        x: targetX,
        y: targetY,
        scaleX: 1,
        scaleY: 1,
        angle: dc * 4,
        duration: forward ? 118 : 128,
        ease: 'Quad.Out',
        onComplete: () => {
          if (!this.player || this.runEnded) return;
          this.player.angle = 0;
          this.moving = false;
          this.collectAt(targetRow, targetCol);
          if (targetRow >= this.goalRows) {
            this.finishDelivery();
            return;
          }
          const buffered = this.bufferedMove;
          this.bufferedMove = null;
          if (buffered && this.canAcceptInput()) this.performMove(buffered.dc, buffered.dr);
        }
      });
    }

    collectAt(row, col) {
      const pickup = this.pickups.find(p => !p.collected && p.row === row && p.col === col);
      if (!pickup) return;
      pickup.collected = true;
      this.menuCollected[pickup.item.key] = (this.menuCollected[pickup.item.key] || 0) + 1;
      this.itemScore += pickup.item.points;
      this.score += pickup.item.points;
      this.tweens.add({
        targets: pickup.object,
        y: pickup.object.y - 24,
        scale: 1.35,
        alpha: 0,
        duration: 260,
        ease: 'Back.In',
        onComplete: () => pickup.object?.destroy?.(true)
      });
      this.cameras.main.flash(120, 255, 224, 150, false);
      this.updateHud(true);
    }

    collectedCount() {
      return Object.values(this.menuCollected).reduce((sum, n) => sum + Number(n || 0), 0);
    }

    menuRatio() {
      return this.menuList.length ? this.collectedCount() / this.menuList.length : 0;
    }

    updateHud(forceMenu = false) {
      ui.level.textContent = String(this.level || 1);
      ui.jumps.textContent = String(this.totalJumps || 0);
      ui.score.textContent = String(this.score || 0);
      ui.time.textContent = formatTime(this.activeMs || 0);
      ui.progress.textContent = `${Math.round(this.menuRatio() * 100)}%`;
      if (!forceMenu) return;
      ui.menuItems.innerHTML = '';
      Object.keys(this.menuRequired).forEach(key => {
        const item = ITEMS.find(candidate => candidate.key === key);
        const required = this.menuRequired[key];
        const got = this.menuCollected[key] || 0;
        const pill = document.createElement('span');
        pill.className = `menu-pill${got >= required ? ' done' : ''}`;
        pill.innerHTML = `<span class="menu-dot" style="background:#${item.color.toString(16).padStart(6, '0')}"></span>${item.label} ${got}/${required}`;
        ui.menuItems.appendChild(pill);
      });
    }

    update(time, delta) {
      if (!this.runActive || this.runEnded || !this.player) return;
      const dt = Math.min(delta, 40) / 1000;
      this.activeMs += Math.min(delta, 50);
      this.updateTraffic(dt);
      this.updateCamera();
      this.handleKeyboard();
      this.checkTrafficCollision();
      this.updateHud();
    }

    updateTraffic(dt) {
      this.vehicles.forEach(vehicle => {
        if (!vehicle.active) return;
        const meta = vehicle.__traffic;
        vehicle.x += meta.vx * dt;
        if (meta.vx > 0 && vehicle.x > W + meta.pad) vehicle.x = -meta.pad;
        else if (meta.vx < 0 && vehicle.x < -meta.pad) vehicle.x = W + meta.pad;
      });
    }

    updateCamera() {
      const desired = Phaser.Math.Clamp(this.rowY(this.maxRow) - H * 0.63, 0, Math.max(0, this.worldH - H));
      this.cameraTargetY = Math.min(this.cameraTargetY, desired);
      const screenY = this.player.y - this.cameras.main.scrollY;
      const catchup = screenY < H * 0.28 ? 0.2 : 0.075;
      this.cameras.main.scrollY += (this.cameraTargetY - this.cameras.main.scrollY) * catchup;
    }

    handleKeyboard() {
      if (!this.canAcceptInput()) return;
      if (Phaser.Input.Keyboard.JustDown(this.keys.UP) || Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.requestMove(0, 1);
      else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN) || Phaser.Input.Keyboard.JustDown(this.keys.S)) this.requestMove(0, -1);
      else if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT) || Phaser.Input.Keyboard.JustDown(this.keys.A)) this.requestMove(-1, 0);
      else if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT) || Phaser.Input.Keyboard.JustDown(this.keys.D)) this.requestMove(1, 0);
    }

    checkTrafficCollision() {
      if (this.runEnded || !this.player) return;
      for (const vehicle of this.vehicles) {
        if (!vehicle.active) continue;
        const meta = vehicle.__traffic;
        const vertical = Math.abs(vehicle.y - this.player.y) < Math.min(ROW_H * 0.34, 24);
        const horizontal = Math.abs(vehicle.x - this.player.x) < (meta.width + PLAYER_W) * 0.43;
        if (vertical && horizontal) {
          this.failRun('TRAFFIC HIT', 'A delivery truck got there first. Retry the level and read the lane speeds.');
          return;
        }
      }
    }

    failRun(title, body) {
      if (this.runEnded) return;
      this.runEnded = true;
      this.inputLocked = true;
      this.clearBufferedMove();
      this.cancelGesture();
      this.tweens.killTweensOf(this.player);
      if (this.player) {
        this.tweens.add({ targets: this.player, angle: 18, scale: 0.85, duration: 160, yoyo: true });
      }
      this.cameras.main.shake(220, 0.009);
      this.showResult(false, title, body, 0);
    }

    finishDelivery() {
      if (this.runEnded) return;
      this.runEnded = true;
      this.inputLocked = true;
      this.clearBufferedMove();
      const ratio = this.menuRatio();
      const passes = ratio > 0.5;
      if (!passes) {
        this.showResult(false, 'RESTAURANT CLOSED', `You delivered ${this.collectedCount()} of ${this.menuList.length} ingredients. More than half of today’s menu is required to open.`, 0);
        return;
      }

      const baseRevenue = 120 + this.level * 28 + this.menuList.length * 12;
      const revenue = Math.round(baseRevenue * (0.55 + ratio * 0.45));
      this.score += Math.round(25 * ratio);
      this.save.bestScores[this.level] = Math.max(Number(this.save.bestScores[this.level]) || 0, this.score);
      this.save.bestRevenue[this.level] = Math.max(Number(this.save.bestRevenue[this.level]) || 0, revenue);
      if (this.level < MAX_LEVEL) this.save.unlockedLevel = Math.max(this.save.unlockedLevel, this.level + 1);
      saveProgress(this.save);
      const full = ratio === 1;
      const title = full ? 'FULL MENU — OPEN!' : 'RESTAURANT OPEN';
      const body = full
        ? 'Every ingredient made it. Full menu, full earning power.'
        : `You brought ${Math.round(ratio * 100)}% of the menu. The restaurant opens, but missing items reduce today’s revenue.`;
      this.showResult(true, title, body, revenue);
    }

    showResult(success, title, body, revenue) {
      ui.title.textContent = title;
      ui.body.textContent = body;
      ui.levelGrid.hidden = true;
      ui.stats.hidden = false;
      ui.stats.innerHTML = `
        <div class="modal-stat"><span>INGREDIENTS</span><b>${this.collectedCount()}/${this.menuList.length}</b></div>
        <div class="modal-stat"><span>SCORE</span><b>${this.score}</b></div>
        <div class="modal-stat"><span>${success ? 'REVENUE' : 'ACTIVE TIME'}</span><b>${success ? `$${revenue}` : formatTime(this.activeMs)}</b></div>`;
      if (success && this.level < MAX_LEVEL) {
        ui.primary.dataset.action = 'next';
        ui.primary.textContent = `NEXT: LEVEL ${this.level + 1}`;
      } else if (success) {
        ui.primary.dataset.action = 'retry';
        ui.primary.textContent = 'REPLAY LEVEL 20';
      } else {
        ui.primary.dataset.action = 'retry';
        ui.primary.textContent = `RETRY LEVEL ${this.level}`;
      }
      ui.secondary.hidden = false;
      ui.secondary.textContent = 'LEVEL SELECT';
      ui.secondary.dataset.action = 'level-select';
      ui.hint.textContent = success ? 'Ingredient values are added to your jump score. A complete menu pays the most.' : 'Shop rows are safe: move sideways there before pushing forward again.';
      ui.modal.classList.add('show');
      this.updateHud(true);
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#dcebd9',
    scale: { mode: Phaser.Scale.NONE, width: W, height: H },
    render: { antialias: true, roundPixels: true },
    input: { activePointers: 2 },
    scene: [SushiScene],
  });
})();
