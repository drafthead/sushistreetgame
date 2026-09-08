(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);
  const PLATE_FILES=[1,2,3,4];
  const PLATE_POINTS={1:5,2:10,3:20,4:35};
  const BELT_KEY='kitchen-tile-5';
  const BELT_PATH='images/kitchen/tiles/5.png';

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    this.load.image(BELT_KEY,BELT_PATH);
  };

  const addRowObject=(scene,row,obj)=>{
    if(!obj)return obj;
    scene.track(obj);
    row.objects?.push(obj);
    return obj;
  };

  const buildPlateConveyorV17=(scene,row)=>{
    const center=S.PLAY_X+S.PLAY_W*.5;
    const z=depth(scene,row.y,-520);

    // A narrow dark backing only exists to hide antialiasing at the outer edges.
    // The visible conveyor itself is entirely made from connected tile-5 images.
    addRowObject(scene,row,scene.add.rectangle(
      center,row.y,S.PLAY_W+12,S.ROW_H+6,0x514b45,1
    ).setDepth(z));

    let renderedW=clamp(S.CELL_W*1.04,48,84);
    let scale=1;
    if(exists(scene,BELT_KEY)){
      const src=scene.textures.get(BELT_KEY).getSourceImage();
      const sourceH=Math.max(1,src.height||1);
      const sourceW=Math.max(1,src.width||1);
      const targetH=S.ROW_H+4;
      scale=targetH/sourceH;
      renderedW=Math.max(12,sourceW*scale);
    }

    // Overlap every repeated panel by 3px. This deliberately eliminates the
    // transparent/3D edge gap that made the old metal tiles look disconnected.
    const step=Math.max(10,renderedW-3);
    const cycleStart=S.PLAY_X-step*3;
    const count=Math.max(10,Math.ceil((S.PLAY_W+step*6)/step)+1);
    const cycleLength=count*step;
    const tiles=[];

    for(let i=0;i<count;i++){
      const baseX=cycleStart+i*step;
      let tile;
      if(exists(scene,BELT_KEY)){
        tile=scene.add.image(baseX,row.y,BELT_KEY)
          .setScale(scale)
          .setOrigin(.5,.5)
          .setDepth(z+2);
      }else{
        tile=scene.add.rectangle(baseX,row.y,step+3,S.ROW_H+4,0x8b8177,1)
          .setDepth(z+2);
      }
      tile.__conveyorBaseX=baseX;
      addRowObject(scene,row,tile);
      tiles.push(tile);
    }

    const dir=row.index%2===0?1:-1;
    const baseSpeed=32+(row.index%3)*4;
    row.__plateConveyorV12={
      vx:dir*baseSpeed,
      phase:0,
      cycleStart,
      cycleLength,
      step,
      tiles,
      plates:[]
    };

    // Select evenly spaced physical belt panels and place the plates directly
    // on those panel centers. V12/V13/V16 then move plates and chef with this
    // exact same conveyor state, keeping everything locked together.
    const visibleTiles=tiles.filter(tile=>
      tile.__conveyorBaseX>=S.PLAY_X+step*.45 &&
      tile.__conveyorBaseX<=S.PLAY_X+S.PLAY_W-step*.45
    );
    const plateCount=S.W>=720?4:3;
    const selected=[];
    for(let i=0;i<plateCount;i++){
      const index=Math.round((i+.5)*visibleTiles.length/plateCount-.5);
      const slot=visibleTiles[clamp(index,0,Math.max(0,visibleTiles.length-1))];
      if(slot&&!selected.includes(slot))selected.push(slot);
    }

    const offset=row.index%PLATE_FILES.length;
    selected.forEach((slot,i)=>{
      const file=PLATE_FILES[(i+offset)%PLATE_FILES.length];
      const plateTexture=`kitchen-plate-${file}`;
      const baseX=slot.__conveyorBaseX;
      const y=row.y-2;
      let plate;

      if(exists(scene,plateTexture)){
        plate=scene.add.image(baseX,y,plateTexture).setDepth(depth(scene,y,52));
        const targetH=clamp(S.ROW_H*.72,38,52);
        plate.setScale(targetH/Math.max(1,plate.height||1)).setOrigin(.5,.6);
      }else{
        plate=scene.add.ellipse(baseX,y,44,20,0xeffae8,1).setDepth(depth(scene,y,52));
      }

      plate.__rowY=row.y;
      plate.__conveyorBaseX=baseX;
      plate.__kitchenPlate={
        file,
        points:PLATE_POINTS[file]||5,
        collected:false,
        rowIndex:row.index,
        hitWidth:clamp(S.CELL_W*.9,40,64)
      };
      addRowObject(scene,row,plate);
      scene.kitchenPlates.push(plate);
      row.__plateConveyorV12.plates.push(plate);

      const halo=scene.add.ellipse(
        baseX,row.y+3,
        Math.max(44,(plate.displayWidth||44)*1.27),
        Math.max(20,(plate.displayHeight||26)*.78),
        0xffe9a2,.12
      ).setDepth(depth(scene,row.y,44));
      halo.__conveyorBaseX=baseX;
      addRowObject(scene,row,halo);
      plate.__kitchenPlateHaloV12=halo;
    });
  };

  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(this._kitchenMode&&row.type==='kitchenPlate'){
      buildPlateConveyorV17(this,row);
      return;
    }
    return baseRenderKitchenRow.call(this,row);
  };
})();
