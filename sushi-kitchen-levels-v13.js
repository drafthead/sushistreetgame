(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  const hideTapPrompt=()=>{
    document.getElementById('tap-hop-hint')?.classList.remove('show');
  };

  const showTapPrompt=scene=>{
    const el=document.getElementById('tap-hop-hint');
    if(!el)return;
    const modalOpen=document.getElementById('modal')?.classList.contains('show');
    el.classList.toggle('show',Boolean(scene?.runActive&&!scene.runEnded&&!modalOpen&&(scene.totalHops||0)===0));
  };

  // Reuse the established plate pickup path so score, SFX, HUD updates and the
  // pickup animation all stay identical. Temporarily place the logical pickup
  // probe on the plate, then restore the chef's real X immediately afterward.
  const collectPlate=(scene,plate)=>{
    const meta=plate?.__kitchenPlate;
    if(!scene.player||!plate?.active||!meta||meta.collected)return false;
    const realX=scene.player.x;
    try{
      scene.player.x=plate.x;
      scene.collectAt(meta.rowIndex);
    }finally{
      if(scene.player)scene.player.x=realX;
    }
    if(meta.collected){
      plate.__kitchenPlateHaloV12?.setVisible?.(false);
      return true;
    }
    return false;
  };

  // Distance of zero from the relative player/plate motion means the chef's
  // path crossed the moving plate between rendered frames. This catches a plate
  // even when a horizontal hop starts on one side and lands on the other.
  const segmentDistanceToZero=(a,b)=>{
    if(!Number.isFinite(a)||!Number.isFinite(b))return Infinity;
    if(a===0||b===0||a*b<0)return 0;
    return Math.min(Math.abs(a),Math.abs(b));
  };

  const sweepMovingPlates=(scene,beforePlayer,beforePlates,dt)=>{
    if(!scene._kitchenMode||!scene.player||scene.runEnded)return;

    const currentPlayer={x:scene.player.x,row:scene.playerRow};
    for(const plate of scene.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      if(!plate?.active||!meta||meta.collected)continue;

      const rowIndex=meta.rowIndex;
      const wasOnRow=beforePlayer.row===rowIndex;
      const isOnRow=currentPlayer.row===rowIndex;
      if(!wasOnRow&&!isOnRow)continue;

      const state=scene.rows?.[rowIndex]?.__plateConveyorV12;
      const oldPlateX=beforePlates.get(plate);
      const currentPlateX=plate.x;
      const tolerance=meta.hitWidth*.58+clamp(S.CELL_W*.12,6,11);
      let hit=false;

      if(wasOnRow&&isOnRow&&Number.isFinite(oldPlateX)){
        // Use the conveyor's expected unwrapped movement for the swept test.
        // That prevents a wrap from the far edge to the near edge being treated
        // as if the plate teleported across the whole playable width.
        const expectedPlateX=oldPlateX+(Number(state?.vx)||0)*dt;
        const r0=beforePlayer.x-oldPlateX;
        const r1=currentPlayer.x-expectedPlateX;
        hit=segmentDistanceToZero(r0,r1)<=tolerance;

        // Also accept the real wrapped endpoint with the same generous radius.
        if(!hit)hit=Math.abs(currentPlayer.x-currentPlateX)<=tolerance;
      }else if(isOnRow){
        // Vertical arrival onto a plate row gets a forgiving endpoint check.
        // This is a second chance after the normal collectAt() landing check,
        // which matters because the conveyor can move during the hop itself.
        hit=Math.abs(currentPlayer.x-currentPlateX)<=tolerance;
      }

      if(hit)collectPlate(scene,plate);
    }
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    showTapPrompt(this);
    return result;
  };

  // The onboarding card should disappear as soon as the FIRST valid hop starts,
  // not after several hops and not after a timer.
  const baseRequestMove=proto.requestMove;
  proto.requestMove=function(dx,dy){
    const before=this.totalHops||0;
    const result=baseRequestMove.call(this,dx,dy);
    if((this.totalHops||0)>before)hideTapPrompt();
    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    const beforePlayer={x:this.player?.x,row:this.playerRow};
    const beforePlates=new Map();
    if(this._kitchenMode){
      for(const plate of this.kitchenPlates||[])beforePlates.set(plate,plate?.x);
    }

    const result=baseUpdate.call(this,time,delta);
    const dt=Math.min(Math.max(Number(delta)||16.667,1),40)/1000;
    sweepMovingPlates(this,beforePlayer,beforePlates,dt);

    if((this.totalHops||0)>=1)hideTapPrompt();
    return result;
  };
})();
