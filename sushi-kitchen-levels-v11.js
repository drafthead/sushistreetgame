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
    for(const obj of [glow.outer,glow.inner]){
      if(!obj?.active)continue;
      scene.tweens.killTweensOf(obj);
      scene.tweens.add({
        targets:obj,
        alpha:0,
        scaleX:1.35,
        scaleY:1.35,
        duration:180,
        ease:'Quad.Out',
        onComplete:()=>obj.destroy()
      });
    }
  };

  const addPlateGlow=(scene,row,plate)=>{
    if(!plate?.active||!plate.__kitchenPlate)return;
    const visualW=Math.max(42,plate.displayWidth||plate.__kitchenPlate.hitWidth||48);
    const visualH=Math.max(20,plate.displayHeight||30);
    const z=depth(scene,row.y,43);
    const outer=scene.track(scene.add.ellipse(
      plate.x,row.y+2,visualW*1.55,Math.max(24,visualH*1.04),0xffe27a,.22
    ).setDepth(z));
    const inner=scene.track(scene.add.ellipse(
      plate.x,row.y+1,visualW*1.18,Math.max(18,visualH*.76),0xffffff,.30
    ).setDepth(z+1));

    if(Phaser?.BlendModes?.ADD!==undefined){
      outer.setBlendMode(Phaser.BlendModes.ADD);
      inner.setBlendMode(Phaser.BlendModes.ADD);
    }
    row.objects?.push(outer,inner);
    plate.__kitchenPlateGlow={outer,inner,cleared:false};

    scene.tweens.add({
      targets:outer,
      scaleX:1.14,
      scaleY:1.18,
      alpha:.44,
      duration:760,
      yoyo:true,
      repeat:-1,
      ease:'Sine.InOut'
    });
    scene.tweens.add({
      targets:inner,
      alpha:.50,
      duration:620,
      yoyo:true,
      repeat:-1,
      ease:'Sine.InOut'
    });
  };

  // Plates now behave like desirable items riding a slow conveyor. All plates
  // in one row share a speed/direction so their spacing stays stable.
  const baseBuildPlateRow=proto.buildKitchenPlateRow;
  proto.buildKitchenPlateRow=function(row){
    const before=(this.kitchenPlates||[]).length;
    const result=baseBuildPlateRow.call(this,row);
    const created=(this.kitchenPlates||[]).slice(before);
    const dir=row.index%2===0?1:-1;
    const speed=18+(row.index%3)*2;
    const left=S.PLAY_X-46;
    const right=S.PLAY_X+S.PLAY_W+46;
    const cycleStart=left;
    const cycleLength=Math.max(120,right-left);

    for(const plate of created){
      plate.__kitchenConveyor={
        vx:dir*speed,
        cycleStart,
        cycleLength,
        row:row.index
      };
      addPlateGlow(this,row,plate);
    }
    return result;
  };

  // The plate tile art has dimensional shading/transparent edges. Instead of
  // letting the old charcoal underlay show through those edges, put a warm wood
  // base beneath the connected TileSprite and tint the belt itself toward wood.
  const baseRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    const result=baseRenderKitchenRow.call(this,row);
    if(!this._kitchenMode)return result;

    if(row.type==='kitchenPlate'){
      const z=depth(this,row.y,-519);
      const center=S.PLAY_X+S.PLAY_W*.5;
      const wood=this.track(this.add.rectangle(
        center,row.y,S.PLAY_W+6,S.ROW_H+2,0xb77b45,1
      ).setDepth(z));
      row.objects?.push(wood);

      const highlight=this.track(this.add.rectangle(
        center,row.y-S.ROW_H*.34,S.PLAY_W+6,3,0xe3bb82,.34
      ).setDepth(z+.2));
      const shadow=this.track(this.add.rectangle(
        center,row.y+S.ROW_H*.36,S.PLAY_W+6,3,0x754821,.28
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
    const root=scene.track(scene.add.container(scene.player.x,scene.player.y-52)
      .setDepth(depth(scene,scene.player.y,145)));
    const pulse=scene.add.container(0,0);
    root.add(pulse);

    const drawChevron=(y,alpha,scale=1)=>{
      const g=scene.add.graphics();
      g.lineStyle(10,0xd99616,.22*alpha);
      g.lineBetween(-10*scale,y+7*scale,0,y-3*scale);
      g.lineBetween(0,y-3*scale,10*scale,y+7*scale);
      g.lineStyle(5,0xfff3a0,.96*alpha);
      g.lineBetween(-10*scale,y+7*scale,0,y-3*scale);
      g.lineBetween(0,y-3*scale,10*scale,y+7*scale);
      pulse.add(g);
    };
    drawChevron(0,1,1);
    drawChevron(14,.86,.92);

    pulse.setAlpha(0);
    scene.tweens.add({
      targets:pulse,
      y:-5,
      alpha:1,
      scaleX:1.08,
      scaleY:1.08,
      duration:560,
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
    root.y=scene.player.y-52;
    root.setDepth(depth(scene,scene.player.y,145));
  };

  const syncTapPrompt=scene=>{
    const el=document.getElementById('tap-hop-hint');
    if(!el)return;
    const show=scene.runActive&&!scene.runEnded&&!document.querySelector('#modal.show')&&(scene.totalHops||0)<3;
    el.classList.toggle('show',Boolean(show));
  };

  const updatePlateConveyors=(scene,dt)=>{
    if(!scene._kitchenMode)return;
    for(const plate of scene.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      const conveyor=plate?.__kitchenConveyor;
      if(!plate?.active||!meta||!conveyor)continue;
      if(meta.collected){
        clearPlateGlow(scene,plate);
        continue;
      }

      const next=plate.x+conveyor.vx*dt;
      plate.x=conveyor.cycleStart+mod(next-conveyor.cycleStart,conveyor.cycleLength);
      const glow=plate.__kitchenPlateGlow;
      if(glow&&!glow.cleared){
        if(glow.outer?.active){glow.outer.x=plate.x;glow.outer.y=plate.y+4;}
        if(glow.inner?.active){glow.inner.x=plate.x;glow.inner.y=plate.y+3;}
      }
    }

    for(const row of scene.rows||[]){
      if(row?.type!=='kitchenPlate'||!row.__kitchenPlateBelt)continue;
      const dir=row.index%2===0?1:-1;
      const speed=18+(row.index%3)*2;
      // The tile movement is intentionally much slower than the plates; it is
      // just enough to sell the conveyor without making the floor visually busy.
      row.__kitchenPlateBelt.tilePositionX-=dir*speed*dt*.28;
    }
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    this._forwardHint=null;
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
