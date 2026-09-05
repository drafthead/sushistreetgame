(() => {
  const W = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 390));
  const H = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 844));
  const COLS = 9;
  const TRACK_W = Math.min(W, 620);
  const TRACK_X = (W - TRACK_W) / 2;
  const SIDE_MARGIN = Phaser.Math.Clamp(TRACK_W * 0.035, 10, 18);
  const CELL_W = (TRACK_W - SIDE_MARGIN * 2) / COLS;
  const ROW_H = Phaser.Math.Clamp(Math.round(H * 0.082), 52, 78);
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
  const THEMES = {
    morning:{key:'morning',skyTop:0x9be0f7,skyBottom:0xeaf6ef,grass:PALETTE.grass,grassAlt:PALETTE.grassMid,grassDark:PALETTE.grassDark,road:PALETTE.road,roadShadow:PALETTE.roadShadow,water:PALETTE.water,waterDeep:PALETTE.waterDeep,laneStripe:0x9aa5b9,shop:0xe6c99d,shopDark:0xb9835d,lantern:0xffc66d,stars:false},
    day:{key:'day',skyTop:0x72d8ff,skyBottom:0xf2fbf3,grass:0xa7d861,grassAlt:0x94bd50,grassDark:0x566a29,road:0x484e5d,roadShadow:0x272b37,water:0x72d8ff,waterDeep:0x4886c1,laneStripe:0x9aa5b9,shop:0xedc98f,shopDark:0xb97d50,lantern:0xffbf68,stars:false},
    sunset:{key:'sunset',skyTop:0xf7a76c,skyBottom:0x756583,grass:0x9cc85b,grassAlt:0x82b04b,grassDark:0x566520,road:0x474b5d,roadShadow:0x292735,water:0x5eaedc,waterDeep:0x3c6f9f,laneStripe:0xc1a9b8,shop:0xe4ad83,shopDark:0xaa6f58,lantern:0xffb05f,stars:false},
    night:{key:'night',skyTop:0x172541,skyBottom:0x0b1224,grass:0x547b42,grassAlt:0x466a37,grassDark:0x2e421e,road:0x323745,roadShadow:0x191d27,water:0x2e759f,waterDeep:0x173d5c,laneStripe:0x77859f,shop:0x8d715f,shopDark:0x624b42,lantern:0xffbd68,stars:true},
  };
  const ui = Object.fromEntries(Object.entries({
    hud:'hud',level:'hud-level',jumps:'hud-jumps',score:'hud-score',time:'hud-time',progress:'hud-progress',
    minimumText:'minimum-text',minimumFill:'minimum-fill',menuItems:'menu-items',modal:'modal',title:'modal-title',body:'modal-body',
    levelGrid:'level-grid',stats:'modal-stats',primary:'primary-action',secondary:'secondary-action',hint:'modal-hint',pause:'pause-button',
  }).map(([k,id]) => [k,document.getElementById(id)]));
  ui.minimumPanel = document.querySelector('.minimum-panel');
  const clamp = Phaser.Math.Clamp;
  const lighten = (c,a) => Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(c),Phaser.Display.Color.ValueToColor(0xffffff),100,clamp(a,0,100)).color;
  const darken = (c,a) => Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(c),Phaser.Display.Color.ValueToColor(0x000000),100,clamp(a,0,100)).color;
  const rngFor = level => { let seed=(0x9e3779b9^(level*0x85ebca6b))>>>0; return()=>{seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}; };
  const formatTime = ms => { const s=Math.max(0,Math.floor(ms/1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  window.SS = { W,H,COLS,TRACK_W,TRACK_X,SIDE_MARGIN,CELL_W,ROW_H,PALETTE,ITEMS,THEMES,ui,clamp,lighten,darken,rngFor,formatTime,
    MAX_LEVEL:20,MAX_BACKTRACK:4,START_COL:Math.floor(COLS/2),SAVE_KEY:'sushi-street-save-v1',IDLE_FISH_MS:6200,
    CAMERA_CREEP:clamp(H*0.021,14,20),CAMERA_FOLLOW_Y:0.68,CAMERA_DANGER_Y:0.91,SAFE_BOTTOM:clamp(H*0.12,68,108),VOXEL_DEPTH:clamp(CELL_W*0.12,4,8),
  };
})();
