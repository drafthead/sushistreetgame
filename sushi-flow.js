(() => {
  const S=window.SS, U=S.ui, proto=window.SushiScene.prototype;
  const AUTO_NEXT_MS=6000;

  const ensureFlowUi=()=>{
    const card=document.querySelector('#modal .modal-card');
    if(!card)return {};
    let progress=document.getElementById('level-auto-progress');
    if(!progress){
      progress=document.createElement('div');progress.id='level-auto-progress';progress.className='level-auto-progress';progress.hidden=true;progress.innerHTML='<i></i>';card.prepend(progress);
    }
    let tabs=document.getElementById('menu-tabs');
    if(!tabs){
      tabs=document.createElement('div');tabs.id='menu-tabs';tabs.className='menu-tabs';tabs.hidden=true;tabs.innerHTML='<button type="button" data-tab="levels" class="active">LEVELS</button><button type="button" data-tab="chefs">CHEFS</button>';
      const grid=document.getElementById('level-grid');card.insertBefore(tabs,grid);
    }
    return {progress,tabs};
  };

  const cancelAutoNext=function(){
    if(this._nextLevelTimer){try{this._nextLevelTimer.remove(false)}catch(_){}this._nextLevelTimer=null;}
    const {progress}=ensureFlowUi();
    if(progress){progress.hidden=true;const fill=progress.querySelector('i');if(fill){fill.style.transition='none';fill.style.width='0%';}}
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){cancelAutoNext.call(this);return baseStartLevel.call(this,level,opt);};

  const baseInstallUi=proto.installUi;
  proto.installUi=function(){
    baseInstallUi.call(this);
    const {tabs}=ensureFlowUi();
    if(tabs&&!tabs.dataset.bound){
      tabs.dataset.bound='1';
      tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;this.menuTab=b.dataset.tab==='chefs'?'chefs':'levels';this.renderLevelGrid();});
    }
    if(U.primary&&!U.primary.dataset.flowBound){
      U.primary.dataset.flowBound='1';
      U.primary.addEventListener('click',e=>{
        if(U.primary.dataset.action!=='next')return;
        e.preventDefault();e.stopImmediatePropagation();
        const next=S.clamp(Number(U.primary.dataset.nextLevel)||this.selectedLevel+1,1,S.MAX_LEVEL);
        cancelAutoNext.call(this);this.startLevel(next);
      },true);
    }
    if(U.secondary&&!U.secondary.dataset.flowBound){U.secondary.dataset.flowBound='1';U.secondary.addEventListener('click',()=>cancelAutoNext.call(this),true);}
  };

  const baseOpenLevelSelect=proto.openLevelSelect;
  proto.openLevelSelect=function(f=this.selectedLevel){
    cancelAutoNext.call(this);this.menuTab='levels';baseOpenLevelSelect.call(this,f);
    const {tabs}=ensureFlowUi();if(tabs)tabs.hidden=false;
    U.title.textContent='SUSHI STREET MENU';U.body.textContent='Choose a route, or switch to Chefs to change your Sushi Master.';U.secondary.hidden=true;U.hint.textContent='Unlocked routes are ready immediately.';this.renderLevelGrid();
  };

  proto.renderLevelGrid=function(){
    const {tabs}=ensureFlowUi();const tab=this.menuTab==='chefs'?'chefs':'levels';
    if(tabs){tabs.hidden=false;tabs.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
    U.levelGrid.innerHTML='';U.levelGrid.hidden=false;
    if(tab==='chefs'){
      U.levelGrid.classList.add('chef-grid-mode');const selectedChef=this.save.selectedChef||S.CHEFS[0].id;
      for(const chef of S.CHEFS){
        const b=document.createElement('button');b.type='button';b.className=`chef-btn${chef.id===selectedChef?' selected':''}`;b.dataset.chef=chef.id;b.innerHTML=`<img src="${chef.menuSrc}" alt="${chef.name}" onerror="this.style.visibility='hidden'"><span>${chef.name}</span>`;U.levelGrid.appendChild(b);
      }
      const chef=S.CHEFS.find(c=>c.id===selectedChef)||S.CHEFS[0];U.primary.dataset.action='start';U.primary.textContent=`PLAY AS ${chef.name.toUpperCase()}`;U.hint.textContent='Chef choice is saved for your next route.';return;
    }

    U.levelGrid.classList.remove('chef-grid-mode');
    for(let level=1;level<=S.MAX_LEVEL;level++){
      const b=document.createElement('button');b.type='button';b.className=`level-btn${level>this.save.unlockedLevel?' locked':''}${level===this.selectedLevel?' selected':''}`;b.dataset.level=level;b.textContent=level;b.disabled=level>this.save.unlockedLevel;U.levelGrid.appendChild(b);
    }
    U.primary.dataset.action='start';U.primary.textContent=`PLAY LEVEL ${this.selectedLevel}`;U.hint.textContent='Choose any unlocked route.';
  };

  proto.showResult=function(success,title,body,revenue){
    cancelAutoNext.call(this);const {progress,tabs}=ensureFlowUi();if(tabs)tabs.hidden=true;
    U.title.textContent=title;U.body.textContent=body;U.levelGrid.hidden=true;U.stats.hidden=false;
    U.stats.innerHTML=`<div class="modal-stat"><span>INGREDIENTS</span><b>${this.collectedCount()}/${this.requiredCount()}</b></div><div class="modal-stat"><span>SCORE</span><b>${this.score}</b></div><div class="modal-stat"><span>${success?'REVENUE':'ACTIVE TIME'}</span><b>${success?'$'+revenue:S.formatTime(this.activeMs)}</b></div>`;
    U.secondary.hidden=false;U.secondary.textContent='VIEW LEVELS';

    if(success&&this.selectedLevel<S.MAX_LEVEL){
      const next=this.selectedLevel+1;U.primary.dataset.action='next';U.primary.dataset.nextLevel=String(next);U.primary.textContent=`NEXT LEVEL ${next}`;U.hint.textContent='Continuing automatically in 6 seconds.';
      if(progress){progress.hidden=false;const fill=progress.querySelector('i');fill.style.transition='none';fill.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{fill.style.transition=`width ${AUTO_NEXT_MS}ms linear`;fill.style.width='100%';}));}
      this._nextLevelTimer=this.time.delayedCall(AUTO_NEXT_MS,()=>{this._nextLevelTimer=null;if(this.runEnded&&U.modal.classList.contains('show'))this.startLevel(next);});
    }else if(success){
      U.primary.dataset.action='levels';U.primary.textContent='VIEW LEVELS';U.hint.textContent='All routes complete.';
      if(!U.primary.dataset.levelsBound){U.primary.dataset.levelsBound='1';U.primary.addEventListener('click',e=>{if(U.primary.dataset.action!=='levels')return;e.preventDefault();e.stopImmediatePropagation();this.openLevelSelect(S.MAX_LEVEL);},true);}
    }else{
      U.primary.dataset.action='retry';U.primary.textContent='TRY AGAIN';U.hint.textContent='You get about 2.5 seconds to see the hit before this result card appears.';
    }
    U.modal.classList.add('show');this.updateHud();
  };
})();