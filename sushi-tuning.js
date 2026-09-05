(() => {
  const S=window.SS, U=S.ui, proto=window.SushiScene.prototype;
  const fmt=n=>Math.max(0,Number(n)||0).toLocaleString('en-US');

  // Faster pacing requested for failures and trains.
  S.DEATH_OVERLAY_DELAY_MS=1500;
  S.TRAIN_INTERVAL_MS=10000;
  S.TRAIN_INTERVAL_JITTER_MS=0;

  const ensureHighScoreUi=()=>{
    const scoreChip=document.querySelector('.score-chip');
    let best=document.getElementById('hud-best-score');
    if(scoreChip&&!best){
      best=document.createElement('small');
      best.id='hud-best-score';
      best.textContent='BEST 0';
      scoreChip.appendChild(best);
    }
    const card=document.querySelector('#modal .modal-card');
    let banner=document.getElementById('result-high-score');
    if(card&&!banner){
      banner=document.createElement('div');
      banner.id='result-high-score';
      banner.className='result-high-score';
      banner.hidden=true;
      const stats=document.getElementById('modal-stats');
      card.insertBefore(banner,stats);
    }
    return {best,banner};
  };

  const currentBest=function(){
    return Number(this.save?.bestScores?.[this.selectedLevel])||0;
  };

  const refreshBestHud=function(){
    const {best}=ensureHighScoreUi();
    if(best)best.textContent=`BEST ${fmt(currentBest.call(this))}`;
  };

  const baseStartLevel=proto.startLevel;
  proto.startLevel=function(level,opt){
    const result=baseStartLevel.call(this,level,opt);
    this._startingBestScore=currentBest.call(this);
    refreshBestHud.call(this);
    return result;
  };

  const baseUpdateHud=proto.updateHud;
  proto.updateHud=function(...args){
    const result=baseUpdateHud.apply(this,args);
    if(U.score)U.score.textContent=fmt(this.score||0);
    refreshBestHud.call(this);
    return result;
  };

  // Keep cars in a lane evenly spaced, but make each lane meaningfully faster
  // or slower than the next one by 10-20% so traffic has more personality.
  const baseBuildTraffic=proto.buildTraffic;
  proto.buildTraffic=function(row){
    baseBuildTraffic.call(this,row);
    const magnitude=.10+(this.rng?.()??Math.random())*.10;
    const direction=(this.rng?.()??Math.random())<.5?-1:1;
    const factor=1+direction*magnitude;
    for(const vehicle of row.vehicles||[]){
      const meta=vehicle?.__traffic;
      if(!meta)continue;
      meta.vx*=factor;
      meta.speedFactor=factor;
    }
    row.trafficSpeedFactor=factor;
  };

  const baseShowResult=proto.showResult;
  proto.showResult=function(success,title,body,revenue){
    const priorBest=Number(this._startingBestScore)||0;
    const runScore=Number(this.score)||0;
    const newHigh=Boolean(success&&runScore>priorBest);
    const result=baseShowResult.call(this,success,title,body,revenue);
    const {banner}=ensureHighScoreUi();

    if(U.stats&&!U.stats.querySelector('[data-best-score]')){
      const stat=document.createElement('div');
      stat.className='modal-stat';
      stat.dataset.bestScore='1';
      stat.innerHTML=`<span>HIGH SCORE</span><b>${fmt(Math.max(currentBest.call(this),runScore&&success?runScore:0))}</b>`;
      U.stats.appendChild(stat);
    }
    if(U.stats)U.stats.classList.add('has-high-score');

    if(banner){
      banner.hidden=!newHigh;
      banner.textContent=newHigh?`NEW HIGH SCORE! ${fmt(runScore)}`:'';
    }
    if(!success&&U.hint)U.hint.textContent='The result appears about 1.5 seconds after the hit.';
    if(newHigh)refreshBestHud.call(this);
    return result;
  };

  ensureHighScoreUi();
})();
