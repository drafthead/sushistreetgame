(() => {
  const S=window.SS, U=S.ui, proto=window.SushiScene.prototype;
  const CHEF_MODE_KEY=`${S.SAVE_KEY}:chefMode`;
  const KITCHEN_MENU_ITEM={
    key:'kitchenChoice',
    label:'KITCHEN INGREDIENT',
    jp:'食材',
    shop:'KITCHEN',
    points:12,
    color:0xf8f858
  };

  const isKitchen=level=>typeof S.isKitchenLevel==='function'
    ? S.isKitchenLevel(level)
    : (Math.max(1,Number(level)||1)%5!==0);

  const requirements=level=>typeof S.prepRequirements==='function'
    ? S.prepRequirements(level)
    : {ingredients:3,plates:3,stage:1};

  const readChefMode=()=>{
    try{return localStorage.getItem(CHEF_MODE_KEY)==='manual'?'manual':'auto';}
    catch(_){return 'auto';}
  };

  const writeChefMode=mode=>{
    try{localStorage.setItem(CHEF_MODE_KEY,mode==='manual'?'manual':'auto');}catch(_){}
  };

  const autoChefForLevel=level=>{
    const list=S.CHEFS||[];
    if(!list.length)return null;
    const n=Math.max(1,Number(level)||1);
    return list[(n-1)%list.length]||list[0];
  };

  const resolvedChef=(scene,level=scene.selectedLevel)=>{
    const list=S.CHEFS||[];
    if(!list.length)return null;
    if(readChefMode()==='manual'){
      return list.find(c=>c.id===scene.save?.selectedChef)||list[0];
    }
    return autoChefForLevel(level)||list[0];
  };

  const persistProgress=scene=>{
    try{window.SushiScene?.saveProgress?.(scene.save);}catch(_){}
  };

  const baseLevelLength=proto.levelLength;
  proto.levelLength=function(level){
    return isKitchen(level)?26:baseLevelLength.call(this,level);
  };

  const baseBuildMenu=proto.buildMenu;
  proto.buildMenu=function(level){
    if(!isKitchen(level))return baseBuildMenu.call(this,level);
    const need=requirements(level).ingredients;
    // The prep quota is deliberately half of this internal menu target. This
    // preserves the game's 50% minimum concept while the HUD shows the clearer
    // player-facing quota (for Level 1: 0/3 ingredients and 0/3 plates).
    return Array.from({length:need*2},()=>KITCHEN_MENU_ITEM);
  };

  // In auto mode the active chef rotates every level. A user-selected chef
  // becomes a manual override and stays active until AUTO CHEF is chosen again.
  const baseSpawnPlayer=proto.spawnPlayer;
  proto.spawnPlayer=function(){
    const chef=resolvedChef(this,this.selectedLevel);
    const previous=this.save?.selectedChef;
    if(this.save&&chef)this.save.selectedChef=chef.id;
    try{
      const result=baseSpawnPlayer.call(this);
      this.activeChefId=chef?.id||previous||null;
      return result;
    }finally{
      if(this.save)this.save.selectedChef=previous;
    }
  };

  const baseInstallUi=proto.installUi;
  proto.installUi=function(){
    baseInstallUi.call(this);
    if(U.levelGrid&&!U.levelGrid.dataset.chefModeBound){
      U.levelGrid.dataset.chefModeBound='1';
      U.levelGrid.addEventListener('click',e=>{
        const auto=e.target.closest('.chef-auto-btn');
        const chefButton=e.target.closest('.chef-btn');
        if(!auto&&!chefButton)return;

        e.preventDefault();
        e.stopImmediatePropagation();

        if(auto){
          writeChefMode('auto');
        }else{
          const id=chefButton.dataset.chef;
          const chef=(S.CHEFS||[]).find(c=>c.id===id);
          if(chef){
            writeChefMode('manual');
            this.save.selectedChef=chef.id;
            persistProgress(this);
          }
        }
        this.renderLevelGrid();
      },true);
    }
  };

  const baseRenderLevelGrid=proto.renderLevelGrid;
  proto.renderLevelGrid=function(){
    baseRenderLevelGrid.call(this);
    if(!U.levelGrid)return;

    if(this.menuTab==='chefs'){
      const mode=readChefMode();
      const autoChef=autoChefForLevel(this.selectedLevel);
      const auto=document.createElement('button');
      auto.type='button';
      auto.className=`chef-auto-btn${mode==='auto'?' selected':''}`;
      auto.dataset.chefMode='auto';
      auto.style.cssText=[
        'grid-column:1/-1',
        'border:0',
        'border-radius:10px',
        'padding:10px 12px',
        `background:${mode==='auto'?'#a6d85e':'#343a47'}`,
        `color:${mode==='auto'?'#273020':'#fff'}`,
        `box-shadow:4px 5px 0 ${mode==='auto'?'#596a1a':'#272b37'}`,
        'font-weight:950',
        'letter-spacing:.04em',
        'min-height:48px'
      ].join(';');
      auto.innerHTML=`AUTO CHEF <small style="display:block;font-size:9px;margin-top:3px;opacity:.78">${autoChef?.name||'ROTATE EACH LEVEL'}</small>`;
      U.levelGrid.prepend(auto);

      if(mode==='auto'){
        U.levelGrid.querySelectorAll('.chef-btn.selected').forEach(b=>b.classList.remove('selected'));
        if(U.primary){
          U.primary.dataset.action='start';
          U.primary.textContent=`PLAY AUTO · ${(autoChef?.name||'CHEF').toUpperCase()}`;
        }
        if(U.hint)U.hint.textContent='AUTO CHEF rotates Sushi Masters every level. Pick a chef below to lock one in.';
      }else if(U.hint){
        const chef=resolvedChef(this,this.selectedLevel);
        U.hint.textContent=`${chef?.name||'Selected chef'} is locked in. Choose AUTO CHEF to rotate again.`;
      }
      return;
    }

    U.levelGrid.querySelectorAll('.level-btn').forEach(b=>{
      const level=Number(b.dataset.level)||0;
      if(!level)return;
      if(level%5===0){
        b.textContent=`${level} ★`;
        b.dataset.bonusStreet='1';
        b.title=`Level ${level}: bonus Sushi Street crossing`;
      }else{
        const req=requirements(level);
        b.title=`Level ${level}: sushi prep · ${req.ingredients} ingredients + ${req.plates} plates`;
      }
    });

    if(U.hint){
      if(this.selectedLevel%5===0)U.hint.textContent='★ Bonus level: cross the original Sushi Street hazards and reach the end.';
      else{
        const req=requirements(this.selectedLevel);
        U.hint.textContent=`Sushi prep quota: ${req.ingredients} ingredients + ${req.plates} plates. Extras earn bonus points.`;
      }
    }
  };

  const showPrepStatusSign=function(ready){
    if(!this.add||!this.track)return null;
    const x=S.PLAY_X+S.PLAY_W*.5;
    const y=this.rowY(this.goalRow)+8;
    const z=this.depthForY?this.depthForY(y+24,92):14500;
    const c=this.track(this.add.container(x,y).setDepth(z));
    const g=this.add.graphics();
    c.add(g);

    g.fillStyle(0x282229,.28);
    g.fillRect(-96,-25,200,60);
    g.fillStyle(0xfff5df,1);
    g.fillRect(-102,-33,204,60);
    g.fillStyle(ready?0x5e9f42:0xe84028,1);
    g.fillRect(-95,-26,190,45);
    g.fillStyle(0x5b3a25,1);
    g.fillRect(-3,19,6,32);

    const label=this.add.text(
      0,-4,
      ready?'READY\nSUSHI PREP':'NOT READY\nSUSHI PREP',
      {
        fontFamily:'Inter,system-ui,sans-serif',
        fontSize:'16px',
        fontStyle:'900',
        align:'center',
        color:'#fffaf0',
        lineSpacing:-1
      }
    ).setOrigin(.5);
    c.add(label);
    c.setScale(.58).setAlpha(0);
    this.tweens.add({targets:c,scaleX:1,scaleY:1,alpha:1,duration:260,ease:'Back.Out'});
    return c;
  };
  proto.showPrepStatusSign=showPrepStatusSign;

  const resetPrepBonusState=scene=>{
    scene._prepBonusIngredientsAwarded=0;
    scene._prepBonusPlatesAwarded=0;
    scene._prepBonusScore=0;
    scene._prepReadyNotified=false;
  };

  const flashPrepMessage=(scene,text,color='#f8f858')=>{
    if(!scene.player||!scene.add?.text)return;
    const t=scene.track(scene.add.text(scene.player.x,scene.player.y-S.ROW_H*1.35,text,{
      fontFamily:'Inter,system-ui,sans-serif',
      fontSize:'12px',
      fontStyle:'900',
      color:'#17212a',
      backgroundColor:color,
      padding:{x:8,y:4}
    }).setOrigin(.5).setDepth(scene.depthForY?scene.depthForY(scene.player.y,125):150));
    scene.tweens.add({targets:t,y:t.y-20,alpha:0,duration:620,ease:'Quad.Out',onComplete:()=>t.destroy()});
  };

  const applyPrepBonuses=scene=>{
    if(!isKitchen(scene.selectedLevel))return;
    const req=requirements(scene.selectedLevel);
    const ingredients=scene.collectedCount?.()||0;
    const plates=scene.kitchenPlateCount||0;
    const extraIngredients=Math.max(0,ingredients-req.ingredients);
    const extraPlates=Math.max(0,plates-req.plates);
    const newIngredients=Math.max(0,extraIngredients-(scene._prepBonusIngredientsAwarded||0));
    const newPlates=Math.max(0,extraPlates-(scene._prepBonusPlatesAwarded||0));

    if(newIngredients||newPlates){
      const bonus=newIngredients*6+newPlates*10;
      scene._prepBonusIngredientsAwarded=extraIngredients;
      scene._prepBonusPlatesAwarded=extraPlates;
      scene._prepBonusScore=(scene._prepBonusScore||0)+bonus;
      scene.score+=bonus;
      flashPrepMessage(scene,`EXTRA PREP +${bonus}`,'#ffd76a');
    }

    const ready=ingredients>=req.ingredients&&plates>=req.plates;
    if(ready&&!scene._prepReadyNotified){
      scene._prepReadyNotified=true;
      flashPrepMessage(scene,'SUSHI PREP READY!','#b9ef85');
    }
  };

  const baseUpdateHud=proto.updateHud;
  proto.updateHud=function(...args){
    const result=baseUpdateHud.apply(this,args);
    if(!isKitchen(this.selectedLevel))return result;

    const req=requirements(this.selectedLevel);
    const ingredients=this.collectedCount?.()||0;
    const plates=this.kitchenPlateCount||0;
    const ingredientRatio=Math.min(1,ingredients/Math.max(1,req.ingredients));
    const plateRatio=Math.min(1,plates/Math.max(1,req.plates));
    const pct=Math.round((ingredientRatio+plateRatio)*50);
    const title=document.querySelector('.minimum-copy span');

    if(title)title.textContent='SUSHI PREP';
    if(U.minimumText)U.minimumText.textContent=`ING ${ingredients}/${req.ingredients} · PLATES ${plates}/${req.plates}`;
    if(U.minimumFill)U.minimumFill.style.width=`${pct}%`;
    if(U.progress)U.progress.textContent=`${pct}%`;
    U.minimumPanel?.classList.toggle('ready',ingredients>=req.ingredients&&plates>=req.plates);
    return result;
  };

  const persistLevelSuccess=scene=>{
    const level=scene.selectedLevel;
    scene.save.bestScores=scene.save.bestScores||{};
    scene.save.bestScores[level]=Math.max(Number(scene.save.bestScores[level])||0,scene.score||0);
    if(level<S.MAX_LEVEL)scene.save.unlockedLevel=Math.max(Number(scene.save.unlockedLevel)||1,level+1);
    scene.save.lastLevel=level;
    persistProgress(scene);
  };

  const baseFinishDelivery=proto.finishDelivery;
  proto.finishDelivery=function(){
    if(this.runEnded)return;

    if(isKitchen(this.selectedLevel)){
      applyPrepBonuses(this);
      const req=requirements(this.selectedLevel);
      const ingredients=this.collectedCount?.()||0;
      const plates=this.kitchenPlateCount||0;
      const ready=ingredients>=req.ingredients&&plates>=req.plates;

      this.runEnded=true;
      this.inputLocked=true;
      this.clearBufferedMove?.();
      this.cancelGesture?.();
      this.showPrepStatusSign(ready);

      if(ready){
        persistLevelSuccess(this);
        const body=`Prep quota met: ${ingredients}/${req.ingredients} ingredients and ${plates}/${req.plates} plates. Anything above the quota counts as bonus prep.`;
        this.time.delayedCall(480,()=>{
          if(this.runEnded)this.showResult(true,'READY FOR SUSHI PREP',body,this._prepBonusScore||0);
        });
      }else{
        const missing=[];
        if(ingredients<req.ingredients)missing.push(`${req.ingredients-ingredients} more ingredient${req.ingredients-ingredients===1?'':'s'}`);
        if(plates<req.plates)missing.push(`${req.plates-plates} more plate${req.plates-plates===1?'':'s'}`);
        const body=`You reached the prep station with ${ingredients}/${req.ingredients} ingredients and ${plates}/${req.plates} plates. Get ${missing.join(' and ')} before finishing.`;
        this.time.delayedCall(480,()=>{
          if(this.runEnded)this.showResult(false,'NOT READY FOR SUSHI PREP',body,0);
        });
      }
      return;
    }

    // Every fifth level is a bonus street crossing. Reaching its goal is enough
    // to clear it; the kitchen ingredient quota does not apply to bonus rounds.
    if(this.selectedLevel%5===0){
      this.runEnded=true;
      this.inputLocked=true;
      this.clearBufferedMove?.();
      this.cancelGesture?.();
      persistLevelSuccess(this);
      const body='Bonus street cleared. You made it through the original traffic route; the next level returns to sushi prep.';
      this.time.delayedCall(360,()=>{
        if(this.runEnded)this.showResult(true,'BONUS STREET CLEARED',body,0);
      });
      return;
    }

    return baseFinishDelivery.call(this);
  };

  const baseShowResult=proto.showResult;
  proto.showResult=function(success,title,body,revenue){
    const kitchen=isKitchen(this.selectedLevel);
    const bonusStreet=!kitchen&&this.selectedLevel%5===0;
    let finalTitle=title;
    let finalBody=body;

    if(kitchen){
      if(success){
        finalTitle='READY FOR SUSHI PREP';
      }else{
        finalTitle='NOT READY FOR SUSHI PREP';
        if(title&&title!=='NOT READY FOR SUSHI PREP')finalBody=`${title}. ${body}`;
      }
    }else if(bonusStreet&&success){
      finalTitle='BONUS STREET CLEARED';
    }

    const result=baseShowResult.call(this,success,finalTitle,finalBody,revenue);

    if(kitchen){
      const req=requirements(this.selectedLevel);
      const ingredients=this.collectedCount?.()||0;
      const plates=this.kitchenPlateCount||0;
      if(U.title)U.title.textContent=finalTitle;
      if(U.body)U.body.textContent=finalBody;
      if(U.stats){
        U.stats.innerHTML=[
          `<div class="modal-stat"><span>INGREDIENTS</span><b>${ingredients}/${req.ingredients}</b></div>`,
          `<div class="modal-stat"><span>PLATES</span><b>${plates}/${req.plates}</b></div>`,
          `<div class="modal-stat"><span>EXTRA BONUS</span><b>+${this._prepBonusScore||0}</b></div>`,
          `<div class="modal-stat"><span>SCORE</span><b>${this.score||0}</b></div>`
        ].join('');
      }
    }else if(bonusStreet&&U.stats){
      U.stats.innerHTML=[
        `<div class="modal-stat"><span>BONUS ROUTE</span><b>LEVEL ${this.selectedLevel}</b></div>`,
        `<div class="modal-stat"><span>SCORE</span><b>${this.score||0}</b></div>`,
        `<div class="modal-stat"><span>ACTIVE TIME</span><b>${S.formatTime(this.activeMs||0)}</b></div>`
      ].join('');
    }

    return result;
  };

  const baseUpdate=proto.update;
  proto.update=function(time,delta){
    const result=baseUpdate.call(this,time,delta);
    if(isKitchen(this.selectedLevel))applyPrepBonuses(this);
    return result;
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    const kitchen=isKitchen(this.selectedLevel);
    this._kitchenMode=kitchen;
    this._bonusStreetMode=!kitchen&&this.selectedLevel%5===0;
    document.body.classList.toggle('kitchen-level-one',kitchen);
    if(kitchen)this.cameras.main.setRotation(0);
    resetPrepBonusState(this);
    this.updateHud?.();
    return result;
  };
})();