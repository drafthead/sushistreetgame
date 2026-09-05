(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const FISH_OPEN_KEY='giant-fish-1';
  const FISH_CLOSED_KEY='giant-fish-2';
  const FISH_OPEN_SRC='images/fish/1.png';
  const FISH_CLOSED_SRC='images/fish/2.png';

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    this.load.image(FISH_OPEN_KEY,FISH_OPEN_SRC);
    this.load.image(FISH_CLOSED_KEY,FISH_CLOSED_SRC);
  };

  const baseCreateFishSprite=proto.createFishSprite;
  proto.createFishSprite=function(x,y){
    if(!this.textures.exists(FISH_OPEN_KEY))return baseCreateFishSprite.call(this,x,y);

    const depth=this.depthForY?this.depthForY(y,92):12000;
    const c=this.add.container(x,y).setDepth(depth);
    const targetHeight=S.clamp(S.ROW_H*4.05,215,300);

    const shadow=this.add.ellipse(-10,targetHeight*.26,targetHeight*.95,targetHeight*.16,0x282229,.2);
    const openImg=this.add.image(0,0,FISH_OPEN_KEY);
    openImg.setOrigin(.5,.56).setScale(targetHeight/Math.max(1,openImg.height));
    c.add([shadow,openImg]);

    let closedImg=null;
    if(this.textures.exists(FISH_CLOSED_KEY)){
      closedImg=this.add.image(0,0,FISH_CLOSED_KEY);
      closedImg.setOrigin(.5,.56).setScale(targetHeight/Math.max(1,closedImg.height)).setVisible(false);
      c.add(closedImg);
    }

    // The supplied artwork faces right with its open mouth on the right side.
    // The existing fish-failure tween approaches from the left, so keep it
    // unflipped and let the open mouth reach the chef first.
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

    // The fish's existing lunge lasts about 350 ms. Close the mouth just before
    // that movement finishes so the bite happens as the fish settles, instead
    // of leaving the mouth open after it has already stopped.
    if(closedImg){
      this.time.delayedCall(305,()=>{
        if(!c.active||!this.runEnded)return;
        openImg.setVisible(false);
        closedImg.setVisible(true);
      });
    }

    return c;
  };
})();
