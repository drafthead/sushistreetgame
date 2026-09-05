(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const FISH_KEY='giant-fish-1';
  const FISH_SRC='images/fish/1.png';

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    this.load.image(FISH_KEY,FISH_SRC);
  };

  const baseCreateFishSprite=proto.createFishSprite;
  proto.createFishSprite=function(x,y){
    if(!this.textures.exists(FISH_KEY))return baseCreateFishSprite.call(this,x,y);

    const depth=this.depthForY?this.depthForY(y,92):12000;
    const c=this.add.container(x,y).setDepth(depth);
    const img=this.add.image(0,0,FISH_KEY);
    const targetHeight=S.clamp(S.ROW_H*4.05,215,300);
    const scale=targetHeight/Math.max(1,img.height);
    img.setOrigin(.5,.56).setScale(scale);

    const shadow=this.add.ellipse(-10,targetHeight*.26,targetHeight*.95,targetHeight*.16,0x282229,.2);
    c.add([shadow,img]);

    // The supplied artwork faces right with its open mouth on the right side.
    // The existing fish-failure tween approaches from the left, so keep it
    // unflipped and let the mouth reach the chef first.
    this.time.delayedCall(245,()=>{
      if(!this.runEnded||!this.playerArt?.active)return;
      this.tweens.killTweensOf(this.playerArt);
      this.tweens.add({
        targets:this.playerArt,
        x:18,
        y:-4,
        scaleX:.08,
        scaleY:.08,
        alpha:0,
        angle:18,
        duration:155,
        ease:'Quad.In'
      });
      if(this.playerShadow?.active){
        this.tweens.add({targets:this.playerShadow,alpha:0,scaleX:.25,scaleY:.25,duration:150,ease:'Quad.In'});
      }
    });

    return c;
  };
})();
