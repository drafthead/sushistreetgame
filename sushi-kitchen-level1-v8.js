(() => {
  const proto=window.SushiScene.prototype;

  const setFramePosition=(left,right)=>{
    const frame=document.getElementById('kitchen-side-frame');
    if(!frame)return;
    frame.style.setProperty('--kitchen-parallax-left',`${left.toFixed(2)}px`);
    frame.style.setProperty('--kitchen-parallax-right',`${right.toFixed(2)}px`);
  };

  const resetSmoothParallax=scene=>{
    scene._kitchenSmoothParallax={left:0,right:0};
    setFramePosition(0,0);
  };

  const updateSmoothParallax=(scene,delta)=>{
    if(!scene?._kitchenMode||!scene.player){
      if(scene?._kitchenSmoothParallax)resetSmoothParallax(scene);
      return;
    }

    const startY=scene.rowY(0);
    const travel=Math.max(0,startY-scene.player.y);
    const targetLeft=travel*.58;
    const targetRight=travel*.52;
    const state=scene._kitchenSmoothParallax||(scene._kitchenSmoothParallax={left:targetLeft,right:targetRight});

    // Ease toward the new wall position instead of tying the background
    // directly to the 128 ms hop tween. This makes each step feel like one
    // continuous glide through the kitchen rather than a short visual jerk.
    const dt=Math.min(Math.max(Number(delta)||16.667,1),50)/1000;
    const follow=1-Math.exp(-dt*5.2);
    state.left+=(targetLeft-state.left)*follow;
    state.right+=(targetRight-state.right)*follow;

    if(Math.abs(targetLeft-state.left)<.02)state.left=targetLeft;
    if(Math.abs(targetRight-state.right)<.02)state.right=targetRight;
    setFramePosition(state.left,state.right);
  };

  const previousStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=previousStartLevel.call(this,level,opt);
    resetSmoothParallax(this);
    return result;
  };

  // V7 still computes its instantaneous parallax position internally. V8 runs
  // after that wrapper in the same Phaser frame and replaces it with the
  // smoothed value before the browser paints, so there is no visible snap.
  const previousUpdate=proto.update;
  proto.update=function(time,delta){
    const result=previousUpdate.call(this,time,delta);
    updateSmoothParallax(this,delta);
    return result;
  };
})();