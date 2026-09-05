(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(n,m)=>((n%m)+m)%m;

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  const tintRed=obj=>{
    if(!obj)return;
    if(obj.setTintFill)obj.setTintFill(0xff3b30);
    else if(obj.setTint)obj.setTint(0xff3b30);
    if(Array.isArray(obj.list))obj.list.forEach(tintRed);
  };

  const setInfiniteSideParallax=scene=>{
    const frame=document.getElementById('kitchen-side-frame');
    if(!frame)return;
    if(!scene?._kitchenMode||!scene.player){
      frame.style.setProperty('--kitchen-parallax-left','0px');
      frame.style.setProperty('--kitchen-parallax-right','0px');
      return;
    }
    const startY=scene.rowY(0);
    const travel=Math.max(0,startY-scene.player.y);
    // The chef moves up through the level, so the wall art moves down past the
    // camera. Repeated backgrounds make this effectively endless.
    frame.style.setProperty('--kitchen-parallax-left',`${Math.round(travel*.58)}px`);
    frame.style.setProperty('--kitchen-parallax-right',`${Math.round(travel*.52)}px`);
  };

  proto.makeKitchenSplash=function(x,y){
    if(!this._kitchenMode||this._kitchenSplashShown)return;
    this._kitchenSplashShown=true;
    const z=this.depthForY?this.depthForY(y,95):160;
    const ring=this.track(this.add.ellipse(x,y+7,26,10,0xdffaff,.86).setDepth(z));
    const ring2=this.track(this.add.ellipse(x,y+8,14,6,0xffffff,.8).setDepth(z+1));
    this.tweens.add({targets:ring,scaleX:2.5,scaleY:1.8,alpha:0,duration:430,ease:'Quad.Out',onComplete:()=>ring.destroy()});
    this.tweens.add({targets:ring2,scaleX:3.3,scaleY:2.1,alpha:0,duration:360,ease:'Quad.Out',onComplete:()=>ring2.destroy()});
    for(let i=0;i<9;i++){
      const drop=this.track(this.add.circle(x,y+3,clamp(S.ROW_H*.045,2.5,4.5),i%3===0?0xffffff:0xbff3ff,.95).setDepth(z+2));
      const angle=(-150+(i/8)*120)*Math.PI/180;
      const distance=18+(i%4)*7;
      const dx=Math.cos(angle)*distance;
      const dy=Math.sin(angle)*distance-8-(i%3)*3;
      this.tweens.add({targets:drop,x:x+dx,y:y+dy,alpha:0,scale:.55,duration:300+(i%3)*55,ease:'Quad.Out',onComplete:()=>drop.destroy()});
    }
  };

  // Add a small edge tolerance beyond the actual visible board. This keeps the
  // landing honest (real world X only) while forgiving a few pixels of timing
  // drift as the board moves underneath the 128 ms hop.
  const previousFindSupportAt=proto.findSupportAt;
  proto.findSupportAt=function(rowIndex,x){
    if(!this._kitchenMode)return previousFindSupportAt.call(this,rowIndex,x);
    const row=this.rows[rowIndex];
    if(!row||row.type!=='water')return null;
    let best=null,bestDistance=Infinity;
    for(const obj of row.floaters||[]){
      const meta=obj?.__float;
      if(!obj?.active||obj.visible===false||!meta||meta.kind!=='kitchen-board')continue;
      const width=Math.max(1,meta.width||44);
      const tolerance=clamp(S.CELL_W*.12,6,10);
      const distance=Math.abs(x-obj.x);
      if(distance<=width*.5+tolerance&&distance<bestDistance){
        best=obj;
        bestDistance=distance;
      }
    }
    return best;
  };

  // Level 1 ingredients are individually collectible. Taking one no longer
  // disables or grays the rest of that row, so the player can backtrack/slide
  // along the station and collect several different ingredients.
  const previousCollectAt=proto.collectAt;
  proto.collectAt=function(rowIndex){
    if(!this._kitchenMode)return previousCollectAt.call(this,rowIndex);

    const groups=(this.kitchenIngredientGroups||[]).filter(g=>g.rowIndex===rowIndex);
    for(const group of groups){
      let hit=null,hitDist=Infinity;
      for(const item of group.items||[]){
        const meta=item?.__kitchenIngredient;
        if(!item?.active||item.visible===false||!meta||meta.collected)continue;
        const distance=Math.abs(item.x-this.player.x);
        if(distance<=clamp(S.CELL_W*.42,18,30)&&distance<hitDist){hit=item;hitDist=distance;}
      }
      if(hit){
        const meta=hit.__kitchenIngredient;
        meta.collected=true;
        this.kitchenIngredientInventory.push(meta.file||1);
        this.menuCollected.kitchenChoice=(this.menuCollected.kitchenChoice||0)+1;
        this.score+=meta.points||12;
        this.playSfx?.('pickup');
        const label=this.track(this.add.text(hit.x,hit.y-36,'INGREDIENT +12',{
          fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#17212a',backgroundColor:'#f8f858',padding:{x:7,y:4}
        }).setOrigin(.5).setDepth(this.depthForY?this.depthForY(hit.y,110):140));
        this.tweens.add({targets:hit,y:hit.y-16,scaleX:hit.scaleX*1.12,scaleY:hit.scaleY*1.12,alpha:0,duration:260,ease:'Quad.Out',onComplete:()=>hit.setVisible(false)});
        this.tweens.add({targets:label,y:label.y-18,alpha:0,duration:520,onComplete:()=>label.destroy()});
        break;
      }
    }

    for(const plate of this.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      if(!plate?.active||!meta||meta.collected||meta.rowIndex!==rowIndex)continue;
      if(Math.abs(plate.x-this.player.x)>meta.hitWidth*.5)continue;
      meta.collected=true;
      this.kitchenPlateCount=(this.kitchenPlateCount||0)+1;
      this.score+=meta.points;
      this.playSfx?.('pickup');
      const label=this.track(this.add.text(plate.x,plate.y-30,`PLATE +${meta.points}`,{
        fontFamily:'Inter,system-ui,sans-serif',fontSize:'12px',fontStyle:'900',color:'#17212a',backgroundColor:'#effae8',padding:{x:7,y:4}
      }).setOrigin(.5).setDepth(this.depthForY?this.depthForY(plate.y,110):140));
      this.tweens.add({targets:plate,y:plate.y-14,alpha:0,scaleX:plate.scaleX*.75,scaleY:plate.scaleY*.75,duration:220,onComplete:()=>plate.setVisible(false)});
      this.tweens.add({targets:label,y:label.y-16,alpha:0,duration:500,onComplete:()=>label.destroy()});
    }
    this.updateHud?.();
  };

  const previousFailRun=proto.failRun;
  proto.failRun=function(title,body,cause){
    if(this._kitchenMode&&cause==='water'&&!this._kitchenSplashShown&&this.player){
      this.makeKitchenSplash(this.player.x,this.player.y);
    }
    return previousFailRun.call(this,title,body,cause);
  };

  proto.beginKitchenFlyingImpact=function(obj,meta){
    if(this.runEnded||this._kitchenFlyingImpact||!this.player)return;
    this._kitchenFlyingImpact={obj,meta};
    this.inputLocked=true;
    this.clearBufferedMove?.();
    this.cancelGesture?.();
    this.playerSupport=null;
    this.playerSupportOffsetX=0;
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerArt);
    this.playerShadow?.setVisible?.(false);
    tintRed(this.player);
    tintRed(this.playerArt);
    this.playSfx?.('hit');
    this.cameras.main.shake(180,.009);

    const dir=Math.sign(meta.vx)||1;
    const sushiW=Math.max(meta.width||80,obj.displayWidth||80);
    const attachX=obj.x-dir*clamp(sushiW*.15,18,42);
    const attachY=obj.y+clamp(S.ROW_H*.05,2,4);
    const exitPadding=Math.max(130,sushiW*.7);
    const exitX=dir>0?S.PLAY_X+S.PLAY_W+exitPadding:S.PLAY_X-exitPadding;

    this.player.setDepth((obj.depth||0)+3);
    this.tweens.add({
      targets:this.player,
      x:attachX,
      y:attachY,
      angle:dir*9,
      duration:85,
      ease:'Quad.Out',
      onComplete:()=>{
        if(this.runEnded||!this._kitchenFlyingImpact)return;
        const deltaX=exitX-obj.x;
        this.tweens.add({targets:obj,x:exitX,duration:470,ease:'Linear'});
        this.tweens.add({
          targets:this.player,
          x:this.player.x+deltaX,
          y:attachY-3,
          angle:dir*18,
          duration:470,
          ease:'Linear',
          onComplete:()=>{
            if(this.runEnded)return;
            this._kitchenFlyingImpact=null;
            this.failRun(
              'FLYING SUSHI HIT!',
              'A flying sushi piece hit the chef and carried them straight out of the kitchen. Wait for a clean gap before crossing.',
              'kitchen-fly'
            );
          }
        });
      }
    });
  };

  // V2 handled flying sushi inside its own update wrapper. V7 takes ownership
  // of that movement so we can animate a hit instead of instantly hiding the
  // chef. We temporarily mask the metadata while the older wrappers run, which
  // prevents double movement/double collision without changing other hazards.
  const previousUpdate=proto.update;
  proto.update=function(time,delta){
    if(!this._kitchenMode)return previousUpdate.call(this,time,delta);

    if(this._kitchenFlyingImpact){
      setInfiniteSideParallax(this);
      return;
    }

    const dt=Math.min(delta,40)/1000;
    const saved=[];
    if(!this.runEnded){
      for(const obj of this.kitchenFlyingSushi||[]){
        const meta=obj?.__kitchenFlying;
        if(!obj?.active||!meta)continue;
        obj.x=meta.cycleStart+mod(obj.x+meta.vx*dt-meta.cycleStart,meta.cycleLength);
        saved.push([obj,meta]);
        obj.__kitchenFlying=null;
      }
    }

    try{
      previousUpdate.call(this,time,delta);
    }finally{
      for(const [obj,meta] of saved)if(obj?.active)obj.__kitchenFlying=meta;
    }

    setInfiniteSideParallax(this);
    if(this.runEnded||this.isMoving||!this.player)return;

    for(const [obj,meta] of saved){
      if(!obj?.active||obj.visible===false)continue;
      if(this.playerRow!==meta.row)continue;
      const hitWidth=Math.max(meta.width||80,(obj.displayWidth||80)*.62);
      if(Math.abs(obj.x-this.player.x)<=hitWidth*.5){
        this.beginKitchenFlyingImpact(obj,meta);
        break;
      }
    }
  };

  const previousStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    this._kitchenSplashShown=false;
    this._kitchenFlyingImpact=null;
    const result=previousStartLevel.call(this,level,opt);
    setInfiniteSideParallax(this);
    return result;
  };
})();