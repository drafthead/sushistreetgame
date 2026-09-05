(() => {
  const S=window.SS, U=S.ui;
  const loadSave=()=>{try{const p=JSON.parse(localStorage.getItem(S.SAVE_KEY)||'{}');return{unlockedLevel:S.clamp(Number(p.unlockedLevel)||1,1,S.MAX_LEVEL),bestScores:p.bestScores||{},bestRevenue:p.bestRevenue||{},lastLevel:S.clamp(Number(p.lastLevel)||1,1,S.MAX_LEVEL)}}catch(_){return{unlockedLevel:1,bestScores:{},bestRevenue:{},lastLevel:1}}};
  const save=x=>{try{localStorage.setItem(S.SAVE_KEY,JSON.stringify(x))}catch(_){}};

  class SushiScene extends Phaser.Scene {
    constructor(){super('SushiStreet');this.save=loadSave();this.selectedLevel=1;this.runActive=false;this.runEnded=true;this.runStarted=false;this.inputLocked=true;this.isMoving=false;this.levelObjects=[];this.skyObjects=[];this.rows=[];this.vehicles=[];this.floaters=[];this.pickups=[];this.gesture={id:null,x:0,y:0};}

    create(){
      window.__SUSHI_SCENE=this;
      window.SUSHI_RUNTIME_LIFECYCLE.bind(()=>window.__SUSHI_SCENE);
      this.keys=this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE');
      this.installInput();this.installUi();
      const l=S.clamp(Math.min(this.save.lastLevel||1,this.save.unlockedLevel||1),1,S.MAX_LEVEL);
      this.startLevel(l,{boot:true});
      requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('loaded')));
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
      if(!U.levelGrid.dataset.bound){U.levelGrid.dataset.bound='1';U.levelGrid.addEventListener('click',e=>{const b=e.target.closest('.level-btn');if(!b||b.disabled)return;this.selectedLevel=Number(b.dataset.level)||1;this.renderLevelGrid();U.primary.dataset.action='start';U.primary.textContent=`PLAY LEVEL ${this.selectedLevel}`})}
    }

    canAcceptInput(){return this.runActive&&!this.runEnded&&!this.inputLocked&&!U.modal.classList.contains('show')}
    cancelGesture(){this.gesture={id:null,x:0,y:0}}
    clearBufferedMove(){this.bufferedMove=null}
    onWarmResumeStart(){this.inputLocked=true;this.cancelGesture();this.clearBufferedMove()}
    onWarmResumeEnd(){if(!this.runEnded)this.inputLocked=false}
    track(o){if(o)this.levelObjects.push(o);return o}
    trackSky(o){if(o)this.skyObjects.push(o);return o}

    destroyLevelObjects(){
      this.levelObjects.splice(0).forEach(o=>{try{o?.destroy?.(true)}catch(_){}});
      this.skyObjects.splice(0).forEach(o=>{try{o?.destroy?.(true)}catch(_){}});
      this.rows=[];this.vehicles=[];this.floaters=[];this.pickups=[];this.player=null;this.playerArt=null;this.playerSupport=null;this.clearBufferedMove();this.isMoving=false;
    }

    themeForLevel(l){if(l===3||l%6===0)return S.THEMES.night;if(l%4===0)return S.THEMES.sunset;if(l%2===0)return S.THEMES.day;return S.THEMES.morning}
    levelLength(l){return 30+(l-1)*2}
    buildMenu(l){const r=S.rngFor(l*97+11),a=S.ITEMS.slice(0,S.clamp(4+Math.floor(l/3),4,S.ITEMS.length)),n=S.clamp(4+Math.floor(l/2),4,9),k=S.clamp(3+Math.floor(l/4),3,Math.min(6,a.length)),chosen=[];while(chosen.length<k){const i=a[Math.floor(r()*a.length)];if(!chosen.includes(i))chosen.push(i)}const list=[];for(let i=0;i<n;i++)list.push(chosen[i%chosen.length]);return list}

    startLevel(l,opt={}){
      this.save=loadSave();l=S.clamp(Number(l)||1,1,this.save.unlockedLevel||1);
      try{if(this.scene.isPaused())this.scene.resume()}catch(_){}
      window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);
      this.selectedLevel=l;this.save.lastLevel=l;save(this.save);
      this.runActive=true;this.runEnded=false;this.runStarted=false;this.inputLocked=true;this.isMoving=false;
      this.activeMs=0;this.idleMs=0;this.score=0;this.totalHops=0;this.maxRow=0;this.goalRow=this.levelLength(l);
      this.theme=this.themeForLevel(l);this.rng=S.rngFor(l);this.menuList=this.buildMenu(l);this.menuRequired={};this.menuCollected={};
      this.menuList.forEach(i=>this.menuRequired[i.key]=(this.menuRequired[i.key]||0)+1);Object.keys(this.menuRequired).forEach(k=>this.menuCollected[k]=0);

      this.worldH=S.OVERSCAN_Y*2+S.SAFE_BOTTOM+(this.goalRow+6)*S.ROW_H;
      this.cameras.main.setBounds(0,0,S.WORLD_W,this.worldH);
      this.cameras.main.setRotation(S.CAMERA_ROTATION);
      this.cameras.main.setZoom(1);
      const initialY=S.clamp(this.rowY(0)-S.H*.74,0,Math.max(0,this.worldH-S.H));
      this.cameras.main.setScroll(S.OVERSCAN_X,initialY);
      this.cameraTargetY=initialY;

      this.buildSky();this.buildRows();this.spawnPlayer();this.updateHud(true);
      U.hud.style.opacity='1';U.modal.classList.remove('show');this.inputLocked=false;
      if(!opt.boot)document.body.classList.add('loaded');
    }

    rowY(r){return this.worldH-S.OVERSCAN_Y-S.SAFE_BOTTOM-r*S.ROW_H}
    colX(c){return S.PLAY_X+S.SIDE_MARGIN+S.CELL_W*.5+c*S.CELL_W}
    describeRow(i){if(i===0)return{index:i,type:'start'};if(i>=this.goalRow)return{index:i,type:'goal'};const c=i%8;if(c===1||c===2||c===7)return{index:i,type:'road'};if(c===3)return{index:i,type:'safe'};if(c===4||c===5)return{index:i,type:'water'};return{index:i,type:'shop'}}
    buildRows(){const shops=[];for(let i=0;i<=this.goalRow;i++){const r=this.describeRow(i);r.y=this.rowY(i);r.objects=[];r.vehicles=[];r.floaters=[];r.pickups=[];this.rows[i]=r;if(r.type==='shop')shops.push(r)}this.rows.forEach(r=>this.renderRow(r));this.placePickups(shops)}

    openLevelSelect(f=this.selectedLevel){
      window.SUSHI_RUNTIME_LIFECYCLE.hideWarmup();try{if(this.scene.isPaused())this.scene.resume()}catch(_){}window.SUSHI_RUNTIME_LIFECYCLE.beforeLevelBuild(this);
      this.runActive=false;this.runEnded=true;this.runStarted=false;this.inputLocked=true;this.save=loadSave();this.selectedLevel=S.clamp(Math.min(f,this.save.unlockedLevel),1,S.MAX_LEVEL);
      U.hud.style.opacity='0';U.title.textContent='DELIVERY MENU';U.body.textContent='Choose an unlocked route. Play drops you directly onto the moving street.';U.stats.hidden=true;U.levelGrid.hidden=false;U.secondary.hidden=true;U.primary.dataset.action='start';U.primary.textContent=`PLAY LEVEL ${this.selectedLevel}`;U.hint.textContent='Level 3 is the first night route. Traffic is already moving before your first hop.';this.renderLevelGrid();U.modal.classList.add('show');
    }
    renderLevelGrid(){U.levelGrid.innerHTML='';for(let l=1;l<=S.MAX_LEVEL;l++){const b=document.createElement('button');b.type='button';b.className=`level-btn${l>this.save.unlockedLevel?' locked':''}${l===this.selectedLevel?' selected':''}`;b.dataset.level=l;b.textContent=l;b.disabled=l>this.save.unlockedLevel;U.levelGrid.appendChild(b)}}
  }

  SushiScene.loadSave=loadSave;SushiScene.saveProgress=save;window.SushiScene=SushiScene;
})();
