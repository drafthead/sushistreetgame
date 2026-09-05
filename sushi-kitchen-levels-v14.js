(() => {
  const proto=window.SushiScene.prototype;

  const doublePlateConveyorSpeed=scene=>{
    if(!scene?._kitchenMode)return;
    for(const row of scene.rows||[]){
      const state=row?.__plateConveyorV12;
      if(!state||state.__v14SpeedApplied)continue;
      state.vx*=2;
      state.__v14SpeedApplied=true;
    }
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    doublePlateConveyorSpeed(this);
    return result;
  };
})();
