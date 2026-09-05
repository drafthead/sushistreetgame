(() => {
  const S=window.SS,P=S.PALETTE,proto=window.SushiScene.prototype;

  proto.drawBox=function(g,cx,cy,w,h,d,color,opt={}){
    d=Math.max(2,d||S.VOXEL_DEPTH);const top=opt.top??S.lighten(color,7),front=opt.front??S.darken(color,18),right=opt.right??S.darken(color,30);
    if(opt.shadow!==false){g.fillStyle(P.shadow,opt.shadowAlpha??.24);g.fillRect(cx-w/2+(opt.sx??d+4),cy-h/2+(opt.sy??d+6),w,h)}
    g.fillStyle(front,1);g.fillPoints([{x:cx-w/2,y:cy+h/2},{x:cx+w/2,y:cy+h/2},{x:cx+w/2+d,y:cy+h/2+d},{x:cx-w/2+d,y:cy+h/2+d}],true);
    g.fillStyle(right,1);g.fillPoints([{x:cx+w/2,y:cy-h/2},{x:cx+w/2,y:cy+h/2},{x:cx+w/2+d,y:cy+h/2+d},{x:cx+w/2+d,y:cy-h/2+d}],true);
    g.fillStyle(top,1);g.fillRect(cx-w/2,cy-h/2,w,h);
  };

  proto.buildSky=function(){const g=this.trackSky(this.add.graphics().setScrollFactor(0).setDepth(-200));g.fillGradientStyle(this.theme.skyTop,this.theme.skyTop,this.theme.skyBottom,this.theme.skyBottom,1);g.fillRect(0,0,S.W,S.H);if(this.theme.stars)for(let i=0;i<36;i++)this.trackSky(this.add.circle(Phaser.Math.Between(5,S.W-5),Phaser.Math.Between(8,Math.max(9,S.H*.42)),Phaser.Math.RND.pick([1,1,2]),0xffffff,Phaser.Math.FloatBetween(.3,.75)).setScrollFactor(0).setDepth(-185))};
  proto.drawDivider=function(y,depth){const seg=S.clamp(S.CELL_W*.62,22,43),gap=seg*.75;for(let x=S.TRACK_X+14;x<S.TRACK_X+S.TRACK_W-10;x+=seg+gap)this.track(this.add.rectangle(x+seg/2,y,seg,4,this.theme.laneStripe,.78).setDepth(depth))};

  proto.renderRow=function(r){
    const y=r.y,d=2+r.index*2,c=S.TRACK_X+S.TRACK_W/2,half=S.ROW_H/2,below=this.rows[r.index-1],above=this.rows[r.index+1];
    const rect=(x,yy,w,h,color,a=1,z=d)=>{const o=this.track(this.add.rectangle(x,yy,w,h,color,a).setDepth(z));r.objects.push(o);return o};
    if(['start','safe','goal'].includes(r.type)){
      rect(c,y+4,S.TRACK_W,S.ROW_H,this.theme.grassDark,.85,d-1);rect(c,y,S.TRACK_W,S.ROW_H-5,this.theme.grass,1,d);
      for(let col=0;col<S.COLS;col++)rect(this.colX(col),y-2,S.CELL_W-1,S.ROW_H-8,(col+r.index)%2?this.theme.grass:this.theme.grassAlt,1,d+1);
      if(r.type==='safe')this.renderLandObstacles(r,d+5);
    }
    if(r.type==='road'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,this.theme.roadShadow,.9,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.road,1,d);
      if(below?.type==='road')this.drawDivider(y+half-1,d+2);else rect(c,y+half-3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);if(above?.type!=='road')rect(c,y-half+3,S.TRACK_W,6,this.theme.roadShadow,1,d+1);this.buildTraffic(r);
    }
    if(r.type==='water'){
      rect(c,y+6,S.TRACK_W,S.ROW_H,this.theme.waterDeep,.94,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.water,1,d);
      if(below?.type!=='water')rect(c,y+half-3,S.TRACK_W,6,this.theme.waterDeep,.95,d+1);if(above?.type!=='water')rect(c,y-half+3,S.TRACK_W,6,S.lighten(this.theme.water,15),.72,d+1);
      const rippleCount=Math.max(12,Math.floor(S.TRACK_W/72));for(let i=0;i<rippleCount;i++){const rx=S.TRACK_X+(i+.5)*S.TRACK_W/rippleCount,ry=y+Phaser.Math.Between(-15,15);rect(rx,ry,S.clamp(S.CELL_W*.66,25,46),3,S.lighten(this.theme.water,26),.38,d+2);rect(rx+Phaser.Math.Between(-8,8),ry+5,S.clamp(S.CELL_W*.28,12,22),2,0xffffff,.17,d+3)}this.buildFloaters(r);
    }
    if(r.type==='shop'){
      rect(c,y+5,S.TRACK_W,S.ROW_H,S.darken(this.theme.shopDark,20),.86,d-1);rect(c,y,S.TRACK_W,S.ROW_H-4,this.theme.shop,1,d);rect(c,y+half-8,S.TRACK_W,12,this.theme.shopDark,.9,d+1);
    }
    if(r.type==='train')this.renderTrainTrack(r,d);
    if(r.type==='goal')r.objects.push(this.createRestaurant(S.PLAY_X+S.PLAY_W/2,y-5,d+8));
  };

  proto.renderLandObstacles=function(r,depth){for(const o of r.obstacles||[]){const x=this.colX(o.col)+(o.span-1)*S.CELL_W*.5;if(o.kind==='building')this.createBlockBuilding(x,r.y-5,o.span*S.CELL_W*.86,depth);else this.createTree(x,r.y-4,depth)}};
  proto.createTree=function(x,y,d){const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics();c.add(g);this.drawBox(g,0,9,S.CELL_W*.22,S.ROW_H*.52,4,0x704532,{shadowAlpha:.18});this.drawBox(g,0,-7,S.CELL_W*.58,S.ROW_H*.48,6,P.grassMid,{shadowAlpha:.2,top:P.grass,front:P.grassDark,right:S.darken(P.grassDark,18)});this.drawBox(g,2,-25,S.CELL_W*.46,S.ROW_H*.32,5,P.lime,{shadow:false,top:S.lighten(P.lime,5),front:P.grassMid,right:P.grassDark});return c};
  proto.createBlockBuilding=function(x,y,w,d){const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(),h=S.ROW_H*.78,base=[0xe57456,0x75a8c4,0xc8a35c,0x9b83b8][Math.floor(this.rng()*4)];c.add(g);this.drawBox(g,0,-5,w,h,8,base,{shadowAlpha:.23});this.drawBox(g,0,-h*.58,w*.76,h*.28,5,S.lighten(base,10),{shadow:false});g.fillStyle(P.black,1);for(let wx=-w*.28;wx<=w*.28;wx+=w*.28)g.fillRect(wx-5,-h*.14,10,9);return c};

  proto.buildTraffic=function(r){
    const dir=this.rng()>.5?1:-1,speed=(88+this.selectedLevel*4+Math.floor(this.rng()*46))*dir,maxW=S.clamp(S.CELL_W*1.65,58,100),minGap=S.clamp(S.CELL_W*.82,42,76),pad=maxW+48,cycleLength=S.TRACK_W+pad*2,cycleStart=S.TRACK_X-pad;
    const desired=S.clamp(Math.floor(S.W/320)+2,2,7),maxCount=Math.max(2,Math.floor(cycleLength/(maxW+minGap))),count=Math.min(desired,maxCount),spacing=cycleLength/count,phase=this.rng()*spacing;
    for(let i=0;i<count;i++){
      const roll=this.rng(),kind=roll<.23?'moped':roll<.58?'car':'truck',w=kind==='moped'?S.clamp(S.CELL_W*.68,30,46):(kind==='truck'?maxW:S.clamp(S.CELL_W*1.2,44,74)),h=kind==='moped'?S.clamp(S.ROW_H*.31,18,24):S.clamp(S.ROW_H*(kind==='truck'?.47:.42),24,36),x=cycleStart+phase+i*spacing;
      const v=kind==='moped'?this.createMoped(x,r.y-2,w,h,dir):this.createVehicle(x,r.y-2,w,h,kind==='truck',dir);v.__traffic={vx:speed,pad,width:w,kind,left:S.TRACK_X,right:S.TRACK_X+S.TRACK_W,cycleStart,cycleLength};r.vehicles.push(v);this.vehicles.push(v);this.track(v);
    }
  };

  proto.createVehicle=function(x,y,w,h,truck,dir){
    const c=this.add.container(x,y).setDepth(45),g=this.add.graphics(),colors=truck?[P.lime,P.orange,0x6a9fc5,0xe26956,0x8c7eb0]:[0x8dbd53,P.redOrange,0x77a8c7,0xe7b34e,0x8c7caf],base=colors[Math.floor(this.rng()*colors.length)],front=dir>0?1:-1;c.add(g);
    g.fillStyle(P.shadow,.26);g.fillRect(-w*.5+8,-h*.5+11,w,h);const chassisW=w*.9;this.drawBox(g,0,7,chassisW,h*.45,Math.max(3,S.VOXEL_DEPTH-1),base,{shadow:false,top:S.lighten(base,4)});
    const highW=w*(truck?.54:.46),highH=h*(truck?.73:.66),highX=-front*w*(truck?.14:.12);this.drawBox(g,highX,-h*.09,highW,highH,Math.max(4,S.VOXEL_DEPTH),P.cabin,{shadow:false,top:P.cabin,front:0xdbe2ef,right:0xa8adc7});
    const noseW=w*(truck?.25:.27),noseX=front*(w*.5-noseW*.58),noseH=h*.34;this.drawBox(g,noseX,9,noseW,noseH,Math.max(3,S.VOXEL_DEPTH-2),S.lighten(base,5),{shadow:false,top:S.lighten(base,9),front:S.darken(base,10),right:S.darken(base,22)});
    g.fillStyle(P.black,1);const winW=Math.max(7,highW*.22),winH=Math.max(6,h*.18),winBase=highX+front*2;g.fillRect(winBase-winW-2,-h*.34,winW,winH);g.fillRect(winBase+2,-h*.34,winW,winH);for(const wx of[-w*.25,w*.25]){g.fillStyle(P.black,1);g.fillRect(wx-7,h*.43,14,9);g.fillStyle(0xa7b6dd,1);g.fillRect(wx-2,h*.46,5,4)}g.fillStyle(P.yellow,1);g.fillRect(front*(w*.5-4)-2,7,4,5);g.fillStyle(0xe43d35,1);g.fillRect(-front*(w*.5-4)-2,7,4,5);return c;
  };

  proto.createMoped=function(x,y,w,h,dir){const c=this.add.container(x,y).setDepth(46),g=this.add.graphics(),front=dir>0?1:-1,body=[P.redOrange,P.lime,0x66a7c6,0xf0ad47][Math.floor(this.rng()*4)];c.add(g);g.fillStyle(P.shadow,.22);g.fillEllipse(7,11,w*.9,10);g.fillStyle(P.black,1);g.fillCircle(-front*w*.27,7,6);g.fillCircle(front*w*.27,7,6);this.drawBox(g,0,3,w*.58,h*.42,3,body,{shadow:false});g.fillStyle(0x2b3340,1);g.fillRect(front*w*.19,-6,3,13);g.fillStyle(P.cabin,1);g.fillCircle(-front*w*.05,-12,7);g.fillStyle(0x3b4c65,1);g.fillRect(-front*w*.1,-4,w*.2,10);g.fillStyle(P.yellow,1);g.fillRect(front*(w*.37)-2,-1,4,4);return c};

  proto.buildFloaters=function(r){
    const waterPhase=r.index%8;
    if(waterPhase===5){
      const padCount=Math.max(S.RIVER_MIN_SUPPORTS,S.W>=900?3:2),cols=[];
      for(let i=0;i<padCount;i++){let col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2)),guard=0;while((cols.includes(col)||cols.some(c=>Math.abs(c-col)<2))&&guard++<80)col=1+Math.floor(this.rng()*Math.max(1,S.COLS-2));cols.push(col);const w=S.clamp(S.CELL_W*1.08,42,86),f=this.createFloater(this.colX(col),r.y-2,w,'lily');f.__float={vx:0,pad:0,width:w,kind:'lily',left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,stationary:true};r.floaters.push(f);this.floaters.push(f);this.track(f)}r.stationaryPadCols=cols;return;
    }
    const dir=this.rng()>.5?1:-1,speed=(34+this.selectedLevel*1.5+Math.floor(this.rng()*18))*dir,maxW=S.clamp(S.CELL_W*3.05,120,240),pad=maxW*.55+12,cycleLength=S.PLAY_W+pad*2,cycleStart=S.PLAY_X-pad;
    const count=Math.max(S.RIVER_MIN_SUPPORTS+2,Math.ceil(S.PLAY_W/(maxW*.9))+2),spacing=cycleLength/count,phase=this.rng()*spacing;
    for(let i=0;i<count;i++){const boat=(i+this.selectedLevel+r.index)%3===0,cells=boat?3:(this.rng()>.55?3:2),w=Math.min(maxW,cells*S.CELL_W-6),x=cycleStart+phase+i*spacing,kind=boat?'boat':'log',f=this.createFloater(x,r.y-2,w,kind);f.__float={vx:speed,pad,width:w,kind,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength,stationary:false};r.floaters.push(f);this.floaters.push(f);this.track(f)}
  };

  proto.createFloater=function(x,y,w,kind){const depth=kind==='lily'?41:37,c=this.add.container(x,y).setDepth(depth),g=this.add.graphics();c.add(g);if(kind==='log'){this.drawBox(g,0,0,w,S.ROW_H*.31,Math.max(4,S.VOXEL_DEPTH-1),P.log,{shadowAlpha:.2,top:P.log,front:P.logDark,right:S.darken(P.logDark,18)});g.fillStyle(S.lighten(P.log,7),.5);for(let m=-w*.38;m<w*.4;m+=24)g.fillRect(m,-4,13,3)}else if(kind==='boat'){const hull=0x3c7596;g.fillStyle(P.shadow,.2);g.fillEllipse(8,12,w*.9,S.ROW_H*.32);this.drawBox(g,0,5,w*.9,S.ROW_H*.26,Math.max(4,S.VOXEL_DEPTH-1),hull,{shadow:false,top:S.lighten(hull,10),front:S.darken(hull,18),right:S.darken(hull,30)});const cabinW=w*.34,cabinX=-w*.16;this.drawBox(g,cabinX,-7,cabinW,S.ROW_H*.28,4,P.cabin,{shadow:false,front:0xd7e5e7,right:0xa4b7c1});g.fillStyle(P.black,1);g.fillRect(cabinX-cabinW*.22,-12,cabinW*.18,7);g.fillRect(cabinX+2,-12,cabinW*.18,7);g.fillStyle(0xe7644c,1);g.fillRect(w*.22,-3,w*.14,5)}else{g.fillStyle(P.shadow,.18);g.fillEllipse(8,9,w*.92,S.ROW_H*.4);g.fillStyle(S.darken(P.grassMid,22),1);g.fillEllipse(4,5,w,S.ROW_H*.43);g.fillStyle(P.grass,1);g.fillEllipse(0,0,w,S.ROW_H*.43);g.fillStyle(S.lighten(P.grass,18),.5);g.fillEllipse(-w*.14,-4,w*.35,S.ROW_H*.13)}return c};

  proto.placePickups=function(shops){
    for(const r of shops){const plan=r.ingredient,item=plan.item,minCol=1,maxCol=Math.max(minCol,S.COLS-5),col=minCol+Math.floor(this.rng()*Math.max(1,maxCol-minCol+1)),zoneW=S.clamp(S.CELL_W*4.4,S.CELL_W*3.4,Math.min(S.PLAY_W*.52,S.CELL_W*5.4)),p=this.createPickup(this.colX(col)+S.CELL_W*1.5,r.y,item,zoneW,plan);p.__pickup={row:r.index,rowStart:plan.rowStart,rowEnd:plan.rowEnd,col,item,collected:false,missed:false,zoneW};r.pickups.push(p.__pickup);this.pickups.push(p);this.track(p)}
  };

  proto.createPickup=function(x,y,item,zoneW,plan){
    const c=this.add.container(x,y).setDepth(70),zh=S.ROW_H*2.7,zone=this.add.rectangle(0,0,zoneW,zh,item.color,.075).setStrokeStyle(2,item.color,.48),missZone=this.add.rectangle(0,0,zoneW,zh,P.redOrange,.2).setStrokeStyle(3,P.redOrange,.92).setVisible(false),g=this.add.graphics();c.add([zone,missZone,g]);
    const shop=S.SHOP_TYPES[item.shop]||{en:item.shop,jp:'市場'},stallW=zoneW*.92,stallH=S.ROW_H*1.75;
    this.drawBox(g,0,-S.ROW_H*.12,stallW,stallH,Math.max(7,S.VOXEL_DEPTH+2),S.lighten(this.theme.shop,5),{shadowAlpha:.2,front:this.theme.shopDark,right:S.darken(this.theme.shopDark,18)});
    this.drawBox(g,0,-S.ROW_H*.9,stallW*1.03,S.ROW_H*.28,Math.max(4,S.VOXEL_DEPTH-1),item.color,{shadow:false,top:S.lighten(item.color,12),front:S.darken(item.color,10),right:S.darken(item.color,22)});
    const segW=stallW/7;for(let i=0;i<7;i++){g.fillStyle(i%2?P.cream:item.color,1);g.fillRect(-stallW/2+i*segW,-S.ROW_H*.68,segW+1,9)}
    const counterW=stallW*.74;this.drawBox(g,0,S.ROW_H*.46,counterW,S.ROW_H*.2,4,this.theme.shopDark,{shadow:false});
    const iconSize=S.clamp(S.CELL_W*.58,25,40);this.drawBox(g,0,S.ROW_H*.27,iconSize,iconSize*.72,Math.max(3,S.VOXEL_DEPTH-2),item.color,{shadow:false});g.fillStyle(P.yellow,1);g.fillRect(-5,S.ROW_H*.23,10,10);
    const storeLabel=this.add.text(0,-S.ROW_H*1.13,`${shop.en}\n${shop.jp}`,{align:'center',fontFamily:'Inter,system-ui,sans-serif',fontSize:'11px',fontStyle:'900',color:'#fff',backgroundColor:'#4b352e',padding:{x:8,y:4}}).setOrigin(.5);
    const itemLabel=this.add.text(0,S.ROW_H*.7,`${item.label} · ${item.jp}`,{fontFamily:'Inter,system-ui,sans-serif',fontSize:'9px',fontStyle:'900',color:'#17212a',backgroundColor:'#fff7ec',padding:{x:5,y:2}}).setOrigin(.5,0);
    const miss=this.add.text(0,-S.ROW_H*.15,'MISSED',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px',fontStyle:'900',color:'#fff',backgroundColor:'#ea4225',padding:{x:8,y:4}}).setOrigin(.5).setVisible(false);c.add([storeLabel,itemLabel,miss]);c.__missedZone=missZone;c.__missedLabel=miss;return c;
  };

  proto.renderTrainTrack=function(r,d){
    const c=S.TRACK_X+S.TRACK_W/2,y=r.y,rect=(x,yy,w,h,color,a=1,z=d)=>{const o=this.track(this.add.rectangle(x,yy,w,h,color,a).setDepth(z));r.objects.push(o);return o};
    rect(c,y,S.TRACK_W,S.ROW_H,P.railDark,1,d);for(let x=S.TRACK_X+16;x<S.TRACK_X+S.TRACK_W;x+=28)rect(x,y,12,S.ROW_H*.72,0x5d4a42,1,d+1);rect(c,y-S.ROW_H*.19,S.TRACK_W,5,P.rail,1,d+2);rect(c,y+S.ROW_H*.19,S.TRACK_W,5,P.rail,1,d+2);
    const makeSignal=x=>{const pole=this.track(this.add.rectangle(x,y-8,6,36,0x313744).setDepth(d+4)),light=this.track(this.add.circle(x,y-28,9,0x5d2424).setDepth(d+5)),arm=this.track(this.add.rectangle(x,y-17,28,5,0xe7e9ee).setDepth(d+4));r.objects.push(pole,light,arm);return light};
    r.warningLights=[makeSignal(S.PLAY_X+24),makeSignal(S.PLAY_X+S.PLAY_W-24)];
  };

  proto.setTrainWarning=function(r,on,blink=true){if(!r?.warningLights)return;const red=blink?P.signalRed:0x8a2828;r.warningLights.forEach(l=>l.setFillStyle(on?red:0x5d2424,1))};
  proto.createTrain=function(r,dir){
    const totalW=S.clamp(S.W*.78,320,680),carCount=4,gap=8,carW=(totalW-gap*(carCount-1))/carCount,h=S.ROW_H*.62,c=this.add.container(0,r.y-3).setDepth(92);
    for(let i=0;i<carCount;i++){const cg=this.add.graphics(),offset=-totalW/2+carW/2+i*(carW+gap),base=i===0?0xd95845:(i%2?0x5f86a8:0xe3b555);this.drawBox(cg,offset,0,carW,h,7,base,{shadowAlpha:.28});cg.fillStyle(P.cabin,1);for(let wx=offset-carW*.28;wx<=offset+carW*.28;wx+=carW*.28)cg.fillRect(wx-7,-h*.23,14,9);c.add(cg)}
    const travel=S.TRACK_W+totalW+120,start=dir>0?S.TRACK_X-totalW/2-60:S.TRACK_X+S.TRACK_W+totalW/2+60;c.x=start;c.__train={row:r.index,dir,width:totalW,elapsed:0,duration:S.TRAIN_TRAVEL_MS,travel,start};this.track(c);this.trains.push(c);return c;
  };

  proto.spawnPlayer=function(){
    this.playerRow=0;this.playerCol=S.START_COL;const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics();
    shadow.fillStyle(P.shadow,.3);shadow.fillEllipse(8,19,S.clamp(S.CELL_W*.72,28,44),S.clamp(S.ROW_H*.17,10,14));c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;
    if(chef&&this.textures.exists(runKey)){const img=this.add.image(0,18,runKey),targetW=S.clamp(S.CELL_W*.88,38,54),scale=targetW/img.width;img.setOrigin(.5,1).setScale(scale);art.add(img)}
    else{const g=this.add.graphics(),s=S.clamp(S.CELL_W*.52,24,34);art.add(g);this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false});this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false});this.drawBox(g,0,-28,s*.72,s*.3,5,P.cabin,{shadow:false})}
    c.add(art);this.player=this.track(c);this.playerArt=art;this.playerShadow=shadow;this.playerSupport=null;this.playerSupportOffsetX=0;
  };

  proto.createRestaurant=function(x,y,d){const c=this.track(this.add.container(x,y).setDepth(d)),g=this.add.graphics(),w=Math.min(S.PLAY_W*.58,320);c.add(g);this.drawBox(g,0,3,w,S.ROW_H*.58,8,0xd8875d,{shadowAlpha:.24});this.drawBox(g,0,-18,w*1.08,16,6,0xa84c41,{shadow:false});this.drawBox(g,0,6,46,34,5,0x5a3734,{shadow:false});c.add(this.add.text(0,-35,'OMAKASE おまかせ',{fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#fff7ec',backgroundColor:'#663d39',padding:{x:7,y:3}}).setOrigin(.5));return c};
  proto.createFishSprite=function(x,y){const c=this.add.container(x,y).setDepth(100),g=this.add.graphics();c.add(g);this.drawBox(g,0,0,72,38,7,0xf09b65,{shadowAlpha:.22});this.drawBox(g,-12,4,42,18,4,0xffd0aa,{shadow:false});g.fillStyle(P.black,1);g.fillRect(-23,-8,5,5);g.fillStyle(0xd45a43,1);g.fillRect(-30,5,17,6);g.fillStyle(S.darken(0xf09b65,22),1);g.fillTriangle(38,-16,38,17,60,1);return c};
})();
