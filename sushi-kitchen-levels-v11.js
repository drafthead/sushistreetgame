(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(n,m)=>((n%m)+m)%m;
  const isKitchen=level=>typeof S.isKitchenLevel==='function'
    ? S.isKitchenLevel(level)
    : (Math.max(1,Number(level)||1)%5!==0);
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;

  const clearPlateGlow=(scene,plate)=>{
    const glow=plate?.__kitchenPlateGlow;
    if(!glow||glow.cleared)return;
    glow.cleared=true;
    const halo=glow.halo;
    if(!halo?.active)return;
    scene.tweens.killTweensOf(halo);
    scene.tweens.add({
      targets:halo,
      alpha:0,
      scaleX:1.14,
      scaleY:1.14,
      duration:140,
      ease:'Quad.Out',
      onComplete:()=>halo.destroy()
    });
  };

  // Keep the plate cue lightweight: one soft, static halo per plate, no blend
  // mode and no always-running pulse tween. It still reads as collectible but
  // avoids the extra continuous animation cost of the previous double glow.
  const addPlateGlow=(scene,row,plate)=>{
    if(!plate?.active||!plate.__kitchenPlate)return;
    const visualW=Math.max(42,plate.displayWidth||plate.__kitchenPlate.hitWidth||48);
    const visualH=Math.max(20,plate.displayHeight||30);
    const halo=scene.track(scene.add.ellipse(
      plate.x,
      row.y+3,
      visualW*1.34,
      Math.max(20,visualH*.82),
      0xffe9a2,
      .18
    ).setDepth(depth(scene,row.y,43)));
    row.objects?.push(halo);
    plate.__kitchenPlateGlow={halo,cleared:false};
  };

  // Plates ride the same repeating tile phase as the conveyor. The wrap length
  // is an exact multiple of the visual tile spacing, so a plate never drifts
  // away from the tile center it started on after wrapping around the row.
  const baseBuildPlateRow=proto.buildKitchenPlateRow;
  proto.buildKitchenPlateRow=function(row){
    const before=(this.kitchenPlates||[]).length;
    const result=baseBuildPlateRow.call(this,row);
    const created=(this.kitchenPlates||[]).slice(before);
    const centers=row.__kitchenTileCenters||[];
    const tileStep=centers.length>1
      ? Math.max(24,Math.abs(centers[1]-centers[0]))
      : clamp(S.CELL_W*1.08,48,84);
    const firstCenter=centers[0]??(S.PLAY_X+tileStep*.5);
    const cycleStart=firstCenter-tileStep*2;
    const cycleTiles=Math.max(6,Math.ceil((S.PLAY_W+tileStep*4)/tileStep));
    const cycleLength=cycleTiles*tileStep;
    const dir=row.index%2===0?1:-1;
    const speed=16+(row.index%3)*2;

    for(const plate of created){
      plate.__kitchenConveyor={
        vx:dir*speed,
        cycleStart,
        cycleLength,
        row:row.index,
        tileStep
      };
      addPlateGlow(this,row,plate);
    }
    return result;
  };

  // The plate tile art has dimensional shading/transparent edges. Keep one
  // continuous TileSprite across the full row, put a warm wood base underneath
  // any transparent/3D edge pixels, and tint the tile surface toward wood.
  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    const result=baseRenderKitchenRow.call(this,row);
    if(!this._kitchenMode)return result;

    if(row.type==='kitchenPlate'){
      const z=depth(this,row.y,-519);
      const center=S.PLAY_X+S.PLAY_W*.5;
      const wood=this.track(this.add.rectangle(
        center,row.y,S.PLAY_W+8,S.ROW_H+4,0xb77b45,1
      ).setDepth(z));
      row.objects?.push(wood);

      const highlight=this.track(this.add.rectangle(
        center,row.y-S.ROW_H*.34,S.PLAY_W+8,3,0xe3bb82,.34
      ).setDepth(z+.2));
      const shadow=this.track(this.add.rectangle(
        center,row.y+S.ROW_H*.36,S.PLAY_W+8,3,0x754821,.28
      ).setDepth(z+.2));
      row.objects?.push(highlight,shadow);

      const band=(row.objects||[]).find(obj=>
        obj?.texture?.key==='kitchen-tile-3' && typeof obj.tilePositionX==='number'
      );
      if(band){
        band.setTint?.(0xe0ae72);
        band.__kitchenPlateBelt=true;
        row.__kitchenPlateBelt=band;
      }
    }
    return result;
  };

  // Warm the moving board artwork so the current board asset reads more like a
  // wood support than dark gray. Its shape/detail remain untouched.
  const baseBuildBoards=proto.buildKitchenBoards;
  proto.buildKitchenBoards=function(row){
    const before=(row.floaters||[]).length;
    const result=baseBuildBoards.call(this,row);
    const created=(row.floaters||[]).slice(before);
    for(const board of created){
      const children=Array.isArray(board?.list)?board.list:[];
      const art=children.find(child=>String(child?.texture?.key||'').startsWith('kitchen-board-'));
      art?.setTint?.(0xe2ad67);
    }
    return result;
  };

  const makeForwardHint=scene=>{
    if(!scene.player||scene._forwardHint?.active)return;
    const root=scene.track(scene.add.container(scene.player.x,scene.player.y-108)
      .setDepth(depth(scene,scene.player.y,145)));
    const pulse=scene.add.container(0,0);
    root.add(pulse);

    const drawChevron=(y,alpha,scale=1)=>{
      const g=scene.add.graphics();
      g.lineStyle(13,0xd99616,.20*alpha);
      g.lineBetween(-14*scale,y+10*scale,0,y-4*scale);
      g.lineBetween(0,y-4*scale,14*scale,y+10*scale);
      g.lineStyle(6,0xfff3a0,.98*alpha);
      g.lineBetween(-14*scale,y+10*scale,0,y-4*scale);
      g.lineBetween(0,y-4*scale,14*scale,y+10*scale);
      pulse.add(g);
    };
    drawChevron(0,1,1);
    drawChevron(21,.86,.94);

    pulse.setAlpha(.82);
    scene.tweens.add({
      targets:pulse,
      y:-6,
      alpha:1,
      scaleX:1.10,
      scaleY:1.10,
      duration:650,
      yoyo:true,
      repeat:-1,
      ease:'Sine.InOut'
    });
    scene._forwardHint=root;
  };

  const syncForwardHint=scene=>{
    const root=scene._forwardHint;
    if(!root?.active||!scene.player)return;
    const show=scene.runActive&&!scene.runEnded&&(scene.totalHops||0)<4;
    root.setVisible(show);
    if(!show)return;
    root.x=scene.player.x;
    root.y=scene.player.y-108;
    root.setDepth(depth(scene,scene.player.y,145));
  };

  const syncTapPrompt=scene=>{
    const el=document.getElementById('tap-hop-hint');
    if(!el)return;
    const modalOpen=document.getElementById('modal')?.classList.contains('show');
    const show=scene.runActive&&!scene.runEnded&&!modalOpen&&(scene.totalHops||0)<5;
    el.classList.toggle('show',Boolean(show));
  };

  // Move the TileSprite and every uncollected plate by the SAME world-space
  // distance. This is the conveyor: the tiles move, and the plates ride on top
  // of those moving tiles rather than sliding independently over a static row.
  const updatePlateConveyors=(scene,dt)=>{
    if(!scene._kitchenMode)return;

    for(const row of scene.rows||[]){
      if(row?.type!=='kitchenPlate')continue;
      const plates=(scene.kitchenPlates||[]).filter(p=>p?.__kitchenConveyor?.row===row.index);
      const sample=plates.find(p=>p?.active&&!p.__kitchenPlate?.collected)?.__kitchenConveyor;
      if(!sample)continue;
      const dx=sample.vx*dt;
      const band=row.__kitchenPlateBelt;

      if(band?.active){
        const scaleX=Math.max(.0001,Math.abs(Number(band.tileScaleX)||1));
        // Phaser TileSprite texture coordinates move opposite tilePositionX.
        // Convert the desired world-pixel belt movement back into source units.
        band.tilePositionX-=dx/scaleX;
      }

      for(const plate of plates){
        const meta=plate?.__kitchenPlate;
        const conveyor=plate?.__kitchenConveyor;
        if(!plate?.active||!meta||!conveyor)continue;
        if(meta.collected){
          clearPlateGlow(scene,plate);
          continue;
        }

        const next=plate.x+dx;
        plate.x=conveyor.cycleStart+mod(next-conveyor.cycleStart,conveyor.cycleLength);
        const halo=plate.__kitchenPlateGlow?.halo;
        if(halo?.active){
          halo.x=plate.x;
          halo.y=plate.y+5;
        }
      }
    }
  };

  const frameKitchenStartLower=scene=>{
    if(!scene._kitchenMode||!scene.player)return;
    // Put the starting chef in the lower portion of the viewport on every
    // aspect ratio. Using a percentage instead of a fixed offset keeps the
    // framing consistent on phones, tablets and wide desktop windows.
    const desiredScreenY=S.H*.82;
    const maxScroll=Math.max(0,scene.worldH-S.H);
    const scroll=clamp(scene.player.y-desiredScreenY,0,maxScroll);
    scene.cameras.main.scrollY=scroll;
    scene.cameraTargetY=scroll;
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    this._forwardHint=null;
    frameKitchenStartLower(this);
    makeForwardHint(this);
    syncForwardHint(this);
    syncTapPrompt(this);
    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    const result=baseUpdate.call(this,time,delta);
    const dt=Math.min(Math.max(Number(delta)||16.667,1),40)/1000;
    updatePlateConveyors(this,dt);
    syncForwardHint(this);
    syncTapPrompt(this);
    return result;
  };

  const baseOpenLevelSelect=proto.openLevelSelect;
  proto.openLevelSelect=function(...args){
    document.getElementById('tap-hop-hint')?.classList.remove('show');
    return baseOpenLevelSelect.apply(this,args);
  };
})();
