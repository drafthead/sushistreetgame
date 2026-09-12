(() => {
  const S=window.SS;
  const game=new Phaser.Game({
    type:Phaser.AUTO,
    parent:'game',
    width:S.W,
    height:S.H,
    backgroundColor:'#72d8ff',
    scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},
    // Sub-pixel positions are important for slow conveyors, moving boards and
    // camera motion. roundPixels=true was forcing those objects into visible
    // one-pixel steps, especially on high-DPI iPhones.
    render:{
      antialias:false,
      roundPixels:false,
      powerPreference:'high-performance'
    },
    // Let Phaser smooth short frame-time spikes instead of feeding every tiny
    // delta variation directly into visible world motion.
    fps:{
      target:60,
      smoothStep:true,
      deltaHistory:10,
      panicMax:120,
      forceSetTimeOut:false
    },
    input:{activePointers:2},
    scene:[window.SushiScene]
  });
  if(game.canvas){
    game.canvas.style.display='block';
    game.canvas.style.maxWidth='none';
    game.canvas.style.maxHeight='none';
  }
})();
