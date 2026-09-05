(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const TILE_FILES=[1,2,3], FLYING_FILES=[1], BOARD_FILES=[1];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(n,m)=>((n%m)+m)%m;
  const depth=(scene,y,o=0)=>scene.depthForY?scene.depthForY(y,o):10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    TILE_FILES.forEach(n=>this.load.image(`kitchen-tile-${n}`,`images/kitchen/tiles/${n}.png`));
    FLYING_FILES.forEach(n=>this.load.image(`kitchen-flying-${n}`,`images/kitchen/flyingsushi/${n}.png`));
  };

  const baseColX=proto.colX;
  proto.colX=function(col){
    if(!this._kitchenMode)return baseColX.call(this,col);
    const side=clamp(S.W*.025,20,40),left=S.PLAY_X+side+7,right=S.PLAY_X+S.PLAY_W-side-7;
    return left+Math.max(1,right-left)*((col+.5)/S.COLS);
  };

  const addRect=(scene,row,x,y,w,h,color,alpha,z)=>{
    const o=scene.track(scene.add.rectangle(x,y,w,h,color,alpha).setDepth(z));
    row?.objects?.push(o);return o;
  };

  const repeatTileBand=(scene,row,texture,targetH,under=0x34393f)=>{
    const z=depth(scene,row.y,-520),center=S.PLAY_X+S.PLAY_W*.5;
    addRect(scene,row,center,row.y,S.PLAY_W,S.ROW_H,under,1,z);
    if(!exists(scene,texture))return;
    const src=scene.textures.get(texture).getSourceImage(),scale=targetH/Math.max(1,src.height||1);
    const tileW=Math.max(12,(src.width||1)*scale),stride=Math.max(11,tileW-1);
    const count=Math.ceil(S.PLAY_W/stride)+2,total=(count-1)*stride+tileW;
    const first=S.PLAY_X-(total-S.PLAY_W)*.5+tileW*.5;
    for(let i=0;i<count;i++){
      const img=scene.track(scene.add.image(first+i*stride,row.y,texture).setScale(scale).setDepth(z+2));
      img.__rowY=row.y;row.objects.push(img);
    }
  };

  proto.buildKitchenBackdrop=function(){
    const sideVisible=clamp(S.W*.025,20,40),screenCenter=S.OVERSCAN_X+S.W*.5,sideDepth=245000;
    const side=(texture,left)=>{
      if(!exists(this,texture))return;
      const img=this.track(this.add.image(0,S.H*.5,texture).setScrollFactor(0).setDepth(sideDepth));
      const src=this.textures.get(texture).getSourceImage(),scale=S.H/Math.max(1,src.height||1);
      img.setScale(scale);
      const displayW=(src.width||1)*scale;
      img.x=left?sideVisible-displayW*.5:S.W-sideVisible+displayW*.5;
      img.y=S.H*.5;
    };
    side('kitchen-bg-left',true);side('kitchen-bg-right',false);

    if(exists(this,'kitchen-bg-bottom')){
      const img=this.track(this.add.image(screenCenter,this.cameras.main.scrollY+S.H,'kitchen-bg-bottom').setOrigin(.5,1).setDepth(depth(this,this.rowY(0),-480)));
      img.setScale(S.W/Math.max(1,img.width||1));
    }
    if(exists(this,'kitchen-bg-top')){
      const y=this.rowY(this.goalRow)+S.ROW_H*.42;
      const img=this.track(this.add.image(screenCenter,y,'kitchen-bg-top').setOrigin(.5,1).setDepth(depth(this,y,-480)));
      img.setScale(S.W/Math.max(1,img.width||1));
    }
  };

  proto.buildKitchenBoards=function(row){
    const dir=row.index%2===0?1:-1,width=clamp(S.CELL_W*.98,44,72),gap=clamp(S.CELL_W*.48,22,36);
    const cycleStart=S.PLAY_X-width-gap,cycleLength=S.PLAY_W+(width+gap)*2;
    const count=Math.max(6,Math.floor(cycleLength/(width+gap))),spacing=cycleLength/count;
    const speed=dir*(48+(row.index%3)*4),phase=(row.index%3)*Math.min(10,gap*.3);
    for(let i=0;i<count;i++){
      const x=cycleStart+phase+i*spacing,c=this.add.container(x,row.y-2).setDepth(depth(this,row.y,38));
      c.add(this.add.ellipse(4,9,width*.84,clamp(S.ROW_H*.16,8,13),0x163c55,.25));
      const key=`kitchen-board-${BOARD_FILES[(i+row.index)%BOARD_FILES.length]}`;
      if(exists(this,key)){
        const img=this.add.image(0,0,key),scale=width/Math.max(1,img.width||1);
        img.setScale(scale).setOrigin(.5,.58).setFlipX(dir<0&&i%2===1);c.add(img);
      }else{
        const g=this.add.graphics();g.fillStyle(0xa96c39,1);g.fillRoundedRect(-width*.5,-10,width,20,4);c.add(g);
      }
      c.__rowY=row.y;c.__float={vx:speed,width,hitWidth:width*.86,kind:'kitchen-board',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength};
      row.floaters.push(c);this.floaters.push(c);this.track(c);row.objects.push(c);
      this.tweens.add({targets:c,y:c.y+2.2,angle:dir>0?1.15:-1.15,duration:650+(i%3)*120,yoyo:true,repeat:-1,ease:'Sine.InOut'});
    }
  };

  proto.buildKitchenPots=function(row){
    const mid=Math.floor(S.COLS/2),raw=row.index%2?[1,mid,S.COLS-2]:[2,mid+1,S.COLS-3];
    const used=new Set();
    for(let i=0;i<raw.length;i++){
      const col=clamp(raw[i],0,S.COLS-1);if(used.has(col))continue;used.add(col);
      const file=1+((i+row.index)%3),key=`kitchen-pot-${file}`,x=this.colX(col),y=row.y-3;
      let pot;
      if(exists(this,key)){
        pot=this.add.image(x,y,key).setDepth(depth(this,y,54));pot.setScale(clamp(S.ROW_H*.78,42,56)/Math.max(1,pot.height||1)).setOrigin(.5,.7);
      }else pot=this.add.circle(x,y,20,0x24262d,1).setDepth(depth(this,y,54));
      pot.__rowY=row.y;pot.__kitchenHotPot={row:row.index,col};this.track(pot);row.objects.push(pot);this.kitchenPots.push(pot);
      this.kitchenHotPotCells.add(`${row.index}:${col}`);
    }
  };

  proto.buildKitchenFlyingSushi=function(row){
    const key=`kitchen-flying-${FLYING_FILES[row.index%FLYING_FILES.length]}`,dir=row.index%2?1:-1;
    const speed=clamp(340+S.W*.065,355,445),probeW=clamp(S.CELL_W*.92,44,68);
    const cycleStart=S.PLAY_X-probeW*1.8,cycleLength=S.PLAY_W+probeW*3.6;
    const count=Math.max(1,Math.round(cycleLength/(speed*2))),spacing=cycleLength/count;
    for(let i=0;i<count;i++){
      const x=cycleStart+i*spacing;let obj;
      if(exists(this,key)){
        obj=this.add.image(x,row.y-2,key);obj.setScale(clamp(S.ROW_H*.58,30,42)/Math.max(1,obj.height||1)).setFlipX(dir<0);
      }else obj=this.add.ellipse(x,row.y-2,probeW,clamp(S.ROW_H*.36,18,28),0x11151a,1);
      obj.setDepth(depth(this,row.y,60));obj.__rowY=row.y;
      obj.__kitchenFlying={row:row.index,width:Math.max(28,(obj.displayWidth||probeW)*.72),vx:dir*speed,cycleStart,cycleLength};
      this.track(obj);row.objects.push(obj);this.kitchenFlyingSushi.push(obj);
    }
  };

  proto.renderKitchenRow=function(row){
    const y=row.y,d=depth(this,y,-520),center=S.PLAY_X+S.PLAY_W*.5;
    if(row.type==='water'){
      addRect(this,row,center,y+5,S.PLAY_W,S.ROW_H,0x176b9b,1,d);addRect(this,row,center,y,S.PLAY_W,S.ROW_H-6,0x2eace0,1,d+1);
      addRect(this,row,center,y-S.ROW_H*.31,S.PLAY_W,4,0x9cedff,.72,d+2);
      const n=Math.max(8,Math.floor(S.PLAY_W/66));
      for(let i=0;i<n;i++){const x=S.PLAY_X+(i+.5)*S.PLAY_W/n,yy=y+((i%3)-1)*9;addRect(this,row,x,yy,clamp(S.CELL_W*.42,18,34),3,0xc8f7ff,.38,d+3);}
      this.buildKitchenBoards(row);return;
    }
    if(row.type==='kitchenIngredient'){repeatTileBand(this,row,'kitchen-tile-2',clamp(S.ROW_H*.84,44,56),0x554b40);this.buildKitchenIngredientStation(row);return;}
    if(row.type==='kitchenPlate'){repeatTileBand(this,row,'kitchen-tile-3',clamp(S.ROW_H*.84,44,56),0x42474e);this.buildKitchenPlateRow(row);return;}
    if(row.type==='kitchenPots'){repeatTileBand(this,row,'kitchen-tile-1',clamp(S.ROW_H*.84,44,56),0x292d31);this.buildKitchenPots(row);return;}
    if(row.type==='kitchenFlying'){repeatTileBand(this,row,'kitchen-tile-2',clamp(S.ROW_H*.78,40,52),0x3c4146);this.buildKitchenFlyingSushi(row);return;}
    if(row.type==='goal'){addRect(this,row,center,y,S.PLAY_W,S.ROW_H,0xd8cbbb,1,d);return;}
    const start=row.type==='start';addRect(this,row,center,y,S.PLAY_W,S.ROW_H,start?0xe7ddd0:0xcbd0d3,1,d);
    for(let x=S.PLAY_X+S.CELL_W*.5;x<S.PLAY_X+S.PLAY_W;x+=S.CELL_W)addRect(this,row,x,y,2,S.ROW_H-10,0xffffff,.18,d+2);
  };

  const baseBuildRows=proto.buildRows;
  proto.buildRows=function(){
    if(!this._kitchenMode)return baseBuildRows.call(this);
    this.rows=[];this.vehicles=[];this.floaters=[];this.pickups=[];this.trains=[];this.trainRows=[];this.blockedCells=new Set();
    this.kitchenIngredientGroups=[];this.kitchenIngredientInventory=[];this.kitchenPlates=[];this.kitchenPlateCount=0;this.kitchenPots=[];
    this.kitchenHotPotCells=new Set();this.kitchenFlyingSushi=[];this.kitchenBurning=false;
    const pattern={0:'start',1:'kitchenPlate',2:'kitchenSafe',3:'water',4:'water',5:'kitchenIngredient',6:'kitchenFlying',7:'kitchenPots',8:'kitchenSafe',9:'kitchenPlate',10:'kitchenFlying',11:'water',12:'water',13:'kitchenIngredient',14:'kitchenPots',15:'kitchenSafe',16:'kitchenPlate',17:'kitchenFlying',18:'kitchenIngredient',19:'water',20:'water',21:'kitchenPots',22:'kitchenSafe',23:'kitchenPlate',24:'kitchenFlying',25:'kitchenIngredient',26:'goal'};
    this.buildKitchenBackdrop();
    for(let i=0;i<=this.goalRow;i++){
      const row={index:i,type:pattern[i]||'kitchenSafe',y:this.rowY(i),objects:[],vehicles:[],floaters:[],pickups:[],obstacles:[]};this.rows[i]=row;this.renderKitchenRow(row);
    }
  };

  const tintRed=obj=>{
    if(!obj)return;if(obj.setTintFill)obj.setTintFill(0xff3b30);else if(obj.setTint)obj.setTint(0xff3b30);
    if(Array.isArray(obj.list))obj.list.forEach(tintRed);
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    baseUpdate.call(this,time,delta);
    if(!this._kitchenMode||this.runEnded||!this.player)return;
    const dt=Math.min(delta,40)/1000;
    for(const obj of this.kitchenFlyingSushi||[]){
      const m=obj?.__kitchenFlying;if(!obj?.active||!m)continue;obj.x=m.cycleStart+mod(obj.x+m.vx*dt-m.cycleStart,m.cycleLength);
      if(!this.isMoving&&this.playerRow===m.row&&Math.abs(obj.x-this.player.x)<=m.width*.5){
        this.player?.setVisible?.(false);this.playerArt?.setVisible?.(false);this.playerShadow?.setVisible?.(false);
        return this.failRun('FLYING SUSHI HIT!','A flying sushi piece hit the chef. These blast across the kitchen about every two seconds, so wait for the gap and hop through.','kitchen-fly');
      }
    }
    if(!this.isMoving&&!this.kitchenBurning&&this.kitchenHotPotCells?.has(`${this.playerRow}:${this.playerCol}`)){
      this.kitchenBurning=true;this.inputLocked=true;this.clearBufferedMove?.();this.cancelGesture?.();tintRed(this.player);tintRed(this.playerArt);this.playSfx?.('hit');this.cameras.main.shake(220,.008);
      this.time.delayedCall(320,()=>{if(!this.runEnded)this.failRun('HOT POT!','The chef touched a hot pot and got burned. Move through the open gaps between the pots.','kitchen-burn');});
    }
  };
})();