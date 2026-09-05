(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const baseFinishDelivery=proto.finishDelivery;

  proto.showRestaurantClosedSign=function(){
    if(!this.add||!this.track)return null;
    const x=S.PLAY_X+S.PLAY_W/2;
    const y=this.rowY(this.goalRow)+8;
    const depth=this.depthForY?this.depthForY(y+24,86):14000;
    const c=this.track(this.add.container(x,y).setDepth(depth));
    const g=this.add.graphics();
    c.add(g);

    g.fillStyle(0x282229,.28);
    g.fillRect(-78,-22,164,54);
    g.fillStyle(0xf8fff6,1);
    g.fillRect(-84,-30,168,54);
    g.fillStyle(0xe84028,1);
    g.fillRect(-78,-24,156,42);
    g.fillStyle(0x272b37,1);
    g.fillRect(-3,18,6,30);

    const label=this.add.text(0,-4,'CLOSED\n本日休業',{
      fontFamily:'Inter,system-ui,sans-serif',
      fontSize:'17px',
      fontStyle:'900',
      align:'center',
      color:'#fff7ec',
      lineSpacing:-2
    }).setOrigin(.5);
    c.add(label);
    c.setScale(.55).setAlpha(0);
    this.tweens.add({targets:c,scaleX:1,scaleY:1,alpha:1,duration:260,ease:'Back.Out'});
    return c;
  };

  proto.finishDelivery=function(){
    if(this.runEnded)return;
    if(this.collectedCount()<this.minimumCount()){
      this.runEnded=true;
      this.inputLocked=true;
      this.clearBufferedMove?.();
      this.cancelGesture?.();
      this.showRestaurantClosedSign();
      const body='You did not get enough ingredients. Please try again and go to enough shops to get the ingredients that you need to open your restaurant.';
      this.time.delayedCall(550,()=>{
        if(this.runEnded)this.showResult(false,'NOT ENOUGH INGREDIENTS',body,0);
      });
      return;
    }
    return baseFinishDelivery.call(this);
  };
})();
