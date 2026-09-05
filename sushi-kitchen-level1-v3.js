(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const FLYING_FILES=[1];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY?scene.depthForY(y,o):10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);

  // V3 framing: the side artwork is now handled by a fixed DOM overlay so it
  // cannot disappear because of world/camera coordinates. Only the bottom and
  // top kitchen caps remain in Phaser world space and scroll with the route.
  proto.buildKitchenBackdrop=function(){
    const screenCenter=S.OVERSCAN_X+S.W*.5;

    if(exists(this,'kitchen-bg-bottom')){
      const img=this.track(this.add.image(screenCenter,this.cameras.main.scrollY+S.H,'kitchen-bg-bottom')
        .setOrigin(.5,1)
        .setDepth(depth(this,this.rowY(0),-480)));
      img.setScale(S.W/Math.max(1,img.width||1));
    }

    if(exists(this,'kitchen-bg-top')){
      const y=this.rowY(this.goalRow)+S.ROW_H*.42;
      const img=this.track(this.add.image(screenCenter,y,'kitchen-bg-top')
        .setOrigin(.5,1)
        .setDepth(depth(this,y,-480)));
      img.setScale(S.W/Math.max(1,img.width||1));
    }
  };

  // Flying sushi was much too small in the first kitchen pass. Scale the art
  // to exactly four times the previous target-height range while preserving
  // the source aspect ratio. Cadence remains about one pass every two seconds.
  proto.buildKitchenFlyingSushi=function(row){
    const texture=`kitchen-flying-${FLYING_FILES[row.index%FLYING_FILES.length]}`;
    const dir=row.index%2?1:-1;
    const speed=clamp(340+S.W*.065,355,445);
    const targetH=clamp(S.ROW_H*2.32,120,168);

    let prototypeW=clamp(S.CELL_W*3.6,150,260);
    if(exists(this,texture)){
      const src=this.textures.get(texture).getSourceImage();
      prototypeW=(src.width||1)*(targetH/Math.max(1,src.height||1));
    }

    const buffer=Math.max(90,prototypeW*.9);
    const cycleStart=S.PLAY_X-buffer;
    const cycleLength=S.PLAY_W+buffer*2;
    const count=Math.max(1,Math.round(cycleLength/(speed*2)));
    const spacing=cycleLength/count;

    for(let i=0;i<count;i++){
      const x=cycleStart+i*spacing;
      let obj;
      if(exists(this,texture)){
        obj=this.add.image(x,row.y-2,texture);
        obj.setScale(targetH/Math.max(1,obj.height||1)).setFlipX(dir<0);
      }else{
        obj=this.add.ellipse(x,row.y-2,prototypeW,targetH*.62,0x11151a,1);
      }

      obj.setDepth(depth(this,row.y,60));
      obj.__rowY=row.y;
      obj.__kitchenFlying={
        row:row.index,
        width:Math.max(80,(obj.displayWidth||prototypeW)*.68),
        vx:dir*speed,
        cycleStart,
        cycleLength
      };
      this.track(obj);
      row.objects.push(obj);
      this.kitchenFlyingSushi.push(obj);
    }
  };
})();