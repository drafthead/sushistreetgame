(() => {
  const S = window.SS;
  const U = S.ui;
  const proto = window.SushiScene.prototype;

  const BOARD_FILES = [1];
  const INGREDIENT_FILES = [1, 2, 3, 4, 5, 6];
  const POT_FILES = [1, 2, 3];
  const PLATE_FILES = [1, 2, 3, 4];
  const KNIFE_FILES = [1, 2, 6];
  const PLATE_POINTS = {1: 5, 2: 10, 3: 20, 4: 35};
  const PLATES_NEEDED = 3;
  const KITCHEN_MENU_ITEM = {
    key: 'kitchenChoice',
    label: 'KITCHEN INGREDIENT',
    jp: '食材',
    shop: 'KITCHEN',
    points: 12,
    color: 0xf8f858
  };

  const basePreload = proto.preload;
  proto.preload = function() {
    basePreload.call(this);
    BOARD_FILES.forEach(n => this.load.image(`kitchen-board-${n}`, `images/kitchen/boards/${n}.png`));
    INGREDIENT_FILES.forEach(n => this.load.image(`kitchen-ingredient-${n}`, `images/kitchen/ingredients/${n}.png`));
    POT_FILES.forEach(n => this.load.image(`kitchen-pot-${n}`, `images/kitchen/pots/${n}.png`));
    PLATE_FILES.forEach(n => this.load.image(`kitchen-plate-${n}`, `images/kitchen/plates/${n}.png`));
    KNIFE_FILES.forEach(n => this.load.image(`kitchen-knife-${n}`, `images/kitchen/knives/${n}.png`));
    this.load.image('kitchen-bg-left', 'images/kitchen/backgrounds/leftside.png');
    this.load.image('kitchen-bg-right', 'images/kitchen/backgrounds/rightside.png');
    this.load.image('kitchen-bg-bottom', 'images/kitchen/backgrounds/bottomside.png');
    this.load.image('kitchen-bg-top', 'images/kitchen/backgrounds/topside.png');
  };

  const baseLevelLength = proto.levelLength;
  proto.levelLength = function(level) {
    return Number(level) === 1 ? 26 : baseLevelLength.call(this, level);
  };

  const baseBuildMenu = proto.buildMenu;
  proto.buildMenu = function(level) {
    if (Number(level) === 1) return Array.from({length: 4}, () => KITCHEN_MENU_ITEM);
    return baseBuildMenu.call(this, level);
  };

  const baseColX = proto.colX;
  proto.colX = function(col) {
    if (!this._kitchenMode) return baseColX.call(this, col);
    const side = S.clamp(S.W * 0.105, 38, 52);
    const innerLeft = S.PLAY_X + side + 8;
    const innerRight = S.PLAY_X + S.PLAY_W - side - 8;
    const usable = Math.max(1, innerRight - innerLeft);
    return innerLeft + usable * ((col + 0.5) / S.COLS);
  };

  const baseStartLevel = proto.startLevel;
  proto.startLevel = function(level, opt) {
    const requested = Number(level) || 1;
    this._kitchenMode = requested === 1;
    const previousRotation = S.CAMERA_ROTATION;
    if (this._kitchenMode) S.CAMERA_ROTATION = 0;
    let result;
    try {
      result = baseStartLevel.call(this, level, opt);
    } finally {
      S.CAMERA_ROTATION = previousRotation;
      this._kitchenMode = this.selectedLevel === 1;
      if (this._kitchenMode) this.cameras.main.setRotation(0);
      document.body.classList.toggle('kitchen-level-one', this._kitchenMode);
    }
    return result;
  };

  const coverImage = (image, targetW, targetH) => {
    const sourceW = Math.max(1, image.width || 1);
    const sourceH = Math.max(1, image.height || 1);
    const targetAspect = targetW / Math.max(1, targetH);
    const sourceAspect = sourceW / sourceH;
    if (sourceAspect > targetAspect) {
      const cropW = Math.max(1, Math.round(sourceH * targetAspect));
      image.setCrop(Math.max(0, Math.round((sourceW - cropW) / 2)), 0, cropW, sourceH);
    } else {
      const cropH = Math.max(1, Math.round(sourceW / targetAspect));
      image.setCrop(0, Math.max(0, Math.round((sourceH - cropH) / 2)), sourceW, cropH);
    }
    image.setDisplaySize(targetW, targetH);
    return image;
  };

  const addRect = (scene, row, x, y, w, h, color, alpha, depth) => {
    const obj = scene.track(scene.add.rectangle(x, y, w, h, color, alpha).setDepth(depth));
    row?.objects?.push(obj);
    return obj;
  };

  const uniqueColumns = (count, minCol = 1, maxCol = S.COLS - 2) => {
    minCol = S.clamp(minCol, 0, S.COLS - 1);
    maxCol = S.clamp(maxCol, minCol, S.COLS - 1);
    const available = maxCol - minCol + 1;
    const actual = Math.min(count, available);
    const cols = [];
    for (let i = 0; i < actual; i++) {
      let col = Math.round(minCol + ((i + 0.5) / actual) * available - 0.5);
      col = S.clamp(col, minCol, maxCol);
      while (cols.includes(col) && col < maxCol) col++;
      while (cols.includes(col) && col > minCol) col--;
      if (!cols.includes(col)) cols.push(col);
    }
    return cols;
  };

  proto.buildKitchenBackdrop = function() {
    const sideW = S.clamp(S.W * 0.105, 38, 52);
    const fixedDepth = 250000;

    if (this.textures.exists('kitchen-bg-left')) {
      const left = this.track(this.add.image(sideW / 2, S.H / 2, 'kitchen-bg-left')
        .setScrollFactor(0)
        .setDepth(fixedDepth));
      coverImage(left, sideW, S.H);
    }
    if (this.textures.exists('kitchen-bg-right')) {
      const right = this.track(this.add.image(S.W - sideW / 2, S.H / 2, 'kitchen-bg-right')
        .setScrollFactor(0)
        .setDepth(fixedDepth));
      coverImage(right, sideW, S.H);
    }

    const worldX = S.PLAY_X + S.PLAY_W / 2;
    const innerW = Math.max(120, S.PLAY_W - sideW * 2);
    const capH = S.clamp(S.ROW_H * 2.55, 145, 190);

    if (this.textures.exists('kitchen-bg-bottom')) {
      const y = this.rowY(0) + S.ROW_H * 0.92;
      const bottom = this.track(this.add.image(worldX, y, 'kitchen-bg-bottom')
        .setDepth(this.depthForY ? this.depthForY(y, -480) : 1));
      coverImage(bottom, innerW, capH);
    }
    if (this.textures.exists('kitchen-bg-top')) {
      const y = this.rowY(this.goalRow) - S.ROW_H * 0.92;
      const top = this.track(this.add.image(worldX, y, 'kitchen-bg-top')
        .setDepth(this.depthForY ? this.depthForY(y, -480) : 1));
      coverImage(top, innerW, capH);
    }
  };

  proto.createKitchenBoard = function(row, x, width, dir, index) {
    const key = `kitchen-board-${BOARD_FILES[index % BOARD_FILES.length]}`;
    const depth = this.depthForY ? this.depthForY(row.y, 38) : 80;
    const c = this.add.container(x, row.y - 1).setDepth(depth);
    const shadow = this.add.ellipse(4, 9, width * 0.88, S.clamp(S.ROW_H * 0.16, 9, 14), 0x163c55, 0.28);
    c.add(shadow);

    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key);
      const scale = width / Math.max(1, img.width);
      img.setScale(scale).setOrigin(0.5, 0.58).setFlipX(dir < 0 && index % 2 === 1);
      c.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x9a653c, 1);
      g.fillRoundedRect(-width / 2, -10, width, 20, 4);
      g.fillStyle(0xc58a55, 0.9);
      g.fillRect(-width * 0.42, -6, width * 0.84, 4);
      c.add(g);
    }

    c.__rowY = row.y;
    return c;
  };

  proto.buildKitchenBoards = function(row) {
    const dir = row.index % 2 === 0 ? 1 : -1;
    const laneSpeed = (28 + (row.index % 3) * 3) * dir;
    const width = S.clamp(S.CELL_W * 1.12, 52, 88);
    const gap = S.clamp(S.CELL_W * 0.62, 30, 48);
    const sideW = S.clamp(S.W * 0.105, 38, 52);
    const left = S.PLAY_X + sideW;
    const right = S.PLAY_X + S.PLAY_W - sideW;
    const buffer = width + gap;
    const cycleStart = left - buffer;
    const cycleLength = (right - left) + buffer * 2;
    const targetSpacing = width + gap;
    const count = Math.max(5, Math.floor(cycleLength / targetSpacing));
    const spacing = cycleLength / count;
    const phase = (row.index % 2) * Math.min(16, gap * 0.3);

    for (let i = 0; i < count; i++) {
      const x = cycleStart + phase + i * spacing;
      const board = this.createKitchenBoard(row, x, width, dir, i + row.index);
      board.__float = {
        vx: laneSpeed,
        width,
        hitWidth: width * 0.9,
        kind: 'kitchen-board',
        stationary: false,
        left,
        right,
        cycleStart,
        cycleLength
      };
      row.floaters.push(board);
      this.floaters.push(board);
      this.track(board);
    }
  };

  proto.buildKitchenIngredientStation = function(row) {
    const cols = uniqueColumns(INGREDIENT_FILES.length);
    const group = {rowIndex: row.index, collected: false, chosen: null, items: []};
    this.kitchenIngredientGroups.push(group);

    cols.forEach((col, i) => {
      const file = INGREDIENT_FILES[i % INGREDIENT_FILES.length];
      const key = `kitchen-ingredient-${file}`;
      const x = this.colX(col);
      const y = row.y - 2;
      const depth = this.depthForY ? this.depthForY(y, 48) : 90;
      let item;

      if (this.textures.exists(key)) {
        item = this.add.image(x, y, key).setDepth(depth);
        const targetH = S.clamp(S.ROW_H * 0.62, 34, 45);
        item.setScale(targetH / Math.max(1, item.height)).setOrigin(0.5, 0.62);
      } else {
        item = this.add.circle(x, y, 13, 0xf8f858, 1).setDepth(depth);
      }

      item.__rowY = row.y;
      item.__kitchenIngredient = {file, col, group, points: 12};
      this.track(item);
      group.items.push(item);
    });
  };

  proto.buildKitchenPlateRow = function(row) {
    const count = S.W >= 720 ? 4 : 3;
    const cols = uniqueColumns(count, 1, S.COLS - 2);
    const offset = row.index % PLATE_FILES.length;

    cols.forEach((col, i) => {
      const file = PLATE_FILES[(i + offset) % PLATE_FILES.length];
      const key = `kitchen-plate-${file}`;
      const x = this.colX(col);
      const y = row.y - 2;
      const depth = this.depthForY ? this.depthForY(y, 48) : 90;
      let plate;

      if (this.textures.exists(key)) {
        plate = this.add.image(x, y, key).setDepth(depth);
        const targetH = S.clamp(S.ROW_H * 0.58, 32, 43);
        plate.setScale(targetH / Math.max(1, plate.height)).setOrigin(0.5, 0.62);
      } else {
        plate = this.add.ellipse(x, y, 40, 18, 0xeffae8, 1).setDepth(depth);
      }

      plate.__rowY = row.y;
      plate.__kitchenPlate = {
        file,
        points: PLATE_POINTS[file] || 5,
        collected: false,
        rowIndex: row.index,
        hitWidth: S.clamp(S.CELL_W * 0.82, 36, 58)
      };
      this.track(plate);
      this.kitchenPlates.push(plate);
    });
  };

  proto.buildKitchenPots = function(row) {
    const mid = Math.floor(S.COLS / 2);
    const candidates = row.index % 4 === 0
      ? [1, mid + 1, S.COLS - 2]
      : row.index % 4 === 1
        ? [2, mid - 1, S.COLS - 3]
        : [1, mid, S.COLS - 3];

    const used = [];
    candidates.forEach((rawCol, i) => {
      const col = S.clamp(rawCol, 0, S.COLS - 1);
      if (used.includes(col)) return;
      used.push(col);
      this.blockedCells.add(`${row.index}:${col}`);

      const file = POT_FILES[(i + row.index) % POT_FILES.length];
      const key = `kitchen-pot-${file}`;
      const x = this.colX(col);
      const y = row.y - 4;
      const depth = this.depthForY ? this.depthForY(y, 54) : 94;
      let pot;

      if (this.textures.exists(key)) {
        pot = this.add.image(x, y, key).setDepth(depth);
        const targetH = S.clamp(S.ROW_H * 0.84, 46, 60);
        pot.setScale(targetH / Math.max(1, pot.height)).setOrigin(0.5, 0.7);
      } else {
        pot = this.add.circle(x, y, 20, 0x24262d, 1).setDepth(depth);
      }
      pot.__rowY = row.y;
      this.track(pot);
      this.kitchenPots.push(pot);
    });
  };

  proto.buildKitchenPrep = function(row) {
    const cols = uniqueColumns(Math.min(KNIFE_FILES.length, 3), 1, S.COLS - 2);
    cols.forEach((col, i) => {
      const file = KNIFE_FILES[i % KNIFE_FILES.length];
      const key = `kitchen-knife-${file}`;
      if (!this.textures.exists(key)) return;
      const knife = this.add.image(this.colX(col), row.y - 2, key)
        .setDepth(this.depthForY ? this.depthForY(row.y, 35) : 70);
      const targetH = S.clamp(S.ROW_H * 0.42, 23, 31);
      knife.setScale(targetH / Math.max(1, knife.height)).setOrigin(0.5, 0.58);
      knife.__rowY = row.y;
      this.track(knife);
    });
  };

  proto.renderKitchenRow = function(row) {
    const sideW = S.clamp(S.W * 0.105, 38, 52);
    const left = S.PLAY_X + sideW;
    const right = S.PLAY_X + S.PLAY_W - sideW;
    const width = Math.max(120, right - left);
    const center = (left + right) / 2;
    const y = row.y;
    const d = this.depthForY ? this.depthForY(y, -520) : 1;

    if (row.type === 'water') {
      addRect(this, row, center, y + 5, width, S.ROW_H, 0x176b9b, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 6, 0x2ea8d5, 1, d + 1);
      addRect(this, row, center, y - S.ROW_H * 0.31, width, 4, 0x8ae5f5, 0.72, d + 2);
      const rippleCount = Math.max(7, Math.floor(width / 54));
      for (let i = 0; i < rippleCount; i++) {
        const rx = left + ((i + 0.5) / rippleCount) * width;
        const ry = y + ((i % 3) - 1) * 10;
        addRect(this, row, rx, ry, S.clamp(S.CELL_W * 0.52, 22, 38), 3, 0xb9f3ff, 0.42, d + 3);
        addRect(this, row, rx + 8, ry + 5, S.clamp(S.CELL_W * 0.22, 10, 18), 2, 0xffffff, 0.28, d + 4);
      }
      this.buildKitchenBoards(row);
      return;
    }

    if (row.type === 'kitchenIngredient') {
      addRect(this, row, center, y + 5, width, S.ROW_H, 0x343941, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 7, 0x626a72, 1, d + 1);
      const cols = uniqueColumns(INGREDIENT_FILES.length);
      cols.forEach(col => {
        addRect(this, row, this.colX(col), y, S.clamp(S.CELL_W * 0.86, 36, 56), S.ROW_H * 0.72, 0xe8dfcf, 1, d + 2);
      });
      this.buildKitchenIngredientStation(row);
      return;
    }

    if (row.type === 'kitchenPots') {
      addRect(this, row, center, y + 4, width, S.ROW_H, 0x1f252a, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 6, 0x32383d, 1, d + 1);
      const burnerCols = uniqueColumns(Math.min(6, S.COLS - 2), 1, S.COLS - 2);
      burnerCols.forEach(col => {
        const ring = this.track(this.add.ellipse(this.colX(col), y + 3, S.clamp(S.CELL_W * 0.55, 28, 40), 16, 0x11151a, 0.92)
          .setDepth(d + 2));
        row.objects.push(ring);
      });
      this.buildKitchenPots(row);
      return;
    }

    if (row.type === 'kitchenPlate') {
      addRect(this, row, center, y + 5, width, S.ROW_H, 0x272b31, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 7, 0x4c535a, 1, d + 1);
      for (let x = left + 12; x < right - 8; x += 26) {
        addRect(this, row, x, y + S.ROW_H * 0.28, 12, 3, 0x8c949a, 0.42, d + 2);
      }
      this.buildKitchenPlateRow(row);
      return;
    }

    if (row.type === 'kitchenPrep') {
      addRect(this, row, center, y + 5, width, S.ROW_H, 0x8a5a36, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 7, 0xc88a52, 1, d + 1);
      for (let x = left + 20; x < right - 10; x += 62) {
        addRect(this, row, x, y - S.ROW_H * 0.26, 2, S.ROW_H * 0.56, 0x99613c, 0.4, d + 2);
      }
      this.buildKitchenPrep(row);
      return;
    }

    if (row.type === 'goal') {
      addRect(this, row, center, y + 4, width, S.ROW_H, 0xc5b6a2, 1, d);
      addRect(this, row, center, y, width, S.ROW_H - 6, 0xe7ddd0, 1, d + 1);
      return;
    }

    const start = row.type === 'start';
    addRect(this, row, center, y + 4, width, S.ROW_H, start ? 0xc5b6a2 : 0x8e969d, 1, d);
    addRect(this, row, center, y, width, S.ROW_H - 6, start ? 0xe8dfd2 : 0xcbd0d3, 1, d + 1);
    for (let x = left + S.CELL_W * 0.5; x < right; x += S.CELL_W) {
      addRect(this, row, x, y, 2, S.ROW_H - 10, 0xffffff, 0.22, d + 2);
    }
  };

  const baseBuildRows = proto.buildRows;
  proto.buildRows = function() {
    if (!this._kitchenMode) return baseBuildRows.call(this);

    this.rows = [];
    this.vehicles = [];
    this.floaters = [];
    this.pickups = [];
    this.trains = [];
    this.trainRows = [];
    this.blockedCells = new Set();
    this.kitchenIngredientGroups = [];
    this.kitchenIngredientInventory = [];
    this.kitchenPlates = [];
    this.kitchenPlateCount = 0;
    this.kitchenPots = [];

    const pattern = {
      0: 'start',
      1: 'kitchenPlate',
      2: 'kitchenSafe',
      3: 'water',
      4: 'water',
      5: 'kitchenIngredient',
      6: 'kitchenSafe',
      7: 'kitchenPots',
      8: 'kitchenPots',
      9: 'kitchenSafe',
      10: 'kitchenPlate',
      11: 'kitchenSafe',
      12: 'water',
      13: 'water',
      14: 'kitchenIngredient',
      15: 'kitchenPrep',
      16: 'kitchenPots',
      17: 'kitchenSafe',
      18: 'kitchenPlate',
      19: 'kitchenIngredient',
      20: 'kitchenSafe',
      21: 'water',
      22: 'water',
      23: 'kitchenPots',
      24: 'kitchenPlate',
      25: 'kitchenIngredient',
      26: 'goal'
    };

    this.buildKitchenBackdrop();

    for (let i = 0; i <= this.goalRow; i++) {
      const row = {
        index: i,
        type: pattern[i] || 'kitchenSafe',
        y: this.rowY(i),
        objects: [],
        vehicles: [],
        floaters: [],
        pickups: [],
        obstacles: []
      };
      this.rows[i] = row;
      this.renderKitchenRow(row);
    }
  };

  const baseCollectAt = proto.collectAt;
  proto.collectAt = function(rowIndex) {
    baseCollectAt.call(this, rowIndex);
    if (!this._kitchenMode) return;

    const group = this.kitchenIngredientGroups?.find(g => g.rowIndex === rowIndex && !g.collected);
    if (group) {
      const hit = group.items.find(item => item?.active && Math.abs(item.x - this.player.x) <= S.clamp(S.CELL_W * 0.42, 18, 30));
      if (hit) {
        group.collected = true;
        group.chosen = hit.__kitchenIngredient?.file || 1;
        this.kitchenIngredientInventory.push(group.chosen);
        this.menuCollected.kitchenChoice = (this.menuCollected.kitchenChoice || 0) + 1;
        this.score += hit.__kitchenIngredient?.points || 12;
        this.playSfx?.('pickup');

        group.items.forEach(item => {
          if (!item?.active) return;
          if (item === hit) {
            this.tweens.add({
              targets: item,
              y: item.y - 16,
              scaleX: item.scaleX * 1.12,
              scaleY: item.scaleY * 1.12,
              alpha: 0,
              duration: 260,
              ease: 'Quad.Out'
            });
          } else {
            item.setTint?.(0x777777);
            item.setAlpha?.(0.34);
          }
        });

        const label = this.track(this.add.text(hit.x, hit.y - 36, 'INGREDIENT +12', {
          fontFamily: 'Inter,system-ui,sans-serif',
          fontSize: '12px',
          fontStyle: '900',
          color: '#17212a',
          backgroundColor: '#f8f858',
          padding: {x: 7, y: 4}
        }).setOrigin(0.5).setDepth(this.depthForY ? this.depthForY(hit.y, 110) : 140));
        this.tweens.add({targets: label, y: label.y - 18, alpha: 0, duration: 520, onComplete: () => label.destroy()});
      }
    }

    for (const plate of this.kitchenPlates || []) {
      const meta = plate?.__kitchenPlate;
      if (!plate?.active || !meta || meta.collected || meta.rowIndex !== rowIndex) continue;
      if (Math.abs(plate.x - this.player.x) > meta.hitWidth * 0.5) continue;

      meta.collected = true;
      this.kitchenPlateCount = (this.kitchenPlateCount || 0) + 1;
      this.score += meta.points;
      this.playSfx?.('pickup');

      const label = this.track(this.add.text(plate.x, plate.y - 30, `PLATE +${meta.points}`, {
        fontFamily: 'Inter,system-ui,sans-serif',
        fontSize: '12px',
        fontStyle: '900',
        color: '#17212a',
        backgroundColor: '#effae8',
        padding: {x: 7, y: 4}
      }).setOrigin(0.5).setDepth(this.depthForY ? this.depthForY(plate.y, 110) : 140));

      this.tweens.add({targets: plate, y: plate.y - 14, alpha: 0, scaleX: plate.scaleX * 0.75, scaleY: plate.scaleY * 0.75, duration: 220});
      this.tweens.add({targets: label, y: label.y - 16, alpha: 0, duration: 500, onComplete: () => label.destroy()});
    }

    this.updateHud();
  };

  const baseUpdateHud = proto.updateHud;
  proto.updateHud = function(...args) {
    const result = baseUpdateHud.apply(this, args);
    const title = document.querySelector('.minimum-copy span');
    const labels = document.querySelectorAll('.minimum-labels span');

    if (this._kitchenMode) {
      const ingredients = this.collectedCount();
      const ingredientNeed = this.minimumCount();
      const plates = this.kitchenPlateCount || 0;
      const ingredientReady = Math.min(1, ingredients / Math.max(1, ingredientNeed));
      const plateReady = Math.min(1, plates / PLATES_NEEDED);
      const readyPct = Math.round((ingredientReady + plateReady) * 50);

      if (title) title.textContent = 'KITCHEN';
      if (U.minimumText) U.minimumText.textContent = `ING ${ingredients}/${this.requiredCount()} · PLATES ${plates}/${PLATES_NEEDED}`;
      if (U.minimumFill) U.minimumFill.style.width = `${readyPct}%`;
      U.minimumPanel?.classList.toggle('ready', ingredients >= ingredientNeed && plates >= PLATES_NEEDED);
      if (labels[0]) labels[0].textContent = '0';
      if (labels[1]) labels[1].textContent = 'OPEN';
      if (labels[2]) labels[2].textContent = 'READY';
    } else {
      if (title) title.textContent = 'INGREDIENTS';
      if (labels[0]) labels[0].textContent = '0';
      if (labels[1]) labels[1].textContent = 'MIN 50%';
      if (labels[2]) labels[2].textContent = 'ALL';
    }
    return result;
  };

  const baseFailRun = proto.failRun;
  proto.failRun = function(title, body, cause) {
    if (this._kitchenMode && cause === 'water') {
      body = 'You missed the floating board. Land directly on a moving kitchen board to cross the water.';
    }
    return baseFailRun.call(this, title, body, cause);
  };

  const baseFinishDelivery = proto.finishDelivery;
  proto.finishDelivery = function() {
    if (!this._kitchenMode) return baseFinishDelivery.call(this);

    if (this.collectedCount() < this.minimumCount()) {
      return baseFinishDelivery.call(this);
    }

    if ((this.kitchenPlateCount || 0) < PLATES_NEEDED) {
      if (this.runEnded) return;
      this.runEnded = true;
      this.inputLocked = true;
      this.clearBufferedMove?.();
      this.cancelGesture?.();
      this.showRestaurantClosedSign?.();

      const body = `You collected ${this.kitchenPlateCount || 0} of ${PLATES_NEEDED} plates. Grab at least ${PLATES_NEEDED} plates on the kitchen belts before reaching the chef.`;
      this.time.delayedCall(450, () => {
        if (this.runEnded) this.showResult(false, 'NOT ENOUGH PLATES', body, 0);
      });
      return;
    }

    return baseFinishDelivery.call(this);
  };

  const baseShowResult = proto.showResult;
  proto.showResult = function(success, title, body, revenue) {
    const result = baseShowResult.call(this, success, title, body, revenue);
    if (!this._kitchenMode) return result;

    if (success && U.body) {
      U.body.textContent = 'You have enough ingredients and plates. Your restaurant can now open.';
    }

    if (U.stats && !U.stats.querySelector('[data-kitchen-plates]')) {
      const stat = document.createElement('div');
      stat.className = 'modal-stat';
      stat.dataset.kitchenPlates = '1';
      stat.innerHTML = `<span>PLATES</span><b>${this.kitchenPlateCount || 0}/${PLATES_NEEDED}</b>`;
      U.stats.appendChild(stat);
    }
    return result;
  };
})();