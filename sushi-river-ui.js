(() => {
  const S=window.SS, P=S.PALETTE, U=S.ui, proto=window.SushiScene.prototype;

  // Keep HUD icons local/offline. River boats are generated in Phaser now;
  // we intentionally do not depend on images/boats for playability.
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

  // River invariant:
  // 1) every water row always has usable supports;
  // 2) moving supports are evenly spaced with a real gap between them;
  // 3) second water rows use stationary pads;
  // 4) raw water is never a valid landing surface.
  proto.buildFloaters=function(r){
    const wide=S.W>=900;
    const previousWater=this.rows[r.index-1]?.type==='water';

    // Second row of a river: stationary pads, deliberately spread apart.
    if(previousWater){
      const padCount=wide?4:3;
      const cols=[];
      const minCol=1, maxCol=Math.max(minCol,S.COLS-2);
      const span=Math.max(1,maxCol-minCol);

      for(let i=0;i<padCount;i++){
        const target=minCol+Math.round(((i+1)/(padCount+1))*span);
        const jitter=Math.floor(this.rng()*3)-1;
        let col=S.clamp(target+jitter,minCol,maxCol);
        let guard=0;
        while(cols.some(c=>Math.abs(c-col)<2)&&guard++<40){
          const step=(guard%2?1:-1)*Math.ceil(guard/2);
          col=S.clamp(target+step,minCol,maxCol);
        }
        if(cols.some(c=>Math.abs(c-col)<2)){
          for(let candidate=minCol;candidate<=maxCol;candidate++){
            if(!cols.some(c=>Math.abs(c-candidate)<2)){col=candidate;break;}
          }
        }
        cols.push(col);

        const w=S.clamp(S.CELL_W*1.12,46,88);
        const f=this.createFloater(this.colX(col),r.y-2,w,'lily',1);
        f.__float={
          vx:0,pad:0,width:w,hitWidth:w*.84,kind:'lily',
          left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,stationary:true
        };
        r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
      r.stationaryPadCols=cols;
      return;
    }

    // First/single water row: independent moving logs with occasional generated boats.
    const dir=this.rng()>.5?1:-1;
    const speed=(27+this.selectedLevel*1.15+Math.floor(this.rng()*10))*dir;
    const logW=S.clamp(S.CELL_W*1.72,68,118);
    const minGap=S.clamp(S.CELL_W*.58,24,44);
    const sidePad=logW*.62+minGap;
    const cycleStart=S.PLAY_X-sidePad;
    const cycleLength=S.PLAY_W+sidePad*2;

    // floor() is intentional: spacing can only get larger than logW + minGap,
    // never smaller, so supports cannot visually fuse into one long platform.
    const maxBySpacing=Math.max(3,Math.floor(cycleLength/(logW+minGap)));
    const count=Math.max(wide?5:4,maxBySpacing);
    const spacing=cycleLength/count;

    // Safety: if the viewport is unusually narrow, shrink the support rather than overlap it.
    const actualW=Math.min(logW,Math.max(50,spacing-minGap));
    const phase=this.rng()*Math.min(minGap*.6,18);

    for(let i=0;i<count;i++){
      const useBoat=(i%4===2); // generated boat, no external boat image required
      const kind=useBoat?'boat':'log';
      const w=useBoat?Math.min(actualW*1.16,spacing-minGap):actualW;
      const x=cycleStart+phase+i*spacing;
      const f=this.createFloater(x,r.y-2,w,kind,dir);
      f.__float={
        vx:speed,pad:w*.5,width:w,hitWidth:w*(useBoat?.78:.86),kind,
        left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,
        cycleStart,cycleLength,stationary:false
      };
      r.floaters.push(f);this.floaters.push(f);this.track(f);
    }

    // Absolute fallback. A water row is never allowed to exist with no supports.
    if(!r.floaters.length){
      const fallbackCount=wide?4:3;
      for(let i=0;i<fallbackCount;i++){
        const w=S.clamp(S.CELL_W*1.6,64,104);
        const x=S.PLAY_X+S.PLAY_W*(i+1)/(fallbackCount+1);
        const f=this.createFloater(x,r.y-2,w,'log',dir);
        f.__float={
          vx:speed,pad:w*.5,width:w,hitWidth:w*.86,kind:'log',
          left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,
          cycleStart,cycleLength,stationary:false
        };
        r.floaters.push(f);this.floaters.push(f);this.track(f);
      }
    }
  };

  const baseCreateFloater=proto.createFloater;
  proto.createFloater=function(x,y,w,kind,dir=1){
    if(kind!=='boat')return baseCreateFloater.call(this,x,y,w,kind);

    // Simple generated fishing boat: low hull + raised box at the rear.
    const c=this.add.container(x,y).setDepth(39);
    const g=this.add.graphics();
    const rear=-Math.sign(dir||1);
    c.add(g);

    g.fillStyle(P.shadow,.2);
    g.fillEllipse(8,13,w*.76,S.clamp(S.ROW_H*.2,11,16));

    const hull=0x4b8eaa;
    this.drawBox(g,0,5,w*.9,S.ROW_H*.27,Math.max(4,S.VOXEL_DEPTH-1),hull,{
      shadow:false,
      top:S.lighten(hull,9),
      front:S.darken(hull,16),
      right:S.darken(hull,28)
    });

    const rearBoxX=rear*w*.22;
    this.drawBox(g,rearBoxX,-7,w*.32,S.ROW_H*.28,4,P.cabin,{
      shadow:false,
      top:P.cabin,
      front:0xd4e4e7,
      right:0xa4b5bd
    });

    g.fillStyle(P.black,1);
    g.fillRect(rearBoxX-w*.1,-12,w*.08,7);
    g.fillRect(rearBoxX+w*.02,-12,w*.08,7);
    g.fillStyle(0xe7654f,1);
    g.fillRect(-rear*w*.22,-1,w*.13,5);

    return c;
  };

  proto.findSupportAt=function(row,x){
    const lane=this.rows[row];
    if(!lane||lane.type!=='water')return null;
    return lane.floaters.find(f=>{
      if(!f?.active||f.visible===false)return false;
      const meta=f.__float;
      if(!meta)return false;
      const hitWidth=meta.hitWidth||meta.width*.82;
      return Math.abs(x-f.x)<=hitWidth*.5;
    })||null;
  };
})();