(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  const hideTapPrompt=()=>document.getElementById('tap-hop-hint')?.classList.remove('show');

  // --- Hot-pot readability -------------------------------------------------
  // Keep this deliberately cheap: one static orange heat pool and one small
  // two-puff steam container/tween per pot. No particles or additive blending.
  const baseBuildKitchenPots=proto.buildKitchenPots;
  proto.buildKitchenPots=function(row){
    const before=(this.kitchenPots||[]).length;
    const result=baseBuildKitchenPots.call(this,row);
    const created=(this.kitchenPots||[]).slice(before);

    created.forEach((pot,index)=>{
      if(!pot?.active)return;
      const h=Math.max(34,Number(pot.displayHeight)||S.ROW_H*.72);
      const w=Math.max(34,Number(pot.displayWidth)||S.CELL_W*.7);

      const heat=this.track(this.add.ellipse(
        pot.x,
        pot.y+h*.18,
        clamp(w*.72,28,48),
        clamp(h*.15,7,11),
        0xff7a2f,
        .28
      ).setDepth(depth(this,row.y,52)));
      row.objects?.push(heat);

      const steam=this.add.container(
        pot.x,
        pot.y-h*.43
      ).setDepth(depth(this,row.y,58)).setAlpha(.24);
      const g=this.add.graphics();
      g.fillStyle(0xffffff,.52);
      g.fillEllipse(-5,3,7,13);
      g.fillStyle(0xf5fbff,.38);
      g.fillEllipse(4,-3,6,11);
      steam.add(g);
      this.track(steam);
      row.objects?.push(steam);

      this.tweens.add({
        targets:steam,
        y:steam.y-13,
        alpha:.52,
        scaleX:1.08,
        scaleY:1.13,
        duration:560+(index%3)*70,
        yoyo:true,
        repeat:-1,
        delay:(index%3)*90,
        ease:'Sine.InOut'
      });
    });
    return result;
  };

  // --- Lower-latency mobile input -----------------------------------------
  // A short tap-intent timer starts the forward hop while the finger is still
  // down. Any meaningful finger movement cancels it so swipes remain intact.
  // Quick taps that end before the timer fire immediately on pointer-up.
  const baseCancelGesture=proto.cancelGesture;
  const clearFastTapIntent=scene=>{
    const intent=scene?._fastTapIntent;
    try{intent?.timer?.remove?.(false)}catch(_){}
    if(scene)scene._fastTapIntent=null;
  };

  proto.cancelGesture=function(){
    clearFastTapIntent(this);
    return baseCancelGesture.call(this);
  };

  proto.installInput=function(){
    const TAP_INTENT_MS=52;
    const TAP_CANCEL_DISTANCE=10;
    const SWIPE_DISTANCE=20;

    this.input.on('pointerdown',p=>{
      clearFastTapIntent(this);
      if(!this.canAcceptInput()){
        this.startAmbientAudio();
        return;
      }

      this.gesture={id:p.id,x:p.x,y:p.y};
      const intent={id:p.id,x:p.x,y:p.y,fired:false,timer:null};
      intent.timer=this.time.delayedCall(TAP_INTENT_MS,()=>{
        if(this._fastTapIntent!==intent||intent.fired||!this.canAcceptInput())return;
        const active=this.input.activePointer;
        if(!active||active.id!==intent.id)return;
        const dx=active.x-intent.x,dy=active.y-intent.y;
        if(Math.hypot(dx,dy)>TAP_CANCEL_DISTANCE)return;
        intent.fired=true;
        this.requestMove(0,1);
      });
      this._fastTapIntent=intent;

      // Schedule gameplay intent before touching the audio stack so a cold
      // mobile AudioContext cannot sit in front of the visual response.
      this.startAmbientAudio();
    });

    this.input.on('pointermove',p=>{
      if(this.gesture.id!==p.id)return;
      const intent=this._fastTapIntent;
      if(!intent||intent.id!==p.id||intent.fired)return;
      if(Math.hypot(p.x-intent.x,p.y-intent.y)>TAP_CANCEL_DISTANCE)clearFastTapIntent(this);
    });

    this.input.on('pointerup',p=>{
      if(this.gesture.id!==p.id){clearFastTapIntent(this);return;}
      const dx=p.x-this.gesture.x,dy=p.y-this.gesture.y;
      const intent=this._fastTapIntent;
      const alreadyFired=Boolean(intent?.fired);
      clearFastTapIntent(this);
      baseCancelGesture.call(this);
      if(alreadyFired||!this.canAcceptInput())return;

      if(Math.hypot(dx,dy)<SWIPE_DISTANCE)this.requestMove(0,1);
      else if(Math.abs(dx)>Math.abs(dy))this.requestMove(dx<0?-1:1,0);
      else this.requestMove(0,dy>0?-1:1);
    });

    const cancel=()=>this.cancelGesture();
    this.input.on('pointercancel',cancel);
    this.input.on('pointerupoutside',cancel);
  };

  // --- Snappier hop motion -------------------------------------------------
  // The old 128ms Sine tween eased in slowly, which made taps feel heavier than
  // they were. 96ms + Cubic.Out gives an immediate start while retaining a soft
  // landing. The squash/air phase is shortened in the same proportion.
  proto.executeMove=function(row,col,lane){
    this.isMoving=true;
    this.idleMs=0;
    this.totalHops++;
    this.score++;
    this.playerSupport=null;
    this.playerSupportOffsetX=0;
    if(row>this.maxRow)this.maxRow=row;

    const x=this.colX(col),y=this.rowY(row);
    this.tweens.killTweensOf(this.player);
    this.tweens.killTweensOf(this.playerArt);

    this.tweens.add({
      targets:this.player,
      x,y,
      duration:96,
      ease:'Cubic.Out',
      onComplete:()=>{
        this.playerRow=row;
        this.playerCol=col;
        this.isMoving=false;
        this.player.y=y;
        if(lane.type==='water'){
          const f=this.findSupportAt(row,this.player.x);
          if(!f)return this.failRun(
            'SPLASH DOWN',
            'You jumped into the canal. Land on a lily pad, log, or fishing boat to cross.',
            'water'
          );
          this.playerSupport=f;
          this.playerSupportOffsetX=this.player.x-f.x;
        }
        this.collectAt(row);
        this.updateMissedPickups();
        if(lane.type==='goal')return this.finishDelivery();
        if(this.bufferedMove){
          const next=this.bufferedMove;
          this.bufferedMove=null;
          this.requestMove(next.dx,next.dy);
        }
      }
    });

    this.tweens.add({
      targets:this.playerArt,
      y:-18,
      scaleX:.98,
      scaleY:1.03,
      duration:48,
      yoyo:true,
      ease:'Quad.Out',
      onComplete:()=>{
        if(this.playerArt)this.playerArt.setPosition(0,-7).setScale(1);
      }
    });
    this.tweens.add({
      targets:this.playerShadow,
      scaleX:.78,
      scaleY:.72,
      alpha:.58,
      duration:48,
      yoyo:true
    });
    this.playSfx('hop');
  };

  const executeFastKitchenVerticalMove=(scene,row,lane,landingX)=>{
    scene.isMoving=true;
    scene.idleMs=0;
    scene.totalHops++;
    scene.score++;
    scene.playerSupport=null;
    scene.playerSupportOffsetX=0;
    if(row>scene.maxRow)scene.maxRow=row;
    hideTapPrompt();

    const y=scene.rowY(row);
    scene.tweens.killTweensOf(scene.player);
    scene.tweens.killTweensOf(scene.playerArt);
    scene.tweens.add({
      targets:scene.player,
      x:landingX,
      y,
      duration:96,
      ease:'Cubic.Out',
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
      duration:48,
      yoyo:true,
      ease:'Quad.Out',
      onComplete:()=>scene.playerArt?.setPosition(0,-7).setScale(1)
    });
    scene.tweens.add({
      targets:scene.playerShadow,
      scaleX:.78,
      scaleY:.72,
      alpha:.58,
      duration:48,
      yoyo:true
    });
    scene.playSfx('hop');
  };

  const previousRequestMove=proto.requestMove;
  proto.requestMove=function(dx,dy){
    if(!this._kitchenMode||dx!==0||dy===0||!this.player){
      if(this._kitchenMode&&this.player)this.playerCol=nearestCol(this,this.player.x);
      return previousRequestMove.call(this,dx,dy);
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
        duration:45,
        yoyo:true,
        onComplete:()=>this.playerArt?.setPosition(0,-7)
      });
      return;
    }

    this.beginRunClock();
    executeFastKitchenVerticalMove(this,row,lane,landingX);
  };

  // --- Conveyor carries the chef ------------------------------------------
  const tintRed=obj=>{
    if(!obj)return;
    if(obj.setTintFill)obj.setTintFill(0xff3b30);
    else obj.setTint?.(0xff3b30);
    if(Array.isArray(obj.list))obj.list.forEach(tintRed);
  };

  const beginConveyorEdgeFail=scene=>{
    if(scene._kitchenConveyorEdgeFailing||scene.runEnded)return;
    scene._kitchenConveyorEdgeFailing=true;
    scene.inputLocked=true;
    scene.clearBufferedMove?.();
    scene.cancelGesture?.();
    tintRed(scene.player);
    tintRed(scene.playerArt);
    scene.cameras.main.shake(170,.008);

    scene.time.delayedCall(150,()=>{
      if(scene.runEnded)return;
      scene.failRun(
        'OUT OF BOUNDS',
        'The conveyor carried the chef off the prep line. Hop off before reaching the edge.',
        'conveyor-edge'
      );
    });
  };

  const carryChefWithPlateConveyor=(scene,dt)=>{
    if(!scene._kitchenMode||scene.runEnded||scene.isMoving||!scene.player)return;
    const row=scene.rows?.[scene.playerRow];
    const state=row?.__plateConveyorV12;
    if(!state)return;

    scene.player.x+=state.vx*dt;
    scene.playerCol=nearestCol(scene,scene.player.x);

    const left=S.PLAY_X+2;
    const right=S.PLAY_X+S.PLAY_W-2;
    if(scene.player.x<left||scene.player.x>right)beginConveyorEdgeFail(scene);
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    this._kitchenConveyorEdgeFailing=false;
    clearFastTapIntent(this);
    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    const result=baseUpdate.call(this,time,delta);
    const dt=Math.min(Math.max(Number(delta)||16.667,1),40)/1000;
    carryChefWithPlateConveyor(this,dt);
    return result;
  };
})();
