(() => {
  const S=window.SS,P=S.PALETTE,proto=window.SushiScene.prototype;

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    this.load.image('traffic-car-1','images/cars/1.png');
  };

  proto.pathColumnsForStore=function(rowStart,rowEnd){
    const rows=this.rows.filter(r=>r?.type==='shop'&&r.index>=rowStart&&r.index<=rowEnd&&r.ingredient?.centerRow===r.index);
    const cols=[];rows.forEach(r=>{if(r.__pickupMeta)cols.push(...(r.__pickupMeta.safeCols||[]))});
    if(!cols.length)return[S.START_COL]; cols.sort((a,b)=>a-b); const out=[];
    for(const c of cols) if(!out.some(v=>Math.abs(v-c)<=1)) out.push(c);
    return out.slice(0,Math.max(2,Math.min(4,out.length)));
  };

  proto.planLandObstacles=function(){
    this.blockedCells=new Set(); const rng=S.rngFor(this.selectedLevel*719+31), roadRows=this.rows.filter(r=>r.type==='road');
    for(const row of this.rows) row.obstacles=[];
    for(const road of roadRows){
      const safeRows=[this.rows[road.index-1],this.rows[road.index+1]].filter(r=>r?.type==='safe');
      const quota=S.W>=900?2:1;
      for(const landRow of safeRows){
        const localBlocked=new Set(); const nearStore=this.storePlans.find(sp=>Math.abs(landRow.index-sp.centerRow)<=2);
        const reservedCols=nearStore?this.pathColumnsForStore(nearStore.rowStart,nearStore.rowEnd):[S.START_COL];
        const addObs=(kind,col,span)=>{ const cells=[]; for(let d=0;d<span;d++){const cc=col+d; this.blockedCells.add(`${landRow.index}:${cc}`); localBlocked.add(cc); cells.push(cc)} landRow.obstacles.push({kind,col,span,cells}); };
        const conflicts=(col,span)=>{ for(let d=0;d<span;d++){const cc=col+d; if(cc<0||cc>=S.COLS||localBlocked.has(cc)||this.blockedCells.has(`${landRow.index}:${cc}`)||reservedCols.some(rc=>Math.abs(rc-cc)<=1))return true;} return false; };
        let buildingCount=0;
        for(let i=0;i<quota;i++){
          const span=rng()<.55?1:2, sides=[0,S.COLS-span].filter(c=>!conflicts(c,span)); let col=sides.length?sides[Math.floor(rng()*sides.length)]:null;
          if(col===null){ const all=[]; for(let c=0;c<=S.COLS-span;c++) if(!conflicts(c,span)) all.push(c); if(all.length) col=all[Math.floor(rng()*all.length)]; }
          if(col!==null){ addObs('building',col,span); buildingCount++; }
        }
        const targetTrees=S.W>=900?6:4; let attempts=0;
        while(landRow.obstacles.filter(o=>o.kind==='tree').length<targetTrees&&attempts++<80){
          const col=Math.floor(rng()*S.COLS); if(conflicts(col,1)) continue; if(landRow.obstacles.some(o=>Math.abs(o.col-col)<=1)) continue; addObs('tree',col,1);
        }
        if(!buildingCount&&!nearStore){ const edges=[0,S.COLS-1].filter(c=>!conflicts(c,1)); if(edges.length) addObs('building',edges[Math.floor(rng()*edges.length)],1); }
      }
    }
  };

  proto.buildRows=function(){
    const shops=[]; this.trainRows=[];
    for(let i=0;i<=this.goalRow;i++){
      const r=this.describeRow(i); r.y=this.rowY(i); r.objects=[]; r.vehicles=[]; r.floaters=[]; r.pickups=[]; r.obstacles=[]; this.rows[i]=r;
      if(r.type==='shop'&&r.ingredient?.centerRow===i) shops.push(r); if(r.type==='train') this.trainRows.push(r);
    }
    this.placePickups(shops); this.planLandObstacles(); this.rows.forEach(r=>this.renderRow(r));
  };

  proto.renderRow=function(r){
    const y=r.y,d=2+r.index*2,c=S.TRACK_X+S.TRACK_W/2,half=S.ROW_H/2,below=this.rows[r.index-1],above=this.rows[r.index+1];
    const rect=(x,yy,w,h,color,a=1,z=d)=>{const o=this.track(this.add.rectangle(x,yy,w,h,color,a).setDepth(z));r.objects.push(o);return o};
    if(['start','safe','goal'].includes(r.type)){
      rect(c,y+4,S.TRACK_W,S.ROW_H,this.theme.grassDark,.85,d-1); rect(c,y,S.TRACK_W,S.ROW_H-5,this.theme.grass,1,d);
      for(let col=0;col<S.COLS;col++) rect(this.colX(col),y-2,S.CELL_W-1,S.ROW_H-8,(col+r.index)%2?this.theme.grass:this.theme.grassAlt,1,d+1);
      if(r.type==='safe') this.renderLandObstacles(r,d+5);
    }
    if(r.type==='road'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,this.theme.roadShadow,.9,d-1); rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.road,1,d);
      if(below?.type==='road') this.drawDivider(y+half-1,d+2); else rect(c,y+half-3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);
      if(above?.type!=='road') rect(c,y-half+3,S.TRACK_W,6,this.theme.roadShadow,1,d+1); this.buildTraffic(r);
    }
    if(r.type==='water'){
      rect(c,y+6,S.TRACK_W,S.ROW_H,this.theme.waterDeep,.94,d-1); rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.water,1,d);
      if(below?.type!=='water') rect(c,y+half-3,S.TRACK_W,6,this.theme.waterDeep,.95,d+1); if(above?.type!=='water') rect(c,y-half+3,S.TRACK_W,6,S.lighten(this.theme.water,15),.72,d+1);
      const ripples=Math.max(12,Math.floor(S.TRACK_W/72));
      for(let i=0;i<ripples;i++){ const rx=S.TRACK_X+(i+.5)*S.TRACK_W/ripples,ry=y+Phaser.Math.Between(-15,15); rect(rx,ry,S.clamp(S.CELL_W*.66,25,46),3,S.lighten(this.theme.water,26),.38,d+2); rect(rx+Phaser.Math.Between(-8,8),ry+5,S.clamp(S.CELL_W*.28,12,22),2,0xffffff,.17,d+3); }
      this.buildFloaters(r);
    }
    if(r.type==='shop'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,S.darken(this.theme.shopDark,20),.82,d-1); rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.shop,1,d); rect(c,y+half-9,S.TRACK_W,14,this.theme.shopDark,.88,d+1);
      const parkingW=S.PLAY_W*.64; rect(S.PLAY_X+S.PLAY_W*.5,y+half-13,parkingW,18,0xc9c0ad,.95,d+2);
      const segs=Math.max(5,Math.floor(parkingW/58)); for(let i=0;i<segs;i++){ const px=S.PLAY_X+S.PLAY_W*.18+i*(parkingW/(Math.max(1,segs-1))); rect(px,y+half-14,18,3,0xf2ece2,.8,d+3); }
      rect(c,y-half+8,S.TRACK_W,14,S.lighten(this.theme.shop,6),.94,d+2); for(let col=0;col<S.COLS;col++) if(col%3===1) rect(this.colX(col),y+half-14,(S.CELL_W-1)*.7,16,this.theme.grassAlt,1,d+2);
    }
    if(r.type==='train') this.renderTrainTrack(r,d); if(r.type==='goal') r.objects.push(this.createRestaurant(S.PLAY_X+S.PLAY_W/2,y-5,d+8));
  };

  proto.renderLandObstacles=function(r,depth){ for(const o of r.obstacles||[]){ const x=this.colX(o.col)+(o.span-1)*S.CELL_W*.5; if(o.kind==='building') this.createBlockBuilding(x,r.y-8,o.span*S.CELL_W*.88,depth); else this.createTree(x,r.y-4,depth);} };
  proto.createTree=function(x,y,d){ const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(); c.add(g); this.drawBox(g,-1,13,S.CELL_W*.22,S.ROW_H*.44,4,0x6d4730,{shadowAlpha:.16,front:0x593521,right:0x402517}); this.drawBox(g,0,-10,S.CELL_W*.66,S.ROW_H*.44,6,P.grassMid,{shadowAlpha:.2,top:P.lime,front:P.grassMid,right:P.grassDark}); this.drawBox(g,3,-30,S.CELL_W*.58,S.ROW_H*.38,6,0x93c821,{shadow:false,top:0xa6d85e,front:0x7ca81a,right:0x648814}); this.drawBox(g,1,-47,S.CELL_W*.48,S.ROW_H*.28,5,0x86b81d,{shadow:false,top:0x98cf2e,front:0x6f9518,right:0x5a7914}); return c; };
  proto.createBlockBuilding=function(x,y,w,d){ const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(),base=[0xc8d2de,0xa6b6c8,0xe0d3c1,0x97a3b0][Math.floor(this.rng()*4)],accent=[0xe57456,0x75a8c4,0xc8a35c,0x9b83b8][Math.floor(this.rng()*4)]; c.add(g); const towerH=S.ROW_H*(1.25+(w>S.CELL_W*1.4?.28:0)); this.drawBox(g,0,-towerH*.22,w,towerH,8,base,{shadowAlpha:.23,top:S.lighten(base,8),front:S.darken(base,10),right:S.darken(base,22)}); this.drawBox(g,0,-towerH*.86,w*.82,S.ROW_H*.16,5,S.lighten(base,14),{shadow:false,front:S.lighten(base,2),right:S.darken(base,8)}); this.drawBox(g,-w*.16,towerH*.03,w*.18,S.ROW_H*.24,4,accent,{shadow:false,top:S.lighten(accent,9)}); const rows=4,cols=Math.max(2,Math.round(w/22)); for(let ry=0;ry<rows;ry++) for(let cx=0;cx<cols;cx++){ const wx=-w*.32+cx*(w*.64/Math.max(1,cols-1)), wy=-towerH*.48+ry*(towerH*.62/Math.max(1,rows-1)); g.fillStyle(P.black,.92); g.fillRect(wx-5,wy-4,10,8); g.fillStyle(0x8fb4d7,.55); g.fillRect(wx-3,wy-2,6,4); } return c; };

  proto.buildTraffic=function(r){
    const dir=this.rng()>.5?1:-1;
    const speed=(88+this.selectedLevel*4+Math.floor(this.rng()*46))*dir;
    const targetW=S.clamp(S.CELL_W*1.42,62,104);
    const minGap=S.clamp(S.CELL_W*.95,52,84);
    const pad=targetW+52,cycleLength=S.TRACK_W+pad*2,cycleStart=S.TRACK_X-pad;
    const desired=S.clamp(Math.floor(S.W/320)+2,2,7);
    const maxCount=Math.max(2,Math.floor(cycleLength/(targetW+minGap)));
    const count=Math.min(desired,maxCount),spacing=cycleLength/count,phase=this.rng()*spacing;
    for(let i=0;i<count;i++){
      const x=cycleStart+phase+i*spacing;
      const vehicle=this.createImageVehicle(x,r.y-2,targetW,dir);
      vehicle.__traffic={vx:speed,pad,width:targetW*.78,kind:'car',left:S.TRACK_X,right:S.TRACK_X+S.TRACK_W,cycleStart,cycleLength};
      r.vehicles.push(vehicle);this.vehicles.push(vehicle);this.track(vehicle);
    }
  };

  proto.createImageVehicle=function(x,y,targetW,dir){
    if(!this.textures.exists('traffic-car-1')) return this.createVehicle(x,y,targetW,S.clamp(S.ROW_H*.45,24,36),false,dir);
    const c=this.add.container(x,y).setDepth(45);
    const shadow=this.add.ellipse(8,12,targetW*.76,S.clamp(S.ROW_H*.18,10,15),P.shadow,.22);
    const img=this.add.image(0,0,'traffic-car-1');
    const scale=targetW/Math.max(1,img.width);
    img.setScale(scale).setOrigin(.5,.64).setFlipX(dir<0);
    c.add([shadow,img]);
    return c;
  };

  proto.placePickups=function(shops){
    const ordered=shops.slice().sort((a,b)=>a.index-b.index); if(!ordered.length) return;
    this.menuList.forEach((item,i)=>{ const r=ordered[i]; if(!r) return; const minCol=1,maxCol=Math.max(minCol,S.COLS-3),col=minCol+Math.floor(this.rng()*Math.max(1,maxCol-minCol+1)); const zoneW=S.clamp(S.CELL_W*4.4,S.CELL_W*3.45,Math.min(S.PLAY_W*.54,S.CELL_W*5.6)),p=this.createPickup(this.colX(col),r.y-6,item,zoneW); p.__pickupMeta={row:r.index,rowStart:r.ingredient.rowStart,rowEnd:r.ingredient.rowEnd,centerRow:r.index,col,item,collected:false,missed:false,zoneW,safeCols:[Math.max(0,col-1),col,Math.min(S.COLS-1,col+1)]}; p.__pickup=p.__pickupMeta; r.__pickupMeta=p.__pickupMeta; r.pickups.push(p.__pickupMeta); this.pickups.push(p); this.track(p); });
  };

  proto.createPickup=function(x,y,item,zoneW){
    const c=this.add.container(x,y).setDepth(70),zh=S.ROW_H*2.65,zone=this.add.rectangle(0,2,zoneW,zh,item.color,.08).setStrokeStyle(2,item.color,.48),missZone=this.add.rectangle(0,2,zoneW,zh,P.redOrange,.22).setStrokeStyle(3,P.redOrange,.92).setVisible(false),g=this.add.graphics(); c.add([zone,missZone,g]);
    const shop=S.SHOP_TYPES[item.shop]||{en:item.shop,jp:'市場'},stallW=zoneW*.88; this.drawBox(g,0,32,stallW,S.ROW_H*1.7,Math.max(6,S.VOXEL_DEPTH),S.lighten(this.theme.shop,6),{shadowAlpha:.2,front:this.theme.shopDark,right:S.darken(this.theme.shopDark,18)}); this.drawBox(g,0,-20,stallW*1.04,S.ROW_H*.22,Math.max(4,S.VOXEL_DEPTH-1),item.color,{shadow:false,top:S.lighten(item.color,12),front:S.darken(item.color,10),right:S.darken(item.color,22)}); const segW=stallW/6; for(let i=0;i<6;i++){ g.fillStyle(i%2?P.cream:item.color,1); g.fillRect(-stallW/2+i*segW,-8,segW+1,9); } this.drawBox(g,0,52,stallW*.74,S.ROW_H*.16,3,this.theme.shopDark,{shadow:false}); const iconSize=S.clamp(S.CELL_W*.58,24,38); this.drawBox(g,0,18,iconSize,iconSize*.76,Math.max(3,S.VOXEL_DEPTH-2),item.color,{shadow:false}); g.fillStyle(P.yellow,1); g.fillRect(-4,14,8,8); [-stallW*.24,stallW*.24].forEach((cx,i)=>this.drawBox(g,cx,46,S.CELL_W*.4,S.ROW_H*.22,3,i?P.cream:S.lighten(item.color,15),{shadow:false}));
    const storeLabel=this.add.text(0,-56,shop.en,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#fff7ec',backgroundColor:'#7f5b3f',padding:{x:7,y:3}}).setOrigin(.5), itemLabel=this.add.text(0,-36,`${shop.jp} • ${item.label}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'10px',fontStyle:'900',color:'#17212a',backgroundColor:'#fff7ec',padding:{x:5,y:2}}).setOrigin(.5,0), miss=this.add.text(0,0,'MISSED',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px',fontStyle:'900',color:'#fff',backgroundColor:'#ea4225',padding:{x:8,y:4}}).setOrigin(.5).setVisible(false);
    c.add([storeLabel,itemLabel,miss]); c.__missedZone=missZone; c.__missedLabel=miss; return c;
  };

  proto.spawnPlayer=function(){
    this.playerRow=0; this.playerCol=S.START_COL; const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics(); shadow.fillStyle(P.shadow,.3); shadow.fillEllipse(13,21,S.clamp(S.CELL_W*1.16,48,72),S.clamp(S.ROW_H*.2,12,18)); c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;
    if(chef&&this.textures.exists(runKey)){ const img=this.add.image(0,20,runKey),targetW=S.clamp(S.CELL_W*1.14,44,62),scale=targetW/img.width; img.setOrigin(.5,1).setScale(scale); art.add(img); }
    else{ const g=this.add.graphics(),s=S.clamp(S.CELL_W*.64,28,40); art.add(g); this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false}); this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false}); this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false,front:0xe1e5ee,right:0xb8b7ce}); this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false,front:0xe3ac89,right:0xc88d72}); this.drawBox(g,0,-34,s*.72,s*.3,5,P.cabin,{shadow:false,front:0xdedfed,right:0xaaa8c2}); }
    c.add(art); this.player=this.track(c); this.playerArt=art; this.playerShadow=shadow; this.playerSupport=null; this.playerSupportOffsetX=0;
  };
})();
