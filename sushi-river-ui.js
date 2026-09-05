(() => {
  const S=window.SS, P=S.PALETTE, U=S.ui, proto=window.SushiScene.prototype;
  const BOAT_FILES=[1];

  const basePreload=proto.preload;
  proto.preload=function(){
    basePreload.call(this);
    BOAT_FILES.forEach(n=>this.load.image(`river-boat-${n}`,`images/boats/${n}.png`));
  };

  proto.syncSoundButton=function(){
    if(!U.sound)return;
    const on=this.save?.soundEnabled!==false;
    U.sound.classList.toggle('muted',!on);
    U.sound.setAttribute('aria-pressed',String(on));
    U.sound.setAttribute('aria-label',on?'Turn sound off':'Turn sound on');
    const img=U.sound.querySelector('img');
    if(img){
      img.src=on?'images/icons/volume-on.svg':'images/icons/volume-off.svg';
      img.alt='';
    }
  };

  proto.buildFloaters=function(r){
    const wide=S.W>=900;
    const previousWater=this.rows[r.index-1]?.type==='water';

    if(previousWater){
      const padCount=wide?4:3;
      const cols=[];
      const minCol=1,maxCol=Math.max(minCol,S.COLS-2);
      const span=Math.max(1,maxCol-minCol);
      for(let i=0;i<padCount;i++){
        const base=minCol+Math.round((i+.5)*span/padCount);
        const jitter=Math.floor(this.rng()*3)-1;
        let col=S.clamp(base+jitter,minCol,maxCol),guard=0;
        while(cols.some(c=>Math.abs(c-col)<2)&&guard++<20){
          col=S.clamp(col+(guard%2?1:-1),minCol,maxCol);
        }
        if(cols.some(c=>Math.abs(c-col)<2)){
          for(let candidate=minCol;candidate<=maxCol;candidate++){
            if(!cols.some(c=>Math.abs(c-candidate)<2)){col=candidate;break;}
          }
        }
        cols.push(col);
        const w=S.clamp(S.CELL_W*1.12,46,88);
        const f=this.createFloater(this.colX(col),r.y-2,w,'lily');
        f.__float={vx:0,pad:0,width:w,hitWidth:w*.82,kind:'lily',left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,stationary:true};
        r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
      r.stationaryPadCols=cols;
      return;
    }

    const dir=this.rng()>.5?1:-1;
    const speed=(29+this.selectedLevel*1.25+Math.floor(this.rng()*12))*dir;
    const supportW=S.clamp(S.CELL_W*2.45,108,198);
    const sidePad=supportW*.65;
    const cycleStart=S.PLAY_X-sidePad;
    const cycleLength=S.PLAY_W+sidePad*2;
    const maxSpacing=supportW*.93;
    const count=Math.max(wide?6:4,Math.ceil(cycleLength/maxSpacing));
    const spacing=cycleLength/count;
    const phase=this.rng()*Math.min(spacing*.4,28);

    for(let i=0;i<count;i++){
      const useBoat=(i+this.selectedLevel+r.index)%2===0 && BOAT_FILES.length>0;
      const kind=useBoat?'imageBoat':'log';
      const w=useBoat?Math.min(S.CELL_W*2.9,supportW*1.08):supportW;
      const x=cycleStart+phase+i*spacing;
      const f=this.createFloater(x,r.y-2,w,kind,dir);
      f.__float={vx:speed,pad:w*.55,width:w,hitWidth:w*(useBoat ? .76 : .84),kind,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength,stationary:false};
      r.floaters.push(f);this.floaters.push(f);this.track(f);
    }

    if(!r.floaters.length){
      const fallbackCount=wide?3:2;
      for(let i=0;i<fallbackCount;i++){
        const x=S.PLAY_X+S.PLAY_W*(i+1)/(fallbackCount+1),w=S.clamp(S.CELL_W*2.35,104,184);
        const f=this.createFloater(x,r.y-2,w,'log',dir);
        f.__float={vx:speed,pad:w*.5,width:w,hitWidth:w*.84,kind:'log',left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength,stationary:false};
        r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
    }
  };

  const baseCreateFloater=proto.createFloater;
  proto.createFloater=function(x,y,w,kind,dir=1){
    if(kind!=='imageBoat')return baseCreateFloater.call(this,x,y,w,kind);
    const key=`river-boat-${BOAT_FILES[Math.floor(this.rng()*BOAT_FILES.length)]}`;
    if(!this.textures.exists(key))return baseCreateFloater.call(this,x,y,w,'boat');
    const c=this.add.container(x,y).setDepth(39);
    const shadow=this.add.ellipse(9,13,w*.72,S.clamp(S.ROW_H*.2,11,16),P.shadow,.2);
    const img=this.add.image(0,0,key),scale=w/Math.max(1,img.width);
    img.setScale(scale).setOrigin(.5,.6).setFlipX(dir<0);
    c.add([shadow,img]);
    return c;
  };

  proto.findSupportAt=function(row,x){
    const lane=this.rows[row];
    if(!lane||lane.type!=='water')return null;
    return lane.floaters.find(f=>{
      if(!f?.active||f.visible===false)return false;
      const meta=f.__float;if(!meta)return false;
      const hitWidth=meta.hitWidth||meta.width*.82;
      return Math.abs(x-f.x)<=hitWidth*.5;
    })||null;
  };
})();