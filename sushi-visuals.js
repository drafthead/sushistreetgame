(() => {
  const S=window.SS,P=S.PALETTE,proto=window.SushiScene.prototype;

  proto.drawBox=function(g,cx,cy,w,h,d,color,opt={}){
    d=Math.max(2,d||S.VOXEL_DEPTH);
    const top=opt.top??S.lighten(color,7),front=opt.front??S.darken(color,18),right=opt.right??S.darken(color,30);
    if(opt.shadow!==false){g.fillStyle(P.shadow,opt.shadowAlpha??.24);g.fillRect(cx-w/2+(opt.sx??d+4),cy-h/2+(opt.sy??d+6),w,h)}
    g.fillStyle(front,1);g.fillPoints([{x:cx-w/2,y:cy+h/2},{x:cx+w/2,y:cy+h/2},{x:cx+w/2+d,y:cy+h/2+d},{x:cx-w/2+d,y:cy+h/2+d}],true);
    g.fillStyle(right,1);g.fillPoints([{x:cx+w/2,y:cy-h/2},{x:cx+w/2,y:cy+h/2},{x:cx+w/2+d,y:cy+h/2+d},{x:cx+w/2+d,y:cy-h/2+d}],true);
    g.fillStyle(top,1);g.fillRect(cx-w/2,cy-h/2,w,h);
  };

  proto.buildSky=function(){
    const g=this.trackSky(this.add.graphics().setScrollFactor(0).setDepth(-200));
    g.fillGradientStyle(this.theme.skyTop,this.theme.skyTop,this.theme.skyBottom,this.theme.skyBottom,1);g.fillRect(0,0,S.W,S.H);
    if(this.theme.stars)for(let i=0;i<36;i++)this.trackSky(this.add.circle(Phaser.Math.Between(5,S.W-5),Phaser.Math.Between(8,Math.max(9,S.H*.42)),Phaser.Math.RND.pick([1,1,2]),0xffffff,Phaser.Math.FloatBetween(.3,.75)).setScrollFactor(0).setDepth(-185));
  };

  proto.drawDivider=function(y,depth){const seg=S.clamp(S.CELL_W*.62,22,43),gap=seg*.75;for(let x=S.TRACK_X+14;x<S.TRACK_X+S.TRACK_W-10;x+=seg+gap)this.track(this.add.rectangle(x+seg/2,y,seg,4,this.theme.laneStripe,.78).setDepth(depth))};

  proto.renderRow=function(r){
    const y=r.y,d=2+r.index*2,c=S.TRACK_X+S.TRACK_W/2,half=S.ROW_H/2,below=this.rows[r.index-1],above=this.rows[r.index+1];
    const rect=(x,yy,w,h,color,a=1,z=d)=>{const o=this.track(this.add.rectangle(x,yy,w,h,color,a).setDepth(z));r.objects.push(o);return o};
    if(['start','safe','goal'].includes(r.type)){
      rect(c,y+4,S.TRACK_W,S.ROW_H,this.theme.grassDark,.85,d-1);rect(c,y,S.TRACK_W,S.ROW_H-5,this.theme.grass,1,d);
      for(let col=0;col<S.COLS;col++)rect(this.colX(col),y-2,S.CELL_W-1,S.ROW_H-8,(col+r.index)%2?this.theme.grass:this.theme.grassAlt,1,d+1);
    }
    if(r.type==='road'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,this.theme.roadShadow,.9,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.road,1,d);
      if(below?.type==='road')this.drawDivider(y+half-1,d+2);else rect(c,y+half-3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);
      if(above?.type!=='road')rect(c,y-half+3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);this.buildTraffic(r);
    }
    if(r.type==='water'){
      rect(c,y+6,S.TRACK_W,S.ROW_H,this.theme.waterDeep,.94,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.water,1,d);
      if(below?.type!=='water')rect(c,y+half-3,S.TRACK_W,6,this.theme.waterDeep,.95,d+1);
      if(above?.type!=='water')rect(c,y-half+3,S.TRACK_W,6,S.lighten(this.theme.water,15),.72,d+1);
      const rippleCount=Math.max(12,Math.floor(S.TRACK_W/72));
      for(let i=0;i<rippleCount;i++){
        const rx=S.TRACK_X+(i+.5)*S.TRACK_W/rippleCount,ry=y+Phaser.Math.Between(-15,15);
        rect(rx,ry,S.clamp(S.CELL_W*.66,25,46),3,S.lighten(this.theme.water,26),.38,d+2);
        rect(rx+Phaser.Math.Between(-8,8),ry+5,S.clamp(S.CELL_W*.28,12,22),2,0xffffff,.17,d+3);
      }
      this.buildFloaters(r);
    }
    if(r.type==='shop'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,S.darken(this.theme.shopDark,20),.86,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.shop,1,d);rect(c,y+half-8,S.TRACK_W,12,this.theme.shopDark,1,d+1);
    }
    if(r.type==='goal')r.objects.push(this.createRestaurant(S.PLAY_X+S.PLAY_W/2,y-5,d+8));
  };

  proto.buildTraffic=function(r){
    const dir=this.rng()>.5?1:-1,speed=(88+this.selectedLevel*4+Math.floor(this.rng()*46))*dir,maxW=S.clamp(S.CELL_W*1.65,58,100),minGap=S.clamp(S.CELL_W*.82,42,76),pad=maxW+48,cycleLength=S.TRACK_W+pad*2,cycleStart=S.TRACK_X-pad;
    const desired=S.clamp(Math.floor(S.W/320)+2,2,7),maxCount=Math.max(2,Math.floor(cycleLength/(maxW+minGap))),count=Math.min(desired,maxCount),spacing=cycleLength/count,phase=this.rng()*spacing;
    for(let i=0;i<count;i++){
      const truck=this.rng()>.5,w=truck?maxW:S.clamp(S.CELL_W*1.2,44,74),h=S.clamp(S.ROW_H*(truck?.47:.42),24,36),x=cycleStart+phase+i*spacing,v=this.createVehicle(x,r.y-2,w,h,truck,dir);
      v.__traffic={vx:speed,pad,width:w,left:S.TRACK_X,right:S.TRACK_X+S.TRACK_W,cycleStart,cycleLength};r.vehicles.push(v);this.vehicles.push(v);this.track(v);
    }
  };

  proto.createVehicle=function(x,y,w,h,truck,dir){
    const c=this.add.container(x,y).setDepth(45),g=this.add.graphics(),colors=truck?[P.lime,P.orange,0x6a9fc5,0xe26956,0x8c7eb0]:[0x8dbd53,P.redOrange,0x77a8c7,0xe7b34e,0x8c7caf],base=colors[Math.floor(this.rng()*colors.length)],front=dir>0?1:-1;c.add(g);
    g.fillStyle(P.shadow,.26);g.fillRect(-w*.5+8,-h*.5+11,w,h);
    const chassisW=w*.9;this.drawBox(g,0,7,chassisW,h*.45,Math.max(3,S.VOXEL_DEPTH-1),base,{shadow:false,top:S.lighten(base,4)});
    const highW=w*(truck?.54:.46),highH=h*(truck?.73:.66),highX=-front*w*(truck?.14:.12);
    this.drawBox(g,highX,-h*.09,highW,highH,Math.max(4,S.VOXEL_DEPTH),P.cabin,{shadow:false,top:P.cabin,front:0xdbe2ef,right:0xa8adc7});
    const noseW=w*(truck?.25:.27),noseX=front*(w*.5-noseW*.58),noseH=h*.34;
    this.drawBox(g,noseX,9,noseW,noseH,Math.max(3,S.VOXEL_DEPTH-2),S.lighten(base,5),{shadow:false,top:S.lighten(base,9),front:S.darken(base,10),right:S.darken(base,22)});
    g.fillStyle(P.black,1);const winW=Math.max(7,highW*.22),winH=Math.max(6,h*.18),winBase=highX+front*2;g.fillRect(winBase-winW-2,-h*.34,winW,winH);g.fillRect(winBase+2,-h*.34,winW,winH);
    for(const wx of[-w*.25,w*.25]){g.fillStyle(P.black,1);g.fillRect(wx-7,h*.43,14,9);g.fillStyle(0xa7b6dd,1);g.fillRect(wx-2,h*.46,5,4)}
    g.fillStyle(P.yellow,1);g.fillRect(front*(w*.5-4)-2,7,4,5);g.fillStyle(0xe43d35,1);g.fillRect(-front*(w*.5-4)-2,7,4,5);return c;
  };

  proto.buildFloaters=function(r){
    const waterPhase=r.index%8;
    if(waterPhase===5){
      const padCount=Math.max(S.RIVER_MIN_SUPPORTS,S.W>=900?3:2),cols=[];
      for(let i=0;i<padCount;i++){
        let col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2)),guard=0;
        while((cols.includes(col)||cols.some(c=>Math.abs(c-col)<2))&&guard++<80)col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2));
        cols.push(col);const w=S.clamp(S.CELL_W*1.08,42,86),f=this.createFloater(this.colX(col),r.y-2,w,'lily');f.__float={vx:0,pad:0,width:w,kind:'lily',left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,stationary:true};r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
      r.stationaryPadCols=cols;return;
    }

    const dir=this.rng()>.5?1:-1,speed=(34+this.selectedLevel*1.5+Math.floor(this.rng()*18))*dir;
    const minCount=S.RIVER_MIN_SUPPORTS, count=Math.max(minCount+2,S.W>=900?6:4),maxW=S.clamp(S.CELL_W*3.05,120,240),pad=maxW*.55+12;
    const cycleLength=S.PLAY_W+pad*2,cycleStart=S.PLAY_X-pad,spacing=cycleLength/count,phase=this.rng()*spacing;
    for(let i=0;i<count;i++){
      const boat=(i+this.selectedLevel+r.index)%3===0;
      const cells=boat?3:(this.rng()>.55?3:2),w=Math.min(maxW,cells*S.CELL_W-6),x=cycleStart+phase+i*spacing,kind=boat?'boat':'log',f=this.createFloater(x,r.y-2,w,kind);
      f.__float={vx:speed,pad,width:w,kind,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength,stationary:false};r.floaters.push(f);this.floaters.push(f);this.track(f);
    }
  };

  proto.createFloater=function(x,y,w,kind){
    const depth=kind==='lily'?41:37,c=this.add.container(x,y).setDepth(depth),g=this.add.graphics();c.add(g);
    if(kind==='log'){
      this.drawBox(g,0,0,w,S.ROW_H*.31,Math.max(4,S.VOXEL_DEPTH-1),P.log,{shadowAlpha:.2,top:P.log,front:P.logDark,right:S.darken(P.logDark,18)});g.fillStyle(S.lighten(P.log,7),.5);for(let m=-w*.38;m<w*.4;m+=24)g.fillRect(m,-4,13,3);
    }else if(kind==='boat'){
      const hull=0x3c7596;g.fillStyle(P.shadow,.2);g.fillEllipse(8,12,w*.9,S.ROW_H*.32);this.drawBox(g,0,5,w*.9,S.ROW_H*.26,Math.max(4,S.VOXEL_DEPTH-1),hull,{shadow:false,top:S.lighten(hull,10),front:S.darken(hull,18),right:S.darken(hull,30)});
      const cabinW=w*.34,cabinX=-w*.16;this.drawBox(g,cabinX,-7,cabinW,S.ROW_H*.28,4,P.cabin,{shadow:false,front:0xd7e5e7,right:0xa4b7c1});g.fillStyle(P.black,1);g.fillRect(cabinX-cabinW*.22,-12,cabinW*.18,7);g.fillRect(cabinX+2,-12,cabinW*.18,7);g.fillStyle(0xe7644c,1);g.fillRect(w*.22,-3,w*.14,5);
    }else{
      g.fillStyle(P.shadow,.18);g.fillEllipse(8,9,w*.92,S.ROW_H*.4);g.fillStyle(S.darken(P.grassMid,22),1);g.fillEllipse(4,5,w,S.ROW_H*.43);g.fillStyle(P.grass,1);g.fillEllipse(0,0,w,S.ROW_H*.43);g.fillStyle(S.lighten(P.grass,18),.5);g.fillEllipse(-w*.14,-4,w*.35,S.ROW_H*.13);
    }
    return c;
  };

  proto.placePickups=function(shops){
    const ordered=shops.slice().sort((a,b)=>a.index-b.index);if(!ordered.length)return;
    this.menuList.forEach((item,i)=>{
      const r=ordered[i];if(!r)return;const minCol=1,maxCol=Math.max(minCol,S.COLS-2),col=minCol+Math.floor(this.rng()*Math.max(1,maxCol-minCol+1));
      const zoneW=S.clamp(S.CELL_W*4.05,S.CELL_W*3.15,Math.min(S.PLAY_W*.48,S.CELL_W*5.1)),p=this.createPickup(this.colX(col),r.y-6,item,zoneW);
      p.__pickup={row:r.index,col,item,collected:false,missed:false,zoneW};r.pickups.push(p.__pickup);this.pickups.push(p);this.track(p);
    });
  };

  proto.createPickup=function(x,y,item,zoneW){
    const c=this.add.container(x,y).setDepth(70),zh=S.ROW_H*.9,zone=this.add.rectangle(0,2,zoneW,zh,item.color,.08).setStrokeStyle(2,item.color,.48),missZone=this.add.rectangle(0,2,zoneW,zh,P.redOrange,.22).setStrokeStyle(3,P.redOrange,.92).setVisible(false),g=this.add.graphics();c.add([zone,missZone,g]);
    const shop=S.SHOP_TYPES[item.shop]||{en:item.shop,jp:'市場'},stallW=zoneW*.88,stallH=S.ROW_H*.55;
    this.drawBox(g,0,5,stallW,stallH,Math.max(5,S.VOXEL_DEPTH),S.lighten(this.theme.shop,5),{shadowAlpha:.2,front:this.theme.shopDark,right:S.darken(this.theme.shopDark,18)});
    this.drawBox(g,0,-16,stallW*1.03,S.ROW_H*.18,Math.max(4,S.VOXEL_DEPTH-1),item.color,{shadow:false,top:S.lighten(item.color,12),front:S.darken(item.color,10),right:S.darken(item.color,22)});
    const awningY=-4,segW=stallW/6;for(let i=0;i<6;i++){g.fillStyle(i%2?P.cream:item.color,1);g.fillRect(-stallW/2+i*segW,awningY,segW+1,7)}
    const counterW=stallW*.7;this.drawBox(g,0,16,counterW,S.ROW_H*.13,3,this.theme.shopDark,{shadow:false});
    const iconSize=S.clamp(S.CELL_W*.5,22,34);this.drawBox(g,0,5,iconSize,iconSize*.72,Math.max(3,S.VOXEL_DEPTH-2),item.color,{shadow:false});g.fillStyle(P.yellow,1);g.fillRect(-4,1,8,8);
    const storeLabel=this.add.text(0,-zh*.39,`${shop.en}\n${shop.jp}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'9px',fontStyle:'900',align:'center',color:'#fff7ec',backgroundColor:'#513a32',padding:{x:7,y:4}}).setOrigin(.5,.5);
    const itemLabel=this.add.text(0,zh*.3,`${item.label} · ${item.jp}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'9px',fontStyle:'900',color:'#17212a',backgroundColor:'#fff7ec',padding:{x:5,y:2}}).setOrigin(.5,0);
    const miss=this.add.text(0,-zh*.1,'MISSED',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px',fontStyle:'900',color:'#fff',backgroundColor:'#ea4225',padding:{x:8,y:4}}).setOrigin(.5).setVisible(false);
    c.add([storeLabel,itemLabel,miss]);c.__missedZone=missZone;c.__missedLabel=miss;return c;
  };

  proto.spawnPlayer=function(){
    this.playerRow=0;this.playerCol=S.START_COL;const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics();
    shadow.fillStyle(P.shadow,.3);shadow.fillEllipse(13,21,S.clamp(S.CELL_W*1.45,58,92),S.clamp(S.ROW_H*.24,14,22));c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;
    if(chef&&this.textures.exists(runKey)){
      const img=this.add.image(0,20,runKey),targetW=S.clamp(S.CELL_W*2.2,96,132),scale=targetW/img.width;img.setOrigin(.5,1).setScale(scale);art.add(img);
    }else{
      const g=this.add.graphics(),s=S.clamp(S.CELL_W*1.15,52,72);art.add(g);this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false,front:0xe1e5ee,right:0xb8b7ce});this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false,front:0xe3ac89,right:0xc88d72});this.drawBox(g,0,-34,s*.72,s*.3,5,P.cabin,{shadow:false,front:0xdedfed,right:0xaaa8c2});
    }
    c.add(art);this.player=this.track(c);this.playerArt=art;this.playerShadow=shadow;this.playerSupport=null;this.playerSupportOffsetX=0;
  };

  proto.createRestaurant=function(x,y,d){const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(),w=Math.min(S.PLAY_W*.58,320);c.add(g);this.drawBox(g,0,3,w,S.ROW_H*.58,8,0xd8875d,{shadowAlpha:.24});this.drawBox(g,0,-18,w*1.08,16,6,0xa84c41,{shadow:false});this.drawBox(g,0,6,46,34,5,0x5a3734,{shadow:false});c.add(this.add.text(0,-35,'OMAKASE おまかせ',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#fff7ec',backgroundColor:'#663d39',padding:{x:7,y:3}}).setOrigin(.5));return c};
  proto.createFishSprite=function(x,y){const c=this.add.container(x,y).setDepth(100),g=this.add.graphics();c.add(g);this.drawBox(g,0,0,72,38,7,0xf09b65,{shadowAlpha:.22});this.drawBox(g,-12,4,42,18,4,0xffd0aa,{shadow:false});g.fillStyle(P.black,1);g.fillRect(-23,-8,5,5);g.fillStyle(0xd45a43,1);g.fillRect(-30,5,17,6);g.fillStyle(S.darken(0xf09b65,22),1);g.fillTriangle(38,-16,38,17,60,1);return c};
})();
