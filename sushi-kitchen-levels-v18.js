(() => {
  const S=window.SS, U=S.ui, proto=window.SushiScene.prototype;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const depth=(scene,y,o=0)=>scene.depthForY
    ? scene.depthForY(y,o)
    : 10000+Math.round((Number(y)||0)*10)+o;
  const PLATE_FILES=[1,2,3,4];
  const PLATE_POINTS={1:5,2:10,3:20,4:35};

  const isKitchen=level=>typeof S.isKitchenLevel==='function'
    ? S.isKitchenLevel(level)
    : (Math.max(1,Number(level)||1)%5!==0);
  const requirements=level=>typeof S.prepRequirements==='function'
    ? S.prepRequirements(level)
    : {ingredients:3,plates:3};

  const nearestCol=(scene,x)=>{
    let best=0,dist=Infinity;
    for(let col=0;col<S.COLS;col++){
      const d=Math.abs(scene.colX(col)-x);
      if(d<dist){dist=d;best=col;}
    }
    return best;
  };

  // --- Mobile gesture recognition -----------------------------------------
  // V16's 52ms forward-tap timer could fire before a slow finger had moved far
  // enough to be recognized as a swipe. V18 gives swipes an early pointermove
  // trigger (12px) and only auto-fires a held tap when the finger is essentially
  // stationary. Quick taps still fire immediately on pointer-up.
  const previousCancelGesture=proto.cancelGesture;
  const clearGestureV18=scene=>{
    const g=scene?._gestureV18;
    try{g?.timer?.remove?.(false);}catch(_){}
    if(scene)scene._gestureV18=null;
  };

  proto.cancelGesture=function(){
    clearGestureV18(this);
    return previousCancelGesture.call(this);
  };

  proto.installInput=function(){
    const SWIPE_TRIGGER=12;
    const TAP_HOLD_MS=90;
    const TAP_STILL_DISTANCE=4;

    const fireDirection=(gesture,dx,dy)=>{
      if(!gesture||gesture.fired||!this.canAcceptInput())return false;
      gesture.fired=true;
      try{gesture.timer?.remove?.(false);}catch(_){}
      gesture.timer=null;
      if(Math.abs(dx)>=Math.abs(dy)*.82){
        this.requestMove(dx<0?-1:1,0);
      }else{
        this.requestMove(0,dy>0?-1:1);
      }
      return true;
    };

    this.input.on('pointerdown',p=>{
      clearGestureV18(this);
      this.startAmbientAudio();
      if(!this.canAcceptInput())return;

      this.gesture={id:p.id,x:p.x,y:p.y};
      const gesture={id:p.id,x:p.x,y:p.y,lastX:p.x,lastY:p.y,fired:false,timer:null};
      gesture.timer=this.time.delayedCall(TAP_HOLD_MS,()=>{
        if(this._gestureV18!==gesture||gesture.fired||!this.canAcceptInput())return;
        const active=this.input.activePointer;
        if(!active||active.id!==gesture.id)return;
        const dx=active.x-gesture.x,dy=active.y-gesture.y;
        if(Math.hypot(dx,dy)>TAP_STILL_DISTANCE)return;
        gesture.fired=true;
        gesture.timer=null;
        this.requestMove(0,1);
      });
      this._gestureV18=gesture;
    });

    this.input.on('pointermove',p=>{
      const gesture=this._gestureV18;
      if(!gesture||gesture.id!==p.id||gesture.fired)return;
      gesture.lastX=p.x;gesture.lastY=p.y;
      const dx=p.x-gesture.x,dy=p.y-gesture.y;
      const distance=Math.hypot(dx,dy);

      // Any real finger travel cancels the hold-to-tap path immediately. This
      // prevents a deliberate swipe from turning into an accidental forward hop.
      if(distance>TAP_STILL_DISTANCE&&gesture.timer){
        try{gesture.timer.remove(false);}catch(_){}
        gesture.timer=null;
      }
      if(distance>=SWIPE_TRIGGER)fireDirection(gesture,dx,dy);
    });

    this.input.on('pointerup',p=>{
      const gesture=this._gestureV18;
      if(!gesture||gesture.id!==p.id){
        clearGestureV18(this);
        previousCancelGesture.call(this);
        return;
      }
      const dx=p.x-gesture.x,dy=p.y-gesture.y;
      const distance=Math.hypot(dx,dy);
      const alreadyFired=gesture.fired;
      clearGestureV18(this);
      previousCancelGesture.call(this);
      if(alreadyFired||!this.canAcceptInput())return;

      if(distance<SWIPE_TRIGGER)this.requestMove(0,1);
      else if(Math.abs(dx)>=Math.abs(dy)*.82)this.requestMove(dx<0?-1:1,0);
      else this.requestMove(0,dy>0?-1:1);
    });

    const cancel=()=>this.cancelGesture();
    this.input.on('pointercancel',cancel);
    this.input.on('pointerupoutside',cancel);
  };

  // --- More collectible plates --------------------------------------------
  const addRowObject=(scene,row,obj)=>{
    if(!obj)return obj;
    scene.track(obj);
    row.objects?.push(obj);
    return obj;
  };

  const addPlateToSlot=(scene,row,state,slot,file)=>{
    const baseX=slot.__conveyorBaseX;
    const y=row.y-2;
    const key=`kitchen-plate-${file}`;
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
      hitWidth:clamp(S.CELL_W*.94,42,68)
    };
    addRowObject(scene,row,plate);
    scene.kitchenPlates.push(plate);
    state.plates.push(plate);

    const halo=scene.add.ellipse(
      baseX,row.y+3,
      Math.max(44,(plate.displayWidth||44)*1.22),
      Math.max(20,(plate.displayHeight||26)*.74),
      0xffe9a2,.10
    ).setDepth(depth(scene,row.y,44));
    halo.__conveyorBaseX=baseX;
    addRowObject(scene,row,halo);
    plate.__kitchenPlateHaloV12=halo;
  };

  const addExtraPlates=(scene,row)=>{
    const state=row?.__plateConveyorV12;
    if(!state||!Array.isArray(state.tiles)||!Array.isArray(state.plates))return;
    const target=S.W>=720?6:5;
    if(state.plates.length>=target)return;

    const occupied=new Set(state.plates.map(p=>p.__conveyorBaseX));
    const candidates=state.tiles.filter(tile=>{
      const x=tile.__conveyorBaseX;
      return Number.isFinite(x)&&
        x>=S.PLAY_X+state.step*.35&&
        x<=S.PLAY_X+S.PLAY_W-state.step*.35&&
        !occupied.has(x);
    });

    while(state.plates.length<target&&candidates.length){
      // Choose the candidate farthest from an existing plate so the extra
      // collectibles remain readable instead of clustering together.
      let bestIndex=0,bestDistance=-1;
      for(let i=0;i<candidates.length;i++){
        const x=candidates[i].__conveyorBaseX;
        const d=state.plates.reduce((m,p)=>Math.min(m,Math.abs(x-p.__conveyorBaseX)),Infinity);
        if(d>bestDistance){bestDistance=d;bestIndex=i;}
      }
      const slot=candidates.splice(bestIndex,1)[0];
      const file=((row.index+state.plates.length)%PLATE_FILES.length)+1;
      addPlateToSlot(scene,row,state,slot,file);
      occupied.add(slot.__conveyorBaseX);
    }
  };

  const previousRenderKitchenRow=proto.renderKitchenRow;
  proto.renderKitchenRow=function(row){
    const result=previousRenderKitchenRow.call(this,row);
    if(this._kitchenMode&&row.type==='kitchenPlate')addExtraPlates(this,row);
    return result;
  };

  // --- Lightweight inventory HUD ------------------------------------------
  const ensureInventoryHud=()=>{
    let root=document.getElementById('prep-inventory-hud');
    if(root)return root;

    if(!document.getElementById('prep-inventory-hud-style')){
      const style=document.createElement('style');
      style.id='prep-inventory-hud-style';
      style.textContent=`
        #prep-inventory-hud{position:fixed;z-index:335;top:calc(env(safe-area-inset-top) + 70px);right:max(9px,env(safe-area-inset-right));display:none;flex-direction:column;align-items:flex-end;gap:5px;pointer-events:none;font-family:Inter,system-ui,sans-serif}
        #prep-inventory-hud.show{display:flex}
        .prep-counter-row{display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:4px 6px;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:rgba(39,43,55,.78);box-shadow:4px 5px 0 rgba(40,34,41,.16);backdrop-filter:blur(5px)}
        .prep-plate-chip{position:relative;display:flex;align-items:center;gap:1px;min-width:38px;height:29px;padding:2px 4px;border-radius:6px;background:rgba(255,255,255,.08)}
        .prep-plate-chip img{width:22px;height:22px;object-fit:contain;display:block}
        .prep-plate-chip b,.prep-ingredient-chip b{font-size:11px;line-height:1;color:#fff;font-weight:950;text-shadow:1px 1px 0 rgba(0,0,0,.3)}
        .prep-plate-chip i{position:absolute;left:2px;top:1px;font-size:7px;line-height:1;color:#fff;font-style:normal;font-weight:950;opacity:.72}
        .prep-ingredient-chip{display:flex;align-items:center;gap:4px;height:29px;padding:3px 7px;border-radius:7px;background:rgba(255,255,255,.08);font-size:18px}
        #prep-inventory-hud.pop{animation:prep-hud-pop .18s ease-out}
        @keyframes prep-hud-pop{0%{transform:scale(.95)}55%{transform:scale(1.06)}100%{transform:scale(1)}}
        .prep-result-inventory{grid-column:1/-1;text-align:left;padding:11px;border-radius:9px;background:#343a47;box-shadow:inset -3px -3px 0 #272b37}
        .prep-result-inventory .prep-result-title{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:8px;color:#fff;font-size:12px;font-weight:950}
        .prep-result-inventory .prep-result-title small{color:#cbd5df;font-size:9px;font-weight:900}
        .prep-result-group{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:7px}
        .prep-result-group>strong{width:72px;color:#aeb8c8;font-size:8px;letter-spacing:.1em}
        .prep-result-item{display:inline-flex;align-items:center;gap:2px;padding:3px 5px;border-radius:6px;background:rgba(255,255,255,.07);color:#fff;font-size:10px;font-weight:950}
        .prep-result-item img{width:28px;height:24px;object-fit:contain;display:block}
        @media(max-width:520px){#prep-inventory-hud{top:calc(env(safe-area-inset-top) + 64px);right:max(7px,env(safe-area-inset-right));gap:4px}.prep-counter-row{gap:2px;padding:3px 4px}.prep-plate-chip{min-width:34px;height:27px;padding:2px 3px}.prep-plate-chip img{width:20px;height:20px}.prep-plate-chip b,.prep-ingredient-chip b{font-size:10px}.prep-ingredient-chip{height:27px;padding:2px 6px;font-size:16px}}
      `;
      document.head.appendChild(style);
    }

    root=document.createElement('div');
    root.id='prep-inventory-hud';
    root.setAttribute('aria-hidden','true');
    root.innerHTML=`
      <div class="prep-counter-row prep-plates-row">
        ${PLATE_FILES.map(file=>`<span class="prep-plate-chip" data-plate-file="${file}"><i>${file}</i><img src="images/kitchen/plates/${file}.png" alt=""><b>×0</b></span>`).join('')}
      </div>
      <div class="prep-counter-row"><span class="prep-ingredient-chip"><span aria-hidden="true">🍚</span><b data-ingredient-total>×0</b></span></div>
    `;
    document.body.appendChild(root);
    return root;
  };

  const inventoryCounts=scene=>{
    const plates={1:0,2:0,3:0,4:0};
    for(const plate of scene.kitchenPlates||[]){
      const meta=plate?.__kitchenPlate;
      if(meta?.collected&&plates[meta.file]!==undefined)plates[meta.file]++;
    }
    const ingredients={};
    for(const file of scene.kitchenIngredientInventory||[]){
      const n=Number(file)||1;
      ingredients[n]=(ingredients[n]||0)+1;
    }
    return {plates,ingredients,ingredientTotal:(scene.kitchenIngredientInventory||[]).length};
  };

  const syncInventoryHud=(scene,force=false)=>{
    const root=ensureInventoryHud();
    const modalOpen=document.getElementById('modal')?.classList.contains('show');
    const visible=isKitchen(scene.selectedLevel)&&scene.runActive&&!scene.runEnded&&!modalOpen;
    root.classList.toggle('show',visible);
    if(!visible)return;

    const counts=inventoryCounts(scene);
    const signature=`${counts.ingredientTotal}|${PLATE_FILES.map(f=>counts.plates[f]).join(',')}`;
    if(!force&&scene._prepInventorySignatureV18===signature)return;
    const changed=scene._prepInventorySignatureV18!==undefined&&scene._prepInventorySignatureV18!==signature;
    scene._prepInventorySignatureV18=signature;

    for(const file of PLATE_FILES){
      const b=root.querySelector(`[data-plate-file="${file}"] b`);
      if(b)b.textContent=`×${counts.plates[file]}`;
    }
    const ing=root.querySelector('[data-ingredient-total]');
    if(ing)ing.textContent=`×${counts.ingredientTotal}`;

    if(changed){
      root.classList.remove('pop');
      void root.offsetWidth;
      root.classList.add('pop');
      setTimeout(()=>root.classList.remove('pop'),190);
    }
  };

  const resultInventoryHtml=scene=>{
    const counts=inventoryCounts(scene);
    const req=requirements(scene.selectedLevel);
    const plateTotal=scene.kitchenPlateCount||0;
    const ingredientTotal=scene.collectedCount?.()||counts.ingredientTotal;
    const ingredientPct=Math.round(Math.min(1,ingredientTotal/Math.max(1,req.ingredients))*100);
    const platePct=Math.round(Math.min(1,plateTotal/Math.max(1,req.plates))*100);
    const overallPct=Math.round((ingredientPct+platePct)/2);

    const plateItems=PLATE_FILES
      .filter(file=>counts.plates[file]>0)
      .map(file=>`<span class="prep-result-item"><img src="images/kitchen/plates/${file}.png" alt="Plate ${file}"><b>×${counts.plates[file]}</b></span>`)
      .join('')||'<span class="prep-result-item">None</span>';

    const ingredientItems=Object.keys(counts.ingredients)
      .sort((a,b)=>Number(a)-Number(b))
      .map(file=>`<span class="prep-result-item"><img src="images/kitchen/ingredients/${file}.png" alt="Ingredient ${file}"><b>×${counts.ingredients[file]}</b></span>`)
      .join('')||'<span class="prep-result-item">None</span>';

    return `<div class="prep-result-inventory" data-prep-inventory-v18>
      <div class="prep-result-title"><span>ORDER PREP ${overallPct}%</span><small>ING ${ingredientPct}% · PLATES ${platePct}%</small></div>
      <div class="prep-result-group"><strong>PLATES</strong>${plateItems}</div>
      <div class="prep-result-group"><strong>INGREDIENTS</strong>${ingredientItems}</div>
    </div>`;
  };

  // --- No detached player shadow ------------------------------------------
  const hidePlayerShadow=scene=>{
    if(!scene?.playerShadow)return;
    scene.tweens?.killTweensOf?.(scene.playerShadow);
    scene.playerShadow.setVisible?.(false);
    scene.playerShadow.setAlpha?.(0);
  };

  const previousStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=previousStartLevel.call(this,level,opt);
    this._prepInventorySignatureV18=undefined;
    hidePlayerShadow(this);
    syncInventoryHud(this,true);
    return result;
  };

  const previousShowResult=proto.showResult;
  proto.showResult=function(success,title,body,revenue){
    const result=previousShowResult.call(this,success,title,body,revenue);
    const root=ensureInventoryHud();
    root.classList.remove('show');
    if(isKitchen(this.selectedLevel)&&U.stats){
      U.stats.querySelector('[data-prep-inventory-v18]')?.remove();
      U.stats.insertAdjacentHTML('beforeend',resultInventoryHtml(this));
      U.stats.hidden=false;
    }
    return result;
  };

  const previousOpenLevelSelect=proto.openLevelSelect;
  proto.openLevelSelect=function(...args){
    ensureInventoryHud().classList.remove('show');
    return previousOpenLevelSelect.apply(this,args);
  };

  const previousUpdate=proto.update;
  proto.update=function(time,delta){
    const result=previousUpdate.call(this,time,delta);
    hidePlayerShadow(this);
    syncInventoryHud(this);
    return result;
  };
})();
