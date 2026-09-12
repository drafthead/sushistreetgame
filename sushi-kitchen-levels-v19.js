(() => {
  const S=window.SS, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mod=(n,m)=>((n%m)+m)%m;
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;
  const BELT_KEY='kitchen-tile-5';
  const WOOD_KEY='kitchen-flying-wood';
  const PLATE_FILES=[1,2,3,4];
  const PLATE_POINTS={1:5,2:10,3:20,4:35};

  const isKitchen=level=>typeof S.isKitchenLevel==='function'
    ? S.isKitchenLevel(level)
    : (Math.max(1,Number(level)||1)%5!==0);

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  const addRowObject=(scene,row,obj)=>{
    if(!obj)return obj;
    scene.track(obj);
    row.objects?.push(obj);
    return obj;
  };

  const sumMenu=menu=>{
    let n=0;
    if(menu)for(const key in menu)n+=Number(menu[key])||0;
    return n;
  };

  // DOM/HUD work used to run every rendered frame through several wrappers.
  // Only touch the DOM when a value the player can actually see has changed.
  const legacyUpdateHud=proto.updateHud;
  proto.updateHud=function(...args){
    const ingredients=this._kitchenMode
      ? Number(this.menuCollected?.kitchenChoice)||0
      : sumMenu(this.menuCollected);
    const sig=[
      this.selectedLevel||0,
      this.score||0,
      ingredients,
      this.kitchenPlateCount||0,
      this.runEnded?1:0
    ].join('|');
    if(this._perfHudSignatureV19===sig)return;
    this._perfHudSignatureV19=sig;
    return legacyUpdateHud.apply(this,args);
  };

  // Delta-aware camera interpolation is less frame-rate dependent than a fixed
  // percentage per frame and allows sub-pixel scrolling on 30/60/120 Hz phones.
  proto.updateCamera=function(dt){
    if(!this.player)return;
    const seconds=clamp(Number(dt)||0,0,.05);
    const target=clamp(
      this.rowY(this.maxRow)-S.H*S.CAMERA_FOLLOW_Y,
      0,
      Math.max(0,this.worldH-S.H)
    );
    this.cameraTargetY=Math.min(this.cameraTargetY,target);
    if(this.runStarted)this.cameraTargetY=Math.max(0,this.cameraTargetY-S.CAMERA_CREEP*seconds);

    const cur=this.cameras.main.scrollY;
    const d=this.cameraTargetY-cur;
    const rate=Math.abs(d)>S.ROW_H*1.2?7.5:5;
    const follow=1-Math.exp(-seconds*rate);
    this.cameras.main.scrollY=Math.abs(d)<.02?this.cameraTargetY:cur+d*follow;
    this.cameras.main.scrollX=S.OVERSCAN_X;
  };

  // Remove the many always-running board bob tweens. Horizontal motion is the
  // mechanic; keeping the wood level makes its travel easier to read and cuts
  // continuous tween work on mobile Safari.
  const legacyBuildBoards=proto.buildKitchenBoards;
  proto.buildKitchenBoards=function(row){
    const before=(row?.floaters||[]).length;
    const result=legacyBuildBoards.call(this,row);
    const created=(row?.floaters||[]).slice(before);
    for(const board of created){
      this.tweens.killTweensOf(board);
      board.y=row.y-2;
      board.angle=0;
    }
    return result;
  };

  // Keep the requested heat/steam cue, but make the steam static instead of an
  // infinite tween per pot.
  const legacyBuildPots=proto.buildKitchenPots;
  proto.buildKitchenPots=function(row){
    const before=(row?.objects||[]).length;
    const result=legacyBuildPots.call(this,row);
    const added=(row?.objects||[]).slice(before);
    for(const obj of added){
      if(Array.isArray(obj?.list)&&!obj.__kitchenHotPot){
        this.tweens.killTweensOf(obj);
        obj.setAlpha?.(.36);
      }
    }
    return result;
  };

  const addWarmSafeFloor=(scene,row)=>{
    const z=depth(scene,row.y,-520);
    const g=scene.add.graphics().setDepth(z);
    const left=S.PLAY_X, top=row.y-S.ROW_H*.5;
    g.fillStyle(0x9a7048,1);
    g.fillRect(left-2,top,S.PLAY_W+4,S.ROW_H);
    g.fillStyle(0xd2aa76,1);
    g.fillRect(left-2,top+3,S.PLAY_W+4,S.ROW_H-6);
    const plankW=clamp(S.CELL_W*1.5,60,96);
    g.lineStyle(1,0x8f653f,.28);
    for(let x=left;x<=left+S.PLAY_W;x+=plankW)g.lineBetween(x,top+5,x,top+S.ROW_H-5);
    g.lineStyle(2,0xf1d0a2,.26);
    g.lineBetween(left,top+5,left+S.PLAY_W,top+5);
    addRowObject(scene,row,g);
  };

  const addOptimizedWater=(scene,row)=>{
    const z=depth(scene,row.y,-520);
    const g=scene.add.graphics().setDepth(z);
    const left=S.PLAY_X, top=row.y-S.ROW_H*.5;
    g.fillStyle(0x176b9b,1);
    g.fillRect(left,top,S.PLAY_W,S.ROW_H);
    g.fillStyle(0x2eace0,1);
    g.fillRect(left,top+3,S.PLAY_W,S.ROW_H-6);
    g.fillStyle(0x9cedff,.48);
    const rippleCount=Math.max(4,Math.min(7,Math.round(S.PLAY_W/150)));
    for(let i=0;i<rippleCount;i++){
      const x=left+(i+.5)*S.PLAY_W/rippleCount;
      const yy=row.y+((i%3)-1)*8;
      g.fillRect(x-14,yy,28,2);
    }
    addRowObject(scene,row,g);
    scene.buildKitchenBoards(row);
  };

  const buildOptimizedPlateConveyor=(scene,row)=>{
    const z=depth(scene,row.y,-520);
    const center=S.PLAY_X+S.PLAY_W*.5;
    addRowObject(scene,row,scene.add.rectangle(
      center,row.y,S.PLAY_W+12,S.ROW_H+6,0x514b45,1
    ).setDepth(z));

    let scale=1, renderedW=clamp(S.CELL_W*1.04,48,84);
    let band=null;
    if(scene.textures?.exists?.(BELT_KEY)){
      const src=scene.textures.get(BELT_KEY).getSourceImage();
      const sourceH=Math.max(1,src.height||1);
      const sourceW=Math.max(1,src.width||1);
      scale=(S.ROW_H+4)/sourceH;
      renderedW=Math.max(12,sourceW*scale);
      band=scene.add.tileSprite(center,row.y,S.PLAY_W+12,S.ROW_H+4,BELT_KEY)
        .setDepth(z+2);
      band.tileScaleX=scale;
      band.tileScaleY=scale;
      band.tilePositionX=0;
      band.tilePositionY=0;
      addRowObject(scene,row,band);
    }

    const step=Math.max(12,renderedW);
    const cycleStart=S.PLAY_X-step*3;
    const cycleTiles=Math.max(10,Math.ceil((S.PLAY_W+step*6)/step));
    const cycleLength=cycleTiles*step;
    const dir=row.index%2===0?1:-1;
    const speed=32+(row.index%3)*4;
    const state=row.__plateConveyorV12={
      vx:dir*speed,
      phase:0,
      cycleStart,
      cycleLength,
      step,
      tiles:[],
      band,
      plates:[]
    };

    const slots=[];
    for(let x=cycleStart;x<cycleStart+cycleLength;x+=step){
      if(x>=S.PLAY_X+step*.35&&x<=S.PLAY_X+S.PLAY_W-step*.35)slots.push(x);
    }
    row.__kitchenTileCenters=slots.slice();

    const plateCount=S.W>=720?8:6;
    const selected=[];
    for(let i=0;i<plateCount&&slots.length;i++){
      const idx=clamp(Math.round((i+.5)*slots.length/plateCount-.5),0,slots.length-1);
      const x=slots[idx];
      if(!selected.includes(x))selected.push(x);
    }

    selected.forEach((baseX,i)=>{
      const file=PLATE_FILES[(i+row.index)%PLATE_FILES.length];
      const key=`kitchen-plate-${file}`;
      const y=row.y-2;
      let plate;
      if(scene.textures?.exists?.(key)){
        plate=scene.add.image(baseX,y,key).setDepth(depth(scene,y,52));
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
        hitWidth:clamp(S.CELL_W*.96,44,70)
      };
      plate.__perfPrevXV19=baseX;
      addRowObject(scene,row,plate);
      scene.kitchenPlates.push(plate);
      state.plates.push(plate);

      const halo=scene.add.ellipse(
        baseX,row.y+3,
        Math.max(42,(plate.displayWidth||44)*1.18),
        Math.max(18,(plate.displayHeight||26)*.7),
        0xffe9a2,.08
      ).setDepth(depth(scene,row.y,44));
      addRowObject(scene,row,halo);
      plate.__kitchenPlateHaloV12=halo;
    });
  };

  const buildOptimizedFlyingLane=(scene,row)=>{
    const z=depth(scene,row.y,-520);
    const center=S.PLAY_X+S.PLAY_W*.5;
    addRowObject(scene,row,scene.add.rectangle(
      center,row.y,S.PLAY_W+10,S.ROW_H+4,0x9a643b,1
    ).setDepth(z));

    if(scene.textures?.exists?.(WOOD_KEY)){
      const src=scene.textures.get(WOOD_KEY).getSourceImage();
      const scale=(S.ROW_H+4)/Math.max(1,src.height||1);
      const band=scene.add.tileSprite(center,row.y,S.PLAY_W+10,S.ROW_H+4,WOOD_KEY)
        .setDepth(z+2);
      band.tileScaleX=scale;
      band.tileScaleY=scale;
      addRowObject(scene,row,band);
    }
    scene.buildKitchenFlyingSushi(row);
  };

  // Replace high-object-count kitchen rows before the older render wrappers run.
  const legacyRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    if(!this._kitchenMode)return legacyRenderKitchenRow.call(this,row);
    if(row.type==='water'){addOptimizedWater(this,row);return;}
    if(row.type==='kitchenSafe'){addWarmSafeFloor(this,row);return;}
    if(row.type==='kitchenPlate'){buildOptimizedPlateConveyor(this,row);return;}
    if(row.type==='kitchenFlying'){buildOptimizedFlyingLane(this,row);return;}
    return legacyRenderKitchenRow.call(this,row);
  };

  // Kitchen movement without the invisible-shadow tween. Use the same short,
  // immediate hop for both taps and swipes and preserve the chef's real X on
  // forward/back hops after moving supports have carried them.
  const legacyRequestMove=proto.requestMove;
  const hideTapPrompt=()=>document.getElementById('tap-hop-hint')?.classList.remove('show');

  const executeKitchenMove=(scene,row,col,lane,x)=>{
    scene.isMoving=true;
    scene.idleMs=0;
    scene.totalHops++;
    scene.score++;
    scene.playerSupport=null;
    scene.playerSupportOffsetX=0;
    if(row>scene.maxRow)scene.maxRow=row;
    hideTapPrompt();

    const y=scene.rowY(row);
    scene.tweens.killTweensOf(scene.player);
    scene.tweens.killTweensOf(scene.playerArt);
    scene.tweens.add({
      targets:scene.player,
      x,y,
      duration:92,
      ease:'Cubic.Out',
      onComplete:()=>{
        if(!scene.player)return;
        scene.player.x=x;
        scene.player.y=y;
        scene.playerRow=row;
        scene.playerCol=nearestCol(scene,x);
        scene.isMoving=false;

        if(lane.type==='water'){
          const support=scene.findSupportAt(row,x);
          if(!support){
            return scene.failRun(
              'SPLASH DOWN',
              'You jumped into the water. A board must be directly under the chef when the jump lands.',
              'water'
            );
          }
          scene.playerSupport=support;
          scene.playerSupportOffsetX=x-support.x;
        }

        scene.collectAt(row);
        scene.updateMissedPickups?.();
        if(lane.type==='goal')return scene.finishDelivery();
        if(scene.bufferedMove){
          const next=scene.bufferedMove;
          scene.bufferedMove=null;
          scene.requestMove(next.dx,next.dy);
        }
      }
    });
    scene.tweens.add({
      targets:scene.playerArt,
      y:-18,
      scaleX:.985,
      scaleY:1.025,
      duration:46,
      yoyo:true,
      ease:'Quad.Out',
      onComplete:()=>scene.playerArt?.setPosition(0,-7).setScale(1)
    });
    scene.playSfx('hop');
  };

  proto.requestMove=function(dx,dy){
    if(!this._kitchenMode)return legacyRequestMove.call(this,dx,dy);
    if(!this.player||!this.canAcceptInput())return;
    if(this.isMoving){this.bufferedMove={dx,dy};return;}

    const currentCol=nearestCol(this,this.player.x);
    const row=clamp(this.playerRow+dy,0,this.goalRow);
    const col=clamp(currentCol+dx,0,S.COLS-1);
    if(row===this.playerRow&&col===currentCol)return;
    if(dy<0&&row<this.maxRow-S.MAX_BACKTRACK)return;
    const lane=this.rows[row];
    if(!lane)return;

    if(this.isBlocked?.(row,col)){
      this.playSfx('bump');
      this.tweens.add({
        targets:this.playerArt,
        x:dx?dx*-4:0,
        y:-4,
        duration:42,
        yoyo:true,
        onComplete:()=>this.playerArt?.setPosition(0,-7)
      });
      return;
    }

    const x=dy!==0
      ? clamp(this.player.x,S.PLAY_X+2,S.PLAY_X+S.PLAY_W-2)
      : this.colX(col);
    this.beginRunClock();
    executeKitchenMove(this,row,col,lane,x);
  };

  const segmentDistanceToZero=(a,b)=>{
    if(!Number.isFinite(a)||!Number.isFinite(b))return Infinity;
    if(a===0||b===0||a*b<0)return 0;
    return Math.min(Math.abs(a),Math.abs(b));
  };

  const collectPlate=(scene,plate)=>{
    const meta=plate?.__kitchenPlate;
    if(!scene.player||!plate?.active||!meta||meta.collected)return false;
    const realX=scene.player.x;
    try{
      scene.player.x=plate.x;
      scene.collectAt(meta.rowIndex);
    }finally{
      if(scene.player)scene.player.x=realX;
    }
    if(meta.collected)plate.__kitchenPlateHaloV12?.setVisible?.(false);
    return Boolean(meta.collected);
  };

  const updatePlateConveyors=(scene,dt)=>{
    for(const row of scene.rows||[]){
      const state=row?.__plateConveyorV12;
      if(!state)continue;
      const dx=state.vx*dt;
      state.phase+=dx;
      if(state.band?.active){
        const scaleX=Math.max(.0001,Math.abs(Number(state.band.tileScaleX)||1));
        state.band.tilePositionX-=dx/scaleX;
      }
      for(const plate of state.plates||[]){
        if(!plate?.active)continue;
        const halo=plate.__kitchenPlateHaloV12;
        if(plate.__kitchenPlate?.collected){
          if(halo?.active)halo.setVisible(false);
          continue;
        }
        plate.x=state.cycleStart+mod(plate.x+dx-state.cycleStart,state.cycleLength);
        if(halo?.active){halo.x=plate.x;halo.y=plate.y+5;}
      }
    }
  };

  const carryChefOnConveyor=(scene,dt)=>{
    if(scene.runEnded||scene.isMoving||!scene.player)return;
    const state=scene.rows?.[scene.playerRow]?.__plateConveyorV12;
    if(!state)return;
    scene.player.x+=state.vx*dt;
    scene.playerCol=nearestCol(scene,scene.player.x);
    const left=S.PLAY_X+2,right=S.PLAY_X+S.PLAY_W-2;
    if(scene.player.x>=left&&scene.player.x<=right)return;
    if(scene._perfConveyorFailV19)return;
    scene._perfConveyorFailV19=true;
    scene.inputLocked=true;
    scene.clearBufferedMove?.();
    scene.cancelGesture?.();
    scene.player?.setTint?.(0xff3b30);
    scene.playerArt?.setTint?.(0xff3b30);
    scene.cameras.main.shake(130,.006);
    scene.time.delayedCall(120,()=>{
      if(!scene.runEnded)scene.failRun(
        'OUT OF BOUNDS',
        'The conveyor carried the chef off the prep line. Hop off before reaching the edge.',
        'conveyor-edge'
      );
    });
  };

  const sweepPlatePickups=(scene,dt,prevX,prevRow)=>{
    if(!scene.player)return;
    const currentX=scene.player.x,currentRow=scene.playerRow;
    for(const plate of scene.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      if(!plate?.active||!meta||meta.collected)continue;
      const wasOn=prevRow===meta.rowIndex,isOn=currentRow===meta.rowIndex;
      if(!wasOn&&!isOn)continue;
      const oldPlateX=Number.isFinite(plate.__perfPrevXV19)?plate.__perfPrevXV19:plate.x;
      const state=scene.rows?.[meta.rowIndex]?.__plateConveyorV12;
      const tolerance=meta.hitWidth*.58+clamp(S.CELL_W*.11,6,10);
      let hit=false;
      if(wasOn&&isOn){
        const expected=oldPlateX+(Number(state?.vx)||0)*dt;
        hit=segmentDistanceToZero(prevX-oldPlateX,currentX-expected)<=tolerance;
        if(!hit)hit=Math.abs(currentX-plate.x)<=tolerance;
      }else if(isOn){
        hit=Math.abs(currentX-plate.x)<=tolerance;
      }
      if(hit)collectPlate(scene,plate);
    }
  };

  const sweepIngredients=(scene,prevX,prevRow)=>{
    if(!scene.player||prevRow!==scene.playerRow)return;
    const row=scene.rows?.[scene.playerRow];
    if(row?.type!=='kitchenIngredient')return;
    const x1=scene.player.x;
    if(!Number.isFinite(prevX)||Math.abs(x1-prevX)<.01)return;
    const tolerance=clamp(S.CELL_W*.10,5,9);
    const left=Math.min(prevX,x1)-tolerance,right=Math.max(prevX,x1)+tolerance;
    const hits=[];
    for(const group of scene.kitchenIngredientGroups||[]){
      if(group.rowIndex!==scene.playerRow)continue;
      for(const item of group.items||[]){
        const meta=item?.__kitchenIngredient;
        if(!item?.active||item.visible===false||!meta||meta.collected)continue;
        if(item.x>=left&&item.x<=right)hits.push(item);
      }
    }
    hits.sort((a,b)=>x1>=prevX?a.x-b.x:b.x-a.x);
    for(const item of hits){
      const realX=scene.player.x;
      scene.player.x=item.x;
      scene.collectAt(scene.playerRow);
      scene.player.x=realX;
    }
  };

  const updateFlyingSushi=(scene,dt)=>{
    if(scene._kitchenFlyingImpact)return;
    for(const obj of scene.kitchenFlyingSushi||[]){
      const meta=obj?.__kitchenFlying;
      if(!obj?.active||!meta)continue;
      obj.x=meta.cycleStart+mod(obj.x+meta.vx*dt-meta.cycleStart,meta.cycleLength);
      if(scene.runEnded||scene.isMoving||scene.playerRow!==meta.row)continue;
      const hitWidth=Math.max(meta.width||80,(obj.displayWidth||80)*.62);
      if(Math.abs(obj.x-scene.player.x)<=hitWidth*.5){
        if(typeof scene.beginKitchenFlyingImpact==='function')scene.beginKitchenFlyingImpact(obj,meta);
        else scene.failRun('FLYING SUSHI HIT!','A flying sushi piece hit the chef.','kitchen-fly');
        break;
      }
    }
  };

  const checkHotPot=(scene)=>{
    if(scene.runEnded||scene.isMoving||scene.kitchenBurning)return;
    if(!scene.kitchenHotPotCells?.has(`${scene.playerRow}:${scene.playerCol}`))return;
    scene.kitchenBurning=true;
    scene.inputLocked=true;
    scene.clearBufferedMove?.();
    scene.cancelGesture?.();
    scene.player?.setTint?.(0xff3b30);
    scene.cameras.main.shake(150,.006);
    scene.time.delayedCall(220,()=>{
      if(!scene.runEnded)scene.failRun(
        'HOT POT!',
        'The chef touched a hot pot and got burned. Move through the open gaps between the pots.',
        'kitchen-burn'
      );
    });
  };

  const syncForwardHint=(scene)=>{
    const root=scene._forwardHint;
    if(!root?.active||!scene.player)return;
    if((scene.totalHops||0)>=4){
      const kill=obj=>{
        scene.tweens.killTweensOf(obj);
        if(Array.isArray(obj?.list))obj.list.forEach(kill);
      };
      kill(root);
      root.destroy(true);
      scene._forwardHint=null;
      return;
    }
    root.x=scene.player.x;
    root.y=scene.player.y-112;
    root.setDepth(depth(scene,scene.player.y,148));
  };

  const syncInventoryHud=(scene)=>{
    const root=document.getElementById('prep-inventory-hud');
    if(!root)return;
    const visible=Boolean(scene._kitchenMode&&scene.runActive&&!scene.runEnded);
    if(scene._perfInventoryVisibleV19!==visible){
      scene._perfInventoryVisibleV19=visible;
      root.classList.toggle('show',visible);
    }
    if(!visible)return;

    const totalIngredients=(scene.kitchenIngredientInventory||[]).length;
    const totalPlates=scene.kitchenPlateCount||0;
    const sig=`${totalIngredients}|${totalPlates}`;
    if(scene._perfInventorySignatureV19===sig)return;
    scene._perfInventorySignatureV19=sig;

    const counts={1:0,2:0,3:0,4:0};
    for(const plate of scene.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      if(meta?.collected&&counts[meta.file]!==undefined)counts[meta.file]++;
    }
    for(const file of PLATE_FILES){
      const b=root.querySelector(`[data-plate-file="${file}"] b`);
      if(b)b.textContent=`×${counts[file]}`;
    }
    const ing=root.querySelector('[data-ingredient-total]');
    if(ing)ing.textContent=`×${totalIngredients}`;
  };

  // Keep the legacy chain for bonus street levels. Kitchen levels use one
  // consolidated update instead of 8+ nested update wrappers and repeated
  // per-frame loops/DOM writes.
  const legacyUpdate=proto.update;
  proto.update=function(time,delta){
    if(!this._kitchenMode)return legacyUpdate.call(this,time,delta);
    if(!this.runActive||!this.player)return;

    const dt=clamp((Number(delta)||16.667)/1000,.001,.05);
    const dtMs=Math.min(Number(delta)||16.667,50);
    const prevX=Number.isFinite(this._perfPrevPlayerXV19)?this._perfPrevPlayerXV19:this.player.x;
    const prevRow=Number.isInteger(this._perfPrevPlayerRowV19)?this._perfPrevPlayerRowV19:this.playerRow;

    if(this.runEnded){
      syncInventoryHud(this);
      this.updateHud();
      return;
    }
    if(this._kitchenFlyingImpact){
      this.updateCamera(dt);
      syncInventoryHud(this);
      this.updateHud();
      return;
    }

    this.updateFloaters(dt);
    this.updatePlayerSupport();
    updatePlateConveyors(this,dt);
    carryChefOnConveyor(this,dt);
    updateFlyingSushi(this,dt);

    sweepIngredients(this,prevX,prevRow);
    sweepPlatePickups(this,dt,prevX,prevRow);

    this.updateCamera(dt);
    this.handleKeyboard();
    checkHotPot(this);
    this.checkWaterState();

    if(this.runStarted){
      this.activeMs+=dtMs;
      if(!this.isMoving)this.idleMs+=dtMs;
      this.checkIdleFish();
      this.checkCameraPressure();
    }

    if(this.player?.active)this.player.setDepth(depth(this,this.player.y,48));
    syncForwardHint(this);
    syncInventoryHud(this);
    this.updateHud();

    this._perfPrevPlayerXV19=this.player?.x;
    this._perfPrevPlayerRowV19=this.playerRow;
    for(const plate of this.kitchenPlates||[])if(plate?.active)plate.__perfPrevXV19=plate.x;
  };

  const legacyStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=legacyStartLevel.call(this,level,opt);
    this._perfHudSignatureV19=null;
    this._perfInventorySignatureV19=null;
    this._perfInventoryVisibleV19=undefined;
    this._perfConveyorFailV19=false;
    this._perfPrevPlayerXV19=this.player?.x;
    this._perfPrevPlayerRowV19=this.playerRow;
    for(const plate of this.kitchenPlates||[])plate.__perfPrevXV19=plate.x;
    if(this.playerShadow){
      this.tweens.killTweensOf(this.playerShadow);
      this.playerShadow.setVisible?.(false);
      this.playerShadow.setAlpha?.(0);
    }
    const frame=document.getElementById('kitchen-side-frame');
    if(frame&&this._kitchenMode){
      frame.style.setProperty('--kitchen-parallax-left','0px');
      frame.style.setProperty('--kitchen-parallax-right','0px');
    }
    this.updateHud();
    syncInventoryHud(this);
    return result;
  };
})();
