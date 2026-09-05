(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(n,m)=>((n%m)+m)%m;
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;
  const exists=(scene,key)=>scene.textures?.exists?.(key);
  const PLATE_FILES=[1,2,3,4];
  const PLATE_POINTS={1:5,2:10,3:20,4:35};

  const addRowObject=(scene,row,obj)=>{
    if(!obj)return obj;
    scene.track(obj);
    row.objects?.push(obj);
    return obj;
  };

  const buildExplicitPlateConveyor=(scene,row)=>{
    const center=S.PLAY_X+S.PLAY_W*.5;
    const z=depth(scene,row.y,-520);

    addRowObject(scene,row,scene.add.rectangle(
      center,row.y,S.PLAY_W+10,S.ROW_H+4,0xb77b45,1
    ).setDepth(z));
    addRowObject(scene,row,scene.add.rectangle(
      center,row.y-S.ROW_H*.36,S.PLAY_W+10,3,0xe7c28d,.32
    ).setDepth(z+.15));
    addRowObject(scene,row,scene.add.rectangle(
      center,row.y+S.ROW_H*.38,S.PLAY_W+10,3,0x754821,.28
    ).setDepth(z+.15));

    const texture='kitchen-tile-3';
    let step=clamp(S.CELL_W*1.02,46,82);
    let scale=1;
    if(exists(scene,texture)){
      const src=scene.textures.get(texture).getSourceImage();
      const sourceH=Math.max(1,src.height||1);
      const sourceW=Math.max(1,src.width||1);
      const targetH=S.ROW_H+2;
      scale=targetH/sourceH;
      // Intentionally overlap neighboring tile images by ~2px. The source art
      // has dimensional/transparent side edges; this removes any visual gap and
      // makes the row read as one continuous physical conveyor belt.
      step=Math.max(24,sourceW*scale-2);
    }

    const cycleStart=S.PLAY_X-step*2.5;
    const count=Math.max(8,Math.ceil((S.PLAY_W+step*5)/step)+1);
    const cycleLength=count*step;
    const tiles=[];
    const centers=[];

    for(let i=0;i<count;i++){
      const baseX=cycleStart+i*step;
      let tile;
      if(exists(scene,texture)){
        tile=scene.add.image(baseX,row.y,texture)
          .setScale(scale)
          .setOrigin(.5,.5)
          .setTint(0xe0ae72)
          .setDepth(z+2);
      }else{
        tile=scene.add.rectangle(baseX,row.y,step+2,S.ROW_H+2,0xc58a55,1).setDepth(z+2);
      }
      tile.__conveyorBaseX=baseX;
      addRowObject(scene,row,tile);
      tiles.push(tile);
      centers.push(baseX);
    }

    row.__kitchenTileCenters=centers;
    const dir=row.index%2===0?1:-1;
    // About 2x the V11 speed so the belt reads clearly as moving machinery.
    const speed=32+(row.index%3)*4;
    row.__plateConveyorV12={
      vx:dir*speed,
      phase:0,
      cycleStart,
      cycleLength,
      step,
      tiles,
      plates:[]
    };

    const visibleTiles=tiles.filter(tile=>
      tile.__conveyorBaseX>=S.PLAY_X+step*.35 &&
      tile.__conveyorBaseX<=S.PLAY_X+S.PLAY_W-step*.35
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

      // Low-compute collectible cue: one faint static halo. It rides the same
      // tile as the plate and has no continuous tween or additive blend mode.
      const halo=scene.add.ellipse(
        baseX,row.y+3,
        Math.max(44,(plate.displayWidth||44)*1.27),
        Math.max(20,(plate.displayHeight||26)*.78),
        0xffe9a2,.14
      ).setDepth(depth(scene,row.y,44));
      halo.__conveyorBaseX=baseX;
      addRowObject(scene,row,halo);
      plate.__kitchenPlateHaloV12=halo;
    });
  };

  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(this._kitchenMode&&row.type==='kitchenPlate'){
      buildExplicitPlateConveyor(this,row);
      return;
    }
    return baseRenderKitchenRow.call(this,row);
  };

  const updateExplicitConveyors=(scene,dt)=>{
    if(!scene._kitchenMode)return;
    for(const row of scene.rows||[]){
      const state=row?.__plateConveyorV12;
      if(!state)continue;
      state.phase+=state.vx*dt;

      for(const tile of state.tiles){
        if(!tile?.active)continue;
        tile.x=state.cycleStart+mod(tile.__conveyorBaseX+state.phase-state.cycleStart,state.cycleLength);
      }

      for(const plate of state.plates){
        if(!plate?.active)continue;
        const meta=plate.__kitchenPlate;
        const halo=plate.__kitchenPlateHaloV12;
        if(meta?.collected){
          if(halo?.active)halo.setVisible(false);
          continue;
        }
        plate.x=state.cycleStart+mod(plate.__conveyorBaseX+state.phase-state.cycleStart,state.cycleLength);
        if(halo?.active){
          halo.x=plate.x;
          halo.y=plate.y+5;
        }
      }
    }
  };

  const destroyOldForwardHint=scene=>{
    const old=scene._forwardHint;
    if(!old)return;
    try{
      for(const child of old.list||[])scene.tweens.killTweensOf(child);
      scene.tweens.killTweensOf(old);
      old.destroy(true);
    }catch(_){}
    scene._forwardHint=null;
  };

  const makeForwardHintV12=scene=>{
    if(!scene.player)return;
    destroyOldForwardHint(scene);

    const root=addRowObject(scene,{objects:[]},scene.add.container(
      scene.player.x,scene.player.y-112
    ).setDepth(depth(scene,scene.player.y,148)));
    const pulse=scene.add.container(0,0);
    root.add(pulse);

    // Filled chevrons give the arrow a real pointed tip. The prior stroked V
    // could look clipped/flat at its apex depending on renderer line caps.
    const addChevron=(y,scaleFactor,alpha)=>{
      const outer=scene.add.graphics();
      outer.fillStyle(0xd99616,.26*alpha);
      outer.fillPoints([
        {x:-17*scaleFactor,y:y+10*scaleFactor},
        {x:0,y:y-8*scaleFactor},
        {x:17*scaleFactor,y:y+10*scaleFactor},
        {x:12*scaleFactor,y:y+16*scaleFactor},
        {x:0,y:y+3*scaleFactor},
        {x:-12*scaleFactor,y:y+16*scaleFactor}
      ],true);
      outer.fillStyle(0xfff3a0,.98*alpha);
      outer.fillPoints([
        {x:-14*scaleFactor,y:y+9*scaleFactor},
        {x:0,y:y-6*scaleFactor},
        {x:14*scaleFactor,y:y+9*scaleFactor},
        {x:10*scaleFactor,y:y+13*scaleFactor},
        {x:0,y:y+2*scaleFactor},
        {x:-10*scaleFactor,y:y+13*scaleFactor}
      ],true);
      pulse.add(outer);
    };

    // Roughly 5% larger than the previous cue.
    addChevron(0,1.05,1);
    addChevron(23,.99,.86);
    pulse.setAlpha(.84);
    scene.tweens.add({
      targets:pulse,
      y:-6,
      alpha:1,
      scaleX:1.08,
      scaleY:1.08,
      duration:650,
      yoyo:true,
      repeat:-1,
      ease:'Sine.InOut'
    });
    scene._forwardHint=root;
  };

  const syncForwardHintV12=scene=>{
    const root=scene._forwardHint;
    if(!root?.active||!scene.player)return;
    const show=scene.runActive&&!scene.runEnded&&(scene.totalHops||0)<4;
    root.setVisible(show);
    if(!show)return;
    root.x=scene.player.x;
    root.y=scene.player.y-112;
    root.setDepth(depth(scene,scene.player.y,148));
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    if(this._kitchenMode)makeForwardHintV12(this);
    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    const result=baseUpdate.call(this,time,delta);
    const dt=Math.min(Math.max(Number(delta)||16.667,1),40)/1000;
    updateExplicitConveyors(this,dt);
    if(this._kitchenMode)syncForwardHintV12(this);
    return result;
  };
})();
