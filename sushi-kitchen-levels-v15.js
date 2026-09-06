(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const WOOD_KEY='kitchen-flying-wood';
  const WOOD_PATH='images/sushimasters/3/wood/1.png';
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    this.load.image(WOOD_KEY,WOOD_PATH);
  };

  const buildContinuousWoodLane=(scene,row)=>{
    const z=depth(scene,row.y,-520);
    const center=S.PLAY_X+S.PLAY_W*.5;

    // Warm wood underneath guarantees that anti-aliased texture edges can never
    // reveal the old gray flying-sushi lane between repeated plank images.
    const under=scene.track(scene.add.rectangle(
      center,row.y,S.PLAY_W+10,S.ROW_H+4,0x9a643b,1
    ).setDepth(z));
    row.objects?.push(under);

    if(!scene.textures?.exists?.(WOOD_KEY))return;
    const src=scene.textures.get(WOOD_KEY).getSourceImage();
    const sourceH=Math.max(1,src.height||1);
    const sourceW=Math.max(1,src.width||1);
    const targetH=S.ROW_H+4;
    const scale=targetH/sourceH;
    const renderedW=Math.max(8,sourceW*scale);

    // Repeat the actual wood PNG edge-to-edge with a 2px overlap. The overlap
    // deliberately removes any sub-pixel seam, so this reads as one continuous
    // wooden pathway across the entire flying-sushi row.
    const stride=Math.max(6,renderedW-2);
    const start=S.PLAY_X-renderedW;
    const end=S.PLAY_X+S.PLAY_W+renderedW;
    for(let x=start;x<=end;x+=stride){
      const plank=scene.track(scene.add.image(x,row.y,WOOD_KEY)
        .setScale(scale)
        .setOrigin(.5,.5)
        .setDepth(z+2));
      plank.__rowY=row.y;
      row.objects?.push(plank);
    }
  };

  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(this._kitchenMode&&row.type==='kitchenFlying'){
      buildContinuousWoodLane(this,row);
      this.buildKitchenFlyingSushi(row);
      return;
    }
    return baseRenderKitchenRow.call(this,row);
  };
})();
