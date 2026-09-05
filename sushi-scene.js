(() => {
  const S=window.SS, U=S.ui;
  const loadSave=()=>{
    try{
      const p=JSON.parse(localStorage.getItem(S.SAVE_KEY)||'{}');
      const chefIds=S.CHEFS.map(c=>c.id);
      const selectedChef=chefIds.includes(p.selectedChef)?p.selectedChef:S.CHEFS[0].id;
      return {
        unlockedLevel:S.clamp(Number(p.unlockedLevel)||1,1,S.MAX_LEVEL),
        bestScores:p.bestScores||{},
        bestRevenue:p.bestRevenue||{},
        lastLevel:S.clamp(Number(p.lastLevel)||1,1,S.MAX_LEVEL),
        selectedChef,
      };
    }catch(_){
      return {unlockedLevel:1,bestScores:{},bestRevenue:{},lastLevel:1,selectedChef:S.CHEFS[0].id};
    }
  };
  const save=x=>{try{localStorage.setItem(S.SAVE_KEY,JSON.stringify(x))}catch(_){}};

  class SushiScene extends Phaser.Scene {
    constructor(){super('SushiStreet');this.save=loadSave();this.selectedLevel=1;this.runActive=false;this.runEnded=true;this.runStarted=false;this.inputLocked=true;this.isMoving=false;this.levelObjects=[];this.skyObjects=[];this.rows=[];this.vehicles=[];this.floaters=[];this.pickups=[];this.gesture={id:null,x:0,y:0};this._resizeTimer=0;}

    preload(){
      for(const chef of S.CHEFS){
        this.load.image(`chef-menu-${chef.id}`,chef.menuSrc);
        this.load.image(`chef-run-${chef.id}`,chef.runSrc);
      }
    }

    create(){
      window.__SUSHI_SCENE=this;window.SUSHI_RUNTIME_LIFECYCLE.bind(()=>window.__SUSHI_SCENE);
      this.keys=this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE');
      this.installInput();this.installUi();
      this.scale.on('resize', size=>this.handleViewportResize(size));
      const l=S.clamp(Math.min(this.save.lastLevel||1,this.save.unlockedLevel||1),1,S.MAX_LEVEL);
      this.startLevel(l,{boot:true});requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('loaded')));
    }

    handleViewportResize(size){
      const w=Math.round(size?.width||window.innerWidth||S.W),h=Math.round(size?.height||window.innerHeight||S.H);
      const oldW=S.W,oldH=S.H;
      if(Math.abs(w-oldW)<2&&Math.abs(h-oldH)<2)return;
      S.setViewport(w,h);
      clearTimeout(this._resizeTimer);
      const material=Math.abs(w-oldW)>24||Math.abs((w/h)-(oldW/oldH))>.08;
      if(!material)return;
      this._resizeTimer=setTimeout(()=>{if(this.scene?.isActive?.())this.startLevel(this.selectedLevel,{resize:true})},120);
    }

    installInput(){
      this.input.on('pointerdown',p=>{if(!this.canAcceptInput())return;this.gesture={id:p.id,x:p.x,y:p.y}});
      this.input.on('pointerup',p=>{if(!this.canAcceptInput()||this.gesture.id!==p.id)return;const dx=p.x-this.gesture.x,dy=p.y-this.gesture.y;this.cancelGesture();if(Math.hypot(dx,dy)<20)this.requestMove(0,1);else if(Math.abs(dx)>Math.abs(dy))this.requestMove(dx<0?-1:1,0);else this.requestMove(0,dy>0?-1:1)});
      this.input.on('pointercancel',()=>this.cancelGesture());this.input.on('pointerupoutside',()=>this.cancelGesture());
    }

    installUi(){
      if(!U.pause.dataset.bound){U.pause.dataset.bound='1';U.pause.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();window.SUSHI_RUNTIME_LIFECYCLE.pause('manual')},{passive:false})}
      if(!U.primary.dataset.bound){U.primary.dataset.bound='1';U.primary.addEventListener('click',()=>{const a=U.primary.dataset.action||'retry';if(a==='resume')return window.SUSHI_RUNTIME_LIFECYCLE.resume('player');this.startLevel(this.selectedLevel)})}
      if(!U.secondary.dataset.bound){U.secondary.dataset.bound='1';U.secondary.addEventListener('click',()=>this.openLevelSelect(this.selectedLevel))}
      if(U.levelGrid&&!U.levelGrid.dataset.bound){U.levelGrid.dataset.bound='1';U.levelGrid.addEventListener('click',e=>{
        const chefButton=e.target.closest('.chef-btn');
        if(chefButton){this.save.selectedChef=chefButton.dataset.chef||S.CHEFS[0].id;save(this.save);this.renderLevelGrid();return;}
        const b=e.target.closest('.level-btn');if(!b||b.disabled)return;this.selectedLevel=Number(b.dataset.level)||1;this.renderLevelGrid();U.primary.dataset.action='start';U.primary.textContent=`PLAY LEVEL ${this.selectedLevel}`
      })}
    }

    canAcceptInput(){return this.runActive&&!this.runEnded&&!this.inputLocked&&!U.modal.classList.contains('show')}
    cancelGesture(){this.gesture={id:null,x:0,y:0}}
    clearBufferedMove(){this.bufferedMove=null}
    onWarmResumeStart(){this.inputLocked=true;this.cancelGesture();this.clearBufferedMove()}
    onWarmResumeEnd(){if(!this.runEnded)this.inputLocked=false}
    track(o){if(o)this.levelObjects.push(o);return o}
    trackSky(o){if(o)this.skyObjects.push(o);return o}

    destroyLevelObjects(){
      this.levelObjects.splice(0).forEach(o=>{try{o?.destroy?.(true)}catch(_){} });
      this.skyObjects.splice(0).forEach(o=>{try{o?.destroy?.(true)}catch(_){} });
      this.rows=[];this.vehicles=[];this.floaters=[];this.pickups=[];this.player=null;this.playerArt=null;this.playerSupport=null;this.clearBufferedMove();this.isMoving=false;
    }

    themeForLevel(l){if(l===3||l%6===0)return S.THEMES.night;if(l%4===0)return S.THEMES.sunset;if(l%2===0)return S.THEMES.day;return S.THEMES.morning}
    levelLength(l){return 30+(l-1)*2}
    buildMenu(l){const r=S.rngFor(l*97+11),a=S.ITEMS.slice(0,S.clamp(4+Math.floor(l/3),4,S.ITEMS.length)),n=S.clamp(4+Math.floor(l/2),4,9),k=S.clamp(3+Math.floor(l/4),3,Math.min(6,a.length)),chosen=[];while(chosen.length<k){const i=a[Math.floor(r()*a.length)];if(!chosen.includes(i))chosen.push(i)}const list=[];for(let i=0;i<n;i++)list.push(chosen[i%chosen.length]);return list}

    planIngredientRows(){
      const count=this.menuList.length,gap=S.PICKUP_ROW_GAP,start=4,end=Math.max(start,this.goalRow-3),rng=S.rngFor(this.selectedLevel*313+29),rows=[];
      if(!count)return rows;
      let previous=start-gap;
      for(let i=0;i<count;i++){
        const remaining=count-i-1;
        const minRow=Math.max(start,previous+gap);
        const maxRow=Math.max(minRow,end-remaining*gap);
        const ideal=count===1?Math.round((start+end)/2):Math.round(start+(end-start)*(i/(count-1)));
        const jitter=Math.floor(rng()*3)-1;
        const row=S.clamp(ideal+jitter,minRow,maxRow);
        rows.push(row);previous=row;
      }
      this.ingredientRowPlan=new Map(rows.map((row,i)=>[row,{item:this.menuList[i],index:i}]));
      return rows;
    }

    startLevel(l,opt={}){
      this.save=loadSave();l=S.clamp(Number(l)||1,1,this.save.unlockedLevel||1);try{if(this.scene.isPaused())this.scene.resume()}catch(_){}window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);
      this.selectedLevel=l;this.save.lastLevel=l;save(this.save);this.runActive=true;this.runEnded=false;this.runStarted=false;this.inputLocked=true;this.isMoving=false;this.activeMs=0;this.idleMs=0;this.score=0;this.totalHops=0;this.maxRow=0;this.goalRow=this.levelLength(l);this.theme=this.themeForLevel(l);this.rng=S.rngFor(l);this.menuList=this.buildMenu(l);this.menuRequired={};this.menuCollected={};this.menuList.forEach(i=>this.menuRequired[i.key]=(this.menuRequired[i.key]||0)+1);Object.keys(this.menuRequired).forEach(k=>this.menuCollected[k]=0);this.planIngredientRows();

      this.worldH=S.OVERSCAN_Y*2+S.SAFE_BOTTOM+(this.goalRow+5)*S.ROW_H;
      this.cameras.main.setBounds(0,0,S.WORLD_W,this.worldH);this.cameras.main.setRotation(S.CAMERA_ROTATION);this.cameras.main.scrollX=S.OVERSCAN_X;
      this.cameras.main.setScroll(S.OVERSCAN_X,S.clamp(this.rowY(0)-S.H*S.CAMERA_FOLLOW_Y,0,Math.max(0,this.worldH-S.H)));
      this.cameraTargetY=this.cameras.main.scrollY;
      this.buildSky();this.buildRows();this.spawnPlayer();this.updateHud(true);U.hud.style.opacity='1';U.modal.classList.remove('show');this.inputLocked=false;if(!opt.boot)document.body.classList.add('loaded');
    }

    rowY(r){return this.worldH-S.OVERSCAN_Y-S.SAFE_BOTTOM-r*S.ROW_H}
    colX(c){return S.PLAY_X+S.SIDE_MARGIN+S.CELL_W*.5+c*S.CELL_W}

    describeRow(i){
      if(i===0)return{index:i,type:'start'};
      if(i>=this.goalRow)return{index:i,type:'goal'};
      if(this.ingredientRowPlan?.has(i))return{index:i,type:'shop',ingredient:this.ingredientRowPlan.get(i)};
      const c=i%8;
      if(c===1||c===2||c===7)return{index:i,type:'road'};
      if(c===4||c===5)return{index:i,type:'water'};
      return{index:i,type:'safe'};
    }

    buildRows(){const shops=[];for(let i=0;i<=this.goalRow;i++){const r=this.describeRow(i);r.y=this.rowY(i);r.objects=[];r.vehicles=[];r.floaters=[];r.pickups=[];this.rows[i]=r;if(r.type==='shop')shops.push(r)}this.rows.forEach(r=>this.renderRow(r));this.placePickups(shops)}

    openLevelSelect(f=this.selectedLevel){
      window.SUSHI_RUNTIME_LIFECYCLE.hideWarmup();try{if(this.scene.isPaused())this.scene.resume()}catch(_){}window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);this.runActive=false;this.runEnded=true;this.runStarted=false;this.inputLocked=true;this.save=loadSave();this.selectedLevel=S.clamp(Math.min(f,this.save.unlockedLevel),1,S.MAX_LEVEL);U.hud.style.opacity='0';U.title.textContent='DELIVERY MENU';U.body.textContent='Choose a sushi master and an unlocked route. Play drops you directly onto the moving street.';U.stats.hidden=true;U.levelGrid.hidden=false;U.secondary.hidden=true;U.primary.dataset.action='start';U.primary.textContent=`PLAY LEVEL ${this.selectedLevel}`;U.hint.textContent='The selected master uses the back view during the run.';this.renderLevelGrid();U.modal.classList.add('show')
    }

    renderLevelGrid(){
      U.levelGrid.innerHTML='';
      const selectedChef=this.save.selectedChef||S.CHEFS[0].id;
      const heading=document.createElement('div');heading.textContent='SUSHI MASTERS';heading.style.cssText='grid-column:1/-1;color:#aeb8c8;font-size:9px;font-weight:950;letter-spacing:.14em;text-align:left;margin:2px 0 0';U.levelGrid.appendChild(heading);
      for(const chef of S.CHEFS){
        const b=document.createElement('button');b.type='button';b.className='chef-btn';b.dataset.chef=chef.id;
        b.style.cssText=`grid-column:span 1;border:0;border-radius:9px;padding:8px;background:${chef.id===selectedChef?'#a6d85e':'#343a47'};color:${chef.id===selectedChef?'#273020':'#fff'};box-shadow:4px 5px 0 ${chef.id===selectedChef?'#596a1a':'#272b37'};font-weight:900;min-height:112px`;
        b.innerHTML=`<img src="${chef.menuSrc}" alt="${chef.name}" style="display:block;width:54px;height:72px;object-fit:contain;margin:0 auto 5px" onerror="this.style.visibility='hidden'"><span style="display:block;font-size:9px;line-height:1.15">${chef.name}</span>`;U.levelGrid.appendChild(b);
      }
      const routeHeading=document.createElement('div');routeHeading.textContent='ROUTES';routeHeading.style.cssText='grid-column:1/-1;color:#aeb8c8;font-size:9px;font-weight:950;letter-spacing:.14em;text-align:left;margin:8px 0 0';U.levelGrid.appendChild(routeHeading);
      for(let l=1;l<=S.MAX_LEVEL;l++){const b=document.createElement('button');b.type='button';b.className=`level-btn${l>this.save.unlockedLevel?' locked':''}${l===this.selectedLevel?' selected':''}`;b.dataset.level=l;b.textContent=l;b.disabled=l>this.save.unlockedLevel;U.levelGrid.appendChild(b)}
    }
  }

  SushiScene.loadSave=loadSave;SushiScene.saveProgress=save;window.SushiScene=SushiScene;
})();
