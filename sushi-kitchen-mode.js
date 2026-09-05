(() => {
  const S=window.SS, proto=window.SushiScene.prototype;

  // Kitchen-prep routes are the default. Every 5th level stays as the
  // original Sushi Street crossing and acts as a bonus round.
  S.isKitchenLevel=level=>{
    const n=Math.max(1,Number(level)||1);
    return n%5!==0;
  };

  S.prepRequirements=level=>{
    const n=Math.max(1,Number(level)||1);
    const stage=n-Math.floor(n/5);
    const need=Math.min(10,2+stage);
    return {ingredients:need,plates:need,stage};
  };

  // This wrapper intentionally loads BEFORE the original Level 1 prototype.
  // The original prototype still contains a Level-1-only mode switch. When it
  // calls its captured base startLevel, this inner wrapper restores the new
  // all-kitchen-except-every-5th rule early enough for buildRows() to render
  // the kitchen world instead of the old street.
  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const requested=Math.max(1,Number(level)||1);
    const kitchen=S.isKitchenLevel(requested);
    const previousRotation=S.CAMERA_ROTATION;
    this._kitchenMode=kitchen;
    this._bonusStreetMode=!kitchen&&requested%5===0;
    if(kitchen)S.CAMERA_ROTATION=0;
    try{
      return baseStartLevel.call(this,level,opt);
    }finally{
      S.CAMERA_ROTATION=previousRotation;
    }
  };
})();