(() => {
  const S=window.SS;
  const game=new Phaser.Game({
    type:Phaser.AUTO,
    parent:'game',
    width:S.W,
    height:S.H,
    backgroundColor:'#72d8ff',
    scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},
    render:{antialias:false,roundPixels:true},
    input:{activePointers:2},
    scene:[window.SushiScene]
  });
  if(game.canvas){game.canvas.style.display='block';game.canvas.style.maxWidth='none';game.canvas.style.maxHeight='none'}
})();
