(() => {
  const S=window.SS, P=S.PALETTE, U=S.ui, proto=window.SushiScene.prototype;

  proto.syncSoundButton=function(){
    if(!U.sound)return;
    const on=this.save?.soundEnabled!==false;
    U.sound.classList.toggle('muted',!on);
    U.sound.setAttribute('aria-pressed',String(on));
    U.sound.setAttribute('aria-label',on?'Turn sound off':'Turn sound on');
    const img=U.sound.querySelector('img');
    if(img){img.src=on?'images/icons/volume-on.svg':'images/icons/volume-off.svg';img.alt='';}
  };

  const addSupport=(scene,row,obj,meta)=>{
    obj.__float=meta;
    row.floaters.push(obj);
    scene.floaters.push(obj);
    scene.track(obj);
    return obj;
  };

  const buildPads=(scene,row)=>{
    const wide=S.W>=900;
    const padCount=wide?5:4;
    const minCol=1,maxCol=Math.max(1,S.COLS-2);
    const fractions=wide?[.12,.31,.5,.69,.88]:[.15,.38,.62,.85];
    const cols=[];

    fractions.forEach((fraction,i)=>{
      let col=Math.round(minCol+fraction*(maxCol-minCol));
      if(i%2===1)col+=row.index%2===0?1:-1;
      col=S.clamp(col,minCol,maxCol);
      let guard=0;
      while(cols.some(c=>Math.abs(c-col)<2)&&guard++<24){
        const delta=guard%2?1:-1;
        col=S.clamp(col+delta,minCol,maxCol);
      }
      if(cols.some(c=>Math.abs(c-col)<2)){
        for(let candidate=minCol;candidate<=maxCol;candidate++){
          if(!cols.some(c=>Math.abs(c-candidate)<2)){col=candidate;break;}
        }
      }
      cols.push(col);

      const w=S.clamp(S.CELL_W*1.18,50,94);
      const pad=scene.createFloater(scene.colX(col),row.y-2,w,'lily',1);
      addSupport(scene,row,pad,{vx:0,width:w,hitWidth:w*.86,kind:'lily',stationary:true,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W});
    });
    row.stationaryPadCols=cols;
  };

  const createSimpleBoat=(scene,x,y,w,dir)=>{
    const c=scene.add.container(x,y).setDepth(39),g=scene.add.graphics();
    c.add(g);
    g.fillStyle(P.shadow,.2);g.fillEllipse(8,13,w*.78,S.clamp(S.ROW_H*.18,10,15));
    const hull=0x4b86a8;
    scene.drawBox(g,0,5,w*.9,S.ROW_H*.25,Math.max(4,S.VOXEL_DEPTH-1),hull,{shadow:false,top:S.lighten(hull,10),front:S.darken(hull,16),right:S.darken(hull,28)});
    const rear=dir>0?-1:1,cabinX=rear*w*.2;
    scene.drawBox(g,cabinX,-8,w*.3,S.ROW_H*.27,4,P.cabin,{shadow:false,front:0xd7e5e7,right:0xa0b2bc});
    g.fillStyle(P.black,.95);g.fillRect(cabinX-w*.09,-13,w*.07,7);g.fillRect(cabinX+w*.01,-13,w*.07,7);
    return c;
  };

  const buildMovingSupports=(scene,row)=>{
    const wide=S.W>=900;
    const dir=scene.rng()>.5?1:-1;
    const speed=(30+scene.selectedLevel*1.1+Math.floor(scene.rng()*9))*dir;
    const supportW=S.clamp(S.CELL_W*1.9,84,136);
    const gap=S.clamp(S.CELL_W*.72,34,58);
    const offscreen=supportW+gap;
    const cycleStart=S.PLAY_X-offscreen;
    const cycleLength=S.PLAY_W+offscreen*2;

    let count=Math.max(wide?6:4,Math.floor(cycleLength/(supportW+gap)));
    while(count>3&&cycleLength/count<supportW+gap*.6)count--;
    const spacing=cycleLength/count;
    const actualW=Math.min(supportW,Math.max(62,spacing-gap));
    const phase=scene.rng()*Math.min(gap*.4,16);

    for(let i=0;i<count;i++){
      const boat=(i+row.index+scene.selectedLevel)%5===2;
      const w=boat?Math.min(actualW*1.04,spacing-gap):actualW;
      const x=cycleStart+phase+i*spacing;
      const obj=boat?createSimpleBoat(scene,x,row.y-2,w,dir):scene.createFloater(x,row.y-2,w,'log',dir);
      addSupport(scene,row,obj,{vx:speed,width:w,hitWidth:w*(boat?.78:.84),kind:boat?'generatedBoat':'log',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength});
    }

    if(!row.floaters.length){
      const fallback=wide?5:3;
      for(let i=0;i<fallback;i++){
        const w=S.clamp(S.CELL_W*1.75,78,126),x=S.PLAY_X+S.PLAY_W*(i+.5)/fallback;
        const log=scene.createFloater(x,row.y-2,w,'log',dir);
        addSupport(scene,row,log,{vx:speed,width:w,hitWidth:w*.84,kind:'log',stationary:false,left:S.PLAY_X,right:S.PLAY_X+S.PLAY_W,cycleStart,cycleLength});
      }
    }
  };

  // The final row of every river section is always a stationary-pad lane.
  // A one-row stream is therefore also pads-only and can never be empty.
  proto.buildFloaters=function(row){
    const nextIsWater=this.rows[row.index+1]?.type==='water';
    if(!nextIsWater)buildPads(this,row);
    else buildMovingSupports(this,row);
  };

  proto.findSupportAt=function(rowIndex,x){
    const row=this.rows[rowIndex];
    if(!row||row.type!=='water')return null;
    return row.floaters.find(obj=>{
      if(!obj?.active||obj.visible===false||!obj.__float)return false;
      const hitWidth=obj.__float.hitWidth||obj.__float.width*.82;
      return Math.abs(x-obj.x)<=hitWidth*.5;
    })||null;
  };

  // Normalize every Sushi Master by height rather than width.
  proto.spawnPlayer=function(){
    this.playerRow=0;this.playerCol=S.START_COL;
    const c=this.add.container(this.colX(S.START_COL),this.rowY(0)).setDepth(82),shadow=this.add.graphics();
    shadow.fillStyle(P.shadow,.3);shadow.fillEllipse(12,22,S.clamp(S.CELL_W*.92,40,62),S.clamp(S.ROW_H*.18,11,16));c.add(shadow);
    const art=this.add.container(0,-7),chef=S.CHEFS.find(ch=>ch.id===(this.save?.selectedChef||S.CHEFS[0].id)),runKey=`chef-run-${chef?.id||S.CHEFS[0].id}`;

    if(chef&&this.textures.exists(runKey)){
      const img=this.add.image(0,20,runKey);
      const targetHeight=S.clamp(S.ROW_H*1.48,82,98);
      img.setOrigin(.5,1).setScale(targetHeight/Math.max(1,img.height));
      art.add(img);
    }else{
      const g=this.add.graphics(),s=S.clamp(S.CELL_W*.64,28,40);art.add(g);
      this.drawBox(g,-s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});this.drawBox(g,s*.18,14,s*.28,s*.24,3,0x5e4238,{shadow:false});
      this.drawBox(g,0,2,s*.62,s*.65,5,P.cabin,{shadow:false,front:0xe1e5ee,right:0xb8b7ce});this.drawBox(g,0,-13,s*.52,s*.42,4,0xffd8b0,{shadow:false,front:0xe3ac89,right:0xc88d72});this.drawBox(g,0,-34,s*.72,s*.3,5,P.cabin,{shadow:false,front:0xdedfed,right:0xaaa8c2});
    }
    c.add(art);this.player=this.track(c);this.playerArt=art;this.playerShadow=shadow;this.playerSupport=null;this.playerSupportOffsetX=0;
  };
})();