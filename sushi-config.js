(() => {
  const PALETTE = {
    road: 0x484e5d, roadShadow: 0x272b37, shadow: 0x282229,
    water: 0x72d8ff, waterMid: 0x57bffd, waterDeep: 0x4886c1,
    grass: 0xa7d861, grassMid: 0x94bd50, grassDark: 0x566a29,
    log: 0x8b433a, logDark: 0x663b3c, orange: 0xf06030,
    redOrange: 0xe84028, lime: 0xa1d15a, mint: 0x81d4c1,
    cabin: 0xeffae8, yellow: 0xf8f858, black: 0x12151c, cream: 0xfff7ec,
  };

  const ITEMS = [
    ['rice','RICE','米','PANTRY',5,0xf4e2b7], ['nori','NORI','のり','SEAWEED',6,0x3d6558],
    ['cucumber','CUCUMBER','きゅうり','PRODUCE',7,PALETTE.grassMid], ['avocado','AVOCADO','アボカド','PRODUCE',8,PALETTE.lime],
    ['tuna','TUNA','まぐろ','FISH SHOP',10,0xde7370], ['salmon','SALMON','さけ','FISH SHOP',12,0xf19a72],
    ['shrimp','SHRIMP','えび','FISH SHOP',14,0xf2aba6], ['uni','UNI','うに','SPECIALTY',18,0xe4aa4d],
  ].map(([key,label,jp,shop,points,color]) => ({ key,label,jp,shop,points,color }));

  const CHEFS = [
    { id:'chef-1', name:'Slicey McDicey', menuSrc:'images/sushimasters/1/front.png', runSrc:'images/sushimasters/1/back.png' },
    { id:'chef-2', name:'Kyoto O Sushi', menuSrc:'images/sushimasters/2/front.png', runSrc:'images/sushimasters/2/back.png' },
    { id:'chef-3', name:'Nigiri McFlurry', menuSrc:'images/sushimasters/3/front.png', runSrc:'images/sushimasters/3/back.png' },
  ];

  const SHOP_TYPES = {
    PANTRY:{en:'RICE & DRY GOODS',jp:'米・乾物店'},
    SEAWEED:{en:'NORI MERCHANT',jp:'海苔屋'},
    PRODUCE:{en:'PRODUCE MARKET',jp:'青果店'},
    'FISH SHOP':{en:'FISHMONGER',jp:'鮮魚店'},
    SPECIALTY:{en:'SPECIALTY MARKET',jp:'専門店'},
  };

  const THEMES = {
    morning:{key:'morning',skyTop:0x9be0f7,skyBottom:0xeaf6ef,grass:PALETTE.grass,grassAlt:PALETTE.grassMid,grassDark:PALETTE.grassDark,road:PALETTE.road,roadShadow:PALETTE.roadShadow,water:PALETTE.water,waterDeep:PALETTE.waterDeep,laneStripe:0x9aa5b9,shop:0xe6c99d,shopDark:0xb9835d,lantern:0xffc66d,stars:false},
    day:{key:'day',skyTop:0x72d8ff,skyBottom:0xf2fbf3,grass:0xa7d861,grassAlt:0x94bd50,grassDark:0x566a29,road:0x484e5d,roadShadow:0x272b37,water:0x72d8ff,waterDeep:0x4886c1,laneStripe:0x9aa5b9,shop:0xedc98f,shopDark:0xb97d50,lantern:0xffbf68,stars:false},
    sunset:{key:'sunset',skyTop:0xf7a76c,skyBottom:0x756583,grass:0x9cc85b,grassAlt:0x82b04b,grassDark:0x566520,road:0x474b5d,roadShadow:0x292735,water:0x5eaedc,waterDeep:0x3c6f9f,laneStripe:0xc1a9b8,shop:0xe4ad83,shopDark:0xaa6f58,lantern:0xffb05f,stars:false},
    night:{key:'night',skyTop:0x172541,skyBottom:0x0b1224,grass:0x547b42,grassAlt:0x466a37,grassDark:0x2e421e,road:0x323745,roadShadow:0x191d27,water:0x2e759f,waterDeep:0x173d5c,laneStripe:0x77859f,shop:0x8d715f,shopDark:0x624b42,lantern:0xffbd68,stars:true},
  };

  const ui = Object.fromEntries(Object.entries({
    hud:'hud',score:'hud-score',progress:'hud-progress',minimumText:'minimum-text',minimumFill:'minimum-fill',
    menuItems:'menu-items',modal:'modal',title:'modal-title',body:'modal-body',levelGrid:'level-grid',stats:'modal-stats',
    primary:'primary-action',secondary:'secondary-action',hint:'modal-hint',pause:'pause-button',sound:'sound-button',bag:'ingredient-bag',
  }).map(([k,id]) => [k,document.getElementById(id)]));
  ui.minimumPanel = document.querySelector('.minimum-panel');

  const clamp = Phaser.Math.Clamp;
  const lighten = (c,a) => Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(c), Phaser.Display.Color.ValueToColor(0xffffff), 100, clamp(a,0,100)
  ).color;
  const darken = (c,a) => Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(c), Phaser.Display.Color.ValueToColor(0x000000), 100, clamp(a,0,100)
  ).color;
  const rngFor = level => { let seed=(0x9e3779b9^(level*0x85ebca6b))>>>0; return()=>{seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}; };
  const formatTime = ms => { const s=Math.max(0,Math.floor(ms/1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  const S = {
    PALETTE, ITEMS, CHEFS, SHOP_TYPES, THEMES, ui, clamp, lighten, darken, rngFor, formatTime,
    MAX_LEVEL:20, MAX_BACKTRACK:4, SAVE_KEY:'sushi-street-save-v1', IDLE_FISH_MS:6200,
    CAMERA_DEG:5.5, CAMERA_FOLLOW_Y:0.68, CAMERA_DANGER_Y:0.91, PICKUP_ROW_GAP:4,
  };

  S.setViewport = (width, height) => {
    const W = Math.max(1, Math.round(Number(width) || window.innerWidth || 390));
    const H = Math.max(1, Math.round(Number(height) || window.innerHeight || 844));
    const CAMERA_ROTATION = Phaser.Math.DegToRad(S.CAMERA_DEG);
    const OVERSCAN_X = Math.ceil(Math.abs(Math.sin(CAMERA_ROTATION)) * H + Math.max(120, W * 0.06));
    const OVERSCAN_Y = Math.ceil(Math.abs(Math.sin(CAMERA_ROTATION)) * W * 0.58 + 110);
    const WORLD_W = W + OVERSCAN_X * 2;
    const PLAY_X = OVERSCAN_X;
    const PLAY_W = W;
    const TRACK_X = 0;
    const TRACK_W = WORLD_W;
    const SIDE_MARGIN = clamp(W * 0.025, 10, 30);

    const TARGET_CELL = 70;
    let COLS = clamp(Math.round((W - SIDE_MARGIN * 2) / TARGET_CELL), 9, 27);
    if (COLS % 2 === 0) COLS += COLS < 27 ? 1 : -1;
    const CELL_W = (PLAY_W - SIDE_MARGIN * 2) / COLS;
    const ROW_H = clamp(CELL_W * 0.88, 54, 70);

    Object.assign(S, {
      W,H,CAMERA_ROTATION,OVERSCAN_X,OVERSCAN_Y,WORLD_W,PLAY_X,PLAY_W,TRACK_X,TRACK_W,SIDE_MARGIN,COLS,CELL_W,ROW_H,
      START_COL:Math.floor(COLS/2), SAFE_BOTTOM:clamp(ROW_H*1.35,72,104), VOXEL_DEPTH:clamp(CELL_W*.12,4,8),
      CAMERA_CREEP:clamp(ROW_H*.24,13,18),
      RIVER_MIN_SUPPORTS:W>=900?3:2,
    });
    return S;
  };

  S.setViewport(window.innerWidth || document.documentElement.clientWidth || 390,
                window.innerHeight || document.documentElement.clientHeight || 844);
  window.SS = S;
})();
