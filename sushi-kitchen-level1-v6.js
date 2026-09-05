(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  const setSideParallax=(scene,reset=false)=>{
    const frame=document.getElementById('kitchen-side-frame');
    if(!frame)return;
    if(reset||!scene?._kitchenMode||!scene.player){
      frame.style.setProperty('--kitchen-parallax-left','0px');
      frame.style.setProperty('--kitchen-parallax-right','0px');
      return;
    }
    const startY=scene.rowY(0),goalY=scene.rowY(scene.goalRow);
    const span=Math.max(1,startY-goalY);
    const progress=clamp((startY-scene.player.y)/span,0,1);
    // The scenery should slide downward as the chef travels upward through the
    // kitchen. The two sides move at slightly different rates for depth.
    frame.style.setProperty('--kitchen-parallax-left',`${Math.round(progress*180)}px`);
    frame.style.setProperty('--kitchen-parallax-right',`${Math.round(progress*150)}px`);
  };

  // The old vertical-hop logic always retargeted the chef to playerCol's fixed
  // center. That is wrong after a moving board has carried the chef sideways:
  // a visually straight hop would secretly slide left/right during the jump.
  // For Level 1 vertical moves, keep the actual world X and update the logical
  // column to whichever column is closest to that real X.
  const baseRequestMove=proto.requestMove;
  proto.requestMove=function(dx,dy){
    if(!this._kitchenMode||dx!==0||dy===0||!this.player){
      return baseRequestMove.call(this,dx,dy);
    }
    if(!this.canAcceptInput())return;
    if(this.isMoving){this.bufferedMove={dx,dy};return;}

    const row=clamp(this.playerRow+dy,0,this.goalRow);
    if(row===this.playerRow)return;
    if(dy<0&&row<this.maxRow-S.MAX_BACKTRACK)return;

    const landingX=clamp(this.player.x,S.PLAY_X+2,S.PLAY_X+S.PLAY_W-2);
    const col=nearestCol(this,landingX);
    const lane=this.rows[row];
    if(!lane)return;

    if(this.isBlocked?.(row,col)){
      this.playSfx('bump');
      this.tweens.add({
        targets:this.playerArt,
        x:0,
        y:-3,
        duration:55,
        yoyo:true,
        onComplete:()=>this.playerArt?.setPosition(0,-7)
      });
      return;
    }

    this.beginRunClock();

    // executeMove only reads colX synchronously to calculate the tween target,
    // so temporarily return the chef's real X for this one vertical landing.
    const originalColX=this.colX;
    this.colX=function(c){
      return c===col?landingX:originalColX.call(this,c);
    };
    try{
      return this.executeMove(row,col,lane);
    }finally{
      this.colX=originalColX;
    }
  };

  // Level 1 water should only accept the board actually under the chef's feet.
  // Do not snap to another support merely because it is in the same logical
  // column. Pick the nearest visible board whose real horizontal footprint
  // overlaps the player's real landing X.
  const baseFindSupportAt=proto.findSupportAt;
  proto.findSupportAt=function(rowIndex,x){
    if(!this._kitchenMode)return baseFindSupportAt.call(this,rowIndex,x);
    const row=this.rows[rowIndex];
    if(!row||row.type!=='water')return null;

    let best=null,bestDistance=Infinity;
    for(const obj of row.floaters||[]){
      const meta=obj?.__float;
      if(!obj?.active||obj.visible===false||!meta||meta.kind!=='kitchen-board')continue;
      const width=Math.max(1,meta.width||meta.hitWidth||44);
      const distance=Math.abs(x-obj.x);
      // 92% of visible board width is landable. This accepts a genuine visual
      // overlap while leaving a clear water gap between neighboring boards.
      if(distance<=width*.46&&distance<bestDistance){
        best=obj;
        bestDistance=distance;
      }
    }
    return best;
  };

  // While a board carries the player, keep playerCol synchronized to the
  // nearest column so subsequent side moves are based on where the chef really
  // is, not where the board was when the chef first landed.
  const baseUpdatePlayerSupport=proto.updatePlayerSupport;
  proto.updatePlayerSupport=function(){
    baseUpdatePlayerSupport.call(this);
    if(this._kitchenMode&&this.playerSupport&&!this.isMoving&&this.player){
      this.playerCol=nearestCol(this,this.player.x);
    }
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    setSideParallax(this,true);
    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    baseUpdate.call(this,time,delta);
    if(this._kitchenMode)setSideParallax(this,false);
  };
})();
