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
    // The scenery slides downward as the chef advances upward through Level 1.
    // Slightly different travel amounts on each side keep it from feeling like
    // a single flat sticker moving in lockstep.
    frame.style.setProperty('--kitchen-parallax-left',`${Math.round(progress*180)}px`);
    frame.style.setProperty('--kitchen-parallax-right',`${Math.round(progress*150)}px`);
  };

  const executeKitchenVerticalMove=(scene,row,col,lane,landingX)=>{
    scene.isMoving=true;
    scene.idleMs=0;
    scene.totalHops++;
    scene.score++;
    scene.playerSupport=null;
    scene.playerSupportOffsetX=0;
    if(row>scene.maxRow)scene.maxRow=row;
    scene.playSfx('hop');

    const y=scene.rowY(row);
    scene.tweens.killTweensOf(scene.player);
    scene.tweens.killTweensOf(scene.playerArt);

    scene.tweens.add({
      targets:scene.player,
      // Critical Level 1 rule: a forward/back hop never changes world X.
      // Moving boards may carry the chef between hops, but the hop itself is
      // always perfectly straight from the chef's current visible position.
      x:landingX,
      y,
      duration:128,
      ease:'Sine.InOut',
      onComplete:()=>{
        if(!scene.player)return;
        scene.player.x=landingX;
        scene.player.y=y;
        scene.playerRow=row;
        scene.playerCol=nearestCol(scene,landingX);
        scene.isMoving=false;

        if(lane.type==='water'){
          const support=scene.findSupportAt(row,landingX);
          if(!support){
            return scene.failRun(
              'SPLASH DOWN',
              'You jumped into the water. A board must be directly under the chef when the jump lands.',
              'water'
            );
          }
          scene.playerSupport=support;
          scene.playerSupportOffsetX=landingX-support.x;
        }

        scene.collectAt(row);
        scene.updateMissedPickups();
        if(lane.type==='goal')return scene.finishDelivery();
        if(scene.bufferedMove){
          const next=scene.bufferedMove;
          scene.bufferedMove=null;
          scene.requestMove(next.dx,next.dy);
        }
      }
    });

    scene.tweens.add({
      targets:scene.playerArt,
      y:-18,
      scaleX:.98,
      scaleY:1.03,
      duration:64,
      yoyo:true,
      ease:'Quad.Out',
      onComplete:()=>{
        if(scene.playerArt)scene.playerArt.setPosition(0,-7).setScale(1);
      }
    });
    scene.tweens.add({targets:scene.playerShadow,scaleX:.78,scaleY:.72,alpha:.58,duration:64,yoyo:true});
  };

  // Base gameplay uses playerCol to calculate every destination. That caused
  // large sideways teleports after a moving board carried the chef away from
  // the center of that logical column. Level 1 vertical hops instead snapshot
  // the chef's real visible X and keep that exact X for the whole hop.
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
    executeKitchenVerticalMove(this,row,col,lane,landingX);
  };

  // A Level 1 water landing now uses only the real board footprint under the
  // chef's actual X. It never snaps to the closest board or to a logical cell.
  const baseFindSupportAt=proto.findSupportAt;
  proto.findSupportAt=function(rowIndex,x){
    if(!this._kitchenMode)return baseFindSupportAt.call(this,rowIndex,x);
    const row=this.rows[rowIndex];
    if(!row||row.type!=='water')return null;

    let best=null,bestDistance=Infinity;
    for(const obj of row.floaters||[]){
      const meta=obj?.__float;
      if(!obj?.active||obj.visible===false||!meta||meta.kind!=='kitchen-board')continue;
      const width=Math.max(1,meta.width||44);
      const distance=Math.abs(x-obj.x);
      // Only the middle 80% of the visible board is a valid landing zone. This
      // keeps a clear miss zone over water while still accepting direct hops.
      if(distance<=width*.40&&distance<bestDistance){
        best=obj;
        bestDistance=distance;
      }
    }
    return best;
  };

  // Boards carry the chef smoothly after a successful landing. Keep the
  // logical column synchronized only for intentional left/right moves; it does
  // not influence the X of a vertical hop anymore.
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
