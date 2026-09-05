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
    g.fillGradientStyle(this.theme.skyTop,this.theme.skyTop,this.theme.skyBottom,this.theme.skyBottom,1);
    g.fillRect(0,0,S.W,S.H);
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
      if(above?.type!=='road')rect(c,y-half+3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);
      this.buildTraffic(r);
    }
    if(r.type==='water'){
      rect(c,y+6,S.TRACK_W,S.ROW_H,this.theme.waterDeep,.92,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.water,1,d);
      if(below?.type!=='water')rect(c,y+half-3,S.TRACK_W,6,this.theme.waterDeep,.9,d+1);
      if(above?.type!=='water')rect(c,y-half+3,S.TRACK_W,6,S.lighten(this.theme.water,15),.7,d+1);
      const rippleCount=Math.max(10,Math.floor(S.TRACK_W/90));
      for(let i=0;i<rippleCount;i++){
        const rx=S.TRACK_X+(i+.5)*S.TRACK_W/rippleCount;
        rect(rx,y+Phaser.Math.Between(-13,13),S.clamp(S.CELL_W*.62,24,42),3,S.lighten(this.theme.water,24),.35,d+2);
        rect(rx+Phaser.Math.Between(-8,8),y+Phaser.Math.Between(-12,12),S.clamp(S.CELL_W*.4,16,30),2,0xffffff,.13,d+3);
      }
      this.buildFloaters(r);
    }
    if(r.type==='shop'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,S.darken(this.theme.shopDark,20),.85,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.shop,1,d);
      rect(c,y+half-8,S.TRACK_W,12,this.theme.shopDark,1,d+1);
      const stallCount=Math.max(3,Math.min(5,Math.floor(S.COLS/2)));
      for(let i=0;i<stallCount;i++){
        const sx=S.PLAY_X+S.PLAY_W*(i+1)/(stallCount+1),aw=Math.min(74,S.CELL_W*1.35),sh=S.ROW_H*.24;
        rect(sx,y-12,aw,sh,this.theme.shopDark,1,d+2);rect(sx,y-18,aw,sh*.55,S.lighten(this.theme.shop,11),1,d+3);
      }
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
    const c=this.add.container(x,y).setDepth(45),g=this.add.graphics(),colors=truck?[P.lime,P.orange,0x6a9fc5,0xe26956,0x8c7eb0]:[0x8dbd53,P.redOrange,0x77a8c7,0xe7b34e,0x8c7caf],base=colors[Math.floor(this.rng()*colors.length)],front=dir>0?1:-1;
    c.add(g);
    g.fillStyle(P.shadow,.26);g.fillRect(-w*.5+8,-h*.5+11,w,h);
    const bodyW=w*(truck?.86:.8);
    this.drawBox(g,0,5,bodyW,h*.56,Math.max(3,S.VOXEL_DEPTH-1),base,{shadow:false,top:S.lighten(base,4)});
    const rearCabW=w*(truck?.48:.42),rearCabH=h*(truck?.66:.62),rearCabX=-front*w*(truck?.13:.11);
    this.drawBox(g,rearCabX,-h*.12,rearCabW,rearCabH,Math.max(4,S.VOXEL_DEPTH),P.cabin,{shadow:false,top:P.cabin,front:0xdbe2ef,right:0xa8adc7});
    const noseW=w*(truck?.18:.2),noseH=h*.34,noseX=front*(bodyW*.5-noseW*.5-1);
    this.drawBox(g,noseX,8,noseW,noseH,Math.max(3,S.VOXEL_DEPTH-2),S.lighten(base,6),{shadow:false,top:S.lighten(base,10),front:S.darken(base,10),right:S.darken(base,22)});
    g.fillStyle(P.black,1);
    const winW=Math.max(7,rearCabW*.22),winH=Math.max(6,h*.18),winBase=rearCabX+front*2;
    g.fillRect(winBase-winW-2,-h*.34,winW,winH);g.fillRect(winBase+2,-h*.34,winW,winH);
    for(const wx of[-w*.24,w*.24]){g.fillStyle(P.black,1);g.fillRect(wx-7,h*.43,14,9);g.fillStyle(0xa7b6dd,1);g.fillRect(wx-2,h*.46,5,4)}
    g.fillStyle(P.yellow,1);g.fillRect(front*(w*.5-5)-2,6,4,5);
    g.fillStyle(0xe43d35,1);g.fillRect(-front*(w*.5-5)-2,6,4,5);
    return c;
  };

  proto.buildFloaters=function(r){
    const waterPhase=r.index%8;
    if(waterPhase===5){
      const padCount=S.clamp(Math.round(S.W/760)+1,2,3),cols=[];
      for(let i=0;i<padCount;i++){
        let col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2)),guard=0;
        while((cols.includes(col)||cols.some(c=>Math.abs(c-col)<2))&&guard++<60)col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2));
        cols.push(col);
        const w=S.clamp(S.CELL_W*1.02,38,82),f=this.createFloater(this.colX(col),r.y-2,w,'lily');
        f.__float={vx:0,pad:0,width:w,kind:'lily',left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,stationary:true};
        r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
      r.stationaryPadCols=cols;
      return;
    }

    const dir=this.rng()>.5?1:-1,speed=(38+this.selectedLevel*1.7+Math.floor(this.rng()*20))*dir;
    const logCount=S.clamp(Math.floor(S.W/460)+2,2,5),maxW=S.clamp(S.CELL_W*2.6,100,210),pad=maxW+55,cycleLength=S.TRACK_W+pad*2,cycleStart=S.TRACK_X-pad,spacing=cycleLength/logCount,phase=this.rng()*spacing;
    for(let i=0;i<logCount;i++){
      const cells=this.rng()>.55?3:2,w=Math.min(maxW,cells*S.CELL_W-7),x=cycleStart+phase+i*spacing,f=this.createFloater(x,r.y-2,w,'log');
      f.__float={vx:speed,pad,width:w,kind:'log',left:S.TRACK_X,right:S.TRACK_X+S.TRACK_W,cycleStart,cycleLength,stationary:false};
      r.floaters.push(f);this.floaters.push(f);this.track(f);
    }
  };

  proto.createFloater=function(x,y,w,kind){
    const depth=kind==='lily'?41:37;
    const c=this.add.container(x,y).setDepth(depth),g=this.add.graphics();c.add(g);
    if(kind==='log'){
      this.drawBox(g,0,0,w,S.ROW_H*.31,Math.max(4,S.VOXEL_DEPTH-1),P.log,{shadowAlpha:.2,top:P.log,front:P.logDark,right:S.darken(P.logDark,18)});
      g.fillStyle(S.lighten(P.log,7),.5);for(let m=-w*.38;m<w*.4;m+=24)g.fillRect(m,-4,13,3);
    }else{
      g.fillStyle(P.shadow,.18);g.fillEllipse(8,9,w*.92,S.ROW_H*.4);g.fillStyle(S.darken(P.grassMid,22),1);g.fillEllipse(4,5,w,S.ROW_H*.43);g.fillStyle(P.grass,1);g.fillEllipse(0,0,w,S.ROW_H*.43);g.fillStyle(S.lighten(P.grass,18),.5);g.fillEllipse(-w*.14,-4,w*.35,S.ROW_H*.13);
    }
    return c;
  };

  proto.placePickups=function(shops){
    const ordered=shops.slice().sort((a,b)=>a.index-b.index);if(!ordered.length)return;
    this.menuList.forEach((item,i)=>{
      const r=ordered[i];if(!r)return;
      const minCol=1,maxCol=Math.max(minCol,S.COLS-2);
      const col=minCol+Math.floor(this.rng()*Math.max(1,maxCol-minCol+1));
      const zoneW=S.clamp(S.CELL_W*2.95,S.CELL_W*2.2,Math.min(S.PLAY_W*.38,S.CELL_W*3.8));
      const p=this.createPickup(this.colX(col),r.y-5,item,zoneW);
      p.__pickup={row:r.index,col,item,collected:false,missed:false,zoneW};r.pickups.push(p.__pickup);this.pickups.push(p);this.track(p);
    });
  };

  proto.createPickup=function(x,y,item,zoneW){
    const c=this.add.container(x,y).setDepth(70),zh=S.ROW_H*.74,zone=this.add.rectangle(0,2,zoneW,zh,item.color,.11).setStrokeStyle(2,item.color,.58),missZone=this.add.rectangle(0,2,zoneW,zh,P.redOrange,.24).setStrokeStyle(3,P.redOrange,.95).setVisible(false),g=this.add.graphics();
    c.add([zone,missZone,g]);
    const stallW=zoneW*.76,stallH=S.ROW_H*.42;
    this.drawBox(g,0,6,stallW,stallH,Math.max(4,S.VOXEL_DEPTH),S.lighten(this.theme.shop,6),{shadowAlpha:.18,front:this.theme.shopDark,right:S.darken(this.theme.shopDark,18)});
    this.drawBox(g,0,-6,stallW*1.04,stallH*.24,Math.max(3,S.VOXEL_DEPTH-1),item.color,{shadow:false,top:S.lighten(item.color,10),front:S.darken(item.color,8),right:S.darken(item.color,20)});
    const tableW=stallW*.72,tableH=S.ROW_H*.14;this.drawBox(g,0,15,tableW,tableH,3,this.theme.shopDark,{shadow:false,top:S.lighten(this.theme.shopDark,5),front:S.darken(this.theme.shopDark,12),right:S.darken(this.theme.shopDark,24)});
    const iconSize=S.clamp(S.CELL_W*.44,18,30);this.drawBox(g,0,4,iconSize,iconSize*.78,Math.max(3,S.VOXEL_DEPTH-2),item.color,{shadow:false,top:S.lighten(item.color,7)});g.fillStyle(P.yellow,1);g.fillRect(-4,0,8,8);
    const label=this.add.text(0,zh*.26,`${item.label} · ${item.jp}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'8px',fontStyle:'900',color:'#17212a',backgroundColor:'#fff7ec',padding:{x:4,y:2}}).setOrigin(.5,0);
    const miss=this.add.text(0,-zh*.22,'MISSED',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px',fontStyle:'900',color:'#fff',backgroundColor:'#ea4225',padding:{x:8,y:4}}).setOrigin(.5).setVisible(false);
    c.add([label,miss]);c.__missedZone=missZone;c.__missedLabel=miss;return c;
  };

  proto.spawnPlayer=function(){
    this.playerRow=0;this.playerCol=S.START_COL;
    const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics();
    shadow.fillStyle(P.shadow,.3);shadow.fillEllipse(10,20,S.clamp(S.CELL_W*.7,26,44),14);c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;
    if(chef&&this.textures.exists(runKey)){
      const img=this.add.image(0,-6,runKey);const targetW=S.clamp(S.CELL_W*.68,28,40),scale=targetW/img.width;img.setScale(scale);art.add(img);
    }else{
      const g=this.add.graphics(),s=S.clamp(S.CELL_W*.62,24,38);art.add(g);
      this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false,front:0xe1e5ee,right:0xb8b7ce});this.drawBox(g,0,6,s*.32,s*.3,3,0xd75f54,{shadow:false});this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false,front:0xe3ac89,right:0xc88d72});this.drawBox(g,0,-28,s*.72,s*.28,5,P.cabin,{shadow:false,front:0xdedfed,right:0xaaa8c2});this.drawBox(g,0,-38,s*.6,s*.25,5,P.cabin,{shadow:false,front:0xe1e2ed,right:0xa9a7c1});g.fillStyle(P.black,1);g.fillRect(-s*.16,-16,3,3);g.fillRect(s*.09,-16,3,3);
    }
    c.add(art);this.player=this.track(c);this.playerArt=art;this.playerShadow=shadow;this.playerSupport=null;this.playerSupportOffsetX=0;
  };

  proto.createRestaurant=function(x,y,d){const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(),w=Math.min(S.PLAY_W*.58,320);c.add(g);this.drawBox(g,0,3,w,S.ROW_H*.58,8,0xd8875d,{shadowAlpha:.24});this.drawBox(g,0,-18,w*1.08,16,6,0xa84c41,{shadow:false});this.drawBox(g,0,6,46,34,5,0x5a3734,{shadow:false});c.add(this.add.text(0,-35,'OMAKASE おまかせ',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#fff7ec',backgroundColor:'#663d39',padding:{x:7,y:3}}).setOrigin(.5));return c};
  proto.createFishSprite=function(x,y){const c=this.add.container(x,y).setDepth(100),g=this.add.graphics();c.add(g);this.drawBox(g,0,0,72,38,7,0xf09b65,{shadowAlpha:.22});this.drawBox(g,-12,4,42,18,4,0xffd0aa,{shadow:false});g.fillStyle(P.black,1);g.fillRect(-23,-8,5,5);g.fillStyle(0xd45a43,1);g.fillRect(-30,5,17,6);g.fillStyle(S.darken(0xf09b65,22),1);g.fillTriangle(38,-16,38,17,60,1);return c};
})();
