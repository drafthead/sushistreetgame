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

    // Keep the side scenery moving opposite the chef's forward progress, but
    // make the total travel much more subtle than the previous pass. The two
    // sides still differ slightly so the kitchen retains a little depth.
    const targetLeft=travel*.34;
    const targetRight=travel*.30;
    const state=scene._kitchenSmoothParallax||(scene._kitchenSmoothParallax={left:targetLeft,right:targetRight});

    // Follow the target more slowly as well. This gives each hop a long, soft
    // background glide instead of making the wall art keep pace with the chef.
    const dt=Math.min(Math.max(Number(delta)||16.667,1),50)/1000;
    const follow=1-Math.exp(-dt*2.6);
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
  // after that wrapper in the same Phaser frame and replaces it with this
  // slower, reduced-distance smoothed value before the browser paints.
  const previousUpdate=proto.update;
  proto.update=function(time,delta){
    const result=previousUpdate.call(this,time,delta);
    updateSmoothParallax(this,delta);
    return result;
  };
})();