(() => {
  const S=window.SS;
  const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:S.W,height:S.H,backgroundColor:'#72d8ff',scale:{mode:Phaser.Scale.NONE,width:S.W,height:S.H},render:{antialias:false,roundPixels:true},input:{activePointers:2},scene:[window.SushiScene]});
  if(game.canvas){game.canvas.style.width='100vw';game.canvas.style.height='100dvh';game.canvas.style.display='block'}
})();
